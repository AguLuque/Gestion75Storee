// Tests de integración contra la base real de Supabase — ver la nota de seguridad
// en test/venta.service.test.js sobre por qué se usa el patrón de crear+limpiar en vez de ROLLBACK.

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import dotenv from "dotenv";
dotenv.config();

import pool from "../src/config/db.js";
import DeudorModel from "../src/models/deudor.model.js";

const MARCA = "__TEST_AUDITORIA__";
const OTRO_UID = "11111111-1111-1111-1111-111111111111";

let REAL_UID;
const deudoresCreados = [];

before(async () => {
  const { rows } = await pool.query(
    `SELECT usuario_id FROM productos WHERE usuario_id IS NOT NULL LIMIT 1`
  );
  if (!rows[0]) throw new Error("No hay ningún usuario_id existente para usar en los tests.");
  REAL_UID = rows[0].usuario_id;
});

after(async () => {
  for (const id of deudoresCreados) {
    try {
      await pool.query(`DELETE FROM deudores WHERE id = $1`, [id]);
    } catch (err) {
      console.error(`No se pudo limpiar el deudor de prueba ${id}:`, err.message);
    }
  }
  await pool.end();
});

test("un deudor nuevo arranca como no pagado", async () => {
  const d = await DeudorModel.create({
    nombre: `${MARCA} deudor`, monto: 5000, plazo: null, observaciones: null, usuario_id: REAL_UID,
  });
  deudoresCreados.push(d.id);

  assert.equal(d.pagado, false);
  assert.equal(d.fecha_pago, null);
});

test("marcar como pagado guarda fecha_pago, y desmarcar la limpia", async () => {
  const d = await DeudorModel.create({
    nombre: `${MARCA} deudor`, monto: 3000, plazo: null, observaciones: null, usuario_id: REAL_UID,
  });
  deudoresCreados.push(d.id);

  const pagado = await DeudorModel.marcarPagado(d.id, true, REAL_UID);
  assert.equal(pagado.pagado, true);
  assert.ok(pagado.fecha_pago, "fecha_pago debe quedar seteada al marcar como pagado");

  const pendienteDeNuevo = await DeudorModel.marcarPagado(d.id, false, REAL_UID);
  assert.equal(pendienteDeNuevo.pagado, false);
  assert.equal(pendienteDeNuevo.fecha_pago, null, "fecha_pago debe limpiarse al volver a pendiente");
});

test("no se puede marcar como pagado un deudor de otro usuario", async () => {
  const d = await DeudorModel.create({
    nombre: `${MARCA} deudor`, monto: 1000, plazo: null, observaciones: null, usuario_id: REAL_UID,
  });
  deudoresCreados.push(d.id);

  const resultado = await DeudorModel.marcarPagado(d.id, true, OTRO_UID);
  assert.equal(resultado, null);

  const sinTocar = await pool.query(`SELECT pagado FROM deudores WHERE id = $1`, [d.id]);
  assert.equal(sinTocar.rows[0].pagado, false, "el estado no debe cambiar tras un intento ajeno");
});
