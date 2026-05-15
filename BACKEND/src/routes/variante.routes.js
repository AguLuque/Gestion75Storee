// src/routes/variante.routes.js
// Rutas para variantes de productos
// Dos grupos:
//   - Anidadas bajo /productos/:producto_id/variantes (crear, listar)
//   - Directas bajo /variantes/:id (leer, editar, eliminar, ajustar stock)

import { Router } from "express";
import VarianteController from "../controllers/variante.controller.js";

const router = Router({ mergeParams: true }); // mergeParams permite acceder a :producto_id desde rutas anidadas

// Rutas anidadas (montadas en /productos/:producto_id/variantes desde index.js)
router.get("/", VarianteController.getByProducto);
router.post("/", VarianteController.create);

// Rutas directas (montadas en /variantes desde index.js)
router.get("/:id", VarianteController.getById);
router.put("/:id", VarianteController.update);
router.patch("/:id/stock", VarianteController.updateStock);
router.delete("/:id", VarianteController.delete);

export default router;