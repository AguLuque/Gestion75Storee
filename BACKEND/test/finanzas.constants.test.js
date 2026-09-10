// BACKEND/test/finanzas.constants.test.js
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  CATEGORIAS_GASTO,
  normalizarCategoriaGasto,
} from "../src/constants/finanzas.js";

test("normaliza las categorías sugeridas actuales del frontend a valores canónicos", () => {
  assert.equal(normalizarCategoriaGasto("Alquiler"), CATEGORIAS_GASTO.ALQUILER);
  assert.equal(normalizarCategoriaGasto("Servicios"), CATEGORIAS_GASTO.SERVICIOS);
  assert.equal(normalizarCategoriaGasto("Transporte"), CATEGORIAS_GASTO.COMBUSTIBLE);
  assert.equal(normalizarCategoriaGasto("Marketing"), CATEGORIAS_GASTO.MARKETING);
  assert.equal(normalizarCategoriaGasto("Personal"), CATEGORIAS_GASTO.SUELDOS);
  assert.equal(normalizarCategoriaGasto("Impuestos"), CATEGORIAS_GASTO.IMPUESTOS);
  assert.equal(normalizarCategoriaGasto("Otros"), CATEGORIAS_GASTO.OTROS_GASTOS);
});

test("es insensible a mayúsculas, tildes y espacios extra", () => {
  assert.equal(normalizarCategoriaGasto("  ALQUILER  "), CATEGORIAS_GASTO.ALQUILER);
  assert.equal(normalizarCategoriaGasto("cómbustible"), CATEGORIAS_GASTO.COMBUSTIBLE);
});

test("categoría desconocida o vacía cae a OTROS_GASTOS en vez de pasar texto libre", () => {
  assert.equal(normalizarCategoriaGasto("una categoria que no existe"), CATEGORIAS_GASTO.OTROS_GASTOS);
  assert.equal(normalizarCategoriaGasto(null), CATEGORIAS_GASTO.OTROS_GASTOS);
  assert.equal(normalizarCategoriaGasto(undefined), CATEGORIAS_GASTO.OTROS_GASTOS);
  assert.equal(normalizarCategoriaGasto(""), CATEGORIAS_GASTO.OTROS_GASTOS);
});
