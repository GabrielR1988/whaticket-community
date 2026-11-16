import { Request, Response } from "express";
import AppError from "../errors/AppError";
import ShowTicketService from "../services/TicketServices/ShowTicketService";
import { logger } from "../utils/logger";

// Botón "Bot" de cada conversación: consulta y cambia si el bot de IA atiende ese
// contacto. El estado vive en el servicio del bot; WhaTicket solo hace de intermediario.
const BOT_URL = (
  process.env.BOT_URL ||
  (process.env.BOT_WEBHOOK_URL || "").replace(/\/webhook\/?$/, "")
).replace(/\/+$/, "");
const BOT_WEBHOOK_SECRET = process.env.BOT_WEBHOOK_SECRET || "";

const botRequest = async (method: string, path: string, body?: unknown) => {
  const res = await fetch(`${BOT_URL}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${BOT_WEBHOOK_SECRET}`
    },
    body: body ? JSON.stringify(body) : undefined
  });
  if (!res.ok) throw new Error(`Bot IA ${method} ${path}: ${res.status}`);
  return res.json();
};

const contactOf = async (ticketId: string) => {
  const ticket = await ShowTicketService(ticketId);
  // Nunca para grupos.
  if (ticket.isGroup || !/^\d{8,15}$/.test(ticket.contact?.number || "")) {
    return null;
  }
  return ticket.contact.number;
};

export const show = async (req: Request, res: Response): Promise<Response> => {
  if (!BOT_URL) return res.json({ disponible: false });
  const number = await contactOf(req.params.ticketId);
  if (!number) return res.json({ disponible: false });

  try {
    const estado = await botRequest("GET", `/control/${number}`);
    return res.json({ disponible: true, ...estado });
  } catch (err) {
    logger.warn(`${err}`);
    return res.json({ disponible: false, error: "El bot no responde" });
  }
};

export const update = async (
  req: Request,
  res: Response
): Promise<Response> => {
  if (!BOT_URL) throw new AppError("El bot de IA no está configurado", 400);
  const number = await contactOf(req.params.ticketId);
  if (!number) throw new AppError("El bot no se usa en grupos", 400);

  const activo = Boolean(req.body?.activo);
  try {
    const estado = await botRequest("POST", `/control/${number}`, {
      activo,
      usuario: req.user?.id
    });
    return res.json({ disponible: true, ...estado });
  } catch (err) {
    logger.warn(`${err}`);
    throw new AppError("No se pudo cambiar el estado del bot", 502);
  }
};
