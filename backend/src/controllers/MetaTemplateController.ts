import { Request, Response } from "express";
import AppError from "../errors/AppError";
import { isCloudApiEnabled, META_PHONE_NUMBER_ID } from "../libs/metaGraph";
import {
  CreateTemplateService,
  DeleteTemplateService,
  ListTemplatesService,
  SendTemplateService
} from "../services/MetaServices/WhatsappTemplateService";
import { getIO } from "../libs/socket";

const ensureAdmin = (req: Request): void => {
  if (req.user.profile !== "admin") {
    throw new AppError("ERR_NO_PERMISSION", 403);
  }
};

export const index = async (req: Request, res: Response): Promise<Response> => {
  if (!isCloudApiEnabled) {
    return res.json({ enabled: false, canSend: false, templates: [] });
  }
  const templates = await ListTemplatesService();
  return res.json({
    enabled: true,
    canSend: Boolean(META_PHONE_NUMBER_ID),
    templates
  });
};

export const store = async (req: Request, res: Response): Promise<Response> => {
  ensureAdmin(req);
  const result = await CreateTemplateService(req.body);
  getIO().emit("metaTemplate", { action: "create", name: req.body.name });
  return res.status(201).json(result);
};

export const remove = async (
  req: Request,
  res: Response
): Promise<Response> => {
  ensureAdmin(req);
  const { name } = req.params;
  const { hsmId } = req.query;
  await DeleteTemplateService(name, hsmId ? String(hsmId) : undefined);
  getIO().emit("metaTemplate", { action: "delete", name });
  return res.status(200).json({ message: "Plantilla eliminada" });
};

export const send = async (req: Request, res: Response): Promise<Response> => {
  const { ticketId } = req.params;
  const { name, language, params } = req.body;
  await SendTemplateService({
    ticketId: Number(ticketId),
    name,
    language,
    params
  });
  return res.status(200).json({ message: "Plantilla enviada" });
};
