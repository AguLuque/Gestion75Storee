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
