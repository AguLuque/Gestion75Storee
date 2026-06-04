import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { TrendingUp, ShoppingCart, AlertTriangle, Wallet, DollarSign, BarChart3 } from 'lucide-react';
import { useDatosGlobal } from '../context/DatosContext.jsx';
import { StatCard, Card, Spinner, Badge } from '../components/ui/index.jsx';
import { formatearPrecio, formatearFecha } from '../utils.js';

export default function Dashboard() {
  const navigate = useNavigate();

  const {
    ventasFiltradas: ventas,
    comprasFiltradas: compras,
    gastosFiltrados: gastos,
    deudores,
    bajoStock,
    cargando,
    mesSeleccionado,
    esMesFuturo
  } = useDatosGlobal();

  const listaVentas = Array.isArray(ventas) ? ventas : [];
  const listaCompras = Array.isArray(compras) ? compras : [];
  const listaGastos = Array.isArray(gastos) ? gastos : [];
  const listaBajoStock = Array.isArray(bajoStock) ? bajoStock : [];
  const listaDeudores = Array.isArray(deudores) ? deudores : [];
  const stats = useMemo(() => {
    const totalVentas = listaVentas.reduce((s, v) => s + Number(v.total || 0), 0);
    const totalCompras = listaCompras.reduce((s, c) => s + Number(c.total || 0), 0);
    const totalGastos = listaGastos.reduce((s, g) => s + Number(g.monto || 0), 0);
    const gananciaBruta = totalVentas - totalCompras;
    const gananciaNeta = gananciaBruta - totalGastos;
    const totalDeudasPorCobrar = listaDeudores.reduce((s, d) => s + Number(d.monto || 0), 0);
    return { totalVentas, totalCompras, totalGastos, gananciaBruta, gananciaNeta, totalDeudasPorCobrar };
  }, [listaVentas, listaCompras, listaGastos, listaDeudores]);

  if (cargando) return <Spinner />;

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-xl font-bold text-slate-800">Principal  </h1>
        <p className="text-sm text-slate-500 mt-0.5">Resumen general del negocio</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        <StatCard
          titulo="Total vendido"
          valor={formatearPrecio(stats.totalVentas)}
          icono={<TrendingUp size={18} />}
          color="azul"
          onClick={() => navigate('/ventas')}
        />

        <StatCard
          titulo="Total comprado"
          valor={formatearPrecio(stats.totalCompras)}
          icono={<ShoppingCart size={18} />}
          color="azul"
          onClick={() => navigate('/compras')}
        />

        <StatCard
          titulo="Gastos"
          valor={formatearPrecio(stats.totalGastos)}
          icono={<Wallet size={18} />}
          color="azul"
          onClick={() => navigate('/gastos')}
        />

        <StatCard
          titulo="Ganancia bruta"
          valor={formatearPrecio(stats.gananciaBruta)}
          icono={<DollarSign size={18} />}
          color={stats.gananciaBruta >= 0 ? 'azul' : 'rojo'}
        />

        <StatCard
          titulo="Ganancia neta"
          valor={formatearPrecio(stats.gananciaNeta)}
          icono={<BarChart3 size={18} />}
          color={stats.gananciaNeta >= 0 ? 'azul' : 'rojo'}
        />

        <StatCard
          titulo="Deudas por cobrar"
          valor={formatearPrecio(stats.totalDeudasPorCobrar)}
          icono={<AlertTriangle size={18} />}
          color="azul"
          onClick={() => navigate('/deudores')}
        />
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