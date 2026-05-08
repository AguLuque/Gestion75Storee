import { useState, useEffect } from 'react';
import { Boton, Input, Select } from './ui/index.jsx';

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
      precio_mayorista: Number(formulario.precio_mayorista),
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
        <Input
          label="Precio minorista *"
          type="number"
          min="0"
          value={formulario.precio_minorista}
          onChange={e => actualizar('precio_minorista', e.target.value)}
          required
          placeholder="0"
        />
        <Input
          label="Precio mayorista *"
          type="number"
          min="0"
          value={formulario.precio_mayorista}
          onChange={e => actualizar('precio_mayorista', e.target.value)}
          required
          placeholder="0"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Input
          label="Precio de compra"
          type="number"
          min="0"
          value={formulario.precio_compra}
          onChange={e => actualizar('precio_compra', e.target.value)}
          placeholder="0"
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
