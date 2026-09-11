// BACKEND/test/gasto.controller.test.js
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import dotenv from "dotenv";
dotenv.config();

import pool from "../src/config/db.js";
import GastoController from "../src/controllers/gasto.controller.js";
import CuentaDineroModel from "../src/models/cuentaDinero.model.js";

const MARCA = "__TEST_FINANZAS__";
const OTRO_UID = "11111111-1111-1111-1111-111111111111";
let REAL_UID;
const gastosCreados = [];
let cuentaDineroId;

before(async () => {
  const { rows } = await pool.query(
    `SELECT usuario_id FROM productos WHERE usuario_id IS NOT NULL LIMIT 1`
  );
  if (!rows[0]) throw new Error("No hay ningún usuario_id existente para usar en los tests.");
  REAL_UID = rows[0].usuario_id;

  const cuenta = await pool.query(
    `INSERT INTO cuentas_dinero (nombre, tipo, saldo_inicial, usuario_id) VALUES ($1,'efectivo',0,$2) RETURNING id`,
    [`${MARCA} cuenta gasto`, REAL_UID]
  );
  cuentaDineroId = cuenta.rows[0].id;
});

after(async () => {
  for (const id of gastosCreados) {
    await pool.query(`DELETE FROM movimientos_financieros WHERE origen_tipo = 'gasto' AND origen_id = $1`, [id]);
    await pool.query(`DELETE FROM gastos WHERE id = $1`, [id]).catch(() => {});
  }
  await pool.query(`DELETE FROM cuentas_dinero WHERE id = $1`, [cuentaDineroId]);
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

test("crear un gasto con cuenta_dinero_id genera un movimiento financiero de egreso", async () => {
  const { req, res, getJson } = crearReqRes({
    descripcion: `${MARCA} gasto`, monto: 1500, categoria: "Alquiler", cuenta_dinero_id: cuentaDineroId,
  });

  await GastoController.create(req, res, (err) => { throw err; });

  const gasto = getJson().data;
  gastosCreados.push(gasto.id);

  const { rows: movs } = await pool.query(
    `SELECT * FROM movimientos_financieros WHERE origen_tipo = 'gasto' AND origen_id = $1`,
    [gasto.id]
  );
  assert.equal(movs.length, 1);
  assert.equal(movs[0].tipo, "egreso");
  assert.equal(movs[0].categoria, "alquiler");
  assert.equal(Number(movs[0].monto), 1500);
});

test("crear un gasto sin cuenta_dinero_id no genera ningun movimiento", async () => {
  const { req, res, getJson } = crearReqRes({
    descripcion: `${MARCA} gasto sin cuenta`, monto: 800, categoria: "Otros",
  });

  await GastoController.create(req, res, (err) => { throw err; });

  const gasto = getJson().data;
  gastosCreados.push(gasto.id);

  const { rows: movs } = await pool.query(
    `SELECT * FROM movimientos_financieros WHERE origen_tipo = 'gasto' AND origen_id = $1`,
    [gasto.id]
  );
  assert.equal(movs.length, 0);
});

test("rechaza gasto con monto 0", async () => {
  const { req, res, getStatus, getJson } = crearReqRes({
    descripcion: `${MARCA} gasto monto cero`, monto: 0, categoria: "Otros", cuenta_dinero_id: cuentaDineroId,
  });

  const countAntes = (await pool.query(`SELECT COUNT(*) FROM gastos WHERE descripcion = $1`, [req.body.descripcion])).rows[0].count;

  await GastoController.create(req, res, (err) => { throw err; });

  assert.equal(getStatus(), 400);
  assert.ok(getJson().error.includes("monto debe ser mayor a 0"));

  const countDespues = (await pool.query(`SELECT COUNT(*) FROM gastos WHERE descripcion = $1`, [req.body.descripcion])).rows[0].count;
  assert.equal(countDespues, countAntes, "no debe crear ninguna fila de gasto");

  const { rows: movs } = await pool.query(
    `SELECT * FROM movimientos_financieros WHERE cuenta_dinero_id = $1 AND descripcion LIKE $2`,
    [cuentaDineroId, `%${MARCA} gasto monto cero%`]
  );
  assert.equal(movs.length, 0, "no debe crear ningún movimiento");
});

test("rechaza gasto con monto negativo", async () => {
  const { req, res, getStatus, getJson } = crearReqRes({
    descripcion: `${MARCA} gasto monto negativo`, monto: -100, categoria: "Otros",
  });

  await GastoController.create(req, res, (err) => { throw err; });

  assert.equal(getStatus(), 400);
  assert.ok(getJson().error.includes("monto debe ser mayor a 0"));
});

test("rechaza gasto con cuenta_dinero_id de otro usuario y no crea gasto ni movimiento", async () => {
  const cuentaAjena = await pool.query(
    `INSERT INTO cuentas_dinero (nombre, tipo, saldo_inicial, usuario_id) VALUES ($1,'efectivo',0,$2) RETURNING id`,
    [`${MARCA} cuenta ajena gasto`, OTRO_UID]
  );
  const cuentaAjenaId = cuentaAjena.rows[0].id;

  const { req, res, getStatus, getJson } = crearReqRes({
    descripcion: `${MARCA} gasto cuenta ajena`, monto: 500, categoria: "Otros", cuenta_dinero_id: cuentaAjenaId,
  });

  await GastoController.create(req, res, (err) => { throw err; });

  assert.equal(getStatus(), 400);
  assert.ok(getJson().error.includes("no existe o no pertenece al usuario"));

  const { rows: gastos } = await pool.query(`SELECT * FROM gastos WHERE descripcion = $1`, [req.body.descripcion]);
  assert.equal(gastos.length, 0, "no debe crear ningún gasto");

  const { rows: movs } = await pool.query(
    `SELECT * FROM movimientos_financieros WHERE cuenta_dinero_id = $1`,
    [cuentaAjenaId]
  );
  assert.equal(movs.length, 0, "no debe crear ningún movimiento");

  await pool.query(`DELETE FROM cuentas_dinero WHERE id = $1`, [cuentaAjenaId]);
});

test("eliminar un gasto con cuenta_dinero_id revierte el movimiento financiero", async () => {
  const { req, res, getJson } = crearReqRes({
    descripcion: `${MARCA} gasto a eliminar`, monto: 2000, categoria: "Alquiler", cuenta_dinero_id: cuentaDineroId,
  });
  await GastoController.create(req, res, (err) => { throw err; });
  const gasto = getJson().data;
  gastosCreados.push(gasto.id);

  const saldoAntes = await CuentaDineroModel.getSaldo(cuentaDineroId, REAL_UID);

  const { req: reqDel, res: resDel, getJson: getJsonDel } = crearReqRes({});
  reqDel.params = { id: gasto.id };
  await GastoController.delete(reqDel, resDel, (err) => { throw err; });

  assert.equal(getJsonDel().success, true);

  const saldoDespues = await CuentaDineroModel.getSaldo(cuentaDineroId, REAL_UID);
  assert.equal(Number(saldoDespues), Number(saldoAntes) + 2000, "el saldo vuelve al valor previo al gasto");

  const { rows: gastoTras } = await pool.query(`SELECT * FROM gastos WHERE id = $1`, [gasto.id]);
  assert.equal(gastoTras.length, 0, "el gasto queda eliminado");
});

test("eliminar un gasto inexistente devuelve 404", async () => {
  const { req: reqDel, res: resDel, getStatus, getJson: getJsonDel } = crearReqRes({});
  reqDel.params = { id: 9999999 };
  await GastoController.delete(reqDel, resDel, (err) => { throw err; });

  assert.equal(getStatus(), 404);
  assert.ok(getJsonDel().error.includes("no encontrado"));
});

test("rechaza gasto con cuenta_dinero_id inexistente y no crea gasto ni movimiento", async () => {
  const { req, res, getStatus, getJson } = crearReqRes({
    descripcion: `${MARCA} gasto cuenta inexistente`, monto: 500, categoria: "Otros", cuenta_dinero_id: 9999999,
  });

  await GastoController.create(req, res, (err) => { throw err; });

  assert.equal(getStatus(), 400);
  assert.ok(getJson().error.includes("no existe o no pertenece al usuario"));

  const { rows: gastos } = await pool.query(`SELECT * FROM gastos WHERE descripcion = $1`, [req.body.descripcion]);
  assert.equal(gastos.length, 0, "no debe crear ningún gasto");
});
