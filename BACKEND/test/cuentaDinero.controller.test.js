// BACKEND/test/cuentaDinero.controller.test.js
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import dotenv from "dotenv";
dotenv.config();

import pool from "../src/config/db.js";
import CuentaDineroController from "../src/controllers/cuentaDinero.controller.js";
import CuentaDineroModel from "../src/models/cuentaDinero.model.js";

const MARCA = "__TEST_AJUSTE__";
let REAL_UID;
let cuentaDineroId;
let cuentaDineroIdConSaldoInicial;
const movimientosCreados = [];

before(async () => {
  const { rows } = await pool.query(
    `SELECT usuario_id FROM productos WHERE usuario_id IS NOT NULL LIMIT 1`
  );
  if (!rows[0]) throw new Error("No hay ningún usuario_id existente para usar en los tests.");
  REAL_UID = rows[0].usuario_id;

  // Crear cuenta sin saldo inicial
  const cuenta1 = await pool.query(
    `INSERT INTO cuentas_dinero (nombre, tipo, saldo_inicial, usuario_id) VALUES ($1,'efectivo',0,$2) RETURNING id`,
    [`${MARCA} cuenta 1`, REAL_UID]
  );
  cuentaDineroId = cuenta1.rows[0].id;

  // Crear cuenta con saldo inicial de 1000
  const cuenta2 = await pool.query(
    `INSERT INTO cuentas_dinero (nombre, tipo, saldo_inicial, usuario_id) VALUES ($1,'banco',1000,$2) RETURNING id`,
    [`${MARCA} cuenta 2`, REAL_UID]
  );
  cuentaDineroIdConSaldoInicial = cuenta2.rows[0].id;
});

after(async () => {
  for (const id of movimientosCreados) {
    await pool.query(`DELETE FROM movimientos_financieros WHERE id = $1`, [id]).catch(() => {});
  }
  await pool.query(`DELETE FROM cuentas_dinero WHERE id IN ($1, $2)`, [cuentaDineroId, cuentaDineroIdConSaldoInicial]);
  await pool.end();
});

function crearReqRes(body) {
  let statusCode = 200;
  let jsonBody = null;
  const res = {
    status(code) { statusCode = code; return this; },
    json(body) { jsonBody = body; return this; },
  };
  const req = { body, usuario_id: REAL_UID };
  return { req, res, getStatus: () => statusCode, getJson: () => jsonBody };
}

test("crear ajuste de ingreso crea movimiento_financiero con tipo ingreso y origen_tipo ajuste_manual", async () => {
  const { req, res, getJson, getStatus } = crearReqRes({
    monto: 500,
    tipo: "ingreso",
    descripcion: `${MARCA} ajuste ingreso`,
  });
  req.params = { id: cuentaDineroId };

  await CuentaDineroController.crearAjuste(req, res, (err) => { throw err; });

  assert.equal(getStatus(), 201, "Debería devolver 201");
  const movimiento = getJson().data;
  assert.ok(movimiento.id, "Debería retornar el movimiento creado");
  movimientosCreados.push(movimiento.id);
  assert.equal(movimiento.tipo, "ingreso");
  assert.equal(movimiento.categoria, "ajuste_manual");
  assert.equal(movimiento.origen_tipo, "ajuste_manual");
  assert.equal(Number(movimiento.monto), 500);
  assert.equal(movimiento.cuenta_dinero_id, cuentaDineroId);

  // Verificar que el saldo cambió
  const saldo = await CuentaDineroModel.getSaldo(cuentaDineroId, REAL_UID);
  assert.equal(saldo, 500);
});

test("crear ajuste de egreso crea movimiento_financiero con tipo egreso y origen_tipo ajuste_manual", async () => {
  const { req, res, getJson, getStatus } = crearReqRes({
    monto: 200,
    tipo: "egreso",
    descripcion: `${MARCA} ajuste egreso`,
  });
  req.params = { id: cuentaDineroIdConSaldoInicial };

  await CuentaDineroController.crearAjuste(req, res, (err) => { throw err; });

  assert.equal(getStatus(), 201, "Debería devolver 201");
  const movimiento = getJson().data;
  assert.ok(movimiento.id, "Debería retornar el movimiento creado");
  movimientosCreados.push(movimiento.id);
  assert.equal(movimiento.tipo, "egreso");
  assert.equal(movimiento.categoria, "ajuste_manual");
  assert.equal(movimiento.origen_tipo, "ajuste_manual");
  assert.equal(Number(movimiento.monto), 200);

  // Verificar que el saldo cambió (1000 - 200 = 800)
  const saldo = await CuentaDineroModel.getSaldo(cuentaDineroIdConSaldoInicial, REAL_UID);
  assert.equal(saldo, 800);
});

test("rechaza ajuste con monto faltante", async () => {
  const { req, res, getStatus, getJson } = crearReqRes({
    tipo: "ingreso",
  });
  req.params = { id: cuentaDineroId };

  await CuentaDineroController.crearAjuste(req, res, (err) => { throw err; });

  assert.equal(getStatus(), 400);
  assert.ok(getJson().error.includes("monto debe ser mayor a 0"));
});

test("rechaza ajuste con monto <= 0", async () => {
  const { req, res, getStatus, getJson } = crearReqRes({
    monto: 0,
    tipo: "ingreso",
  });
  req.params = { id: cuentaDineroId };

  await CuentaDineroController.crearAjuste(req, res, (err) => { throw err; });

  assert.equal(getStatus(), 400);
  assert.ok(getJson().error.includes("monto debe ser mayor a 0"));
});

test("rechaza ajuste con tipo inválido", async () => {
  const { req, res, getStatus, getJson } = crearReqRes({
    monto: 500,
    tipo: "transferencia",
  });
  req.params = { id: cuentaDineroId };

  await CuentaDineroController.crearAjuste(req, res, (err) => { throw err; });

  assert.equal(getStatus(), 400);
  assert.ok(getJson().error.includes("tipo debe ser 'ingreso' o 'egreso'"));
});

test("rechaza ajuste para cuenta no existente", async () => {
  const { req, res, getStatus, getJson } = crearReqRes({
    monto: 500,
    tipo: "ingreso",
  });
  req.params = { id: 99999 };

  await CuentaDineroController.crearAjuste(req, res, (err) => { throw err; });

  assert.equal(getStatus(), 404);
  assert.ok(getJson().error.includes("Cuenta no encontrada"));
});

test("usa descripción por defecto si no se proporciona", async () => {
  const { req, res, getJson } = crearReqRes({
    monto: 100,
    tipo: "ingreso",
  });
  req.params = { id: cuentaDineroId };

  await CuentaDineroController.crearAjuste(req, res, (err) => { throw err; });

  const movimiento = getJson().data;
  movimientosCreados.push(movimiento.id);
  assert.equal(movimiento.descripcion, "Ajuste manual de saldo");
});
