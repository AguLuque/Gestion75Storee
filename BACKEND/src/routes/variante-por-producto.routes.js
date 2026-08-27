// src/routes/variante-por-producto.routes.js
// Rutas anidadas de variantes, montadas en /productos/:producto_id/variantes desde index.js

import { Router } from "express";
import VarianteController from "../controllers/variante.controller.js";

const router = Router({ mergeParams: true }); // permite leer :producto_id del mount padre

router.get("/", VarianteController.getByProducto);
router.post("/", VarianteController.create);

export default router;
