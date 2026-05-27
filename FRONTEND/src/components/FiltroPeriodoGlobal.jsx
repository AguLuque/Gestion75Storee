import { useState, useRef, useEffect } from 'react';
import { useDatosGlobal } from '../context/DatosContext.jsx';
import { ChevronDown } from 'lucide-react';
import { cn } from '../utils.js';

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

const OPCIONES = [
  { valor: 'dia',    etiqueta: 'Hoy' },
  { valor: 'semana', etiqueta: 'Semana' },
  { valor: 'mes',    etiqueta: 'Mes' },
  { valor: 'año',    etiqueta: 'Año' },
  { valor: 'todo',   etiqueta: 'Todo' },
];

export default function FiltroPeriodoGlobal() {
  const { periodo, setPeriodo, mesSeleccionado, setMesSeleccionado } = useDatosGlobal();
  const [mostrarMeses, setMostrarMeses] = useState(false);
  const ref = useRef(null);

  // Cerrar al hacer click afuera
  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) {
        setMostrarMeses(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  function seleccionarMes(idx) {
    setMesSeleccionado(idx);
    setPeriodo('mes');
    setMostrarMeses(false);
  }

  const etiquetaMes = periodo === 'mes' ? MESES[mesSeleccionado] : 'Mes';

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <span className="text-xs text-slate-400 mr-1">Filtrar por:</span>

      {OPCIONES.map(op => (
        op.valor === 'mes' ? (
          // Botón especial para mes con dropdown
          <div key="mes" className="relative" ref={ref}>
            <button
              onClick={() => {
                setPeriodo('mes');
                setMostrarMeses(v => !v);
              }}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-medium transition-all inline-flex items-center gap-1',
                periodo === 'mes'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
              )}
            >
              {etiquetaMes}
              <ChevronDown size={12} className={cn('transition-transform', mostrarMeses && 'rotate-180')} />
            </button>

            {/* Dropdown de meses */}
            {mostrarMeses && (
              <div className="absolute top-full mt-1 right-0 bg-white border border-slate-200 rounded-xl shadow-lg z-50 p-2 w-44 animate-fade-in">
                <p className="text-xs text-slate-400 px-2 pb-2 border-b border-slate-100 mb-1">
                  Seleccioná un mes
                </p>
                <div className="grid grid-cols-2 gap-1 pt-1">
                  {MESES.map((mes, idx) => (
                    <button
                      key={idx}
                      onClick={() => seleccionarMes(idx)}
                      className={cn(
                        'px-2 py-1.5 rounded-lg text-xs font-medium transition-all text-left',
                        periodo === 'mes' && mesSeleccionado === idx
                          ? 'bg-blue-600 text-white'
                          : 'text-slate-600 hover:bg-slate-50'
                      )}
                    >
                      {mes}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <button
            key={op.valor}
            onClick={() => { setPeriodo(op.valor); setMostrarMeses(false); }}
            className={cn(
              'px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
              periodo === op.valor
                ? 'bg-blue-600 text-white'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            )}
          >
            {op.etiqueta}
          </button>
        )
      ))}
    </div>
  );
}