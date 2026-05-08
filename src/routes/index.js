// src/routes/index.js
// Concentra y exporta todas las rutas del sistema bajo sus prefijos correspondientes

import { Router } from "express";
import productoRoutes from "./producto.routes.js";
import categoriaRoutes from "./categoria.routes.js";
import proveedorRoutes from "./proveedor.routes.js";
import compraRoutes from "./compra.routes.js";
import ventaRoutes from "./venta.routes.js";
import gastoRoutes from "./gasto.routes.js";

const router = Router();

router.use("/productos", productoRoutes);
router.use("/categorias", categoriaRoutes);
router.use("/proveedores", proveedorRoutes);
router.use("/compras", compraRoutes);
router.use("/ventas", ventaRoutes);
router.use("/gastos", gastoRoutes);

export default router;