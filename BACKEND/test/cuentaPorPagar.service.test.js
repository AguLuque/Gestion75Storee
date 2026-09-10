import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import dotenv from "dotenv";
dotenv.config();

import pool from "../src/config/db.js";
import CuentaPorPagarModel from "../src/models/cuentaPorPagar.model.js";
import CuentaDineroModel from "../src/models/cuentaDinero.model.js";
import CuentaPorPagarService from "../src/services/cuentaPorPagar.service.js";

const MARCA = "__TEST_FINANZAS__";
let REAL_UID;
const cuentasCxPCreadas = [];
let cuentaDineroId;

before(async () => {
  const { rows } = await pool.query(
    `SELECT usuario_id FROM productos WHERE usuario_id IS NOT NULL LIMIT 1`
  );
  if (!rows[0]) throw new Error("No hay ningún usuario_id existente para usar en los tests.");
  REAL_UID = rows[0].usuario_id;

  const cuenta = await pool.query(
    `INSERT INTO cuentas_dinero (nombre, tipo, saldo_inicial, usuario_id) VALUES ($1,'efectivo',1000,$2) RETURNING id`,
    [`${MARCA} cuenta pago`, REAL_UID]
  );
  cuentaDineroId = cuenta.rows[0].id;
});

after(async () => {
  for (const id of cuentasCxPCreadas) {
    await pool.query(`DELETE FROM movimientos_financieros WHERE origen_tipo = 'cuenta_por_pagar' AND origen_id = $1`, [id]);
    await pool.query(`DELETE FROM cuentas_por_pagar WHERE id = $1`, [id]).catch(() => {});
  }
  await pool.query(`DELETE FROM cuentas_dinero WHERE id = $1`, [cuentaDineroId]);
  await pool.end();
});

test("registrar un pago parcial decrementa el saldo y crea un movimiento de egreso", async () => {
  const cxp = await CuentaPorPagarModel.create({
    compra_id: null, proveedor_id: null, monto_total: 1000,
    fecha_emision: "2026-01-10", fecha_vencimiento: null, usuario_id: REAL_UID,
  });
  cuentasCxPCreadas.push(cxp.id);

  const actualizada = await CuentaPorPagarService.registrarPago(cxp.id, {
    monto: 400, cuenta_dinero_id: cuentaDineroId,
  }, REAL_UID);

  assert.equal(actualizada.estado, "parcial");
  assert.equal(Number(actualizada.saldo_pendiente), 600);

  const saldoCuenta = await CuentaDineroModel.getSaldo(cuentaDineroId, REAL_UID);
  assert.equal(Number(saldoCuenta), 600);

  const { rows: movs } = await pool.query(
    `SELECT * FROM movimientos_financieros WHERE origen_tipo = 'cuenta_por_pagar' AND origen_id = $1`,
    [cxp.id]
  );
  assert.equal(movs.length, 1);
  assert.equal(movs[0].tipo, "egreso");
  assert.equal(Number(movs[0].monto), 400);
});

test("un pago con cuenta de dinero de otro usuario es rechazado y no modifica el saldo pendiente", async () => {
  const cxp = await CuentaPorPagarModel.create({
    compra_id: null, proveedor_id: null, monto_total: 500,
    fecha_emision: "2026-01-10", fecha_vencimiento: null, usuario_id: REAL_UID,
  });
  cuentasCxPCreadas.push(cxp.id);

  await assert.rejects(
    () => CuentaPorPagarService.registrarPago(cxp.id, { monto: 100, cuenta_dinero_id: cuentaDineroId }, "11111111-1111-1111-1111-111111111111"),
    (err) => err.status === 404
  );
});

test("un pago mayor al saldo pendiente es rechazado y no crea movimiento", async () => {
  const cxp = await CuentaPorPagarModel.create({
    compra_id: null, proveedor_id: null, monto_total: 100,
    fecha_emision: "2026-01-10", fecha_vencimiento: null, usuario_id: REAL_UID,
  });
  cuentasCxPCreadas.push(cxp.id);

  await assert.rejects(
    () => CuentaPorPagarService.registrarPago(cxp.id, { monto: 200, cuenta_dinero_id: cuentaDineroId }, REAL_UID),
    (err) => err.status === 400
  );

  const { rows: movs } = await pool.query(
    `SELECT * FROM movimientos_financieros WHERE origen_tipo = 'cuenta_por_pagar' AND origen_id = $1`,
    [cxp.id]
  );
  assert.equal(movs.length, 0);
});
