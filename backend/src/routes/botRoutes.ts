import { Router } from "express";
import isAuth from "../middleware/isAuth";

import * as BotControlController from "../controllers/BotControlController";

const botRoutes = Router();

botRoutes.get("/tickets/:ticketId/bot", isAuth, BotControlController.show);
botRoutes.put("/tickets/:ticketId/bot", isAuth, BotControlController.update);

export default botRoutes;
