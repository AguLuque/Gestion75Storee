// src/components/FilaItemFormulario.jsx
import { Trash2 } from 'lucide-react';
import { Button } from './ui/button.jsx';
import { Input } from './ui/input.jsx';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from './ui/select.jsx';

export default function FilaItemFormulario({
  item, productos, onCambiar, onQuitar, mostrarQuitar, etiquetaStock = false,
}) {
  return (
    <div className="flex gap-2 items-end">
      <div className="flex-1">
        <Select value={item.producto_id} onValueChange={v => onCambiar('producto_id', v)}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Seleccionar producto..." />
          </SelectTrigger>
          <SelectContent>
            {productos.map(p => (
              <SelectItem key={p.id} value={String(p.id)}>
                {p.nombre}{etiquetaStock ? ` (${p.stock_actual} u.)` : ''}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Input
        type="number" min="1" value={item.cantidad}
        onChange={e => onCambiar('cantidad', e.target.value)}
        placeholder="Cant." className="w-20" required
      />
      <Input
        type="number" min="0" step="0.01" value={item.precio_unitario}
        onChange={e => onCambiar('precio_unitario', e.target.value)}
        placeholder="Precio" className="w-28" required
      />
      {mostrarQuitar && (
        <Button variant="destructive" size="icon-sm" type="button" onClick={onQuitar}>
          <Trash2 size={14} />
        </Button>
      )}
    </div>
  );
}