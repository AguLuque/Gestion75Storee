// BACKEND/src/constants/finanzas.js
// Vocabulario canónico de categorías financieras. Toda categoría que entra a
// movimientos_financieros debe salir de acá — evita que texto libre (ej. la
// categoría de gastos, hoy sugerida en el frontend pero no restringida en la
// base) ensucie el libro con variantes de mayúsculas/tildes que romperían
// cualquier reporte futuro agrupado por categoría.

export const CATEGORIAS_INGRESO = {
  VENTA_PRODUCTOS: "venta_productos",
  VENTA_SERVICIOS: "venta_servicios",
  OTROS_INGRESOS: "otros_ingresos",
};

export const CATEGORIAS_COSTO = {
  COSTO_MERCADERIA: "costo_mercaderia",
  FLETE: "flete",
  IMPORTACION: "importacion",
  COMISIONES: "comisiones",
};

export const CATEGORIAS_GASTO = {
  ALQUILER: "alquiler",
  SERVICIOS: "servicios",
  SUELDOS: "sueldos",
  MARKETING: "marketing",
  SOFTWARE: "software",
  TELEFONIA: "telefonia",
  COMBUSTIBLE: "combustible",
  MANTENIMIENTO: "mantenimiento",
  HONORARIOS: "honorarios",
  IMPUESTOS: "impuestos",
  GASTOS_BANCARIOS: "gastos_bancarios",
  OTROS_GASTOS: "otros_gastos",
};

export const CATEGORIA_AJUSTE_MANUAL = "ajuste_manual";

export const ORIGEN_TIPOS = {
  VENTA: "venta",
  COMPRA: "compra",
  GASTO: "gasto",
  CUENTA_POR_COBRAR: "cuenta_por_cobrar",
  CUENTA_POR_PAGAR: "cuenta_por_pagar",
  AJUSTE_MANUAL: "ajuste_manual",
};

// Métodos de pago que tienen sentido para cada tipo de cuenta de dinero (ej. no
// se paga "en efectivo" desde Mercado Pago). Un tipo que no está acá ('otro')
// admite cualquiera. El frontend usa el mismo mapeo (FRONTEND/src/utils.js)
// para autocompletar y limitar el selector.
export const METODOS_PAGO_POR_TIPO_CUENTA = {
  efectivo: ["efectivo"],
  banco: ["transferencia", "tarjeta"],
  billetera_virtual: ["transferencia", "tarjeta"],
};

const ETIQUETA_TIPO_CUENTA = { efectivo: "efectivo", banco: "banco", billetera_virtual: "billetera virtual", otro: "otro" };

// Sin método indicado se acepta (queda "sin especificar").
export const esMetodoPagoCompatible = (tipoCuenta, metodoPago) => {
  const permitidos = METODOS_PAGO_POR_TIPO_CUENTA[tipoCuenta];
  return !permitidos || !metodoPago || permitidos.includes(metodoPago);
};

export const errorMetodoPagoIncompatible = (cuenta, metodoPago) => ({
  status: 400,
  message: `El método de pago "${metodoPago}" no corresponde a la cuenta "${cuenta.nombre}" (${ETIQUETA_TIPO_CUENTA[cuenta.tipo] || cuenta.tipo}): usá ${METODOS_PAGO_POR_TIPO_CUENTA[cuenta.tipo].join(" o ")}.`,
});

// Mapea el texto libre actual de gastos.categoria (hoy sugerido pero no
// restringido en FRONTEND/src/pages/Gastos.jsx: Servicios, Alquiler,
// Transporte, Marketing, Personal, Impuestos, Otros) a la categoría canónica
// más cercana. Si no matchea nada conocido, cae a OTROS_GASTOS en vez de
// dejar pasar el texto original al libro de movimientos.
const MAPA_NORMALIZACION_GASTO = {
  alquiler: CATEGORIAS_GASTO.ALQUILER,
  servicios: CATEGORIAS_GASTO.SERVICIOS,
  sueldos: CATEGORIAS_GASTO.SUELDOS,
  personal: CATEGORIAS_GASTO.SUELDOS,
  marketing: CATEGORIAS_GASTO.MARKETING,
  software: CATEGORIAS_GASTO.SOFTWARE,
  telefonia: CATEGORIAS_GASTO.TELEFONIA,
  combustible: CATEGORIAS_GASTO.COMBUSTIBLE,
  transporte: CATEGORIAS_GASTO.COMBUSTIBLE,
  mantenimiento: CATEGORIAS_GASTO.MANTENIMIENTO,
  honorarios: CATEGORIAS_GASTO.HONORARIOS,
  impuestos: CATEGORIAS_GASTO.IMPUESTOS,
  "gastos bancarios": CATEGORIAS_GASTO.GASTOS_BANCARIOS,
  otros: CATEGORIAS_GASTO.OTROS_GASTOS,
};

const quitarAcentos = (texto) => texto.normalize("NFD").replace(/[̀-ͯ]/g, "");

export const normalizarCategoriaGasto = (categoriaLibre) => {
  if (!categoriaLibre) return CATEGORIAS_GASTO.OTROS_GASTOS;
  const clave = quitarAcentos(String(categoriaLibre).trim().toLowerCase());
  return MAPA_NORMALIZACION_GASTO[clave] || CATEGORIAS_GASTO.OTROS_GASTOS;
};
