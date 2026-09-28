// BACKEND/src/services/cuentaPorCobrar.service.js
// Único lugar donde una cuenta por cobrar toca movimientos_financieros:
// el cobro real de dinero, no la emisión de la venta a crédito.

import CuentaPorCobrarModel from "../models/cuentaPorCobrar.model.js";
import CuentaDineroModel from "../models/cuentaDinero.model.js";
import MovimientoFinancieroModel from "../models/movimientoFinanciero.model.js";
import { fechaArgentina } from "../utils/fechas.js";
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
      fecha: fechaArgentina(),
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

// --- Deudas manuales ---------------------------------------------------------
// Cuentas por cobrar sin venta_id: "fiado" cargado a mano (reemplazan a
// Deudores). Se pueden editar y anular mientras no tengan cobros. Las que
// nacen de una venta a crédito no se tocan desde acá: se anula la venta.

const redondear = (n) => Math.round(n * 100) / 100;

const validarDatosManual = ({ cliente_nombre, monto, fecha_vencimiento }) => {
  const nombre = String(cliente_nombre ?? "").trim();
  if (!nombre) {
    throw { status: 400, message: "El nombre del cliente es obligatorio." };
  }
  const montoNumerico = Number(monto);
  if (!(montoNumerico > 0)) {
    throw { status: 400, message: "El monto tiene que ser mayor a 0." };
  }
  if (fecha_vencimiento && !/^\d{4}-\d{2}-\d{2}$/.test(fecha_vencimiento)) {
    throw { status: 400, message: "La fecha de vencimiento no es válida (formato AAAA-MM-DD)." };
  }
  return { nombre, montoNumerico };
};

const limpiarObservaciones = (observaciones) => String(observaciones ?? "").trim() || null;

// Bloquea la fila (FOR UPDATE) y verifica que sea una deuda manual del usuario.
const obtenerManualParaModificar = async (client, id, usuario_id) => {
  const { rows } = await client.query(
    `SELECT * FROM cuentas_por_cobrar WHERE id = $1 AND activo = true AND usuario_id = $2 FOR UPDATE`,
    [id, usuario_id]
  );
  const cxc = rows[0];
  if (!cxc) {
    throw { status: 404, message: "Cuenta por cobrar no encontrada." };
  }
  if (cxc.venta_id) {
    throw {
      status: 400,
      message: `Esta deuda viene de la venta #${cxc.venta_id}: se modifica o se anula desde la venta.`,
    };
  }
  return cxc;
};

// Lo ya cobrado sale de la diferencia entre total y saldo (así también cuenta
// como "con cobros" una deuda migrada de Deudores que ya estaba pagada).
const yaCobrado = (cxc) => redondear(Number(cxc.monto_total) - Number(cxc.saldo_pendiente));

const crearManual = async ({ cliente_nombre, monto, fecha_vencimiento, observaciones }, usuario_id) => {
  const { nombre, montoNumerico } = validarDatosManual({ cliente_nombre, monto, fecha_vencimiento });

  return CuentaPorCobrarModel.create({
    venta_id: null,
    cliente_nombre: nombre,
    monto_total: montoNumerico,
    fecha_emision: fechaArgentina(),
    fecha_vencimiento: fecha_vencimiento || null,
    observaciones: limpiarObservaciones(observaciones),
    usuario_id,
  });
};

const editarManual = async (id, { cliente_nombre, monto, fecha_vencimiento, observaciones }, usuario_id) => {
  const { nombre, montoNumerico } = validarDatosManual({ cliente_nombre, monto, fecha_vencimiento });

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const cxc = await obtenerManualParaModificar(client, id, usuario_id);

    // Nombre, vencimiento y observaciones se editan siempre; el monto, solo
    // si todavía no hubo cobros (si no, el saldo dejaría de cuadrar con los
    // ingresos ya registrados en las cuentas de dinero).
    let montoTotal = Number(cxc.monto_total);
    let saldo = Number(cxc.saldo_pendiente);
    if (redondear(montoNumerico) !== redondear(montoTotal)) {
      const cobrado = yaCobrado(cxc);
      if (cobrado > 0) {
        throw {
          status: 400,
          message: `Esta deuda ya tiene cobros por $${cobrado.toLocaleString("es-AR")}: no se puede cambiar el monto.`,
        };
      }
      montoTotal = montoNumerico;
      saldo = montoNumerico;
    }

    const { rows } = await client.query(
      `UPDATE cuentas_por_cobrar
       SET cliente_nombre = $1, monto_total = $2, saldo_pendiente = $3, fecha_vencimiento = $4, observaciones = $5
       WHERE id = $6 AND usuario_id = $7
       RETURNING *`,
      [nombre, montoTotal, saldo, fecha_vencimiento || null, limpiarObservaciones(observaciones), id, usuario_id]
    );

    await client.query("COMMIT");
    return rows[0];
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
};

const anularManual = async (id, usuario_id) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const cxc = await obtenerManualParaModificar(client, id, usuario_id);

    const cobrado = yaCobrado(cxc);
    if (cobrado > 0) {
      throw {
        status: 400,
        message: `Esta deuda ya tiene cobros por $${cobrado.toLocaleString("es-AR")}: no se puede anular.`,
      };
    }

    // Borrado suave, igual que el resto de la app (y que Deudores).
    const { rows } = await client.query(
      `UPDATE cuentas_por_cobrar SET activo = false WHERE id = $1 AND usuario_id = $2 RETURNING id`,
      [id, usuario_id]
    );

    await client.query("COMMIT");
    return rows[0];
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
};

export default { registrarCobro, crearManual, editarManual, anularManual };
