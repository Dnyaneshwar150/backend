import { Router } from "express";
import {
  getEvents,
  getEventDetails,
  createNewEvent,
} from "../controllers/event.controller";
import { authenticate } from "../middleware/authenticate";
import { authorize } from "../middleware/authenticate";

const router = Router();

router.get("/", getEvents);

router.get("/:id", getEventDetails);

router.post("/", authenticate, authorize("admin"), createNewEvent);

export default router;
