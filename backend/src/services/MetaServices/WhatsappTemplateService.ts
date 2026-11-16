import AppError from "../../errors/AppError";
import Ticket from "../../models/Ticket";
import Contact from "../../models/Contact";
import CreateMessageService from "../MessageServices/CreateMessageService";
import {
  CloudConfig,
  getCloudConfig,
  graphRequest,
  MetaGraphError
} from "../../libs/metaGraph";

// Plantillas de WhatsApp (message templates) gestionadas directamente contra Meta:
// Meta es la fuente de verdad (no se guardan en la base), asi el estado siempre esta al dia.

export interface TemplateInput {
  name: string;
  category: "MARKETING" | "UTILITY";
  language: string;
  header?: string;
  body: string;
  bodyExamples?: string[];
  footer?: string;
  buttons?: string[];
}

export interface SendTemplateInput {
  ticketId: number;
  name: string;
  language: string;
  params?: string[];
}

const ensureEnabled = async (needsPhone = false): Promise<CloudConfig> => {
  const config = await getCloudConfig();
  if (!config.enabled || (needsPhone && !config.phoneNumberId)) {
    throw new AppError(
      "La API de WhatsApp (Meta) no esta conectada. Conectala en Conexiones -> WhatsApp API (Meta).",
      400
    );
  }
  return config;
};

const wrapMetaError = async <T>(fn: () => Promise<T>): Promise<T> => {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof MetaGraphError) {
      throw new AppError(`Meta: ${err.userMessage}`, 400);
    }
    throw err;
  }
};

const countVariables = (text: string): number => {
  const matches = text.match(/\{\{\s*(\d+)\s*\}\}/g) || [];
  return new Set(matches.map(m => m.replace(/\D/g, ""))).size;
};

export const renderTemplateText = (text: string, params: string[]): string =>
  text.replace(
    /\{\{\s*(\d+)\s*\}\}/g,
    (match, n) => params[Number(n) - 1] ?? match
  );

export const ListTemplatesService = async (): Promise<any[]> => {
  const { wabaId } = await ensureEnabled();
  return wrapMetaError(async () => {
    const data = await graphRequest("GET", `${wabaId}/message_templates`, {
      fields: "id,name,status,category,language,components,rejected_reason",
      limit: "200"
    });
    return data.data || [];
  });
};

export const CreateTemplateService = async (
  input: TemplateInput
): Promise<any> => {
  const { wabaId } = await ensureEnabled();

  const name = (input.name || "").trim();
  if (!/^[a-z0-9_]{1,512}$/.test(name)) {
    throw new AppError(
      "El nombre solo puede tener minusculas, numeros y guion bajo (ej: seguimiento_cotizacion)",
      400
    );
  }
  if (!input.body?.trim()) throw new AppError("El cuerpo es obligatorio", 400);
  if (input.header && /\{\{/.test(input.header)) {
    throw new AppError("El encabezado no puede tener variables", 400);
  }

  const varCount = countVariables(input.body);
  const examples = (input.bodyExamples || []).map(e => (e || "").trim());
  if (varCount > 0 && examples.filter(Boolean).length < varCount) {
    throw new AppError(
      `El cuerpo tiene ${varCount} variable(s): Meta exige un ejemplo para cada una`,
      400
    );
  }

  const components: any[] = [];
  if (input.header?.trim()) {
    components.push({
      type: "HEADER",
      format: "TEXT",
      text: input.header.trim()
    });
  }
  components.push({
    type: "BODY",
    text: input.body.trim(),
    ...(varCount > 0
      ? { example: { body_text: [examples.slice(0, varCount)] } }
      : {})
  });
  if (input.footer?.trim()) {
    components.push({ type: "FOOTER", text: input.footer.trim() });
  }
  const buttons = (input.buttons || []).map(b => b.trim()).filter(Boolean);
  if (buttons.length) {
    components.push({
      type: "BUTTONS",
      buttons: buttons.slice(0, 3).map(text => ({ type: "QUICK_REPLY", text }))
    });
  }

  return wrapMetaError(() =>
    graphRequest("POST", `${wabaId}/message_templates`, undefined, {
      name,
      category: input.category,
      language: input.language || "es",
      components
    })
  );
};

export const DeleteTemplateService = async (
  name: string,
  hsmId?: string
): Promise<void> => {
  const { wabaId } = await ensureEnabled();
  await wrapMetaError(() =>
    graphRequest("DELETE", `${wabaId}/message_templates`, {
      name,
      ...(hsmId ? { hsm_id: hsmId } : {})
    })
  );
};

export const SendTemplateService = async ({
  ticketId,
  name,
  language,
  params = []
}: SendTemplateInput): Promise<void> => {
  const { phoneNumberId } = await ensureEnabled(true);

  const ticket = await Ticket.findByPk(ticketId, { include: [Contact] });
  if (!ticket?.contact) throw new AppError("ERR_NO_TICKET_FOUND", 404);
  if (ticket.contact.isGroup) {
    throw new AppError("No se pueden enviar plantillas a grupos", 400);
  }

  const templates = await ListTemplatesService();
  const template = templates.find(
    t => t.name === name && t.language === language
  );
  if (!template) throw new AppError("Plantilla no encontrada", 404);
  if (template.status !== "APPROVED") {
    throw new AppError("La plantilla todavia no esta aprobada por Meta", 400);
  }

  const bodyComponent = (template.components || []).find(
    (c: any) => c.type === "BODY"
  );
  const bodyText: string = bodyComponent?.text || "";
  const varCount = countVariables(bodyText);
  const values = params.slice(0, varCount).map(p => (p || "").trim());
  if (values.filter(Boolean).length < varCount) {
    throw new AppError(
      `Completa las ${varCount} variable(s) de la plantilla`,
      400
    );
  }

  const data = await wrapMetaError(() =>
    graphRequest("POST", `${phoneNumberId}/messages`, undefined, {
      messaging_product: "whatsapp",
      to: ticket.contact.number,
      type: "template",
      template: {
        name,
        language: { code: language },
        ...(varCount > 0
          ? {
              components: [
                {
                  type: "body",
                  parameters: values.map(text => ({ type: "text", text }))
                }
              ]
            }
          : {})
      }
    })
  );

  const wamid: string | undefined = data.messages?.[0]?.id;
  const headerText: string =
    (template.components || []).find((c: any) => c.type === "HEADER")?.text ||
    "";
  const body = [
    headerText && `*${headerText}*`,
    renderTemplateText(bodyText, values)
  ]
    .filter(Boolean)
    .join("\n");

  // Se registra en el ticket para que se vea en el chat (los ticks llegan por el webhook).
  await CreateMessageService({
    messageData: {
      id: wamid || `tpl-${Date.now()}`,
      ticketId: ticket.id,
      contactId: ticket.contactId,
      body,
      fromMe: true,
      read: true,
      ack: 1
    }
  });
  await ticket.update({ lastMessage: body });
};
