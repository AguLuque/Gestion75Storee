// Queries SQL para la tabla cuentas_por_pagar.
// El pago (registrarPagoEnTransaccion) no crea el movimiento financiero —
// eso es responsabilidad del servicio que sí conoce la cuenta de dinero
// origen (ver cuentaPorPagar.service.js, Tarea 10).

import pool from "../config/db.js";

const CuentaPorPagarModel = {
  getAll: async (usuario_id) => {
    const { rows } = await pool.query(
      `SELECT * FROM cuentas_por_pagar WHERE activo = true AND usuario_id = $1
       ORDER BY estado ASC, fecha_vencimiento ASC NULLS LAST`,
      [usuario_id]
    );
    return rows;
  },

  getById: async (id, usuario_id) => {
    const { rows } = await pool.query(
      `SELECT * FROM cuentas_por_pagar WHERE id = $1 AND activo = true AND usuario_id = $2`,
      [id, usuario_id]
    );
    return rows[0] || null;
  },

  create: async ({ compra_id, proveedor_id, monto_total, fecha_emision, fecha_vencimiento, usuario_id }) => {
    const { rows } = await pool.query(
      `INSERT INTO cuentas_por_pagar
         (compra_id, proveedor_id, monto_total, saldo_pendiente, fecha_emision, fecha_vencimiento, usuario_id)
       VALUES ($1, $2, $3, $3, $4, $5, $6) RETURNING *`,
      [compra_id ?? null, proveedor_id ?? null, monto_total, fecha_emision, fecha_vencimiento ?? null, usuario_id]
    );
    return rows[0];
  },

  createEnTransaccion: async (client, { compra_id, proveedor_id, monto_total, fecha_emision, fecha_vencimiento, usuario_id }) => {
    const { rows } = await client.query(
      `INSERT INTO cuentas_por_pagar
         (compra_id, proveedor_id, monto_total, saldo_pendiente, fecha_emision, fecha_vencimiento, usuario_id)
       VALUES ($1, $2, $3, $3, $4, $5, $6) RETURNING *`,
      [compra_id ?? null, proveedor_id ?? null, monto_total, fecha_emision, fecha_vencimiento ?? null, usuario_id]
    );
    return rows[0];
  },

  registrarPagoEnTransaccion: async (client, id, monto, usuario_id) => {
    const { rows: filaActual } = await client.query(
      `SELECT * FROM cuentas_por_pagar WHERE id = $1 AND activo = true AND usuario_id = $2 FOR UPDATE`,
      [id, usuario_id]
    );

    if (!filaActual[0]) {
      throw { status: 404, message: "Cuenta por pagar no encontrada." };
    }

    if (Number(monto) > Number(filaActual[0].saldo_pendiente)) {
      throw { status: 400, message: `El pago (${monto}) supera el saldo pendiente (${filaActual[0].saldo_pendiente}).` };
    }

    const nuevoSaldo = Math.round((Number(filaActual[0].saldo_pendiente) - Number(monto)) * 100) / 100;
    const nuevoEstado = nuevoSaldo === 0 ? "pagado" : "parcial";

    const { rows } = await client.query(
      `UPDATE cuentas_por_pagar SET saldo_pendiente = $1, estado = $2
       WHERE id = $3 AND usuario_id = $4 RETURNING *`,
      [nuevoSaldo, nuevoEstado, id, usuario_id]
    );
    return rows[0];
  },

  getTotalPendiente: async (usuario_id) => {
    const { rows } = await pool.query(
      `SELECT COALESCE(SUM(saldo_pendiente), 0) AS total FROM cuentas_por_pagar
       WHERE activo = true AND usuario_id = $1 AND estado != 'pagado'`,
      [usuario_id]
    );
    return rows[0].total;
  },
};

export default CuentaPorPagarModel;
