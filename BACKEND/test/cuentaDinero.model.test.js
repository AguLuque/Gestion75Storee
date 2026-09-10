import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import dotenv from "dotenv";
dotenv.config();

import pool from "../src/config/db.js";
import CuentaDineroModel from "../src/models/cuentaDinero.model.js";

const MARCA = "__TEST_FINANZAS__";
let REAL_UID;
const cuentasCreadas = [];

before(async () => {
  const { rows } = await pool.query(
    `SELECT usuario_id FROM productos WHERE usuario_id IS NOT NULL LIMIT 1`
  );
  if (!rows[0]) throw new Error("No hay ningún usuario_id existente para usar en los tests.");
  REAL_UID = rows[0].usuario_id;
});

after(async () => {
  for (const id of cuentasCreadas) {
    await pool.query(`DELETE FROM movimientos_financieros WHERE cuenta_dinero_id = $1`, [id]);
    await pool.query(`DELETE FROM cuentas_dinero WHERE id = $1`, [id]).catch(() => {});
  }
  await pool.end();
});

test("crear una cuenta de dinero con saldo inicial", async () => {
  const cuenta = await CuentaDineroModel.create({
    nombre: `${MARCA} Naranja X`, tipo: "billetera_virtual", saldo_inicial: 1000, usuario_id: REAL_UID,
  });
  cuentasCreadas.push(cuenta.id);

  assert.equal(cuenta.nombre, `${MARCA} Naranja X`);
  assert.equal(Number(cuenta.saldo_inicial), 1000);
  assert.equal(cuenta.activo, true);
});

test("getSaldo sin movimientos devuelve el saldo inicial", async () => {
  const cuenta = await CuentaDineroModel.create({
    nombre: `${MARCA} Caja`, tipo: "efectivo", saldo_inicial: 500, usuario_id: REAL_UID,
  });
  cuentasCreadas.push(cuenta.id);

  const saldo = await CuentaDineroModel.getSaldo(cuenta.id, REAL_UID);
  assert.equal(saldo, 500);
});

test("getSaldo suma ingresos y resta egresos", async () => {
  const cuenta = await CuentaDineroModel.create({
    nombre: `${MARCA} Banco`, tipo: "banco", saldo_inicial: 0, usuario_id: REAL_UID,
  });
  cuentasCreadas.push(cuenta.id);

  await pool.query(
    `INSERT INTO movimientos_financieros (fecha, tipo, categoria, monto, cuenta_dinero_id, origen_tipo, usuario_id)
     VALUES (CURRENT_DATE, 'ingreso', 'venta_productos', 800, $1, 'ajuste_manual', $2)`,
    [cuenta.id, REAL_UID]
  );
  await pool.query(
    `INSERT INTO movimientos_financieros (fecha, tipo, categoria, monto, cuenta_dinero_id, origen_tipo, usuario_id)
     VALUES (CURRENT_DATE, 'egreso', 'otros_gastos', 300, $1, 'ajuste_manual', $2)`,
    [cuenta.id, REAL_UID]
  );

  const saldo = await CuentaDineroModel.getSaldo(cuenta.id, REAL_UID);
  assert.equal(saldo, 500);
});

test("no se puede ver el saldo de una cuenta de otro usuario", async () => {
  const cuenta = await CuentaDineroModel.create({
    nombre: `${MARCA} Ajena`, tipo: "efectivo", saldo_inicial: 999, usuario_id: REAL_UID,
  });
  cuentasCreadas.push(cuenta.id);

  const saldo = await CuentaDineroModel.getSaldo(cuenta.id, "11111111-1111-1111-1111-111111111111");
  assert.equal(saldo, null);
});
