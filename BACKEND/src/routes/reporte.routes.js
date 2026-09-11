// src/routes/reporte.routes.js
import { Router } from "express";
import ReporteController from "../controllers/reporte.controller.js";

const router = Router();

router.get("/resumen", ReporteController.getResumen);
router.get("/estado-resultados", ReporteController.getEstadoResultados);
router.get("/balance", ReporteController.getBalance);
router.get("/flujo-caja", ReporteController.getFlujoCaja);

export default router;
