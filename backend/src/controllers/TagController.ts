import { Request, Response } from "express";
import {
  CreateTagService,
  ListTagsService,
  UpdateTagService,
  DeleteTagService,
  SyncTagsService
} from "../services/TagServices/TagServices";
import Tag from "../models/Tag";
import TicketTag from "../models/TicketTag";
import Ticket from "../models/Ticket";

export const index = async (req: Request, res: Response): Promise<Response> => {
  const tags = await ListTagsService();
  return res.json(tags);
};

export const store = async (req: Request, res: Response): Promise<Response> => {
  const { name, color } = req.body;
  const tag = await CreateTagService({ name, color });
  return res.status(201).json(tag);
};

export const update = async (req: Request, res: Response): Promise<Response> => {
  const { tagId } = req.params;
  const { name, color } = req.body;
  const tag = await UpdateTagService(Number(tagId), { name, color });
  return res.json(tag);
};

export const remove = async (req: Request, res: Response): Promise<Response> => {
  const { tagId } = req.params;
  await DeleteTagService(Number(tagId));
  return res.status(200).json({ message: "Tag deleted" });
};

export const sync = async (req: Request, res: Response): Promise<Response> => {
  const { ticketId } = req.params;
  const { tagIds } = req.body;
  await SyncTagsService(Number(ticketId), tagIds);
  return res.status(200).json({ message: "Tags synced" });
};

export const getByTicket = async (req: Request, res: Response): Promise<Response> => {
  const { ticketId } = req.params;
  
  const ticket = await Ticket.findByPk(ticketId, {
    include: [
      {
        model: Tag,
        as: "tags",
        through: { attributes: [] }
      }
    ]
  });

  if (!ticket) {
    return res.status(404).json({ error: "Ticket not found" });
  }

  return res.json((ticket as any).tags || []);
};
