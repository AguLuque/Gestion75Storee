import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Boton, Select, Textarea, Input } from './ui/index.jsx';
import { formatearPrecio, metodosPagoPermitidos, metodoPagoParaCuenta } from '../utils.js';
import { InputPrecio } from './ui/index.jsx';
import { SelectorProducto } from './ui/selector-producto.jsx';
import { useToast } from '../context/ToastContext.jsx';

const itemVacio = () => ({ producto_id: '', cantidad: 1, precio_unitario: '' });

const METODOS_PAGO = [
  { valor: 'efectivo', etiqueta: 'Efectivo' },
  { valor: 'transferencia', etiqueta: 'Transferencia' },
  { valor: 'tarjeta', etiqueta: 'Tarjeta' },
  { valor: 'otro', etiqueta: 'Otro' },
];

// Stock disponible al lado de cada producto del buscador (≤2 = bajo stock,
// mismo umbral que /productos/bajo-stock)
function detalleStock(producto) {
  const stock = Number(producto.stock_actual) || 0;
  if (stock <= 0) return <span className="font-medium text-red-500">Sin stock</span>;
  return <span className={stock <= 2 ? 'font-medium text-amber-600' : 'text-slate-500'}>{stock} u.</span>;
}

export default function FormularioVenta({ productos, cuentasDinero = [], onGuardar, guardando, onCancelar }) {
  const [tipo, setTipo] = useState('minorista');
  const [items, setItems] = useState([itemVacio()]);
  const [observaciones, setObservaciones] = useState('');
  const [metodoPago, setMetodoPago] = useState('efectivo');
  const [canal, setCanal] = useState('directa');
  const [comision, setComision] = useState('');
  const [cuentaDineroId, setCuentaDineroId] = useState('');
  const [aCredito, setACredito] = useState(false);
  const [clienteNombre, setClienteNombre] = useState('');
  const [fechaVencimiento, setFechaVencimiento] = useState('');
  const { mostrarToast } = useToast();

  // La cuenta que recibe el dinero limita el método de pago a su tipo (Caja ->
  // efectivo, Mercado Pago -> transferencia/tarjeta). A crédito no hay cuenta.
  const cuentaElegida = aCredito ? null : cuentasDinero.find(c => String(c.id) === String(cuentaDineroId));
  const metodosPermitidos = cuentaElegida ? metodosPagoPermitidos(cuentaElegida.tipo) : null;
  const metodosVisibles = metodosPermitidos ? METODOS_PAGO.filter(m => metodosPermitidos.includes(m.valor)) : METODOS_PAGO;

  function elegirCuenta(id) {
    setCuentaDineroId(id);
    const cuenta = cuentasDinero.find(c => String(c.id) === String(id));
    if (cuenta) setMetodoPago(prev => metodoPagoParaCuenta(cuenta.tipo, prev));
  }

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
      estado_cobro: aCredito ? 'pendiente' : 'cobrado',
      cliente_nombre: aCredito ? (clienteNombre || null) : null,
      fecha_vencimiento: aCredito ? (fechaVencimiento || null) : null,
      cuenta_dinero_id: !aCredito && cuentaDineroId ? Number(cuentaDineroId) : null,
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
          {metodosVisibles.map(m => <option key={m.valor} value={m.valor}>{m.etiqueta}</option>)}
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

      <div className="flex items-center gap-2 -mt-1">
        <input
          type="checkbox"
          id="venta-a-credito"
          checked={aCredito}
          onChange={e => {
            setACredito(e.target.checked);
            // Al volver a "cobrada en el momento", la cuenta elegida vuelve a mandar
            if (!e.target.checked) elegirCuenta(cuentaDineroId);
          }}
          className="rounded border-slate-300 text-primary-600 focus:ring-primary-500"
        />
        <label htmlFor="venta-a-credito" className="text-sm text-slate-600">
          Venta a crédito (todavía no se cobró)
        </label>
      </div>

      {aCredito ? (
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Cliente (opcional)"
            value={clienteNombre}
            onChange={e => setClienteNombre(e.target.value)}
            placeholder="Nombre del cliente"
          />
          <Input
            label="Vence el (opcional)"
            type="date"
            value={fechaVencimiento}
            onChange={e => setFechaVencimiento(e.target.value)}
          />
        </div>
      ) : (
        <Select
          label="Cuenta que recibe el dinero (opcional)"
          value={cuentaDineroId}
          onChange={e => elegirCuenta(e.target.value)}
        >
          <option value="">Sin registrar en ninguna cuenta</option>
          {cuentasDinero.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
        </Select>
      )}

      {/* Items */}
      <div className="space-y-3">
        <label className="text-xs font-medium text-slate-600">Productos</label>
        {items.map((item, idx) => (
          // En mobile el producto va en su propia línea y cantidad + precio
          // debajo, agrupados en un recuadro; desde md: todo en una fila.
          <div key={idx} className="flex flex-wrap md:flex-nowrap gap-2 items-end rounded-lg border border-slate-100 p-2 md:border-0 md:p-0">
            <div className="flex-1 basis-full md:basis-0 min-w-0">
              <SelectorProducto
                productos={productos}
                value={item.producto_id}
                onChange={id => actualizarItem(idx, 'producto_id', id)}
                detalle={detalleStock}
                required
              />
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
            <div className="flex-1 md:flex-none md:w-28">
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
