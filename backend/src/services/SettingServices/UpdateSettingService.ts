import AppError from "../../errors/AppError";
import Setting from "../../models/Setting";
import {
  CONTACT_PHRASES_SETTING,
  OPPORTUNITY_PHRASES_SETTING,
  clearPhrasesCache
} from "../EspoServices/SyncWhatsappToEspoService";

interface Request {
  key: string;
  value: string;
}

// Claves que se crean la primera vez que se guardan (no vienen en el seed original).
const CREATABLE_KEYS = [CONTACT_PHRASES_SETTING, OPPORTUNITY_PHRASES_SETTING];

const UpdateSettingService = async ({
  key,
  value
}: Request): Promise<Setting | undefined> => {
  let setting = await Setting.findOne({
    where: { key }
  });

  if (!setting && !CREATABLE_KEYS.includes(key)) {
    throw new AppError("ERR_NO_SETTING_FOUND", 404);
  }

  if (CREATABLE_KEYS.includes(key)) {
    if (typeof value !== "string" || value.length > 255) {
      throw new AppError("Las frases no pueden superar los 255 caracteres", 400);
    }
    clearPhrasesCache();
  }

  if (!setting) {
    setting = await Setting.create({ key, value });
  } else {
    await setting.update({ value });
  }

  return setting;
};

export default UpdateSettingService;
