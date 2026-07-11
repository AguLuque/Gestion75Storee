import { useState } from 'react';
import { Plus, Search, Pencil, Trash2, Loader2 } from 'lucide-react';
import { useAccion } from '../hooks/useDatos.js';
import { productosApi } from '../services/api.js';
import { useDatosGlobal } from '../context/DatosContext.jsx';
import { useToast } from '../context/ToastContext.jsx';

import { Button } from '../components/ui/button.jsx';
import { Card } from '../components/ui/card.jsx';
import { Input } from '../components/ui/input.jsx';
import { Badge } from '../components/ui/badge.jsx';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../components/ui/select.jsx';
import {
  Table, TableHeader, TableRow, TableHead, TableBody, TableCell,
} from '../components/ui/table.jsx';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '../components/ui/dialog.jsx';
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction,
} from '../components/ui/alert-dialog.jsx';

import { formatearPrecio } from '../utils.js';
import FormularioProducto from '../components/FormularioProducto.jsx';

export default function Productos() {
  const { productos, categorias, cargando, recargar } = useDatosGlobal();
  const { ejecutar, cargando: guardando } = useAccion();
  const { mostrarToast } = useToast();

  const [busqueda, setBusqueda] = useState('');
  const [filtroCategoria, setFiltroCategoria] = useState('');
  const [modalAbierto, setModalAbierto] = useState(false);
  const [productoEditando, setProductoEditando] = useState(null);
  const [confirmEliminar, setConfirmEliminar] = useState(null);

  const productosFiltrados = (Array.isArray(productos) ? productos : []).filter(p => {
    const coincideBusqueda = p.nombre.toLowerCase().includes(busqueda.toLowerCase());
    const coincideCategoria = !filtroCategoria || String(p.categoria_id) === filtroCategoria;
    return coincideBusqueda && coincideCategoria;
  });

  function abrirCrear() {
    setProductoEditando(null);
    setModalAbierto(true);
  }

  function abrirEditar(producto) {
    setProductoEditando(producto);
    setModalAbierto(true);
  }

  async function guardar(datos) {
    const accion = productoEditando
      ? () => productosApi.actualizar(productoEditando.id, datos)
      : () => productosApi.crear(datos);

    const resultado = await ejecutar(accion);
    if (resultado.ok) {
      mostrarToast(productoEditando ? 'Producto actualizado' : 'Producto creado');
      setModalAbierto(false);
      recargar('productos');
    } else {
      mostrarToast(resultado.error, 'error');
    }
  }

  async function eliminar() {
    const resultado = await ejecutar(() => productosApi.eliminar(confirmEliminar.id));
    if (resultado.ok) {
      mostrarToast('Producto eliminado');
      setConfirmEliminar(null);
      recargar('productos');
    } else {
      mostrarToast(resultado.error, 'error');
    }
  }

  if (cargando) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">Productos</h1>
          <p className="text-sm text-muted-foreground">{productosFiltrados.length} productos</p>
        </div>
        <Button onClick={abrirCrear}>
          <Plus size={16} /> Nuevo
        </Button>
      </div>

      <Card className="p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar producto..."
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={filtroCategoria} onValueChange={setFiltroCategoria}>
            <SelectTrigger className="sm:w-56">
              <SelectValue placeholder="Todas las categorías" />
            </SelectTrigger>
            <SelectContent>
              {(Array.isArray(categorias) ? categorias : []).map(c => (
                <SelectItem key={c.id} value={String(c.id)}>{c.nombre}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </Card>

      <Card className="p-5">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Producto</TableHead>
              <TableHead>Categoría</TableHead>
              <TableHead>Stock</TableHead>
              <TableHead className="hidden sm:table-cell">P. Compra</TableHead>
              <TableHead>P. Minorista</TableHead>
              <TableHead className="hidden sm:table-cell">P. Mayorista</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {productosFiltrados.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                  No se encontraron productos
                </TableCell>
              </TableRow>
            ) : (
              productosFiltrados.map(p => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium text-foreground">{p.nombre}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{p.categoria_nombre || '—'}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={p.stock_actual === 0 ? 'destructive' : p.stock_actual <= 2 ? 'outline' : 'secondary'}>
                      <span className="whitespace-nowrap">{p.stock_actual} u.</span>
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs hidden sm:table-cell">
                    {formatearPrecio(p.precio_compra)}
                  </TableCell>
                  <TableCell>{formatearPrecio(p.precio_minorista)}</TableCell>
                  <TableCell className="hidden sm:table-cell">{formatearPrecio(p.precio_mayorista)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <Button variant="ghost" size="icon-sm" onClick={() => abrirEditar(p)}>
                        <Pencil size={14} />
                      </Button>
                      <Button variant="destructive" size="icon-sm" onClick={() => setConfirmEliminar(p)}>
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={modalAbierto} onOpenChange={setModalAbierto}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{productoEditando ? 'Editar producto' : 'Nuevo producto'}</DialogTitle>
          </DialogHeader>
          <FormularioProducto
            productoInicial={productoEditando}
            categorias={Array.isArray(categorias) ? categorias : []}
            onGuardar={guardar}
            guardando={guardando}
            onCancelar={() => setModalAbierto(false)}
          />
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!confirmEliminar} onOpenChange={(open) => !open && setConfirmEliminar(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar acción</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Eliminar el producto "{confirmEliminar?.nombre}"? Esta acción desactivará el producto.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={guardando}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={eliminar}
              disabled={guardando}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {guardando ? 'Eliminando...' : 'Eliminar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}