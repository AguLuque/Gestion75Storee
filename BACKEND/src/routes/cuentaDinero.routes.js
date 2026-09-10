import { Router } from "express";
import CuentaDineroController from "../controllers/cuentaDinero.controller.js";

const router = Router();

router.get("/", CuentaDineroController.getAll);
router.get("/:id/saldo", CuentaDineroController.getSaldo);
router.post("/", CuentaDineroController.create);
router.put("/:id", CuentaDineroController.update);
router.delete("/:id", CuentaDineroController.delete);
router.post("/:id/ajuste", CuentaDineroController.crearAjuste);

export default router;
