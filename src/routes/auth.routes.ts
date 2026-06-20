import { Router } from "express";
import { registerUser, loginUser, getMe } from "../controllers/auth.controller";
import { authenticate } from "../middleware/authenticate";

const router = Router();

router.post("/register", registerUser);

router.post("/login", loginUser);

router.get("/me", authenticate, getMe);

export default router;
