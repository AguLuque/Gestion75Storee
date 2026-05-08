// src/routes/compra.routes.js

import { Router } from "express";
import CompraController from "../controllers/compra.controller.js";

const router = Router();

router.get("/", CompraController.getAll);
router.get("/:id", CompraController.getById);
router.post("/", CompraController.create);

export default router;