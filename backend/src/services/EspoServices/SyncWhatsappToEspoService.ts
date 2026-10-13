import { addDays, format } from "date-fns";
import { logger } from "../../utils/logger";

// Integracion WhaTicket -> EspoCRM (por API REST, con API key de un usuario API de Espo).
// - Mensaje que contiene la frase de contacto (saludo del bot): crea el Contact.
// - Mensaje que contiene la frase de oportunidad (derivacion del bot): crea la Opportunity
//   (y el Contact si faltaba), salvo que ya haya una abierta.
// Se desactiva sola si faltan ESPO_URL / ESPO_API_KEY.

const ESPO_URL = (process.env.ESPO_URL || "")
  .trim()
  .replace(/^(?!https?:\/\/)(?=.)/, "https://")
  .replace(/\/+$/, "");
const ESPO_API_KEY = process.env.ESPO_API_KEY || "";
const STAGE = process.env.ESPO_OPPORTUNITY_STAGE || "Prospecting";
const CLOSED_STAGES = (process.env.ESPO_CLOSED_STAGES || "Closed Won,Closed Lost")
  .split(",")
  .map(s => s.trim())
  .filter(Boolean);
const CLOSE_DAYS = Number(process.env.ESPO_OPPORTUNITY_CLOSE_DAYS || 30);
const ASSIGNED_USER_ID = process.env.ESPO_ASSIGNED_USER_ID || "";

const normalize = (text: string): string =>
  text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

// Varias frases separadas por "|". Basta con que el mensaje CONTENGA alguna;
// se compara sin mayusculas, tildes ni espacios extra.
const parsePhrases = (value: string): string[] =>
  value.split("|").map(normalize).filter(Boolean);

const CONTACT_PHRASES = parsePhrases(
  process.env.ESPO_CONTACT_PHRASES || "Soy Rodrigo Garrido"
);
const OPPORTUNITY_PHRASES = parsePhrases(
  process.env.ESPO_OPPORTUNITY_PHRASES || "me contacto a la brevedad"
);

export const isEspoEnabled = Boolean(ESPO_URL && ESPO_API_KEY);

export interface AdReferral {
  title?: string;
  body?: string;
  sourceUrl?: string;
  sourceId?: string;
}

interface SyncPayload {
  number: string;
  name: string;
  body: string;
  adReferral?: AdReferral;
}

interface EspoContact {
  id: string;
  name: string;
  cCampaniaOrigen?: string | null;
  cAnuncioUrl?: string | null;
}

const espoRequest = async (
  method: string,
  path: string,
  params?: Record<string, string>,
  body?: unknown
): Promise<any> => {
  const query = params ? `?${new URLSearchParams(params).toString()}` : "";
  const res = await fetch(`${ESPO_URL}/api/v1/${path}${query}`, {
    method,
    headers: {
      "X-Api-Key": ESPO_API_KEY,
      "Content-Type": "application/json",
      Accept: "application/json"
    },
    body: body ? JSON.stringify(body) : undefined
  });
  if (!res.ok) {
    throw new Error(
      `EspoCRM ${method} ${path}: ${res.status} ${await res.text()}`
    );
  }
  return res.json();
};

const findContact = async (number: string): Promise<EspoContact | null> => {
  const select = "id,name,cCampaniaOrigen,cAnuncioUrl";
  const byWhatsappId = await espoRequest("GET", "Contact", {
    select,
    maxSize: "1",
    "where[0][type]": "equals",
    "where[0][attribute]": "cWhatsappId",
    "where[0][value]": number
  });
  if (byWhatsappId.list?.length) return byWhatsappId.list[0];

  // Contacto cargado a mano por el vendedor: se busca por telefono y se le asigna el WhatsApp ID.
  const byPhone = await espoRequest("GET", "Contact", {
    select,
    maxSize: "1",
    "where[0][type]": "equals",
    "where[0][attribute]": "phoneNumber",
    "where[0][value]": `+${number}`
  });
  if (byPhone.list?.length) {
    const contact = byPhone.list[0];
    await espoRequest("PUT", `Contact/${contact.id}`, undefined, {
      cWhatsappId: number
    });
    return contact;
  }

  return null;
};

const createContact = async (
  number: string,
  name: string,
  adReferral?: AdReferral
): Promise<EspoContact> => {
  const contact = await espoRequest("POST", "Contact", undefined, {
    // Espo exige lastName; el nombre de perfil de WhatsApp va entero ahi.
    lastName: name || `+${number}`,
    phoneNumber: `+${number}`,
    cWhatsappId: number,
    cCampaniaOrigen: adReferral?.title || null,
    cAnuncioUrl: adReferral?.sourceUrl || null,
    description: "Creado automáticamente desde WhatsApp",
    ...(ASSIGNED_USER_ID && { assignedUserId: ASSIGNED_USER_ID })
  });
  logger.info(`EspoCRM: Contact creado ${contact.id} (+${number})`);
  // La respuesta del POST no trae "name" (es un campo calculado en Espo).
  return { ...contact, name: contact.name || name || `+${number}` };
};

const updateReferralIfMissing = async (
  contact: EspoContact,
  adReferral?: AdReferral
): Promise<void> => {
  if (!adReferral?.title || contact.cCampaniaOrigen) return;
  await espoRequest("PUT", `Contact/${contact.id}`, undefined, {
    cCampaniaOrigen: adReferral.title,
    cAnuncioUrl: adReferral.sourceUrl || null
  });
  contact.cCampaniaOrigen = adReferral.title;
  contact.cAnuncioUrl = adReferral.sourceUrl || null;
};

const hasOpenOpportunity = async (contactId: string): Promise<boolean> => {
  const params: Record<string, string> = {
    select: "id",
    maxSize: "1",
    "where[0][type]": "linkedWith",
    "where[0][attribute]": "contacts",
    "where[0][value][]": contactId
  };
  if (CLOSED_STAGES.length) {
    params["where[1][type]"] = "notIn";
    params["where[1][attribute]"] = "stage";
    CLOSED_STAGES.forEach((stage, i) => {
      params[`where[1][value][${i}]`] = stage;
    });
  }
  const res = await espoRequest("GET", "Opportunity", params);
  return res.total > 0 || Boolean(res.list?.length);
};

const createOpportunity = async (
  contact: EspoContact,
  number: string
): Promise<void> => {
  if (await hasOpenOpportunity(contact.id)) {
    logger.info(`EspoCRM: +${number} ya tiene una Opportunity abierta`);
    return;
  }

  const opportunity = await espoRequest("POST", "Opportunity", undefined, {
    name: `${contact.name} - WhatsApp`,
    stage: STAGE,
    amount: 0,
    closeDate: format(addDays(new Date(), CLOSE_DAYS), "yyyy-MM-dd"),
    leadSource: "WhatsApp",
    contactsIds: [contact.id],
    cCampaniaOrigen: contact.cCampaniaOrigen || null,
    cAnuncioUrl: contact.cAnuncioUrl || null,
    ...(ASSIGNED_USER_ID && { assignedUserId: ASSIGNED_USER_ID })
  });
  logger.info(`EspoCRM: Opportunity creada ${opportunity.id} (+${number})`);
};

// Cache numero -> Contact para no consultar Espo en cada mensaje.
const contactCache = new Map<string, EspoContact>();

const getOrCreateContact = async (
  number: string,
  name: string,
  adReferral?: AdReferral
): Promise<EspoContact> => {
  let contact = contactCache.get(number) || (await findContact(number));
  if (!contact) {
    contact = await createContact(number, name, adReferral);
  } else {
    await updateReferralIfMissing(contact, adReferral);
  }
  if (contactCache.size > 5000) contactCache.clear();
  contactCache.set(number, contact);
  return contact;
};

const containsPhrase = (body: string, phrases: string[]): boolean => {
  if (!phrases.length || !body) return false;
  const text = normalize(body);
  return phrases.some(phrase => text.includes(phrase));
};

// El anuncio viene en el primer mensaje del cliente, pero el Contact se crea despues
// (con el saludo del bot): se guarda aca hasta entonces.
const pendingReferrals = new Map<string, AdReferral>();

const sync = async ({ number, name, body, adReferral }: SyncPayload) => {
  if (adReferral) {
    if (pendingReferrals.size > 5000) pendingReferrals.clear();
    pendingReferrals.set(number, adReferral);
  }

  const isOpportunity = containsPhrase(body, OPPORTUNITY_PHRASES);
  if (!isOpportunity && !containsPhrase(body, CONTACT_PHRASES)) return;

  const contact = await getOrCreateContact(
    number,
    name,
    pendingReferrals.get(number)
  );
  pendingReferrals.delete(number);

  if (isOpportunity) {
    logger.info(`EspoCRM: frase de oportunidad detectada (+${number})`);
    await createOpportunity(contact, number);
  }
};

// Cola por numero: varios mensajes seguidos de un cliente nuevo no deben crear Contacts duplicados.
const queues = new Map<string, Promise<void>>();

const SyncWhatsappToEspoService = (payload: SyncPayload): void => {
  if (!isEspoEnabled) return;
  // Solo numeros de telefono reales (los grupos y los LID no aplican).
  if (!/^\d{8,15}$/.test(payload.number)) return;
  const previous = queues.get(payload.number) || Promise.resolve();
  const next = previous
    .then(() => sync(payload))
    .catch(err => {
      // Por si el Contact cacheado fue borrado en Espo.
      contactCache.delete(payload.number);
      logger.error(err, "EspoCRM: error sincronizando");
    })
    .then(() => {
      if (queues.get(payload.number) === next) queues.delete(payload.number);
    });
  queues.set(payload.number, next);
};

export default SyncWhatsappToEspoService;
