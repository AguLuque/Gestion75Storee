import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Boton, Select, Textarea } from './ui/index.jsx';
import { formatearPrecio } from '../utils.js';
import { InputPrecio } from './ui/index.jsx';
import { useToast } from '../context/ToastContext.jsx';

const itemVacio = () => ({ producto_id: '', cantidad: 1, precio_unitario: '' });

export default function FormularioVenta({ productos, onGuardar, guardando, onCancelar }) {
  const [tipo, setTipo] = useState('minorista');
  const [items, setItems] = useState([itemVacio()]);
  const [observaciones, setObservaciones] = useState('');
  const [metodoPago, setMetodoPago] = useState('efectivo');
  const [canal, setCanal] = useState('directa');
  const [comision, setComision] = useState('');
  const { mostrarToast } = useToast();

  function actualizarItem(idx, campo, valor) {
    setItems(prev => {
      const copia = [...prev];
      copia[idx] = { ...copia[idx], [campo]: valor };

      // Auto-rellenar precio según tipo de venta (si el producto no tiene
      // precio mayorista cargado, queda en blanco para cargarlo a mano)
      if (campo === 'producto_id' && valor) {
        const prod = productos.find(p => String(p.id) === valor);

        if (prod) {
          const precioBase = tipo === 'mayorista' ? prod.precio_mayorista : prod.precio_minorista;
          copia[idx].precio_unitario = precioBase ?? '';
        }
      }
      return copia;
    });
  }

  function cambiarTipoVenta(nuevoTipo) {
    setTipo(nuevoTipo);

    setItems(prev =>
      prev.map(item => {
        const prod = productos.find(
          p => String(p.id) === String(item.producto_id)
        );

        if (!prod) return item;

        const precioBase = nuevoTipo === 'mayorista' ? prod.precio_mayorista : prod.precio_minorista;
        return { ...item, precio_unitario: precioBase ?? '' };
      })
    );
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
    const itemsConProducto = items.filter(i => i.producto_id);
    if (itemsConProducto.length === 0) return;

    const incompleto = itemsConProducto.find(i => !(Number(i.cantidad) > 0) || !(Number(i.precio_unitario) > 0));
    if (incompleto) {
      mostrarToast('Completá la cantidad y el precio de todos los productos antes de guardar.', 'error');
      return;
    }

    onGuardar({
      tipo,
      observaciones: observaciones || null,
      metodo_pago: metodoPago,
      canal,
      comision: canal === 'mercadolibre' ? Number(comision) || 0 : 0,
      items: itemsConProducto.map(i => ({
        producto_id: Number(i.producto_id),
        cantidad: Number(i.cantidad),
        precio_unitario: Number(i.precio_unitario),
      })),
    });
  }

  return (
    <form onSubmit={enviar} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Select
          label="Tipo de venta"
          value={tipo}
          onChange={e => cambiarTipoVenta(e.target.value)}
        >
          <option value="minorista">Minorista</option>
          <option value="mayorista">Mayorista</option>
        </Select>

        <Select
          label="Método de pago"
          value={metodoPago}
          onChange={e => setMetodoPago(e.target.value)}
        >
          <option value="efectivo">Efectivo</option>
          <option value="transferencia">Transferencia</option>
          <option value="tarjeta">Tarjeta</option>
          <option value="otro">Otro</option>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Select
          label="Canal de venta"
          value={canal}
          onChange={e => setCanal(e.target.value)}
        >
          <option value="directa">Directa</option>
          <option value="mercadolibre">MercadoLibre</option>
        </Select>

        {canal === 'mercadolibre' && (
          <InputPrecio
            label="Comisión de ML"
            valorInicial={comision}
            onCambio={valor => setComision(valor || '')}
            placeholder="0"
          />
        )}
      </div>

      {/* Items */}
      <div className="space-y-3">
        <label className="text-xs font-medium text-slate-600">Productos</label>
        {items.map((item, idx) => (
          <div key={idx} className="flex gap-2 items-end">
            <div className="flex-1">
              <select
                value={item.producto_id}
                onChange={e => actualizarItem(idx, 'producto_id', e.target.value)}
                className="w-full text-base md:text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
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
                className="w-20 text-base md:text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
                required
              />
            </div>
            <div className="w-28">
              <InputPrecio
                valorInicial={item.precio_unitario}
                onCambio={valor => actualizarItem(idx, 'precio_unitario', valor)}
                placeholder="Precio"
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
