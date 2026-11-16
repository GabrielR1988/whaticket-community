import { Request, Response } from "express";
import * as Yup from "yup";
import AppError from "../errors/AppError";
import ShowTicketService from "../services/TicketServices/ShowTicketService";
import SendWhatsAppMessage from "../services/WbotServices/SendWhatsAppMessage";
import SyncWhatsappToEspoService from "../services/EspoServices/SyncWhatsappToEspoService";

// Envío de mensajes del bot de IA dentro de un ticket existente.
// Usa el mismo token de API que /api/messages/send.
export const send = async (req: Request, res: Response): Promise<Response> => {
  const schema = Yup.object().shape({
    ticketId: Yup.number().required(),
    body: Yup.string().required(),
    crearOportunidad: Yup.boolean()
  });

  try {
    await schema.validate(req.body);
  } catch (err: any) {
    throw new AppError(err.message);
  }

  const { ticketId, body, crearOportunidad } = req.body as {
    ticketId: number;
    body: string;
    crearOportunidad?: boolean;
  };
  const ticket = await ShowTicketService(ticketId);

  // El bot nunca escribe en grupos.
  if (ticket.isGroup) {
    throw new AppError("El bot no puede escribir en grupos", 400);
  }

  const sent = await SendWhatsAppMessage({ body, ticket });

  if (crearOportunidad) {
    SyncWhatsappToEspoService({
      number: ticket.contact.number,
      name: ticket.contact.name,
      body,
      forceOpportunity: true
    });
  }

  return res.status(201).json({ id: sent?.id });
};
