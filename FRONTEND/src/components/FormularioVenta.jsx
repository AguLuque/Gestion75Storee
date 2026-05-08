import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Boton, Input, Select, Textarea } from './ui/index.jsx';
import { formatearPrecio } from '../utils.js';

const itemVacio = () => ({ producto_id: '', cantidad: 1, precio_unitario: '' });

export default function FormularioVenta({ productos, onGuardar, guardando, onCancelar }) {
  const [tipo, setTipo] = useState('minorista');
  const [items, setItems] = useState([itemVacio()]);
  const [observaciones, setObservaciones] = useState('');

  function actualizarItem(idx, campo, valor) {
    setItems(prev => {
      const copia = [...prev];
      copia[idx] = { ...copia[idx], [campo]: valor };

      // Auto-rellenar precio según tipo de venta
      if (campo === 'producto_id' && valor) {
        const prod = productos.find(p => String(p.id) === valor);
        if (prod) {
          copia[idx].precio_unitario =
            tipo === 'mayorista' ? prod.precio_mayorista : prod.precio_minorista;
        }
      }
      return copia;
    });
  }

  function agregarItem() {
    setItems(prev => [...prev, itemVacio()]);
  }

  function quitarItem(idx) {
    setItems(prev => prev.filter((_, i) => i !== idx));
  }

  const total = items.reduce((s, item) => {
    const cantidad = Number(item.cantidad) || 0;
    const precio = Number(item.precio_unitario) || 0;
    return s + cantidad * precio;
  }, 0);

  function enviar(e) {
    e.preventDefault();
    const itemsValidos = items.filter(i => i.producto_id && i.cantidad > 0 && i.precio_unitario > 0);
    if (itemsValidos.length === 0) return;

    onGuardar({
      tipo,
      observaciones: observaciones || null,
      items: itemsValidos.map(i => ({
        producto_id: Number(i.producto_id),
        cantidad: Number(i.cantidad),
        precio_unitario: Number(i.precio_unitario),
      })),
    });
  }

  return (
    <form onSubmit={enviar} className="space-y-4">
      <Select
        label="Tipo de venta"
        value={tipo}
        onChange={e => setTipo(e.target.value)}
      >
        <option value="minorista">Minorista</option>
        <option value="mayorista">Mayorista</option>
      </Select>

      {/* Items */}
      <div className="space-y-3">
        <label className="text-xs font-medium text-slate-600">Productos</label>
        {items.map((item, idx) => (
          <div key={idx} className="flex gap-2 items-end">
            <div className="flex-1">
              <select
                value={item.producto_id}
                onChange={e => actualizarItem(idx, 'producto_id', e.target.value)}
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                required
              >
                <option value="">Seleccionar...</option>
                {productos.map(p => (
                  <option key={p.id} value={p.id}>{p.nombre} ({p.stock_actual} u.)</option>
                ))}
              </select>
            </div>
            <div className="w-20">
              <input
                type="number"
                min="1"
                value={item.cantidad}
                onChange={e => actualizarItem(idx, 'cantidad', e.target.value)}
                placeholder="Cant."
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            <div className="w-28">
              <input
                type="number"
                min="0"
                value={item.precio_unitario}
                onChange={e => actualizarItem(idx, 'precio_unitario', e.target.value)}
                placeholder="Precio"
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            {items.length > 1 && (
              <Boton variante="peligro" tamaño="sm" type="button" onClick={() => quitarItem(idx)}>
                <Trash2 size={14} />
              </Boton>
            )}
          </div>
        ))}
        <Boton variante="secundario" tamaño="sm" type="button" onClick={agregarItem}>
          <Plus size={14} /> Agregar producto
        </Boton>
      </div>

      <Textarea
        label="Observaciones (opcional)"
        value={observaciones}
        onChange={e => setObservaciones(e.target.value)}
        placeholder="Notas adicionales..."
      />

      {/* Total */}
      <div className="bg-slate-50 rounded-lg p-3 flex justify-between items-center">
        <span className="text-sm text-slate-600">Total estimado</span>
        <span className="font-bold text-slate-800">{formatearPrecio(total)}</span>
      </div>

      <div className="flex gap-2 justify-end">
        <Boton variante="secundario" type="button" onClick={onCancelar} disabled={guardando}>
          Cancelar
        </Boton>
        <Boton type="submit" disabled={guardando}>
          {guardando ? 'Registrando...' : 'Registrar venta'}
        </Boton>
      </div>
    </form>
  );
}
