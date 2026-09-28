// Queries SQL para la tabla cuentas_por_cobrar.
// El cobro (registrarCobroEnTransaccion) no crea el movimiento financiero —
// eso es responsabilidad del servicio que sí conoce la cuenta de dinero
// destino (ver cuentaPorCobrar.service.js, Tarea 10).

import pool from "../config/db.js";

const CuentaPorCobrarModel = {
  getAll: async (usuario_id) => {
    const { rows } = await pool.query(
      `SELECT * FROM cuentas_por_cobrar WHERE activo = true AND usuario_id = $1
       ORDER BY estado ASC, fecha_vencimiento ASC NULLS LAST`,
      [usuario_id]
    );
    return rows;
  },

  getById: async (id, usuario_id) => {
    const { rows } = await pool.query(
      `SELECT * FROM cuentas_por_cobrar WHERE id = $1 AND activo = true AND usuario_id = $2`,
      [id, usuario_id]
    );
    return rows[0] || null;
  },

  // Sin venta_id es una deuda manual ("fiado" cargado a mano, antes Deudores).
  create: async ({ venta_id, cliente_nombre, monto_total, fecha_emision, fecha_vencimiento, observaciones, usuario_id }) => {
    const { rows } = await pool.query(
      `INSERT INTO cuentas_por_cobrar
         (venta_id, cliente_nombre, monto_total, saldo_pendiente, fecha_emision, fecha_vencimiento, observaciones, usuario_id)
       VALUES ($1, $2, $3, $3, $4, $5, $6, $7) RETURNING *`,
      [venta_id ?? null, cliente_nombre ?? null, monto_total, fecha_emision, fecha_vencimiento ?? null, observaciones ?? null, usuario_id]
    );
    return rows[0];
  },

  createEnTransaccion: async (client, { venta_id, cliente_nombre, monto_total, fecha_emision, fecha_vencimiento, usuario_id }) => {
    const { rows } = await client.query(
      `INSERT INTO cuentas_por_cobrar
         (venta_id, cliente_nombre, monto_total, saldo_pendiente, fecha_emision, fecha_vencimiento, usuario_id)
       VALUES ($1, $2, $3, $3, $4, $5, $6) RETURNING *`,
      [venta_id ?? null, cliente_nombre ?? null, monto_total, fecha_emision, fecha_vencimiento ?? null, usuario_id]
    );
    return rows[0];
  },

  registrarCobroEnTransaccion: async (client, id, monto, usuario_id) => {
    const { rows: filaActual } = await client.query(
      `SELECT * FROM cuentas_por_cobrar WHERE id = $1 AND activo = true AND usuario_id = $2 FOR UPDATE`,
      [id, usuario_id]
    );

    if (!filaActual[0]) {
      throw { status: 404, message: "Cuenta por cobrar no encontrada." };
    }

    if (Number(monto) > Number(filaActual[0].saldo_pendiente)) {
      throw { status: 400, message: `El cobro (${monto}) supera el saldo pendiente (${filaActual[0].saldo_pendiente}).` };
    }

    const nuevoSaldo = Math.round((Number(filaActual[0].saldo_pendiente) - Number(monto)) * 100) / 100;
    const nuevoEstado = nuevoSaldo === 0 ? "cobrado" : "parcial";

    const { rows } = await client.query(
      `UPDATE cuentas_por_cobrar SET saldo_pendiente = $1, estado = $2
       WHERE id = $3 AND usuario_id = $4 RETURNING *`,
      [nuevoSaldo, nuevoEstado, id, usuario_id]
    );
    return rows[0];
  },

  getTotalPendiente: async (usuario_id) => {
    const { rows } = await pool.query(
      `SELECT COALESCE(SUM(saldo_pendiente), 0) AS total FROM cuentas_por_cobrar
       WHERE activo = true AND usuario_id = $1 AND estado != 'cobrado'`,
      [usuario_id]
    );
    return rows[0].total;
  },
};

export default CuentaPorCobrarModel;
