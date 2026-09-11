// BACKEND/src/services/cuentaPorCobrar.service.js
// Único lugar donde una cuenta por cobrar toca movimientos_financieros:
// el cobro real de dinero, no la emisión de la venta a crédito.

import CuentaPorCobrarModel from "../models/cuentaPorCobrar.model.js";
import CuentaDineroModel from "../models/cuentaDinero.model.js";
import MovimientoFinancieroModel from "../models/movimientoFinanciero.model.js";
import { CATEGORIAS_INGRESO, ORIGEN_TIPOS } from "../constants/finanzas.js";
import pool from "../config/db.js";

const registrarCobro = async (cuentaPorCobrarId, { monto, cuenta_dinero_id }, usuario_id) => {
  if (!monto || Number(monto) <= 0) {
    throw { status: 400, message: "El monto del cobro debe ser mayor a 0." };
  }
  if (!cuenta_dinero_id) {
    throw { status: 400, message: "Se requiere indicar la cuenta de dinero que recibe el cobro." };
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const cuenta = await CuentaDineroModel.getById(cuenta_dinero_id, usuario_id);
    if (!cuenta) {
      throw { status: 404, message: "Cuenta de dinero no encontrada." };
    }

    const cxcExistente = await client.query(
      `SELECT id FROM cuentas_por_cobrar WHERE id = $1 AND activo = true AND usuario_id = $2`,
      [cuentaPorCobrarId, usuario_id]
    );
    if (!cxcExistente.rows[0]) {
      throw { status: 404, message: "Cuenta por cobrar no encontrada." };
    }

    const actualizada = await CuentaPorCobrarModel.registrarCobroEnTransaccion(client, cuentaPorCobrarId, monto, usuario_id);

    await MovimientoFinancieroModel.createEnTransaccion(client, {
      fecha: new Date().toISOString().slice(0, 10),
      tipo: "ingreso",
      categoria: CATEGORIAS_INGRESO.VENTA_PRODUCTOS,
      monto,
      cuenta_dinero_id,
      origen_tipo: ORIGEN_TIPOS.CUENTA_POR_COBRAR,
      origen_id: cuentaPorCobrarId,
      descripcion: `Cobro de cuenta por cobrar #${cuentaPorCobrarId}`,
      usuario_id,
    });

    await client.query("COMMIT");
    return actualizada;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
};

export default { registrarCobro };
