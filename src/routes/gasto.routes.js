// src/routes/gasto.routes.js

import { Router } from "express";
import GastoController from "../controllers/gasto.controller.js";

const router = Router();

// /gastos/periodo?desde=...&hasta=... — debe ir ANTES de /:id
router.get("/periodo", GastoController.getByPeriodo);

router.get("/", GastoController.getAll);
router.get("/:id", GastoController.getById);
router.post("/", GastoController.create);
router.put("/:id", GastoController.update);
router.delete("/:id", GastoController.delete);

export default router;