import { Router } from "express";
import CuentaPorCobrarController from "../controllers/cuentaPorCobrar.controller.js";

const router = Router();

router.get("/", CuentaPorCobrarController.getAll);
router.post("/", CuentaPorCobrarController.crearManual);
router.put("/:id", CuentaPorCobrarController.editarManual);
router.delete("/:id", CuentaPorCobrarController.anularManual);
router.post("/:id/cobro", CuentaPorCobrarController.registrarCobro);

export default router;
