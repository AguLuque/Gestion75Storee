// Combobox de productos con buscador (patrón shadcn: Popover + Command).
// Filtra en el cliente sobre la lista que ya viene del contexto (sin pegarle al
// backend). Cada formulario decide qué dato extra mostrar al lado del nombre
// con `detalle(producto)`: stock en Ventas, precio de compra en Compras.
import { useMemo, useRef, useState } from 'react';
import { Check, ChevronsUpDown } from 'lucide-react';
import { cn, filtrarProductos } from '../../utils.js';
import { Popover, PopoverTrigger, PopoverContent } from './popover.jsx';
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from './command.jsx';

export function SelectorProducto({ productos, value, onChange, detalle, required, placeholder = 'Seleccionar producto...', className }) {
  const [abierto, setAbierto] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  const inputBusqueda = useRef(null);
  const valorActual = value === null || value === undefined ? '' : String(value);
  const seleccionado = productos.find(p => String(p.id) === valorActual);
  const resultados = useMemo(() => filtrarProductos(productos, busqueda), [productos, busqueda]);

  function cambiarAbierto(nuevo) {
    setAbierto(nuevo);
    if (!nuevo) setBusqueda('');
  }

  // Radix enfoca el buscador seleccionando su texto, y la siguiente tecla
  // borraría la letra con la que se abrió: se enfoca a mano, cursor al final.
  function enfocarBuscador(e) {
    e.preventDefault();
    const input = inputBusqueda.current;
    if (!input) return;
    input.focus();
    input.setSelectionRange(input.value.length, input.value.length);
  }

  function elegir(producto) {
    onChange?.(String(producto.id));
    cambiarAbierto(false);
  }

  // Con el foco en el trigger: flecha abajo abre, y escribir una letra abre
  // el buscador ya con esa letra (no hace falta hacer click primero).
  function teclaEnTrigger(e) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      cambiarAbierto(true);
    } else if (e.key.length === 1 && e.key !== ' ' && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault();
      // Se acumula (la búsqueda está vacía mientras está cerrado): si se tipea
      // rápido, las teclas que llegan antes de que el foco pase al buscador
      // no se pierden.
      setBusqueda(prev => prev + e.key);
      setAbierto(true);
    }
  }

  return (
    <div className="relative">
      <Popover open={abierto} onOpenChange={cambiarAbierto}>
        <PopoverTrigger asChild>
          <button
            type="button"
            role="combobox"
            aria-expanded={abierto}
            aria-label="Producto"
            aria-required={required || undefined}
            onKeyDown={teclaEnTrigger}
            className={cn(
              'flex w-full items-center justify-between gap-2 border border-slate-200 rounded-lg px-3 py-2 text-base md:text-sm text-left bg-white transition-colors',
              'focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500',
              className
            )}
          >
            <span className={cn('truncate', !seleccionado && 'text-slate-400')}>
              {seleccionado ? seleccionado.nombre : valorActual ? 'Cargando...' : placeholder}
            </span>
            <ChevronsUpDown size={16} className="flex-shrink-0 text-slate-400" />
          </button>
        </PopoverTrigger>

        {/* Mismo criterio que el Select: siempre hacia abajo (sin
            avoidCollisions), lista de hasta 16rem que se achica si abajo no
            hay lugar. Mínimo 16rem de ancho para que entre nombre + detalle. */}
        <PopoverContent
          side="bottom"
          avoidCollisions={false}
          collisionPadding={8}
          className="flex w-[var(--radix-popover-trigger-width)] min-w-[16rem] max-h-[var(--radix-popover-content-available-height)] flex-col overflow-hidden p-0"
          onOpenAutoFocus={enfocarBuscador}
        >
          <Command shouldFilter={false} loop className="min-h-0">
            <CommandInput ref={inputBusqueda} value={busqueda} onValueChange={setBusqueda} placeholder="Buscar producto..." />
            <CommandList className="max-h-64 min-h-0 flex-1">
              <CommandEmpty>No hay productos que coincidan.</CommandEmpty>
              <CommandGroup>
                {resultados.map(p => (
                  <CommandItem key={p.id} value={String(p.id)} onSelect={() => elegir(p)}>
                    <Check
                      size={14}
                      className={cn('flex-shrink-0 text-primary-600', String(p.id) === valorActual ? 'opacity-100' : 'opacity-0')}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate">{p.nombre}</p>
                      {p.categoria_nombre && <p className="truncate text-xs text-slate-400">{p.categoria_nombre}</p>}
                    </div>
                    {detalle && <span className="flex-shrink-0 text-xs">{detalle(p)}</span>}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {/* Validación nativa de "required" (igual que el <select> que reemplaza) */}
      {required && (
        <input
          tabIndex={-1}
          aria-hidden="true"
          required
          value={valorActual}
          onChange={() => {}}
          className="absolute inset-x-0 bottom-0 h-px opacity-0 pointer-events-none"
        />
      )}
    </div>
  );
}
