import { Router } from "express";
import EstadisticaController from "../controllers/estadistica.controller.js";

const router = Router();

router.get("/resumen-mensual", EstadisticaController.getResumenMensual);
router.get("/resumen", EstadisticaController.getResumenPeriodo);
router.get("/top-productos", EstadisticaController.getTopProductos);

export default router;