// src/routes/venta.routes.js

import { Router } from "express";
import VentaController from "../controllers/venta.controller.js";

const router = Router();

router.get("/periodo", VentaController.getByPeriodo);

router.get("/", VentaController.getAll);
router.get("/:id", VentaController.getById);
router.post("/", VentaController.create);
router.delete("/:id", VentaController.delete);

export default router;