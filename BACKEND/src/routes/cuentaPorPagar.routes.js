import { Router } from "express";
import CuentaPorPagarController from "../controllers/cuentaPorPagar.controller.js";

const router = Router();

router.get("/", CuentaPorPagarController.getAll);
router.post("/:id/pago", CuentaPorPagarController.registrarPago);

export default router;
