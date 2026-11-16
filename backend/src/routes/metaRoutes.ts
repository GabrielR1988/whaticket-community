import express from "express";
import isAuth from "../middleware/isAuth";
import * as MetaTemplateController from "../controllers/MetaTemplateController";
import * as MetaWebhookController from "../controllers/MetaWebhookController";

const metaRoutes = express.Router();

// Webhook publico de Meta (se valida con verify token y firma X-Hub-Signature-256).
metaRoutes.get("/meta/webhook", MetaWebhookController.verify);
metaRoutes.post("/meta/webhook", MetaWebhookController.receive);

metaRoutes.get(
  "/meta/connection",
  isAuth,
  MetaTemplateController.connectionInfo
);
metaRoutes.post(
  "/meta/connection",
  isAuth,
  MetaTemplateController.connectionComplete
);
metaRoutes.get(
  "/meta/connection/check",
  isAuth,
  MetaTemplateController.connectionCheck
);
metaRoutes.delete(
  "/meta/connection",
  isAuth,
  MetaTemplateController.connectionRemove
);

metaRoutes.get("/meta/templates", isAuth, MetaTemplateController.index);
metaRoutes.post("/meta/templates", isAuth, MetaTemplateController.store);
metaRoutes.delete(
  "/meta/templates/:name",
  isAuth,
  MetaTemplateController.remove
);
metaRoutes.post(
  "/tickets/:ticketId/template",
  isAuth,
  MetaTemplateController.send
);

export default metaRoutes;
