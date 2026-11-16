import { Request, Response } from "express";

import { getIO } from "../libs/socket";
import AppError from "../errors/AppError";

import UpdateSettingService from "../services/SettingServices/UpdateSettingService";
import ListSettingsService from "../services/SettingServices/ListSettingsService";
import {
  CONTACT_PHRASES_SETTING,
  OPPORTUNITY_PHRASES_SETTING,
  DEFAULT_CONTACT_PHRASES,
  DEFAULT_OPPORTUNITY_PHRASES
} from "../services/EspoServices/SyncWhatsappToEspoService";

export const index = async (req: Request, res: Response): Promise<Response> => {
  if (req.user.profile !== "admin") {
    throw new AppError("ERR_NO_PERMISSION", 403);
  }

  const settings: any[] = (await ListSettingsService()) || [];

  // Frases de EspoCRM: si todavía no se guardaron, se muestran las que están en uso.
  [
    [CONTACT_PHRASES_SETTING, DEFAULT_CONTACT_PHRASES],
    [OPPORTUNITY_PHRASES_SETTING, DEFAULT_OPPORTUNITY_PHRASES]
  ].forEach(([key, value]) => {
    if (!settings.some(s => s.key === key)) settings.push({ key, value });
  });

  return res.status(200).json(settings);
};

export const update = async (
  req: Request,
  res: Response
): Promise<Response> => {
  if (req.user.profile !== "admin") {
    throw new AppError("ERR_NO_PERMISSION", 403);
  }
  const { settingKey: key } = req.params;
  const { value } = req.body;

  const setting = await UpdateSettingService({
    key,
    value
  });

  const io = getIO();
  io.emit("settings", {
    action: "update",
    setting
  });

  return res.status(200).json(setting);
};
