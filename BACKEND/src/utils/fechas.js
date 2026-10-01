// src/utils/fechas.js
// El negocio opera en Argentina, pero el servidor (Railway) y la sesión de
// Postgres corren en UTC: con toISOString() o dejando que Postgres corte un
// timestamptz a DATE, todo lo que pasa entre las 21 y las 24 hs de Argentina
// caía en el día siguiente (y a fin de mes, en el mes siguiente) en los
// movimientos financieros y los reportes.

export const ZONA_HORARIA_NEGOCIO = "America/Argentina/Buenos_Aires";

// en-CA formatea como YYYY-MM-DD, el formato de una columna DATE.
const formatoDia = new Intl.DateTimeFormat("en-CA", {
  timeZone: ZONA_HORARIA_NEGOCIO,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

// Día ("YYYY-MM-DD") en hora argentina de un instante (Date, timestamptz de
// pg o string ISO). Sin argumento: hoy.
export const fechaArgentina = (fecha = new Date()) => formatoDia.format(new Date(fecha));

const FORMATO_DIA = /^\d{4}-\d{2}-\d{2}$/;

// "YYYY-MM-DD" de un día que existe (descarta, por ejemplo, 2026-02-31)
const esDiaValido = (valor) => {
  if (typeof valor !== "string" || !FORMATO_DIA.test(valor)) return false;
  const [anio, mes, dia] = valor.split("-").map(Number);
  const fecha = new Date(Date.UTC(anio, mes - 1, dia));
  return fecha.getUTCFullYear() === anio && fecha.getUTCMonth() === mes - 1 && fecha.getUTCDate() === dia;
};

// Lee ?desde=YYYY-MM-DD&hasta=YYYY-MM-DD (los dos opcionales, días de
// Argentina, ambos inclusive) y valida el formato.
export const leerRangoFechas = (query) => {
  const desde = query.desde || null;
  const hasta = query.hasta || null;
  for (const valor of [desde, hasta]) {
    if (valor !== null && !esDiaValido(valor)) {
      throw { status: 400, message: "desde y hasta deben tener formato YYYY-MM-DD." };
    }
  }
  return { desde, hasta };
};

// Condición SQL para filtrar una columna timestamptz por días de Argentina.
// pDesde/pHasta son los números de parámetro ($n); si el valor es NULL ese
// extremo no filtra. Compara la columna sin transformarla para que se puedan
// usar los índices por fecha.
export const condicionRangoFechas = (columna, pDesde, pHasta) => `
  ($${pDesde}::date IS NULL OR ${columna} >= ($${pDesde}::date::timestamp AT TIME ZONE '${ZONA_HORARIA_NEGOCIO}'))
  AND ($${pHasta}::date IS NULL OR ${columna} < (($${pHasta}::date + 1)::timestamp AT TIME ZONE '${ZONA_HORARIA_NEGOCIO}'))`;
