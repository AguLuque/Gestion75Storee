import { Router } from "express";
import CuentaPorCobrarController from "../controllers/cuentaPorCobrar.controller.js";

const router = Router();

router.get("/", CuentaPorCobrarController.getAll);
router.post("/:id/cobro", CuentaPorCobrarController.registrarCobro);

export default router;
