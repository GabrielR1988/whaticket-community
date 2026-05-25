import express from "express";
import isAuth from "../middleware/isAuth";
import * as TagController from "../controllers/TagController";

const tagRoutes = express.Router();

tagRoutes.get("/tags", isAuth, TagController.index);
tagRoutes.post("/tags", isAuth, TagController.store);
tagRoutes.put("/tags/:tagId", isAuth, TagController.update);
tagRoutes.delete("/tags/:tagId", isAuth, TagController.remove);
tagRoutes.post("/tickets/:ticketId/tags/sync", isAuth, TagController.sync);
tagRoutes.get("/tickets/:ticketId/tags", isAuth, TagController.getByTicket);

export default tagRoutes;
