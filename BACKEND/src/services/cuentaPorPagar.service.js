// BACKEND/src/services/cuentaPorPagar.service.js
// Único lugar donde una cuenta por pagar toca movimientos_financieros:
// el pago real de dinero, no la emisión de la compra a crédito.

import CuentaPorPagarModel from "../models/cuentaPorPagar.model.js";
import CuentaDineroModel from "../models/cuentaDinero.model.js";
import MovimientoFinancieroModel from "../models/movimientoFinanciero.model.js";
import { fechaArgentina } from "../utils/fechas.js";
import { CATEGORIAS_COSTO, ORIGEN_TIPOS } from "../constants/finanzas.js";
import pool from "../config/db.js";

const registrarPago = async (cuentaPorPagarId, { monto, cuenta_dinero_id }, usuario_id) => {
  if (!monto || Number(monto) <= 0) {
    throw { status: 400, message: "El monto del pago debe ser mayor a 0." };
  }
  if (!cuenta_dinero_id) {
    throw { status: 400, message: "Se requiere indicar la cuenta de dinero que realiza el pago." };
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const cuenta = await CuentaDineroModel.getById(cuenta_dinero_id, usuario_id);
    if (!cuenta) {
      throw { status: 404, message: "Cuenta de dinero no encontrada." };
    }

    const cxpExistente = await client.query(
      `SELECT id FROM cuentas_por_pagar WHERE id = $1 AND activo = true AND usuario_id = $2`,
      [cuentaPorPagarId, usuario_id]
    );
    if (!cxpExistente.rows[0]) {
      throw { status: 404, message: "Cuenta por pagar no encontrada." };
    }

    const actualizada = await CuentaPorPagarModel.registrarPagoEnTransaccion(client, cuentaPorPagarId, monto, usuario_id);

    await MovimientoFinancieroModel.createEnTransaccion(client, {
      fecha: fechaArgentina(),
      tipo: "egreso",
      categoria: CATEGORIAS_COSTO.COSTO_MERCADERIA,
      monto,
      cuenta_dinero_id,
      origen_tipo: ORIGEN_TIPOS.CUENTA_POR_PAGAR,
      origen_id: cuentaPorPagarId,
      descripcion: `Pago de cuenta por pagar #${cuentaPorPagarId}`,
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

export default { registrarPago };
