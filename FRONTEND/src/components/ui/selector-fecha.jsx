// Selector de fecha con la misma estética que el desplegable de meses del
// filtro global (FiltroPeriodoGlobal): tarjeta blanca, flechas para cambiar
// de mes y el día elegido en primary-300. Reemplaza al <input type="date">,
// que muestra el calendario nativo del navegador (distinto en cada uno).
// Trabaja con strings "YYYY-MM-DD" (el mismo formato que el input nativo),
// así que los formularios no cambian lo que mandan al backend.
import { useState } from 'react';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn, fechaLocalISO } from '../../utils.js';
import { Popover, PopoverTrigger, PopoverContent } from './popover.jsx';

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];
const DIAS_SEMANA = ['L', 'M', 'M', 'J', 'V', 'S', 'D']; // la semana arranca el lunes

// "YYYY-MM-DD" -> { año, mes (0-11), dia } sin pasar por Date/UTC
function partes(valor) {
  const [año, mes, dia] = valor.split('-').map(Number);
  return { año, mes: mes - 1, dia };
}

function aISO(año, mes, dia) {
  return `${año}-${String(mes + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
}

function formatear(valor) {
  const { año, mes, dia } = partes(valor);
  return `${String(dia).padStart(2, '0')}/${String(mes + 1).padStart(2, '0')}/${año}`;
}

// Celdas del mes: huecos (null) hasta el día de la semana en que empieza
function celdasDelMes(año, mes) {
  const primerDia = (new Date(año, mes, 1).getDay() + 6) % 7; // lunes = 0
  const diasEnMes = new Date(año, mes + 1, 0).getDate();
  return [...Array(primerDia).fill(null), ...Array.from({ length: diasEnMes }, (_, i) => i + 1)];
}

export function SelectorFecha({
  label,
  value,
  onChange,
  placeholder = 'Elegir fecha',
  min,
  max,
  permitirVacio = true,
  compacto = false,
  className,
}) {
  const [abierto, setAbierto] = useState(false);
  const [mesVisible, setMesVisible] = useState(() => partes(value || fechaLocalISO()));
  const hoy = fechaLocalISO();

  function cambiarAbierto(nuevo) {
    // Al abrir, el calendario muestra el mes de la fecha elegida (o el actual)
    if (nuevo) setMesVisible(partes(value || hoy));
    setAbierto(nuevo);
  }

  function moverMes(delta) {
    setMesVisible(({ año, mes }) => {
      const fecha = new Date(año, mes + delta, 1);
      return { año: fecha.getFullYear(), mes: fecha.getMonth(), dia: 1 };
    });
  }

  function elegir(valor) {
    onChange?.(valor);
    setAbierto(false);
  }

  const fueraDeRango = (iso) => (min && iso < min) || (max && iso > max);

  return (
    <div className="flex flex-col gap-1">
      {label && <span className="text-xs font-medium text-slate-600">{label}</span>}
      <Popover open={abierto} onOpenChange={cambiarAbierto}>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label={label ? `${label}: ${value ? formatear(value) : 'sin fecha'}` : undefined}
            className={cn(
              'inline-flex items-center gap-2 border border-slate-200 rounded-lg bg-white text-left transition-colors',
              'focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500',
              compacto ? 'px-2.5 py-1.5 text-sm' : 'w-full px-3 py-2 text-base md:text-sm',
              className
            )}
          >
            <Calendar size={14} className="flex-shrink-0 text-slate-400" />
            <span className={cn('flex-1', !value && 'text-slate-400')}>{value ? formatear(value) : placeholder}</span>
          </button>
        </PopoverTrigger>

        <PopoverContent className="w-64 rounded-xl p-2" collisionPadding={8}>
          {/* Encabezado: mismo estilo que el selector de año del filtro */}
          <div className="flex items-center justify-between px-1 pb-2 border-b border-slate-100 mb-1">
            <button type="button" onClick={() => moverMes(-1)} className="p-1 rounded hover:bg-slate-100 text-slate-500" aria-label="Mes anterior">
              <ChevronLeft size={14} />
            </button>
            <span className="text-xs font-medium text-slate-600">{MESES[mesVisible.mes]} {mesVisible.año}</span>
            <button type="button" onClick={() => moverMes(1)} className="p-1 rounded hover:bg-slate-100 text-slate-500" aria-label="Mes siguiente">
              <ChevronRight size={14} />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-0.5 pt-1">
            {DIAS_SEMANA.map((d, i) => (
              <span key={i} className="py-1 text-center text-[10px] font-medium text-slate-400">{d}</span>
            ))}
            {celdasDelMes(mesVisible.año, mesVisible.mes).map((dia, i) => {
              if (!dia) return <span key={i} />;
              const iso = aISO(mesVisible.año, mesVisible.mes, dia);
              const elegido = iso === value;
              const deshabilitado = fueraDeRango(iso);
              return (
                <button
                  key={i}
                  type="button"
                  disabled={deshabilitado}
                  onClick={() => elegir(iso)}
                  aria-label={formatear(iso)}
                  aria-pressed={elegido}
                  className={cn(
                    'h-8 rounded-lg text-xs font-medium transition-all',
                    elegido
                      ? 'bg-primary-300 text-slate-900'
                      : iso === hoy
                        ? 'text-primary-700 ring-1 ring-inset ring-primary-300 hover:bg-slate-50'
                        : 'text-slate-600 hover:bg-slate-50',
                    deshabilitado && 'opacity-30 cursor-not-allowed hover:bg-transparent'
                  )}
                >
                  {dia}
                </button>
              );
            })}
          </div>

          <div className="flex items-center justify-between border-t border-slate-100 mt-1 pt-2 px-1">
            <button
              type="button"
              onClick={() => elegir(hoy)}
              disabled={fueraDeRango(hoy)}
              className="px-2 py-1 rounded-lg text-xs font-medium text-primary-700 hover:bg-primary-50 disabled:opacity-30"
            >
              Hoy
            </button>
            {permitirVacio && value && (
              <button type="button" onClick={() => elegir('')} className="px-2 py-1 rounded-lg text-xs font-medium text-slate-500 hover:bg-slate-50">
                Borrar
              </button>
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
