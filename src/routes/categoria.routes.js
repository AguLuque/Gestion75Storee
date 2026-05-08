// src/routes/categoria.routes.js

import { Router } from "express";
import CategoriaController from "../controllers/categoria.controller.js";

const router = Router();

router.get("/", CategoriaController.getAll);
router.get("/:id", CategoriaController.getById);
router.post("/", CategoriaController.create);
router.put("/:id", CategoriaController.update);
router.delete("/:id", CategoriaController.delete);

export default router;