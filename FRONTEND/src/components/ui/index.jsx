import { cn } from '../../utils.js';
import { X } from 'lucide-react';
import { useState, useEffect } from 'react';

// --- Botón ---
export function Boton({ children, variante = 'primario', tamaño = 'md', className, ...props }) {
  const base = 'inline-flex items-center gap-2 font-medium rounded-lg transition-all focus:outline-none focus:ring-2 focus:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer';

  const variantes = {
    primario: 'bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500',
    secundario: 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 focus:ring-slate-300',
    peligro: 'bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 focus:ring-red-300',
    fantasma: 'text-slate-600 hover:bg-slate-100 focus:ring-slate-300',
  };

  const tamaños = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-4 py-2 text-sm',
    lg: 'px-5 py-2.5 text-base',
  };

  return (
    <button className={cn(base, variantes[variante], tamaños[tamaño], className)} {...props}>
      {children}
    </button>
  );
}

// --- Input ---
export function Input({ label, error, className, ...props }) {
  return (
    <div className="flex flex-col gap-1">
      {label && <label className="text-xs font-medium text-slate-600">{label}</label>}
      <input
        className={cn(
          'border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white transition-all',
          error && 'border-red-400 focus:ring-red-400',
          className
        )}
        {...props}
      />
      {error && <span className="text-xs text-red-500">{error}</span>}
    </div>
  );
}

// --- Select ---
export function Select({ label, error, children, className, ...props }) {
  return (
    <div className="flex flex-col gap-1">
      {label && <label className="text-xs font-medium text-slate-600">{label}</label>}
      <select
        className={cn(
          'border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white transition-all',
          error && 'border-red-400',
          className
        )}
        {...props}
      >
        {children}
      </select>
      {error && <span className="text-xs text-red-500">{error}</span>}
    </div>
  );
}

// --- Textarea ---
export function Textarea({ label, error, className, ...props }) {
  return (
    <div className="flex flex-col gap-1">
      {label && <label className="text-xs font-medium text-slate-600">{label}</label>}
      <textarea
        className={cn(
          'border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white transition-all resize-none',
          error && 'border-red-400',
          className
        )}
        rows={3}
        {...props}
      />
    </div>
  );
}

// --- Badge ---
export function Badge({ children, color = 'default', className }) {
  const colores = {
    default: 'bg-slate-100 text-slate-600',
    azul: 'bg-blue-100 text-blue-700',
    verde: 'bg-green-100 text-green-700',
    rojo: 'bg-red-100 text-red-600',
    amarillo: 'bg-yellow-100 text-yellow-700',
    violeta: 'bg-purple-100 text-purple-700',
  };
  return (
    <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap', colores[color], className)}>
      {children}
    </span>
  );
}

// --- Card ---
export function Card({ children, className, ...props }) {
  return (
    <div className={cn('bg-white border border-slate-200 rounded-xl shadow-sm', className)} {...props}>
      {children}
    </div>
  );
}

// --- Modal ---
export function Modal({ abierto, onCerrar, titulo, children, className }) {
  if (!abierto) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onCerrar} />
      <div className={cn('relative bg-white rounded-2xl shadow-2xl w-full max-h-[90vh] overflow-y-auto animate-fade-in', className || 'max-w-lg mx-4')}>
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <h2 className="font-semibold text-slate-800">{titulo}</h2>
          <button onClick={onCerrar} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X size={18} />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

// --- Tabla base ---
export function Tabla({ columnas, datos, renderFila, vacio = 'Sin datos' }) {
  return (
    <div className="overflow-x-auto -mx-5 px-5">
      <table className="w-full text-sm min-w-[500px]">
        <thead>
          <tr className="border-b border-slate-100">
            {columnas.map((col, i) => (
              <th key={i} className="text-left text-xs font-medium text-slate-500 pb-3 pr-4 last:pr-0 whitespace-nowrap">
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {datos.length === 0 ? (
            <tr>
              <td colSpan={columnas.length} className="py-8 text-center text-slate-400 text-sm">
                {vacio}
              </td>
            </tr>
          ) : (
            datos.map((item, i) => (
              <tr key={item.id || i} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                {renderFila(item)}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

// --- Spinner ---
export function Spinner({ className }) {
  return (
    <div className={cn('flex items-center justify-center py-12', className)}>
      <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

// --- Stat Card ---
// --- Stat Card ---
export function StatCard({
  titulo,
  valor,
  icono,
  color = 'azul',
  onClick
}) {
  const colores = {
    azul: 'bg-blue-50 text-blue-600',
    verde: 'bg-green-50 text-green-600',
    amarillo: 'bg-yellow-50 text-yellow-600',
    rojo: 'bg-red-50 text-red-600',
  };

  return (
    <Card
      onClick={onClick}
      className={cn(
        'p-4',
        onClick && 'cursor-pointer hover:shadow-md hover:-translate-y-1 transition-all'
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide truncate">
            {titulo}
          </p>
          <p className="text-lg lg:text-xl font-bold text-slate-800 mt-1 break-all">
            {valor}
          </p>
        </div>

        <div className={cn('p-2 rounded-xl text-base flex-shrink-0', colores[color])}>
          {icono}
        </div>
      </div>
    </Card>
  );
}

// --- Confirmar eliminación ---
export function ModalConfirmar({ abierto, onCerrar, onConfirmar, mensaje, cargando }) {
  return (
    <Modal abierto={abierto} onCerrar={onCerrar} titulo="Confirmar acción" className="max-w-sm mx-4">
      <p className="text-sm text-slate-600 mb-5">{mensaje}</p>
      <div className="flex gap-2 justify-end">
        <Boton variante="secundario" onClick={onCerrar} disabled={cargando}>Cancelar</Boton>
        <Boton variante="peligro" onClick={onConfirmar} disabled={cargando}>
          {cargando ? 'Eliminando...' : 'Eliminar'}
        </Boton>
      </div>
    </Modal>
  );
}

// --- Hook para formatear precios mientras se escribe ---
export function usePrecio(valorInicial = '') {
  const [display, setDisplay] = useState(
    valorInicial ? Number(valorInicial).toLocaleString('es-AR') : ''
  );

  // Cuando cambia el valor inicial (al editar un producto existente)
  useEffect(() => {
    if (valorInicial !== '' && valorInicial !== undefined) {
      setDisplay(Number(valorInicial).toLocaleString('es-AR'));
    }
  }, [valorInicial]);

  function onChange(e) {
    // Sacar todo lo que no sea número
    const soloNumeros = e.target.value.replace(/\D/g, '');
    // Formatear con puntos de miles
    const formateado = soloNumeros ? Number(soloNumeros).toLocaleString('es-AR') : '';
    setDisplay(formateado);
  }

  // Valor numérico real para enviar al backend
  const valorNumerico = Number(display.replace(/\./g, '').replace(/,/g, '')) || 0;

  return { display, onChange, valorNumerico };
}

// --- Input de precio con formato automático ---
export function InputPrecio({ label, valorInicial = '', onCambio, required, placeholder = '0', className }) {
  const { display, onChange, valorNumerico } = usePrecio(valorInicial);

  useEffect(() => {
    onCambio?.(valorNumerico);
  }, [valorNumerico]);

  return (
    <div className="flex flex-col gap-1">
      {label && <label className="text-xs font-medium text-slate-600">{label}</label>}
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
        <input
          type="text"
          inputMode="numeric"
          value={display}
          onChange={onChange}
          required={required}
          placeholder={placeholder}
          className={cn(
            'border border-slate-200 rounded-lg pl-7 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white transition-all w-full',
            className
          )}
        />
      </div>
    </div>
  );
}