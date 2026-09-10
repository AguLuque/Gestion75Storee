// BACKEND/test/gasto.controller.test.js
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import dotenv from "dotenv";
dotenv.config();

import pool from "../src/config/db.js";
import GastoController from "../src/controllers/gasto.controller.js";

const MARCA = "__TEST_FINANZAS__";
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
  assert.equal(movs[0].categoria, "Alquiler");
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
