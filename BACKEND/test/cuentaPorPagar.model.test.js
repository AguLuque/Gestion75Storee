// BACKEND/test/cuentaPorPagar.model.test.js
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import dotenv from "dotenv";
dotenv.config();

import pool from "../src/config/db.js";
import CuentaPorPagarModel from "../src/models/cuentaPorPagar.model.js";

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
    await pool.query(`DELETE FROM cuentas_por_pagar WHERE id = $1`, [id]).catch(() => {});
  }
  await pool.end();
});

test("crear una cuenta por pagar arranca en estado pendiente con saldo igual al total", async () => {
  const cxp = await CuentaPorPagarModel.create({
    compra_id: null, proveedor_id: null, monto_total: 5000,
    fecha_emision: "2026-01-10", fecha_vencimiento: "2026-02-10", usuario_id: REAL_UID,
  });
  cuentasCreadas.push(cxp.id);

  assert.equal(cxp.estado, "pendiente");
  assert.equal(Number(cxp.saldo_pendiente), 5000);
});

test("un pago parcial deja estado parcial y decrementa el saldo", async () => {
  const cxp = await CuentaPorPagarModel.create({
    compra_id: null, proveedor_id: null, monto_total: 1000,
    fecha_emision: "2026-01-10", fecha_vencimiento: null, usuario_id: REAL_UID,
  });
  cuentasCreadas.push(cxp.id);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const actualizada = await CuentaPorPagarModel.registrarPagoEnTransaccion(client, cxp.id, 400, REAL_UID);
    await client.query("COMMIT");
    assert.equal(actualizada.estado, "parcial");
    assert.equal(Number(actualizada.saldo_pendiente), 600);
  } finally {
    client.release();
  }
});

test("un pago que cubre el saldo total deja estado pagado", async () => {
  const cxp = await CuentaPorPagarModel.create({
    compra_id: null, proveedor_id: null, monto_total: 800,
    fecha_emision: "2026-01-10", fecha_vencimiento: null, usuario_id: REAL_UID,
  });
  cuentasCreadas.push(cxp.id);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const actualizada = await CuentaPorPagarModel.registrarPagoEnTransaccion(client, cxp.id, 800, REAL_UID);
    await client.query("COMMIT");
    assert.equal(actualizada.estado, "pagado");
    assert.equal(Number(actualizada.saldo_pendiente), 0);
  } finally {
    client.release();
  }
});

test("un pago mayor al saldo pendiente es rechazado", async () => {
  const cxp = await CuentaPorPagarModel.create({
    compra_id: null, proveedor_id: null, monto_total: 100,
    fecha_emision: "2026-01-10", fecha_vencimiento: null, usuario_id: REAL_UID,
  });
  cuentasCreadas.push(cxp.id);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await assert.rejects(
      () => CuentaPorPagarModel.registrarPagoEnTransaccion(client, cxp.id, 150, REAL_UID),
      (err) => err.status === 400
    );
    await client.query("ROLLBACK");
  } finally {
    client.release();
  }
});

test("una secuencia de pagos parciales cuya suma exacta cubre el total termina en estado pagado con saldo cero", async () => {
  const cxp = await CuentaPorPagarModel.create({
    compra_id: null, proveedor_id: null, monto_total: 1000.00,
    fecha_emision: "2026-01-10", fecha_vencimiento: null, usuario_id: REAL_UID,
  });
  cuentasCreadas.push(cxp.id);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await CuentaPorPagarModel.registrarPagoEnTransaccion(client, cxp.id, 333.33, REAL_UID);
    await CuentaPorPagarModel.registrarPagoEnTransaccion(client, cxp.id, 333.33, REAL_UID);
    const actualizada = await CuentaPorPagarModel.registrarPagoEnTransaccion(client, cxp.id, 333.34, REAL_UID);
    await client.query("COMMIT");
    assert.equal(actualizada.estado, "pagado");
    assert.equal(Number(actualizada.saldo_pendiente), 0);
  } finally {
    client.release();
  }
});

test("getTotalPendiente suma el saldo_pendiente de todas las cuentas no pagadas del usuario", async () => {
  const c1 = await CuentaPorPagarModel.create({
    compra_id: null, proveedor_id: null, monto_total: 300,
    fecha_emision: "2026-01-10", fecha_vencimiento: null, usuario_id: REAL_UID,
  });
  const c2 = await CuentaPorPagarModel.create({
    compra_id: null, proveedor_id: null, monto_total: 200,
    fecha_emision: "2026-01-10", fecha_vencimiento: null, usuario_id: REAL_UID,
  });
  cuentasCreadas.push(c1.id, c2.id);

  const total = await CuentaPorPagarModel.getTotalPendiente(REAL_UID);
  assert.ok(Number(total) >= 500, "debe incluir al menos las dos cuentas recién creadas");
});
