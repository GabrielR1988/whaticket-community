import { createHmac, timingSafeEqual } from "crypto";
import { Request, Response } from "express";
import { getIO } from "../libs/socket";
import { logger } from "../utils/logger";
import { META_APP_SECRET, META_WEBHOOK_VERIFY_TOKEN } from "../libs/metaGraph";
import CreateOrUpdateContactService from "../services/ContactServices/CreateOrUpdateContactService";
import { handleMessageAck } from "../handlers/handleWhatsappEvents";

// Webhook de la WhatsApp Cloud API (numero en coexistencia).
// Los chats se siguen manejando por WhatsApp Web (wwebjs); de aca solo se usa:
// - messages[].referral.ctwa_clid: click ID del anuncio Click-to-WhatsApp -> Contact.ctwaClid
// - statuses[]: ticks (enviado/entregado/leido) de las plantillas enviadas por la API
// - message_template_status_update: aprobacion/rechazo de plantillas -> aviso al frontend

// GET: verificacion que hace Meta al configurar el webhook.
export const verify = (req: Request, res: Response): Response => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (
    mode === "subscribe" &&
    META_WEBHOOK_VERIFY_TOKEN &&
    token === META_WEBHOOK_VERIFY_TOKEN
  ) {
    return res.status(200).send(String(challenge));
  }
  return res.sendStatus(403);
};

const isValidSignature = (req: Request): boolean => {
  if (!META_APP_SECRET) {
    logger.warn("Meta webhook: falta META_APP_SECRET, no se valida la firma");
    return true;
  }
  const header = String(req.headers["x-hub-signature-256"] || "");
  const { rawBody } = req as any;
  if (!header.startsWith("sha256=") || !rawBody) return false;

  const expected = createHmac("sha256", META_APP_SECRET)
    .update(rawBody)
    .digest("hex");
  const received = header.slice("sha256=".length);
  return (
    expected.length === received.length &&
    timingSafeEqual(Buffer.from(expected), Buffer.from(received))
  );
};

const STATUS_ACK: Record<string, 1 | 2 | 3> = {
  sent: 1,
  delivered: 2,
  read: 3
};

const handleMessagesChange = async (value: any): Promise<void> => {
  const profiles: Record<string, string> = {};
  (value.contacts || []).forEach((c: any) => {
    if (c.wa_id) profiles[c.wa_id] = c.profile?.name || "";
  });

  await Promise.all(
    (value.messages || [])
      .filter((msg: any) => msg.referral?.ctwa_clid && msg.from)
      .map(async (msg: any) => {
        const number = String(msg.from).replace(/\D/g, "");
        const contact = await CreateOrUpdateContactService({
          name: profiles[msg.from] || number,
          number,
          isGroup: false
        });
        await contact.update({ ctwaClid: msg.referral.ctwa_clid });
        logger.info(
          `Meta webhook: ctwa_clid guardado para el contacto ${
            contact.id
          } (anuncio ${msg.referral.source_id || "?"})`
        );
      })
  );

  await Promise.all(
    (value.statuses || [])
      .filter((st: any) => STATUS_ACK[st.status])
      .map((st: any) => handleMessageAck(st.id, STATUS_ACK[st.status]))
  );

  (value.statuses || [])
    .filter((st: any) => st.status === "failed")
    .forEach((st: any) =>
      logger.error(
        `Meta webhook: fallo el envio ${st.id}: ${JSON.stringify(st.errors)}`
      )
    );
};

// POST: notificaciones. Se responde 200 enseguida (Meta reintenta si tarda) y se procesa despues.
export const receive = (req: Request, res: Response): Response => {
  if (!isValidSignature(req)) {
    logger.warn("Meta webhook: firma invalida, se descarta");
    return res.sendStatus(401);
  }

  const entries: any[] = req.body?.entry || [];
  setImmediate(async () => {
    try {
      await Promise.all(
        entries
          .reduce(
            (all: any[], entry: any) => all.concat(entry.changes || []),
            []
          )
          .map(async (change: any) => {
            if (change.field === "messages") {
              await handleMessagesChange(change.value || {});
            } else if (change.field === "message_template_status_update") {
              const v = change.value || {};
              logger.info(
                `Meta webhook: plantilla ${v.message_template_name} -> ${
                  v.event
                } ${v.reason || ""}`
              );
              getIO().emit("metaTemplate", {
                action: "status",
                name: v.message_template_name,
                status: v.event,
                reason: v.reason
              });
            }
          })
      );
    } catch (err) {
      logger.error(`Meta webhook: error procesando notificacion: ${err}`);
    }
  });

  return res.sendStatus(200);
};
