import { useDatosGlobal } from '../context/DatosContext.jsx';
import { cn } from '../utils.js';

const OPCIONES = [
  { valor: 'dia',    etiqueta: 'Día' },
  { valor: 'semana', etiqueta: 'Semana' },
  { valor: 'mes',    etiqueta: 'Mes' },
  { valor: 'año',    etiqueta: 'Año' },
  { valor: 'todo',   etiqueta: 'Todo' },
];

export default function FiltroPeriodoGlobal() {
  const { periodo, setPeriodo } = useDatosGlobal();

  return (
    <div className="flex items-center gap-1.5">
      <span className="text-xs text-slate-400 mr-1">Filtar por:</span>
      {OPCIONES.map(op => (
        <button
          key={op.valor}
          onClick={() => setPeriodo(op.valor)}
          className={cn(
            'px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
            periodo === op.valor
              ? 'bg-blue-600 text-white'
              : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
          )}
        >
          {op.etiqueta}
        </button>
      ))}
    </div>
  );
}