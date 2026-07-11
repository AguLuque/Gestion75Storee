import { Router } from "express";
import productoRoutes from "./producto.routes.js";
import categoriaRoutes from "./categoria.routes.js";
import proveedorRoutes from "./proveedor.routes.js";
import compraRoutes from "./compra.routes.js";
import ventaRoutes from "./venta.routes.js";
import gastoRoutes from "./gasto.routes.js";
import varianteRoutes from "./variante.routes.js";
import deudorRoutes from "./deudor.routes.js";
import estadisticaRoutes from "./estadistica.routes.js";
import { requireAuth } from "../middleware/auth.middleware.js";

const router = Router();

router.use(requireAuth);

router.use("/productos", productoRoutes);
router.use("/categorias", categoriaRoutes);
router.use("/proveedores", proveedorRoutes);
router.use("/compras", compraRoutes);
router.use("/ventas", ventaRoutes);
router.use("/gastos", gastoRoutes);
router.use("/variantes", varianteRoutes);
router.use("/productos/:producto_id/variantes", varianteRoutes);
router.use("/deudores", deudorRoutes);
router.use("/estadisticas", estadisticaRoutes);
export default router;