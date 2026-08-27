import { cn } from '../../utils.js';
import { X, ChevronRight } from 'lucide-react';
import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Drawer as DrawerPrimitive } from 'vaul';

// --- Botón ---
export function Boton({ children, variante = 'primario', tamaño = 'md', className, ...props }) {
  const base = 'inline-flex items-center gap-2 font-medium rounded-lg transition-all focus:outline-none focus:ring-2 focus:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer';

  const variantes = {
    primario: 'bg-primary-300 text-slate-900 hover:bg-primary-400 hover:text-white focus:ring-primary-300',
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
          'border border-slate-200 rounded-lg px-3 py-2 text-base md:text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white transition-colors',
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
          'border border-slate-200 rounded-lg px-3 py-2 text-base md:text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white transition-colors',
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
          'border border-slate-200 rounded-lg px-3 py-2 text-base md:text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white transition-colors resize-none',
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
    azul: 'bg-primary-100 text-primary-700',
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

export function Modal({ abierto, onCerrar, titulo, children, className }) {
  if (!abierto) return null;

  return createPortal(
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
    </div>,
    document.body
  );
}

// --- Tabla base ---
// En md: para arriba se ve como tabla (sin cambios). Por debajo de md:, se ve
// como una lista de cards clickeables (renderCardMobile + onSeleccionar),
// pensada para abrir un <Drawer> con el detalle completo del ítem.
export function Tabla({ columnas, datos, renderFila, renderCardMobile, onSeleccionar, vacio = 'Sin datos' }) {
  return (
    <>
      <div className="hidden md:block overflow-x-auto -mx-5 px-5">
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

      {renderCardMobile && (
        <div className="md:hidden space-y-2">
          {datos.length === 0 ? (
            <p className="py-8 text-center text-slate-400 text-sm">{vacio}</p>
          ) : (
            datos.map((item, i) => (
              <CardMobile key={item.id || i} onClick={() => onSeleccionar?.(item)}>
                {renderCardMobile(item)}
              </CardMobile>
            ))
          )}
        </div>
      )}
    </>
  );
}

// --- Spinner ---
export function Spinner({ className }) {
  return (
    <div className={cn('flex items-center justify-center py-12', className)}>
      <div className="w-6 h-6 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

// --- Stat Card ---
export function StatCard({
  titulo,
  valor,
  icono,
  color = 'azul',
  onClick
}) {
  const colores = {
    azul: 'bg-primary-50 text-primary-600',
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

// --- Drawer (panel deslizable desde abajo, uso mobile) ---
// Envoltorio de vaul (la misma librería del Drawer oficial de shadcn/ui),
// restyleado con los mismos tokens que el resto de la app (Card, Modal).
export function Drawer({ abierto, onCerrar, titulo, children, footer }) {
  return (
    <DrawerPrimitive.Root open={abierto} onOpenChange={(v) => !v && onCerrar()}>
      <DrawerPrimitive.Portal>
        <DrawerPrimitive.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm" />
        <DrawerPrimitive.Content className="fixed inset-x-0 bottom-0 z-50 flex max-h-[85vh] flex-col rounded-t-2xl border-t border-slate-200 bg-white shadow-2xl outline-none">
          <div className="mx-auto mt-3 h-1.5 w-10 flex-shrink-0 rounded-full bg-slate-200" />
          {titulo && (
            <div className="px-5 pt-3 pb-2">
              <DrawerPrimitive.Title className="font-semibold text-slate-800">{titulo}</DrawerPrimitive.Title>
            </div>
          )}
          <div className="flex-1 overflow-y-auto px-5 pb-2">{children}</div>
          {footer && <div className="flex gap-2 justify-end p-5 pt-3 border-t border-slate-100">{footer}</div>}
        </DrawerPrimitive.Content>
      </DrawerPrimitive.Portal>
    </DrawerPrimitive.Root>
  );
}

// --- Fila de detalle dentro de un Drawer (etiqueta: valor) ---
export function DetalleCampo({ etiqueta, valor }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2.5 border-b border-slate-50 last:border-0">
      <span className="text-xs font-medium text-slate-500 flex-shrink-0">{etiqueta}</span>
      <span className="text-sm text-slate-800 font-medium text-right">{valor ?? '—'}</span>
    </div>
  );
}

// --- Card clickeable para listas en mobile (reemplaza filas de <table>) ---
export function CardMobile({ children, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left bg-white border border-slate-200 rounded-xl p-4 flex items-center justify-between gap-3 active:bg-slate-50 transition-colors"
    >
      <div className="min-w-0 flex-1 space-y-1">{children}</div>
      <ChevronRight size={16} className="text-slate-300 flex-shrink-0" />
    </button>
  );
}

// --- Hook para formatear precios mientras se escribe ---
export function usePrecio(valorInicial = '') {
  const [display, setDisplay] = useState(
    valorInicial ? Number(valorInicial).toLocaleString('es-AR') : ''
  );

  // Cuando cambia el valor inicial (al editar un producto existente)
  useEffect(() => {
    const valorActualEnPantalla = Number(display.replace(/\./g, '').replace(/,/g, '')) || 0;
    const valorEntrante = Number(valorInicial) || 0;

    // Si el valor que llega es el mismo que ya tenemos mostrado, es el "eco"
    // de lo que el usuario acaba de tipear (vino y volvió). No lo tocamos.
    if (valorEntrante === valorActualEnPantalla) return;

    setDisplay(
      valorInicial !== '' && valorInicial !== undefined
        ? Number(valorInicial).toLocaleString('es-AR')
        : ''
    );
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
            'border border-slate-200 rounded-lg pl-7 pr-3 py-2 text-base md:text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white transition-colors w-full',
            className
          )}
        />
      </div>
    </div>
  );
}