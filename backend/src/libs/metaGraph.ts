// Cliente minimo de la Graph API de Meta para la WhatsApp Cloud API (coexistencia).
// Token: usuario del sistema del Business con permisos whatsapp_business_management
// y whatsapp_business_messaging.

export const META_API_VERSION = (
  process.env.META_API_VERSION || "v24.0"
).trim();
export const META_WHATSAPP_TOKEN = (
  process.env.META_WHATSAPP_TOKEN || ""
).trim();
export const META_WABA_ID = (process.env.META_WABA_ID || "").trim();
export const META_PHONE_NUMBER_ID = (
  process.env.META_PHONE_NUMBER_ID || ""
).trim();
export const META_APP_SECRET = (process.env.META_APP_SECRET || "").trim();
export const META_WEBHOOK_VERIFY_TOKEN = (
  process.env.META_WEBHOOK_VERIFY_TOKEN || ""
).trim();

export const isCloudApiEnabled = Boolean(META_WHATSAPP_TOKEN && META_WABA_ID);

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

export const graphRequest = async (
  method: string,
  path: string,
  params?: Record<string, string>,
  body?: unknown
): Promise<any> => {
  const query = params ? `?${new URLSearchParams(params).toString()}` : "";
  const res = await fetch(
    `https://graph.facebook.com/${META_API_VERSION}/${path}${query}`,
    {
      method,
      headers: {
        Authorization: `Bearer ${META_WHATSAPP_TOKEN}`,
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
