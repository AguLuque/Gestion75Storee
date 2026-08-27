import { useState, useEffect } from 'react';
import { Boton, Input, InputPrecio, Select } from './ui/index.jsx';

export default function FormularioProducto({ productoInicial, categorias, onGuardar, guardando, onCancelar }) {
  const [formulario, setFormulario] = useState({
    nombre: '',
    categoria_id: '',
    precio_minorista: '',
    precio_mayorista: '',
    precio_compra: '',
    stock_actual: '0',
  });

  useEffect(() => {
    if (productoInicial) {
      setFormulario({
        nombre: productoInicial.nombre || '',
        categoria_id: productoInicial.categoria_id || '',
        precio_minorista: productoInicial.precio_minorista || '',
        precio_mayorista: productoInicial.precio_mayorista || '',
        precio_compra: productoInicial.precio_compra || '',
        stock_actual: productoInicial.stock_actual ?? '0',
      });
    }
  }, [productoInicial]);

  function actualizar(campo, valor) {
    setFormulario(prev => ({ ...prev, [campo]: valor }));
  }

  function enviar(e) {
    e.preventDefault();
    onGuardar({
      ...formulario,
      categoria_id: Number(formulario.categoria_id) || null,
      precio_minorista: Number(formulario.precio_minorista),
      precio_mayorista: formulario.precio_mayorista === '' ? null : Number(formulario.precio_mayorista),
      precio_compra: Number(formulario.precio_compra) || 0,
      stock_actual: Number(formulario.stock_actual) || 0,
    });
  }

  return (
    <form onSubmit={enviar} className="space-y-4">
      <Input
        label="Nombre del producto *"
        value={formulario.nombre}
        onChange={e => actualizar('nombre', e.target.value)}
        required
        placeholder="Ej: Remera básica"
      />

      <Select
        label="Categoría"
        value={formulario.categoria_id}
        onChange={e => actualizar('categoria_id', e.target.value)}
      >
        <option value="">Sin categoría</option>
        {categorias.map(c => (
          <option key={c.id} value={c.id}>{c.nombre}</option>
        ))}
      </Select>

      <div className="grid grid-cols-2 gap-3">
        <InputPrecio
          label="Precio minorista *"
          valorInicial={formulario.precio_minorista}
          onCambio={(valor) => actualizar('precio_minorista', valor)}
          required
        />
        <div>
          <InputPrecio
            label="Precio mayorista"
            valorInicial={formulario.precio_mayorista}
            onCambio={(valor) => actualizar('precio_mayorista', valor || '')}
            placeholder="Opcional"
          />
          <p className="text-xs text-slate-400 mt-1">Dejalo vacío si no vendés este producto por mayor.</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <InputPrecio
          label="Precio de compra"
          valorInicial={formulario.precio_compra}
          onCambio={(valor) => actualizar('precio_compra', valor)}
        />
        <Input
          label="Stock"
          type="number"
          min="0"
          value={formulario.stock_actual}
          onChange={e => actualizar('stock_actual', e.target.value)}
        />
      </div>

      <div className="flex gap-2 pt-2 justify-end">
        <Boton variante="secundario" type="button" onClick={onCancelar} disabled={guardando}>
          Cancelar
        </Boton>
        <Boton type="submit" disabled={guardando}>
          {guardando ? 'Guardando...' : 'Guardar'}
        </Boton>
      </div>
    </form>
  );
}
