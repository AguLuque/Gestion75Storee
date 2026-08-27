// src/routes/variante.routes.js
// Rutas directas para variantes por su propio id, montadas en /variantes desde index.js

import { Router } from "express";
import VarianteController from "../controllers/variante.controller.js";

const router = Router();

router.get("/:id", VarianteController.getById);
router.put("/:id", VarianteController.update);
router.patch("/:id/stock", VarianteController.updateStock);
router.delete("/:id", VarianteController.delete);

export default router;
