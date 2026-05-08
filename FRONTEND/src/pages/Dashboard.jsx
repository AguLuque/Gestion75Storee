import { useMemo } from 'react';
import { TrendingUp, ShoppingCart, Package, AlertTriangle } from 'lucide-react';
import { useDatos } from '../hooks/useDatos.js';
import { ventasApi, comprasApi, productosApi } from '../services/api.js';
import { StatCard, Card, Spinner, Badge } from '../components/ui/index.jsx';
import { formatearPrecio, formatearFecha } from '../utils.js';

export default function Dashboard() {
  const { datos: ventas, cargando: cargandoVentas } = useDatos(ventasApi.listar);
  const { datos: compras, cargando: cargandoCompras } = useDatos(comprasApi.listar);
  const { datos: productos, cargando: cargandoProductos } = useDatos(productosApi.listar);
  const { datos: bajoStock } = useDatos(productosApi.bajoStock);

  const listaVentas = Array.isArray(ventas) ? ventas : [];
  const listaCompras = Array.isArray(compras) ? compras : [];
  const listaProductos = Array.isArray(productos) ? productos : [];
  const listaBajoStock = Array.isArray(bajoStock) ? bajoStock : [];

  const stats = useMemo(() => {
    const totalVentas = listaVentas.reduce((s, v) => s + Number(v.total || 0), 0);
    const totalGanancia = listaVentas.reduce((s, v) => s + Number(v.ganancia || 0), 0);
    const totalCompras = listaCompras.reduce((s, c) => s + Number(c.total || 0), 0);
    return { totalVentas, totalGanancia, totalCompras };
  }, [listaVentas, listaCompras]);

  if (cargandoVentas || cargandoCompras || cargandoProductos) return <Spinner />;

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-xl font-bold text-slate-800">Dashboard</h1>
        <p className="text-sm text-slate-500 mt-0.5">Resumen general del negocio</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard titulo="Total ventas" valor={formatearPrecio(stats.totalVentas)} icono={<TrendingUp size={18} />} color="verde" />
        <StatCard titulo="Ganancia" valor={formatearPrecio(stats.totalGanancia)} icono="💰" color="azul" />
        <StatCard titulo="Compras" valor={formatearPrecio(stats.totalCompras)} icono={<ShoppingCart size={18} />} color="amarillo" />
        <StatCard titulo="Productos" valor={listaProductos.length} icono={<Package size={18} />} color="azul" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="p-5">
          <h2 className="font-semibold text-slate-700 mb-4 text-sm">Últimas ventas</h2>
          <div className="space-y-0">
            {listaVentas.slice(0, 5).map(venta => (
              <div key={venta.id} className="flex items-center justify-between py-2.5 border-b border-slate-50 last:border-0">
                <div>
                  <p className="text-sm text-slate-800 font-medium">{formatearPrecio(venta.total)}</p>
                  <p className="text-xs text-slate-400">{formatearFecha(venta.fecha)}</p>
                </div>
                <Badge color={venta.tipo === 'mayorista' ? 'violeta' : 'azul'}>{venta.tipo}</Badge>
              </div>
            ))}
            {listaVentas.length === 0 && (
              <p className="text-sm text-slate-400 py-4 text-center">Sin ventas registradas</p>
            )}
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle size={16} className="text-amber-500" />
            <h2 className="font-semibold text-slate-700 text-sm">Stock bajo</h2>
          </div>
          <div className="space-y-0">
            {listaBajoStock.slice(0, 6).map(p => (
              <div key={p.id} className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
                <p className="text-sm text-slate-700">{p.nombre}</p>
                <Badge color="amarillo">{p.stock_actual} u.</Badge>
              </div>
            ))}
            {listaBajoStock.length === 0 && (
              <p className="text-sm text-slate-400 py-4 text-center">✓ Todo el stock está bien</p>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}