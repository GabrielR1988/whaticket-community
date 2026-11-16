import { logger } from "../../utils/logger";

// Avisa al bot de IA (servicio aparte en Railway) de cada mensaje de un chat
// individual, entrante o saliente. Si BOT_WEBHOOK_URL no está configurada no hace
// nada, y si el bot no responde WhaTicket sigue funcionando igual.
const BOT_WEBHOOK_URL = process.env.BOT_WEBHOOK_URL || "";
const BOT_WEBHOOK_SECRET = process.env.BOT_WEBHOOK_SECRET || "";

export interface BotNotification {
  ticketId: number;
  ticketStatus: string;
  ticketUserId: number | null;
  whatsappId: number;
  contact: { number: string; name: string };
  message: {
    id: string;
    body: string;
    fromMe: boolean;
    mediaType?: string;
    mediaFile?: string; // nombre del archivo en /public
    timestamp: number;
  };
}

const NotifyBotService = (payload: BotNotification): void => {
  if (!BOT_WEBHOOK_URL) return;

  fetch(BOT_WEBHOOK_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${BOT_WEBHOOK_SECRET}`
    },
    body: JSON.stringify(payload)
  })
    .then(res => {
      if (!res.ok) logger.warn(`Bot IA webhook respondió ${res.status}`);
    })
    .catch(err => logger.warn(`Bot IA webhook no disponible: ${err}`));
};

export default NotifyBotService;
