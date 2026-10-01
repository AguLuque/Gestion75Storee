// src/utils/cantidades.js

// Suma las cantidades por id: [{ id, cantidad }] -> { ids, cantidades }, listos
// para pasar como arrays a un UPDATE ... FROM unnest(...). Hace falta agrupar
// porque si el mismo id aparece dos veces en el FROM, Postgres aplica una sola.
export const agruparCantidades = (ajustes) => {
  const porId = new Map();
  for (const { id, cantidad } of ajustes) {
    const clave = String(id);
    porId.set(clave, (porId.get(clave) ?? 0) + Number(cantidad));
  }
  return { ids: [...porId.keys()], cantidades: [...porId.values()] };
};
