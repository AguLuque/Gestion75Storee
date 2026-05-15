// src/routes/producto.routes.js

import { Router } from "express";
import ProductoController from "../controllers/producto.controller.js";

const router = Router();

router.get("/bajo-stock", ProductoController.getBajoStock);
router.get("/sin-stock", ProductoController.getSinStock);
router.get("/", ProductoController.getAll);
router.get("/:id", ProductoController.getById);
router.post("/", ProductoController.create);
router.put("/:id", ProductoController.update);
router.patch("/:id/stock", ProductoController.updateStock);
router.delete("/:id", ProductoController.delete);

export default router;