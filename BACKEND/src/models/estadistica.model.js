import pool from "../config/db.js";

const EstadisticaModel = {
  // Totales por mes, últimos N meses (para el gráfico de evolución)
  getResumenMensual: async (meses, usuario_id) => {
    const { rows } = await pool.query(
      `
      SELECT
        date_trunc('month', v.fecha) AS mes,
        COALESCE(SUM(v.total), 0) AS total_ventas,
        COALESCE(SUM(v.ganancia), 0) AS ganancia_neta,
        COUNT(*) AS cantidad_ventas
      FROM ventas v
      WHERE v.activo = true
        AND v.usuario_id = $1
        AND v.fecha >= date_trunc('month', now()) - ($2 || ' months')::interval
      GROUP BY mes
      ORDER BY mes ASC
      `,
      [usuario_id, meses]
    );
    return rows;
  },

  // KPIs totales de un período (desde-hasta)
  getResumenPeriodo: async (desde, hasta, usuario_id) => {
    const { rows } = await pool.query(
      `
      SELECT
        COALESCE(SUM(v.total), 0) AS total_vendido,
        COALESCE(SUM(v.ganancia), 0) AS ganancia_neta,
        COUNT(*) AS cantidad_ventas,
        COALESCE(AVG(v.total), 0) AS ticket_promedio
      FROM ventas v
      WHERE v.activo = true
        AND v.usuario_id = $1
        AND v.fecha BETWEEN $2 AND $3
      `,
      [usuario_id, desde, hasta]
    );
    return rows[0];
  },

  // Productos más vendidos en un período
  getTopProductos: async (desde, hasta, limite, usuario_id) => {
    const { rows } = await pool.query(
      `
      SELECT
        p.id,
        p.nombre,
        SUM(vi.cantidad) AS cantidad_vendida,
        SUM(vi.subtotal) AS total_vendido,
        SUM(vi.cantidad * (vi.precio_unitario - vi.costo_unitario)) AS ganancia_generada
      FROM venta_items vi
      JOIN ventas v ON v.id = vi.venta_id
      JOIN productos p ON p.id = vi.producto_id
      WHERE v.activo = true
        AND v.usuario_id = $1
        AND v.fecha BETWEEN $2 AND $3
      GROUP BY p.id, p.nombre
      ORDER BY cantidad_vendida DESC
      LIMIT $4
      `,
      [usuario_id, desde, hasta, limite]
    );
    return rows;
  },
};

export default EstadisticaModel;