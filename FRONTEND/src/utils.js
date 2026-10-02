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

// Categoría de Gastos para la plata que el dueño saca para uso personal. No es
// un gasto del negocio: no se resta de la ganancia, solo sale de la caja. El
// backend la reconoce por este mismo texto (BACKEND/src/constants/finanzas.js).
export const CATEGORIA_RETIRO_DUENO = 'Retiro del dueño (personal)';

export function esRetiroDueno(categoria) {
  return (categoria || '').trim().toLowerCase().replace('ñ', 'n').startsWith('retiro del dueno');
}

// Días (YYYY-MM-DD, ambos inclusive) que abarca el período del filtro global,
// para pedirle al backend solo esos datos. null en un extremo = sin límite.
export function rangoDelPeriodo(periodo, mesSeleccionado, añoSeleccionado, hoy = new Date()) {
  const fechaHoy = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
  switch (periodo) {
    case 'dia':
      return { desde: fechaLocalISO(fechaHoy), hasta: null };
    case 'semana': {
      const inicio = new Date(fechaHoy);
      inicio.setDate(inicio.getDate() - 7);
      return { desde: fechaLocalISO(inicio), hasta: null };
    }
    case 'mes':
      return {
        desde: fechaLocalISO(new Date(añoSeleccionado, mesSeleccionado, 1)),
        hasta: fechaLocalISO(new Date(añoSeleccionado, mesSeleccionado + 1, 0)),
      };
    case 'año':
      return { desde: `${fechaHoy.getFullYear()}-01-01`, hasta: null };
    default:
      return { desde: null, hasta: null };
  }
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

// Métodos de pago compatibles con cada tipo de cuenta de dinero (mismo mapeo
// que BACKEND/src/constants/finanzas.js, que también lo valida). Un tipo que
// no está acá ('otro') admite cualquiera.
const METODOS_PAGO_POR_TIPO_CUENTA = {
  efectivo: ['efectivo'],
  banco: ['transferencia', 'tarjeta'],
  billetera_virtual: ['transferencia', 'tarjeta'],
};

// Valores de método de pago permitidos para ese tipo de cuenta; null = todos.
export function metodosPagoPermitidos(tipoCuenta) {
  return METODOS_PAGO_POR_TIPO_CUENTA[tipoCuenta] ?? null;
}

// Al elegir una cuenta: si el método actual le corresponde se deja; si no, se
// pasa al primero permitido (ej. Mercado Pago + "efectivo" -> "transferencia").
export function metodoPagoParaCuenta(tipoCuenta, metodoActual) {
  const permitidos = metodosPagoPermitidos(tipoCuenta);
  if (!permitidos || permitidos.includes(metodoActual)) return metodoActual;
  return permitidos[0];
}

// Badge de color según tipo de venta
export function colorTipoVenta(tipo) {
  return tipo === 'mayorista'
    ? 'bg-purple-100 text-purple-700'
    : 'bg-blue-100 text-blue-700';
}
