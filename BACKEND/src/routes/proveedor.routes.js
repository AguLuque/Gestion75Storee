// src/routes/proveedor.routes.js

import { Router } from "express";
import ProveedorController from "../controllers/proveedor.controller.js";

const router = Router();

router.get("/", ProveedorController.getAll);
router.get("/:id", ProveedorController.getById);
router.get("/:id/compras", ProveedorController.getCompras); // historial de compras del proveedor
router.post("/", ProveedorController.create);
router.put("/:id", ProveedorController.update);
router.delete("/:id", ProveedorController.delete);

export default router;