import { Router } from "express";
import DeudorController from "../controllers/deudor.controller.js";

const router = Router();

router.get("/",           DeudorController.getAll);
router.post("/",          DeudorController.create);
router.put("/:id",        DeudorController.update);
router.patch("/:id/pagado", DeudorController.marcarPagado);
router.delete("/:id",     DeudorController.delete);

export default router;