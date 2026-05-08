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

// Unir clases condicionalmente (equivalente simple a clsx)
export function cn(...clases) {
  return clases.filter(Boolean).join(' ');
}

// Badge de color según tipo de venta
export function colorTipoVenta(tipo) {
  return tipo === 'mayorista'
    ? 'bg-purple-100 text-purple-700'
    : 'bg-blue-100 text-blue-700';
}
