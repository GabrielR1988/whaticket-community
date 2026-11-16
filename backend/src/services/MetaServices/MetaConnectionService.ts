import { randomInt } from "crypto";
import AppError from "../../errors/AppError";
import Setting from "../../models/Setting";
import { logger } from "../../utils/logger";
import {
  deleteCloudConfig,
  getCloudConfig,
  graphRequest,
  META_API_VERSION,
  META_APP_ID,
  META_APP_SECRET,
  META_ES_CONFIG_ID,
  META_WEBHOOK_VERIFY_TOKEN,
  MetaGraphError,
  saveCloudConfig
} from "../../libs/metaGraph";

// Alta de la WhatsApp Cloud API desde el CRM con Embedded Signup de Meta.
// - Coexistencia (numero que ya usa la app WhatsApp Business): el cliente escanea un QR
//   desde la app del celular dentro de la ventana de Meta; NO se llama a /register.
// - Numero nuevo (solo API): se registra con /register y un PIN de verificacion en dos
//   pasos generado aca (queda guardado en Settings: metaRegisterPin).

const COEXISTENCE_EVENT = "FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING";

export interface EmbeddedSignupInput {
  code: string;
  wabaId?: string;
  phoneNumberId?: string;
  event?: string;
}

const metaError = (err: unknown, step: string): never => {
  if (err instanceof MetaGraphError) {
    throw new AppError(`Meta (${step}): ${err.userMessage}`, 400);
  }
  throw err;
};

export const GetConnectionInfoService = async (): Promise<
  Record<string, unknown>
> => {
  const config = await getCloudConfig();
  return {
    app: {
      appId: META_APP_ID,
      configId: META_ES_CONFIG_ID,
      apiVersion: META_API_VERSION,
      // Lo minimo para poder abrir la ventana de Meta y canjear el codigo.
      ready: Boolean(META_APP_ID && META_ES_CONFIG_ID && META_APP_SECRET),
      webhookConfigured: Boolean(META_WEBHOOK_VERIFY_TOKEN && META_APP_SECRET)
    },
    connection: {
      enabled: config.enabled,
      source: config.source,
      wabaId: config.wabaId,
      phoneNumberId: config.phoneNumberId,
      displayPhone: config.displayPhone,
      verifiedName: config.verifiedName,
      connectedAt: config.connectedAt
    }
  };
};

const pickPhoneNumber = async (
  wabaId: string,
  token: string,
  phoneNumberId?: string
): Promise<{ id: string; display: string; name: string }> => {
  if (phoneNumberId) {
    const phone = await graphRequest(
      "GET",
      phoneNumberId,
      { fields: "display_phone_number,verified_name" },
      undefined,
      token
    );
    return {
      id: phoneNumberId,
      display: phone.display_phone_number || "",
      name: phone.verified_name || ""
    };
  }
  const list = await graphRequest(
    "GET",
    `${wabaId}/phone_numbers`,
    { fields: "id,display_phone_number,verified_name" },
    undefined,
    token
  );
  const phone = list.data?.[0];
  if (!phone) throw new AppError("La cuenta de WhatsApp no tiene numeros", 400);
  return {
    id: phone.id,
    display: phone.display_phone_number || "",
    name: phone.verified_name || ""
  };
};

export const CompleteEmbeddedSignupService = async ({
  code,
  wabaId,
  phoneNumberId,
  event
}: EmbeddedSignupInput): Promise<Record<string, unknown>> => {
  if (!META_APP_ID || !META_APP_SECRET) {
    throw new AppError(
      "Faltan META_APP_ID / META_APP_SECRET en el backend",
      400
    );
  }
  if (!code)
    throw new AppError("Meta no devolvio el codigo de autorizacion", 400);
  if (!wabaId) {
    throw new AppError(
      "Meta no informo la cuenta de WhatsApp (WABA). Reintenta el alta completa.",
      400
    );
  }

  // 1. Codigo -> token de negocio (no vence mientras la app siga autorizada).
  let token = "";
  try {
    const data = await graphRequest(
      "GET",
      "oauth/access_token",
      { client_id: META_APP_ID, client_secret: META_APP_SECRET, code },
      undefined,
      ""
    );
    token = data.access_token;
  } catch (err) {
    metaError(err, "canje del codigo");
  }

  // 2. Numero de la cuenta.
  let phone = { id: "", display: "", name: "" };
  try {
    phone = await pickPhoneNumber(wabaId, token, phoneNumberId);
  } catch (err) {
    metaError(err, "datos del numero");
  }

  // 3. Suscribir la App a los webhooks de esta cuenta.
  try {
    await graphRequest(
      "POST",
      `${wabaId}/subscribed_apps`,
      undefined,
      {},
      token
    );
  } catch (err) {
    metaError(err, "suscripcion al webhook");
  }

  const isCoexistence = event === COEXISTENCE_EVENT;
  const warnings: string[] = [];

  if (isCoexistence) {
    // 4a. Coexistencia: pedir sincronizacion de contactos e historial (Meta da 24 h).
    await Promise.all(
      ["smb_app_state_sync", "history"].map(syncType =>
        graphRequest(
          "POST",
          `${phone.id}/smb_app_data`,
          undefined,
          { messaging_product: "whatsapp", sync_type: syncType },
          token
        ).catch(err => {
          logger.warn(`Meta alta: sync ${syncType} fallo: ${err}`);
          warnings.push(`No se pudo pedir la sincronizacion (${syncType})`);
        })
      )
    );
  } else {
    // 4b. Numero solo API: registrarlo en la Cloud API con un PIN de dos pasos.
    const pin = String(randomInt(0, 1000000)).padStart(6, "0");
    try {
      await graphRequest(
        "POST",
        `${phone.id}/register`,
        undefined,
        { messaging_product: "whatsapp", pin },
        token
      );
      const existing = await Setting.findOne({
        where: { key: "metaRegisterPin" }
      });
      if (existing) await existing.update({ value: pin });
      else await Setting.create({ key: "metaRegisterPin", value: pin });
    } catch (err) {
      logger.warn(`Meta alta: register fallo: ${err}`);
      warnings.push(
        "No se pudo registrar el numero en la API (puede que ya estuviera registrado)"
      );
    }
  }

  await saveCloudConfig({
    token,
    wabaId,
    phoneNumberId: phone.id,
    displayPhone: phone.display,
    verifiedName: phone.name,
    connectedAt: new Date().toISOString()
  });

  logger.info(
    `Meta alta completada: WABA ${wabaId}, numero ${phone.display} (${
      isCoexistence ? "coexistencia" : "solo API"
    })`
  );

  return {
    mode: isCoexistence ? "coexistence" : "cloud",
    wabaId,
    phoneNumberId: phone.id,
    displayPhone: phone.display,
    verifiedName: phone.name,
    warnings
  };
};

// Consulta en vivo el estado del numero en Meta (para el boton "Verificar").
export const CheckConnectionService = async (): Promise<
  Record<string, unknown>
> => {
  const config = await getCloudConfig();
  if (!config.enabled || !config.phoneNumberId) {
    throw new AppError("No hay una cuenta de WhatsApp API conectada", 400);
  }
  try {
    const [phone, apps] = await Promise.all([
      graphRequest("GET", config.phoneNumberId, {
        fields:
          "display_phone_number,verified_name,name_status,quality_rating,platform_type,status,code_verification_status,is_on_biz_app"
      }),
      graphRequest("GET", `${config.wabaId}/subscribed_apps`)
    ]);
    return {
      ...phone,
      subscribedApps: (apps.data || []).map(
        (a: any) =>
          a.whatsapp_business_api_data?.name || a.whatsapp_business_api_data?.id
      )
    };
  } catch (err) {
    return metaError(err, "verificacion");
  }
};

export const DisconnectService = async (): Promise<void> => {
  await deleteCloudConfig();
  logger.info("Meta: credenciales de WhatsApp API borradas del CRM");
};
