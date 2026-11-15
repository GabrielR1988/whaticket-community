import { createHash } from "crypto";
import { logger } from "../../utils/logger";
import Ticket from "../../models/Ticket";
import Contact from "../../models/Contact";
import Tag from "../../models/Tag";

// Integracion WhaTicket -> Meta Conversions API (CAPI).
// Cuando a un ticket se le AGREGA una etiqueta configurada (por defecto "Contacto" y "Venta"),
// se envia un evento al dataset (pixel) de Meta para que las campañas lo usen como conversion.
//
// - Sin META_DATASET_ID / META_ACCESS_TOKEN funciona en modo "dry run": solo loguea el payload.
// - Con META_TEST_EVENT_CODE los eventos caen en "Probar eventos" del Administrador de eventos
//   (no cuentan para las campañas). Quitarlo para pasar a produccion.
// - Si el contacto llego por un anuncio Click-to-WhatsApp y se capturo su ctwa_clid, y hay
//   META_WABA_ID, el evento sale como "business_messaging" (atribucion exacta al anuncio).
//   Si no, sale como "chat" con el telefono hasheado (Meta lo matchea con el usuario).

const DATASET_ID = (process.env.META_DATASET_ID || "").trim();
const ACCESS_TOKEN = (process.env.META_ACCESS_TOKEN || "").trim();
const API_VERSION = (process.env.META_API_VERSION || "v24.0").trim();
const TEST_EVENT_CODE = (process.env.META_TEST_EVENT_CODE || "").trim();
const WABA_ID = (process.env.META_WABA_ID || "").trim();
const CURRENCY = (process.env.META_CURRENCY || "CLP").trim().toUpperCase();
const PURCHASE_VALUE = Number(process.env.META_PURCHASE_VALUE || 0);
const COUNTRY = (process.env.META_COUNTRY || "cl").trim().toLowerCase();

export const isMetaEnabled = Boolean(DATASET_ID && ACCESS_TOKEN);

const normalize = (text: string): string =>
  text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

// "etiqueta:Evento,etiqueta:Evento" -> { etiqueta: Evento }
const TAG_EVENTS: Record<string, string> = {};
(process.env.META_TAG_EVENTS || "contacto:Lead,venta:Purchase")
  .split(",")
  .map(pair => pair.split(":").map(s => s.trim()))
  .filter(([tag, event]) => tag && event)
  .forEach(([tag, event]) => {
    TAG_EVENTS[normalize(tag)] = event;
  });

// En business_messaging Meta usa nombres propios para algunos eventos estandar.
const BUSINESS_MESSAGING_NAMES: Record<string, string> = {
  Lead: "LeadSubmitted"
};

const sha256 = (value: string): string =>
  createHash("sha256").update(value).digest("hex");

const postEvent = async (event: Record<string, unknown>): Promise<void> => {
  const body: Record<string, unknown> = { data: [event] };
  if (TEST_EVENT_CODE) body.test_event_code = TEST_EVENT_CODE;

  if (!isMetaEnabled) {
    logger.info(
      `Meta CAPI (dry run, faltan credenciales): ${JSON.stringify(body)}`
    );
    return;
  }

  const res = await fetch(
    `https://graph.facebook.com/${API_VERSION}/${DATASET_ID}/events?access_token=${encodeURIComponent(
      ACCESS_TOKEN
    )}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    }
  );
  const text = await res.text();
  if (!res.ok) throw new Error(`Meta CAPI ${res.status}: ${text}`);
  logger.info(`Meta CAPI ok (${event.event_name}, ${event.event_id}): ${text}`);
};

const buildEvent = (
  ticket: Ticket,
  contact: Contact,
  tag: Tag,
  eventName: string
): Record<string, unknown> => {
  const phone = (contact.number || "").replace(/\D/g, "");
  const userData: Record<string, unknown> = {
    country: [sha256(COUNTRY)],
    external_id: [sha256(`wt-contact-${contact.id}`)]
  };
  if (phone) userData.ph = [sha256(phone)];

  const useBusinessMessaging = Boolean(contact.ctwaClid && WABA_ID);
  if (useBusinessMessaging) {
    userData.ctwa_clid = contact.ctwaClid;
    userData.whatsapp_business_account_id = WABA_ID;
  }

  const event: Record<string, unknown> = {
    event_name: useBusinessMessaging
      ? BUSINESS_MESSAGING_NAMES[eventName] || eventName
      : eventName,
    event_time: Math.floor(Date.now() / 1000),
    // Mismo ticket + misma etiqueta = mismo id: Meta deduplica si se quita y se vuelve a poner.
    event_id: `wt-ticket${ticket.id}-tag${tag.id}`,
    action_source: useBusinessMessaging ? "business_messaging" : "chat",
    user_data: userData
  };
  if (useBusinessMessaging) event.messaging_channel = "whatsapp";

  if (eventName === "Purchase") {
    event.custom_data = { currency: CURRENCY, value: PURCHASE_VALUE };
  }

  return event;
};

// Se llama con las etiquetas que se acaban de AGREGAR a un ticket (no las que ya tenia).
const SendMetaConversionService = async (
  ticketId: number,
  addedTagIds: number[]
): Promise<void> => {
  if (!addedTagIds.length) return;

  try {
    const tags = await Tag.findAll({ where: { id: addedTagIds } });
    const toSend = tags
      .map(tag => ({ tag, eventName: TAG_EVENTS[normalize(tag.name)] }))
      .filter(({ eventName }) => Boolean(eventName));
    if (!toSend.length) return;

    const ticket = await Ticket.findByPk(ticketId, { include: [Contact] });
    if (!ticket?.contact || ticket.contact.isGroup) return;

    const { contact } = ticket;
    await Promise.all(
      toSend.map(({ tag, eventName }) =>
        postEvent(buildEvent(ticket, contact, tag, eventName)).catch(err =>
          logger.error(
            `Meta CAPI: error enviando ${eventName} del ticket ${ticketId}: ${err}`
          )
        )
      )
    );
  } catch (err) {
    logger.error(
      `Meta CAPI: error preparando eventos del ticket ${ticketId}: ${err}`
    );
  }
};

export default SendMetaConversionService;
