// Consultas de sólo lectura para los reportes financieros. Nunca escriben,
// nunca usan una transacción — leen exclusivamente de las tablas que ya
// alimentan ventas/compras/gastos/movimientos_financieros.
//
// Devengado (ventas, venta_items, gastos) vs percibido (movimientos_financieros):
// getEstadoResultados usa devengado; getFlujoCaja usa percibido; getBalance
// combina ambos como una foto "a hoy".

import pool from "../config/db.js";
import { ZONA_HORARIA_NEGOCIO } from "../utils/fechas.js";

const ReporteModel = {
  getEstadoResultados: async (desde, hasta, usuario_id) => {
    const { rows: ventasRows } = await pool.query(
      `SELECT COALESCE(SUM(total), 0) AS ingresos_por_ventas, COALESCE(SUM(comision), 0) AS comisiones
       FROM ventas
       WHERE activo = true AND usuario_id = $1 AND (fecha AT TIME ZONE '${ZONA_HORARIA_NEGOCIO}')::date BETWEEN $2 AND $3`,
      [usuario_id, desde, hasta]
    );

    const { rows: costoRows } = await pool.query(
      `SELECT COALESCE(SUM(vi.cantidad * vi.costo_unitario), 0) AS costo_mercaderia_vendida
       FROM venta_items vi
       JOIN ventas v ON v.id = vi.venta_id
       WHERE v.activo = true AND v.usuario_id = $1 AND (v.fecha AT TIME ZONE '${ZONA_HORARIA_NEGOCIO}')::date BETWEEN $2 AND $3`,
      [usuario_id, desde, hasta]
    );

    const { rows: gastosRows } = await pool.query(
      `SELECT COALESCE(SUM(monto), 0) AS gastos_operativos
       FROM gastos
       WHERE usuario_id = $1 AND (fecha AT TIME ZONE '${ZONA_HORARIA_NEGOCIO}')::date BETWEEN $2 AND $3`,
      [usuario_id, desde, hasta]
    );

    const ingresos_por_ventas = Number(ventasRows[0].ingresos_por_ventas);
    const comisiones = Number(ventasRows[0].comisiones);
    const costo_mercaderia_vendida = Number(costoRows[0].costo_mercaderia_vendida);
    const gastos_operativos = Number(gastosRows[0].gastos_operativos);

    const utilidad_bruta = ingresos_por_ventas - costo_mercaderia_vendida - comisiones;
    const utilidad_neta = utilidad_bruta - gastos_operativos;

    return {
      ingresos_por_ventas,
      costo_mercaderia_vendida,
      comisiones,
      utilidad_bruta,
      gastos_operativos,
      utilidad_neta,
    };
  },

  getBalance: async (usuario_id) => {
    const { rows: disponibleRows } = await pool.query(
      `SELECT COALESCE(SUM(saldo), 0) AS disponible FROM (
         SELECT cd.id,
           cd.saldo_inicial
             + COALESCE(SUM(CASE WHEN mf.tipo = 'ingreso' THEN mf.monto ELSE 0 END), 0)
             - COALESCE(SUM(CASE WHEN mf.tipo = 'egreso' THEN mf.monto ELSE 0 END), 0) AS saldo
         FROM cuentas_dinero cd
         LEFT JOIN movimientos_financieros mf ON mf.cuenta_dinero_id = cd.id
         WHERE cd.activo = true AND cd.usuario_id = $1
         GROUP BY cd.id, cd.saldo_inicial
       ) sub`,
      [usuario_id]
    );

    const { rows: cxcRows } = await pool.query(
      `SELECT COALESCE(SUM(saldo_pendiente), 0) AS por_cobrar FROM cuentas_por_cobrar WHERE activo = true AND usuario_id = $1`,
      [usuario_id]
    );

    const { rows: inventarioRows } = await pool.query(
      `SELECT COALESCE(SUM(stock_actual * precio_compra), 0) AS inventario FROM productos WHERE activo = true AND usuario_id = $1`,
      [usuario_id]
    );

    const { rows: cxpRows } = await pool.query(
      `SELECT COALESCE(SUM(saldo_pendiente), 0) AS por_pagar FROM cuentas_por_pagar WHERE activo = true AND usuario_id = $1`,
      [usuario_id]
    );

    const disponible = Number(disponibleRows[0].disponible);
    const por_cobrar = Number(cxcRows[0].por_cobrar);
    const inventario = Number(inventarioRows[0].inventario);
    const por_pagar = Number(cxpRows[0].por_pagar);

    const total_activos = disponible + por_cobrar + inventario;
    const total_pasivos = por_pagar;

    return {
      disponible,
      por_cobrar,
      inventario,
      total_activos,
      por_pagar,
      total_pasivos,
      patrimonio: total_activos - total_pasivos,
    };
  },

  getFlujoCaja: async (desde, hasta, usuario_id) => {
    const { rows: saldoInicialRows } = await pool.query(
      `SELECT COALESCE(SUM(saldo), 0) AS saldo_inicial FROM (
         SELECT cd.id,
           cd.saldo_inicial
             + COALESCE(SUM(CASE WHEN mf.tipo = 'ingreso' AND mf.fecha < $2 THEN mf.monto ELSE 0 END), 0)
             - COALESCE(SUM(CASE WHEN mf.tipo = 'egreso' AND mf.fecha < $2 THEN mf.monto ELSE 0 END), 0) AS saldo
         FROM cuentas_dinero cd
         LEFT JOIN movimientos_financieros mf ON mf.cuenta_dinero_id = cd.id
         WHERE cd.activo = true AND cd.usuario_id = $1
         GROUP BY cd.id, cd.saldo_inicial
       ) sub`,
      [usuario_id, desde]
    );

    const { rows: totalesRows } = await pool.query(
      `SELECT
         COALESCE(SUM(CASE WHEN tipo = 'ingreso' THEN monto ELSE 0 END), 0) AS ingresos_caja,
         COALESCE(SUM(CASE WHEN tipo = 'egreso' THEN monto ELSE 0 END), 0) AS egresos_caja
       FROM movimientos_financieros
       WHERE usuario_id = $1 AND fecha BETWEEN $2 AND $3`,
      [usuario_id, desde, hasta]
    );

    const { rows: detalleRows } = await pool.query(
      `SELECT tipo, categoria, COALESCE(SUM(monto), 0) AS monto
       FROM movimientos_financieros
       WHERE usuario_id = $1 AND fecha BETWEEN $2 AND $3
       GROUP BY tipo, categoria
       ORDER BY tipo, monto DESC`,
      [usuario_id, desde, hasta]
    );

    const saldo_inicial = Number(saldoInicialRows[0].saldo_inicial);
    const ingresos_caja = Number(totalesRows[0].ingresos_caja);
    const egresos_caja = Number(totalesRows[0].egresos_caja);
    const flujo_neto = ingresos_caja - egresos_caja;

    return {
      saldo_inicial,
      ingresos_caja,
      egresos_caja,
      flujo_neto,
      saldo_final: saldo_inicial + flujo_neto,
      detalle_por_categoria: detalleRows.map((r) => ({ tipo: r.tipo, categoria: r.categoria, monto: Number(r.monto) })),
    };
  },

  getResumen: async (desde, hasta, usuario_id) => {
    const [estadoResultados, balance, flujoCaja] = await Promise.all([
      ReporteModel.getEstadoResultados(desde, hasta, usuario_id),
      ReporteModel.getBalance(usuario_id),
      ReporteModel.getFlujoCaja(desde, hasta, usuario_id),
    ]);

    return {
      utilidad_neta_periodo: estadoResultados.utilidad_neta,
      ingresos_por_ventas_periodo: estadoResultados.ingresos_por_ventas,
      saldo_total_cuentas: balance.disponible,
      total_por_cobrar: balance.por_cobrar,
      total_por_pagar: balance.por_pagar,
      ingresos_caja_periodo: flujoCaja.ingresos_caja,
      egresos_caja_periodo: flujoCaja.egresos_caja,
      flujo_neto_caja_periodo: flujoCaja.flujo_neto,
    };
  },
};

export default ReporteModel;
