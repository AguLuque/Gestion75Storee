import { useDatosGlobal } from '../context/DatosContext.jsx';
import { ToggleGroup, ToggleGroupItem } from './ui/toggle-group.jsx';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from './ui/dropdown-menu.jsx';
import { Button } from './ui/button.jsx';
import { ChevronDown } from 'lucide-react';
import { cn } from '../lib/utils.js';

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

const OPCIONES = [
  { valor: 'dia', etiqueta: 'Hoy' },
  { valor: 'semana', etiqueta: 'Semana' },
  { valor: 'año', etiqueta: 'Año' },
  { valor: 'todo', etiqueta: 'Todo' },
];

export default function FiltroPeriodoGlobal() {
  const { periodo, setPeriodo, mesSeleccionado, setMesSeleccionado } = useDatosGlobal();

  const etiquetaMes = periodo === 'mes' ? MESES[mesSeleccionado] : 'Mes';

  function seleccionarMes(idx) {
    setMesSeleccionado(idx);
    setPeriodo('mes');
  }

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <span className="text-xs text-muted-foreground mr-1">Filtrar por:</span>

      <ToggleGroup
        type="single"
        value={periodo === 'mes' ? '' : periodo}
        onValueChange={(v) => v && setPeriodo(v)}
        className="gap-1.5"
      >
        {OPCIONES.slice(0, 2).map(op => (
          <ToggleGroupItem key={op.valor} value={op.valor} className="rounded-lg px-3 py-1.5 text-xs h-auto data-[state=on]:bg-primary data-[state=on]:text-primary-foreground border border-border">
            {op.etiqueta}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant={periodo === 'mes' ? 'default' : 'outline'}
            size="sm"
            className="h-auto px-3 py-1.5 text-xs gap-1"
          >
            {etiquetaMes}
            <ChevronDown size={12} />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="grid grid-cols-2 gap-1 w-44 p-2">
          {MESES.map((mes, idx) => (
            <DropdownMenuItem
              key={idx}
              onClick={() => seleccionarMes(idx)}
              className={cn(
                'rounded-lg text-xs justify-start cursor-pointer',
                periodo === 'mes' && mesSeleccionado === idx && 'bg-accent'
              )}
            >
              {mes}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <ToggleGroup
        type="single"
        value={periodo === 'mes' ? '' : periodo}
        onValueChange={(v) => v && setPeriodo(v)}
        className="gap-1.5"
      >
        {OPCIONES.slice(2).map(op => (
          <ToggleGroupItem key={op.valor} value={op.valor} className="rounded-lg px-3 py-1.5 text-xs h-auto data-[state=on]:bg-primary data-[state=on]:text-primary-foreground border border-border">
            {op.etiqueta}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </div>
  );
}