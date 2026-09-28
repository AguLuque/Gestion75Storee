// src/services/gasto.service.js
// Editar un gasto en una sola transacción, manteniendo su movimiento
// financiero en sincronía. Antes el update solo tocaba la fila de gastos: si
// el gasto se había pagado desde una cuenta, al cambiarle el monto la cuenta
// seguía descontando el monto viejo.

import pool from "../config/db.js";
import MovimientoFinancieroModel from "../models/movimientoFinanciero.model.js";
import CuentaDineroModel from "../models/cuentaDinero.model.js";
import { normalizarCategoriaGasto } from "../constants/finanzas.js";

// Cuenta del pago vigente: la del último egreso del gasto (el de id más alto;
// las reversiones son ingresos). null si nunca se pagó desde una cuenta.
const cuentaDelPagoVigente = (movimientos) => {
  const ultimoEgreso = movimientos
    .filter((m) => m.tipo === "egreso")
    .sort((a, b) => Number(b.id) - Number(a.id))[0];
  return ultimoEgreso?.cuenta_dinero_id ?? null;
};

const editarGasto = async (id, { descripcion, monto, categoria, metodo_pago }, usuario_id) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const { rows: anteriorRows } = await client.query(
      `SELECT * FROM gastos WHERE id = $1 AND usuario_id = $2 FOR UPDATE`,
      [id, usuario_id]
    );
    const anterior = anteriorRows[0];
    if (!anterior) {
      throw { status: 404, message: "Gasto no encontrado." };
    }

    const { rows: actualizadoRows } = await client.query(
      `UPDATE gastos
       SET descripcion = $1, monto = $2, categoria = $3, metodo_pago = $4
       WHERE id = $5 AND usuario_id = $6
       RETURNING *`,
      [descripcion, monto, categoria, metodo_pago ?? null, id, usuario_id]
    );
    const actualizado = actualizadoRows[0];

    // Solo el monto y la categoría llegan al libro de movimientos: si se
    // corrigió la descripción o el método de pago, no se lo ensucia.
    const cambioMonto = Number(anterior.monto) !== Number(actualizado.monto);
    const cambioCategoria =
      normalizarCategoriaGasto(anterior.categoria) !== normalizarCategoriaGasto(actualizado.categoria);

    if (cambioMonto || cambioCategoria) {
      const { rows: movimientos } = await client.query(
        `SELECT * FROM movimientos_financieros WHERE origen_tipo = 'gasto' AND origen_id = $1 AND usuario_id = $2`,
        [id, usuario_id]
      );
      const cuentaId = cuentaDelPagoVigente(movimientos);

      // Gasto que nunca se pagó desde una cuenta: no hay nada que ajustar.
      if (cuentaId) {
        const cuenta = await CuentaDineroModel.getById(cuentaId, usuario_id);
        if (!cuenta) {
          throw {
            status: 400,
            message:
              "La cuenta con la que se pagó este gasto fue eliminada: no se puede cambiar el monto ni la categoría. Eliminá el gasto y cargalo de nuevo.",
          };
        }

        // Mismo criterio que editar una compra: se revierten todos los
        // movimientos del gasto y se registra el egreso con los datos nuevos.
        for (const mov of movimientos) {
          await MovimientoFinancieroModel.createEnTransaccion(client, {
            fecha: new Date().toISOString().slice(0, 10),
            tipo: mov.tipo === "ingreso" ? "egreso" : "ingreso",
            categoria: mov.categoria,
            monto: mov.monto,
            cuenta_dinero_id: mov.cuenta_dinero_id,
            origen_tipo: "gasto",
            origen_id: id,
            descripcion: `Reversión por edición de gasto #${id}`,
            usuario_id,
          });
        }

        // Un gasto editado a $0 queda solo revertido (el libro no admite montos 0).
        if (Number(actualizado.monto) > 0) {
          await MovimientoFinancieroModel.createEnTransaccion(client, {
            fecha: new Date().toISOString().slice(0, 10),
            tipo: "egreso",
            categoria: normalizarCategoriaGasto(actualizado.categoria),
            monto: actualizado.monto,
            cuenta_dinero_id: cuentaId,
            origen_tipo: "gasto",
            origen_id: id,
            descripcion: `Gasto #${id}: ${actualizado.descripcion} (editado)`,
            usuario_id,
          });
        }
      }
    }

    await client.query("COMMIT");
    return actualizado;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
};

export default { editarGasto };
