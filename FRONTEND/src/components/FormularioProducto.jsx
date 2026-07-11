import { useState, useEffect } from 'react';
import { Button } from './ui/button.jsx';
import { Input } from './ui/input.jsx';
import { Label } from './ui/label.jsx';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from './ui/select.jsx';

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
        categoria_id: productoInicial.categoria_id ? String(productoInicial.categoria_id) : '',
        precio_minorista: productoInicial.precio_minorista || '',
        precio_mayorista: productoInicial.precio_mayorista || '',
        precio_compra: productoInicial.precio_compra || '',
        stock_actual: String(productoInicial.stock_actual ?? '0'),
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
      <div className="space-y-1.5">
        <Label htmlFor="nombre">Nombre del producto *</Label>
        <Input
          id="nombre"
          value={formulario.nombre}
          onChange={e => actualizar('nombre', e.target.value)}
          required
          placeholder="Ej: Remera básica"
        />
      </div>

      <div className="space-y-1.5">
        <Label>Categoría</Label>
        <Select value={formulario.categoria_id} onValueChange={v => actualizar('categoria_id', v)}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Sin categoría" />
          </SelectTrigger>
          <SelectContent>
            {categorias.map(c => (
              <SelectItem key={c.id} value={String(c.id)}>{c.nombre}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="p_minorista">Precio minorista *</Label>
          <Input
            id="p_minorista" type="number" min="0" step="0.01"
            value={formulario.precio_minorista}
            onChange={e => actualizar('precio_minorista', e.target.value)}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="p_mayorista">Precio mayorista *</Label>
          <Input
            id="p_mayorista" type="number" min="0" step="0.01"
            value={formulario.precio_mayorista}
            onChange={e => actualizar('precio_mayorista', e.target.value)}
            required
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="p_compra">Precio de compra</Label>
          <Input
            id="p_compra" type="number" min="0" step="0.01"
            value={formulario.precio_compra}
            onChange={e => actualizar('precio_compra', e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="stock">Stock</Label>
          <Input
            id="stock" type="number" min="0"
            value={formulario.stock_actual}
            onChange={e => actualizar('stock_actual', e.target.value)}
          />
        </div>
      </div>

      <div className="flex gap-2 pt-2 justify-end">
        <Button variant="outline" type="button" onClick={onCancelar} disabled={guardando}>
          Cancelar
        </Button>
        <Button type="submit" disabled={guardando}>
          {guardando ? 'Guardando...' : 'Guardar'}
        </Button>
      </div>
    </form>
  );
}