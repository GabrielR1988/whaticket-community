import Setting from "../models/Setting";

// Cliente minimo de la Graph API de Meta para la WhatsApp Cloud API (coexistencia).
//
// Credenciales de la cuenta de WhatsApp (token, WABA, numero):
// - Se guardan en la tabla Settings cuando se conecta desde el CRM (Conexiones ->
//   "Conectar con Meta", Embedded Signup en modo coexistencia).
// - Si no hay nada guardado, se usan las variables META_WHATSAPP_TOKEN / META_WABA_ID /
//   META_PHONE_NUMBER_ID (token de usuario del sistema cargado a mano).
// Datos de la App de Meta (fijos, siempre por variables): META_APP_ID, META_APP_SECRET,
// META_ES_CONFIG_ID, META_WEBHOOK_VERIFY_TOKEN.

export const META_API_VERSION = (
  process.env.META_API_VERSION || "v24.0"
).trim();
export const META_APP_ID = (process.env.META_APP_ID || "").trim();
export const META_APP_SECRET = (process.env.META_APP_SECRET || "").trim();
export const META_ES_CONFIG_ID = (process.env.META_ES_CONFIG_ID || "").trim();
export const META_WEBHOOK_VERIFY_TOKEN = (
  process.env.META_WEBHOOK_VERIFY_TOKEN || ""
).trim();

export const SETTING_KEYS = {
  token: "metaWhatsappToken",
  wabaId: "metaWabaId",
  phoneNumberId: "metaPhoneNumberId",
  displayPhone: "metaDisplayPhone",
  verifiedName: "metaVerifiedName",
  connectedAt: "metaConnectedAt"
};

export interface CloudConfig {
  token: string;
  wabaId: string;
  phoneNumberId: string;
  displayPhone: string;
  verifiedName: string;
  connectedAt: string;
  source: "crm" | "env" | "none";
  enabled: boolean;
}

let cache: { config: CloudConfig; at: number } | null = null;
const CACHE_MS = 60 * 1000;

export const clearCloudConfigCache = (): void => {
  cache = null;
};

export const getCloudConfig = async (): Promise<CloudConfig> => {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.config;

  const rows = await Setting.findAll({
    where: { key: Object.values(SETTING_KEYS) }
  });
  const db: Record<string, string> = {};
  rows.forEach(r => {
    db[r.key] = r.value || "";
  });

  let config: CloudConfig;
  if (db[SETTING_KEYS.token] && db[SETTING_KEYS.wabaId]) {
    config = {
      token: db[SETTING_KEYS.token],
      wabaId: db[SETTING_KEYS.wabaId],
      phoneNumberId: db[SETTING_KEYS.phoneNumberId] || "",
      displayPhone: db[SETTING_KEYS.displayPhone] || "",
      verifiedName: db[SETTING_KEYS.verifiedName] || "",
      connectedAt: db[SETTING_KEYS.connectedAt] || "",
      source: "crm",
      enabled: true
    };
  } else {
    const token = (process.env.META_WHATSAPP_TOKEN || "").trim();
    const wabaId = (process.env.META_WABA_ID || "").trim();
    const enabled = Boolean(token && wabaId);
    config = {
      token,
      wabaId,
      phoneNumberId: (process.env.META_PHONE_NUMBER_ID || "").trim(),
      displayPhone: "",
      verifiedName: "",
      connectedAt: "",
      source: enabled ? "env" : "none",
      enabled
    };
  }

  cache = { config, at: Date.now() };
  return config;
};

export const saveCloudConfig = async (
  values: Record<keyof typeof SETTING_KEYS, string>
): Promise<void> => {
  await Promise.all(
    (Object.keys(SETTING_KEYS) as (keyof typeof SETTING_KEYS)[]).map(
      async field => {
        const key = SETTING_KEYS[field];
        const value = values[field] || "";
        const existing = await Setting.findOne({ where: { key } });
        if (existing) await existing.update({ value });
        else await Setting.create({ key, value });
      }
    )
  );
  clearCloudConfigCache();
};

export const deleteCloudConfig = async (): Promise<void> => {
  await Setting.destroy({ where: { key: Object.values(SETTING_KEYS) } });
  clearCloudConfigCache();
};

export class MetaGraphError extends Error {
  status: number;

  userMessage: string;

  constructor(status: number, body: any) {
    const err = body?.error || {};
    const userMessage =
      err.error_user_msg ||
      err.error_user_title ||
      err.message ||
      "Error de Meta";
    super(`Meta Graph ${status}: ${JSON.stringify(body)}`);
    this.status = status;
    this.userMessage = userMessage;
  }
}

// Si no se pasa token, se usa el de la cuenta conectada.
export const graphRequest = async (
  method: string,
  path: string,
  params?: Record<string, string>,
  body?: unknown,
  token?: string
): Promise<any> => {
  const accessToken = token ?? (await getCloudConfig()).token;
  const query = params ? `?${new URLSearchParams(params).toString()}` : "";
  const res = await fetch(
    `https://graph.facebook.com/${META_API_VERSION}/${path}${query}`,
    {
      method,
      headers: {
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        "Content-Type": "application/json"
      },
      body: body ? JSON.stringify(body) : undefined
    }
  );
  const text = await res.text();
  let data: any;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }
  if (!res.ok) throw new MetaGraphError(res.status, data);
  return data;
};
