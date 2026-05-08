import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Boton, Select, Textarea } from './ui/index.jsx';
import { formatearPrecio } from '../utils.js';

const itemVacio = () => ({ producto_id: '', cantidad: 1, precio_unitario: '' });

export default function FormularioCompra({ productos, proveedores, onGuardar, guardando, onCancelar }) {
  const [proveedorId, setProveedorId] = useState('');
  const [items, setItems] = useState([itemVacio()]);
  const [observaciones, setObservaciones] = useState('');

  function actualizarItem(idx, campo, valor) {
    setItems(prev => {
      const copia = [...prev];
      copia[idx] = { ...copia[idx], [campo]: valor };
      if (campo === 'producto_id' && valor) {
        const prod = productos.find(p => String(p.id) === valor);
        if (prod) copia[idx].precio_unitario = prod.precio_compra || '';
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
    return s + (Number(item.cantidad) || 0) * (Number(item.precio_unitario) || 0);
  }, 0);

  function enviar(e) {
    e.preventDefault();
    const itemsValidos = items.filter(i => i.producto_id && i.cantidad > 0);
    if (itemsValidos.length === 0) return;

    onGuardar({
      proveedor_id: proveedorId ? Number(proveedorId) : null,
      observaciones: observaciones || null,
      items: itemsValidos.map(i => ({
        producto_id: Number(i.producto_id),
        cantidad: Number(i.cantidad),
        precio_unitario: Number(i.precio_unitario) || 0,
      })),
    });
  }

  return (
    <form onSubmit={enviar} className="space-y-4">
      <Select
        label="Proveedor (opcional)"
        value={proveedorId}
        onChange={e => setProveedorId(e.target.value)}
      >
        <option value="">Sin proveedor</option>
        {proveedores.map(p => (
          <option key={p.id} value={p.id}>{p.nombre}</option>
        ))}
      </Select>

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
                  <option key={p.id} value={p.id}>{p.nombre}</option>
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
                placeholder="Costo"
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
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

      <div className="bg-slate-50 rounded-lg p-3 flex justify-between items-center">
        <span className="text-sm text-slate-600">Total</span>
        <span className="font-bold text-slate-800">{formatearPrecio(total)}</span>
      </div>

      <div className="flex gap-2 justify-end">
        <Boton variante="secundario" type="button" onClick={onCancelar} disabled={guardando}>Cancelar</Boton>
        <Boton type="submit" disabled={guardando}>
          {guardando ? 'Registrando...' : 'Registrar compra'}
        </Boton>
      </div>
    </form>
  );
}
