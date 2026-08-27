// Tests de integración contra la base real de Supabase (no hay un entorno de test separado).
//
// Nota sobre seguridad de estos tests: VentaService.crearVenta/eliminarVenta abren y
// confirman (COMMIT) su propia transacción internamente, así que no se pueden envolver
// en una transacción externa con ROLLBACK — el COMMIT interno persistiría igual.
// En su lugar, cada test crea únicamente productos/ventas sintéticos marcados con el
// prefijo "__TEST_AUDITORIA__", nunca lee ni modifica una fila que no haya creado él
// mismo, y el hook `after` los borra a todos al final de la corrida.

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import dotenv from "dotenv";
dotenv.config();

import pool from "../src/config/db.js";
import ProductoModel from "../src/models/producto.model.js";
import VentaService from "../src/services/venta.service.js";

const MARCA = "__TEST_AUDITORIA__";
const OTRO_UID = "11111111-1111-1111-1111-111111111111"; // usuario_id ficticio, solo se usa como parámetro

let REAL_UID;
const productosCreados = [];
const ventasCreadas = [];

before(async () => {
  const { rows } = await pool.query(
    `SELECT usuario_id FROM productos WHERE usuario_id IS NOT NULL LIMIT 1`
  );
  if (!rows[0]) throw new Error("No hay ningún usuario_id existente para usar en los tests.");
  REAL_UID = rows[0].usuario_id;
});

after(async () => {
  for (const id of ventasCreadas) {
    try {
      await pool.query(`DELETE FROM venta_items WHERE venta_id = $1`, [id]);
      await pool.query(`DELETE FROM ventas WHERE id = $1`, [id]);
    } catch (err) {
      console.error(`No se pudo limpiar la venta de prueba ${id}:`, err.message);
    }
  }
  for (const id of productosCreados) {
    try {
      await pool.query(`DELETE FROM productos WHERE id = $1`, [id]);
    } catch (err) {
      console.error(`No se pudo limpiar el producto de prueba ${id}:`, err.message);
    }
  }
  await pool.end();
});

async function productoDePrueba(overrides = {}) {
  const p = await ProductoModel.create({
    nombre: `${MARCA} producto`,
    categoria_id: null,
    precio_minorista: 100,
    precio_mayorista: 80,
    precio_compra: 50,
    stock_actual: 10,
    usuario_id: REAL_UID,
    ...overrides,
  });
  productosCreados.push(p.id);
  return p;
}

test("crear una venta con varios ítems calcula total, ganancia y descuenta stock correctamente", async () => {
  const p1 = await productoDePrueba({ stock_actual: 10, precio_compra: 50, precio_minorista: 100 });
  const p2 = await productoDePrueba({ stock_actual: 5, precio_compra: 20, precio_minorista: 40 });

  const venta = await VentaService.crearVenta({
    tipo: "minorista",
    items: [
      { producto_id: p1.id, cantidad: 2 },
      { producto_id: p2.id, cantidad: 1 },
    ],
    usuario_id: REAL_UID,
  });
  ventasCreadas.push(venta.id);

  assert.equal(Number(venta.total), 2 * 100 + 1 * 40);
  assert.equal(Number(venta.ganancia), 2 * (100 - 50) + 1 * (40 - 20));

  const p1Tras = await ProductoModel.getById(p1.id, REAL_UID);
  const p2Tras = await ProductoModel.getById(p2.id, REAL_UID);
  assert.equal(Number(p1Tras.stock_actual), 8);
  assert.equal(Number(p2Tras.stock_actual), 4);
});

test("una venta que falla a mitad de camino no deja cambios parciales (rollback)", async () => {
  const p1 = await productoDePrueba({ stock_actual: 5 });
  const p2 = await productoDePrueba({ stock_actual: 1 });

  await assert.rejects(
    () => VentaService.crearVenta({
      tipo: "minorista",
      items: [
        { producto_id: p1.id, cantidad: 2 },
        { producto_id: p2.id, cantidad: 5 }, // sin stock suficiente: debe abortar toda la venta
      ],
      usuario_id: REAL_UID,
    }),
    (err) => err.status === 400
  );

  const p1Tras = await ProductoModel.getById(p1.id, REAL_UID);
  assert.equal(Number(p1Tras.stock_actual), 5, "el stock del primer ítem no debe descontarse si el segundo falla");
});

test("dos ventas simultáneas por la última unidad: exactamente una tiene éxito", async () => {
  const p = await productoDePrueba({ stock_actual: 1 });

  const resultados = await Promise.allSettled([
    VentaService.crearVenta({ tipo: "minorista", items: [{ producto_id: p.id, cantidad: 1 }], usuario_id: REAL_UID }),
    VentaService.crearVenta({ tipo: "minorista", items: [{ producto_id: p.id, cantidad: 1 }], usuario_id: REAL_UID }),
  ]);

  const exitosas = resultados.filter((r) => r.status === "fulfilled");
  const fallidas = resultados.filter((r) => r.status === "rejected");
  assert.equal(exitosas.length, 1, "exactamente una de las dos ventas debe tener éxito");
  assert.equal(fallidas.length, 1);

  if (exitosas[0]) ventasCreadas.push(exitosas[0].value.id);

  const pTras = await ProductoModel.getById(p.id, REAL_UID);
  assert.equal(Number(pTras.stock_actual), 0, "el stock final no debe quedar negativo ni haberse descontado dos veces");
});

test("una venta a pérdida (precio manual menor al costo) calcula ganancia negativa sin recortarla", async () => {
  const p = await productoDePrueba({ stock_actual: 5, precio_compra: 100, precio_minorista: 150 });

  const venta = await VentaService.crearVenta({
    tipo: "minorista",
    items: [{ producto_id: p.id, cantidad: 1, precio_unitario: 60 }], // por debajo del costo (100)
    usuario_id: REAL_UID,
  });
  ventasCreadas.push(venta.id);

  assert.equal(Number(venta.total), 60);
  assert.equal(Number(venta.ganancia), 60 - 100);
});

test("anular una venta repone el stock descontado", async () => {
  const p = await productoDePrueba({ stock_actual: 10 });

  const venta = await VentaService.crearVenta({
    tipo: "minorista", items: [{ producto_id: p.id, cantidad: 4 }], usuario_id: REAL_UID,
  });
  ventasCreadas.push(venta.id); // eliminarVenta solo desactiva la venta, no borra la fila — hay que limpiarla igual

  const pTrasVenta = await ProductoModel.getById(p.id, REAL_UID);
  assert.equal(Number(pTrasVenta.stock_actual), 6);

  await VentaService.eliminarVenta(venta.id, REAL_UID);

  const pTrasAnular = await ProductoModel.getById(p.id, REAL_UID);
  assert.equal(Number(pTrasAnular.stock_actual), 10, "el stock debe volver al valor original");
});

test("no se puede vender un producto de otro usuario", async () => {
  const p = await productoDePrueba({ stock_actual: 5, precio_compra: 999 });

  await assert.rejects(
    () => VentaService.crearVenta({ tipo: "minorista", items: [{ producto_id: p.id, cantidad: 1 }], usuario_id: OTRO_UID }),
    (err) => err.status === 404
  );

  const pTras = await ProductoModel.getById(p.id, REAL_UID);
  assert.equal(Number(pTras.stock_actual), 5, "el stock no debe cambiar tras un intento de venta ajena");
});

test("un método de pago inválido es rechazado", async () => {
  const p = await productoDePrueba({ stock_actual: 5 });

  await assert.rejects(
    () => VentaService.crearVenta({
      tipo: "minorista", metodo_pago: "bitcoin", items: [{ producto_id: p.id, cantidad: 1 }], usuario_id: REAL_UID,
    }),
    (err) => err.status === 400
  );
});
