import { Router } from "express";
import productoRoutes from "./producto.routes.js";
import categoriaRoutes from "./categoria.routes.js";
import proveedorRoutes from "./proveedor.routes.js";
import compraRoutes from "./compra.routes.js";
import ventaRoutes from "./venta.routes.js";
import gastoRoutes from "./gasto.routes.js";
import varianteRoutes from "./variante.routes.js";
import varianteAnidadaRoutes from "./variante-por-producto.routes.js";
import deudorRoutes from "./deudor.routes.js";
import cuentaDineroRoutes from "./cuentaDinero.routes.js";
import cuentaPorCobrarRoutes from "./cuentaPorCobrar.routes.js";
import cuentaPorPagarRoutes from "./cuentaPorPagar.routes.js";
import reporteRoutes from "./reporte.routes.js";
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
router.use("/productos/:producto_id/variantes", varianteAnidadaRoutes);
router.use("/deudores", deudorRoutes);
router.use("/cuentas-dinero", cuentaDineroRoutes);
router.use("/cuentas-por-cobrar", cuentaPorCobrarRoutes);
router.use("/cuentas-por-pagar", cuentaPorPagarRoutes);
router.use("/reportes", reporteRoutes);

export default router;