// Formatear moneda en pesos argentinos
export function formatearPrecio(valor) {
  if (valor == null) return '$0';
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 0,
  }).format(valor);
}

// Formatear fecha legible
export function formatearFecha(fecha) {
  if (!fecha) return '-';
  return new Date(fecha).toLocaleDateString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

// Formatear una columna DATE de Postgres (sin hora: vencimientos, emisiones).
// node-pg la manda como medianoche en la zona del servidor (en Railway, UTC:
// "2026-09-30T00:00:00.000Z"), y formatearla en hora argentina la corre al
// día anterior (29/09). Leyéndola en UTC se ve el día real, sea cual sea la
// zona del servidor (UTC o Argentina).
export function formatearFechaDia(fecha) {
  if (!fecha) return '-';
  return new Date(fecha).toLocaleDateString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

// "YYYY-MM-DD" de una columna DATE (ver formatearFechaDia), para comparar.
export function diaISO(fecha) {
  return fecha ? new Date(fecha).toISOString().slice(0, 10) : null;
}

// "YYYY-MM-DD" de hoy (u otra fecha) en hora LOCAL. toISOString() da la fecha
// en UTC: en Argentina, después de las 21 hs ya devuelve el día siguiente.
export function fechaLocalISO(fecha = new Date()) {
  const año = fecha.getFullYear();
  const mes = String(fecha.getMonth() + 1).padStart(2, '0');
  const dia = String(fecha.getDate()).padStart(2, '0');
  return `${año}-${mes}-${dia}`;
}

// Unir clases condicionalmente (equivalente simple a clsx)
export function cn(...clases) {
  return clases.filter(Boolean).join(' ');
}

// Minúsculas y sin tildes, para comparar búsquedas ("remera" encuentra "Reméra")
export function normalizarTexto(texto) {
  return String(texto ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

// Filtra productos en el cliente: cada palabra de la búsqueda tiene que aparecer
// en el nombre, la categoría o el código/SKU (si el producto lo tiene), en
// cualquier orden. "rem neg" encuentra "Remera negra talle M".
export function filtrarProductos(productos, busqueda) {
  const palabras = normalizarTexto(busqueda).split(/\s+/).filter(Boolean);
  if (palabras.length === 0) return productos;
  return productos.filter(p => {
    const texto = normalizarTexto([p.nombre, p.categoria_nombre, p.codigo, p.sku].filter(Boolean).join(' '));
    return palabras.every(palabra => texto.includes(palabra));
  });
}

// Badge de color según tipo de venta
export function colorTipoVenta(tipo) {
  return tipo === 'mayorista'
    ? 'bg-purple-100 text-purple-700'
    : 'bg-blue-100 text-blue-700';
}
