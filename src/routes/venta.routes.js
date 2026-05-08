// src/routes/venta.routes.js

import { Router } from "express";
import VentaController from "../controllers/venta.controller.js";

const router = Router();

// /ventas/periodo?desde=...&hasta=... — debe ir ANTES de /:id
router.get("/periodo", VentaController.getByPeriodo);

router.get("/", VentaController.getAll);
router.get("/:id", VentaController.getById);
router.post("/", VentaController.create);

export default router;