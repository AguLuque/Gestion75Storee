// BACKEND/test/cuentaPorCobrar.model.test.js
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import dotenv from "dotenv";
dotenv.config();

import pool from "../src/config/db.js";
import CuentaPorCobrarModel from "../src/models/cuentaPorCobrar.model.js";

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
    await pool.query(`DELETE FROM cuentas_por_cobrar WHERE id = $1`, [id]).catch(() => {});
  }
  await pool.end();
});

test("crear una cuenta por cobrar arranca en estado pendiente con saldo igual al total", async () => {
  const cxc = await CuentaPorCobrarModel.create({
    venta_id: null, cliente_nombre: `${MARCA} cliente`, monto_total: 5000,
    fecha_emision: "2026-01-10", fecha_vencimiento: "2026-02-10", usuario_id: REAL_UID,
  });
  cuentasCreadas.push(cxc.id);

  assert.equal(cxc.estado, "pendiente");
  assert.equal(Number(cxc.saldo_pendiente), 5000);
});

test("un cobro parcial deja estado parcial y decrementa el saldo", async () => {
  const cxc = await CuentaPorCobrarModel.create({
    venta_id: null, cliente_nombre: `${MARCA} cliente`, monto_total: 1000,
    fecha_emision: "2026-01-10", fecha_vencimiento: null, usuario_id: REAL_UID,
  });
  cuentasCreadas.push(cxc.id);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const actualizada = await CuentaPorCobrarModel.registrarCobroEnTransaccion(client, cxc.id, 400, REAL_UID);
    await client.query("COMMIT");
    assert.equal(actualizada.estado, "parcial");
    assert.equal(Number(actualizada.saldo_pendiente), 600);
  } finally {
    client.release();
  }
});

test("un cobro que cubre el saldo total deja estado cobrado", async () => {
  const cxc = await CuentaPorCobrarModel.create({
    venta_id: null, cliente_nombre: `${MARCA} cliente`, monto_total: 800,
    fecha_emision: "2026-01-10", fecha_vencimiento: null, usuario_id: REAL_UID,
  });
  cuentasCreadas.push(cxc.id);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const actualizada = await CuentaPorCobrarModel.registrarCobroEnTransaccion(client, cxc.id, 800, REAL_UID);
    await client.query("COMMIT");
    assert.equal(actualizada.estado, "cobrado");
    assert.equal(Number(actualizada.saldo_pendiente), 0);
  } finally {
    client.release();
  }
});

test("un cobro mayor al saldo pendiente es rechazado", async () => {
  const cxc = await CuentaPorCobrarModel.create({
    venta_id: null, cliente_nombre: `${MARCA} cliente`, monto_total: 100,
    fecha_emision: "2026-01-10", fecha_vencimiento: null, usuario_id: REAL_UID,
  });
  cuentasCreadas.push(cxc.id);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await assert.rejects(
      () => CuentaPorCobrarModel.registrarCobroEnTransaccion(client, cxc.id, 150, REAL_UID),
      (err) => err.status === 400
    );
    await client.query("ROLLBACK");
  } finally {
    client.release();
  }
});

test("getTotalPendiente suma el saldo_pendiente de todas las cuentas no cobradas del usuario", async () => {
  const c1 = await CuentaPorCobrarModel.create({
    venta_id: null, cliente_nombre: `${MARCA} cliente 1`, monto_total: 300,
    fecha_emision: "2026-01-10", fecha_vencimiento: null, usuario_id: REAL_UID,
  });
  const c2 = await CuentaPorCobrarModel.create({
    venta_id: null, cliente_nombre: `${MARCA} cliente 2`, monto_total: 200,
    fecha_emision: "2026-01-10", fecha_vencimiento: null, usuario_id: REAL_UID,
  });
  cuentasCreadas.push(c1.id, c2.id);

  const total = await CuentaPorCobrarModel.getTotalPendiente(REAL_UID);
  assert.ok(Number(total) >= 500, "debe incluir al menos las dos cuentas recién creadas");
});
