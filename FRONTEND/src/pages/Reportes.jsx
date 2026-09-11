import { useState, useEffect, useCallback } from 'react';
import { TrendingUp, FileText, Scale, Waves } from 'lucide-react';
import { reportesApi } from '../services/api.js';
import { useToast } from '../context/ToastContext.jsx';
import { Card, Boton, Spinner, StatCard } from '../components/ui/index.jsx';
import { formatearPrecio } from '../utils.js';

const TABS = [
  { id: 'resumen', etiqueta: 'Resumen' },
  { id: 'estado-resultados', etiqueta: 'Estado de Resultados' },
  { id: 'balance', etiqueta: 'Balance' },
  { id: 'flujo-caja', etiqueta: 'Flujo de Caja' },
];

function primerDiaDelMes() {
  const hoy = new Date();
  return new Date(hoy.getFullYear(), hoy.getMonth(), 1).toISOString().slice(0, 10);
}

function hoyISO() {
  return new Date().toISOString().slice(0, 10);
}

export default function Reportes() {
  const { mostrarToast } = useToast();
  const [tab, setTab] = useState('resumen');
  const [desde, setDesde] = useState(primerDiaDelMes());
  const [hasta, setHasta] = useState(hoyISO());
  const [cargando, setCargando] = useState(false);
  const [datos, setDatos] = useState({});

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const [resumen, estadoResultados, balance, flujoCaja] = await Promise.all([
        reportesApi.resumen(desde, hasta),
        reportesApi.estadoResultados(desde, hasta),
        reportesApi.balance(),
        reportesApi.flujoCaja(desde, hasta),
      ]);
      setDatos({
        resumen,
        'estado-resultados': estadoResultados,
        balance,
        'flujo-caja': flujoCaja,
      });
    } catch (err) {
      mostrarToast(err.message || 'No se pudieron cargar los reportes', 'error');
    } finally {
      setCargando(false);
    }
  }, [desde, hasta, mostrarToast]);

  useEffect(() => { cargar(); }, [cargar]);

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Reportes</h1>
          <p className="text-sm text-slate-500">Resumen, Estado de Resultados, Balance y Flujo de Caja</p>
        </div>
        <div className="flex items-center gap-2">
          <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} className="border border-slate-200 rounded-lg px-2 py-1.5 text-sm" />
          <span className="text-slate-400 text-sm">a</span>
          <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} className="border border-slate-200 rounded-lg px-2 py-1.5 text-sm" />
        </div>
      </div>

      <div className="flex gap-2 flex-wrap">
        {TABS.map((t) => (
          <Boton key={t.id} variante={tab === t.id ? 'primario' : 'secundario'} tamaño="sm" onClick={() => setTab(t.id)}>
            {t.etiqueta}
          </Boton>
        ))}
      </div>

      {cargando ? <Spinner /> : (
        <>
          {tab === 'resumen' && <TabResumen datos={datos.resumen} />}
          {tab === 'estado-resultados' && <TabEstadoResultados datos={datos['estado-resultados']} />}
          {tab === 'balance' && <TabBalance datos={datos.balance} />}
          {tab === 'flujo-caja' && <TabFlujoCaja datos={datos['flujo-caja']} />}
        </>
      )}
    </div>
  );
}

function TabResumen({ datos }) {
  if (!datos) return null;
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
      <StatCard titulo="Utilidad neta del período" valor={formatearPrecio(datos.utilidad_neta_periodo)} icono={<TrendingUp size={18} />} color={datos.utilidad_neta_periodo >= 0 ? 'verde' : 'rojo'} />
      <StatCard titulo="Saldo en cuentas" valor={formatearPrecio(datos.saldo_total_cuentas)} icono={<Scale size={18} />} color="azul" />
      <StatCard titulo="Por cobrar" valor={formatearPrecio(datos.total_por_cobrar)} icono={<FileText size={18} />} color="amarillo" />
      <StatCard titulo="Por pagar" valor={formatearPrecio(datos.total_por_pagar)} icono={<FileText size={18} />} color="rojo" />
      <StatCard titulo="Ingresos de caja del período" valor={formatearPrecio(datos.ingresos_caja_periodo)} icono={<Waves size={18} />} color="verde" />
      <StatCard titulo="Egresos de caja del período" valor={formatearPrecio(datos.egresos_caja_periodo)} icono={<Waves size={18} />} color="rojo" />
      <StatCard titulo="Flujo neto de caja del período" valor={formatearPrecio(datos.flujo_neto_caja_periodo)} icono={<Waves size={18} />} color={datos.flujo_neto_caja_periodo >= 0 ? 'verde' : 'rojo'} />
      <StatCard titulo="Ingresos por ventas del período" valor={formatearPrecio(datos.ingresos_por_ventas_periodo)} icono={<TrendingUp size={18} />} color="azul" />
    </div>
  );
}

function Fila({ etiqueta, valor, negativo, total }) {
  return (
    <div className={`flex justify-between py-2 text-sm ${total ? 'border-t border-slate-200 mt-1 pt-3 font-semibold text-slate-800' : 'text-slate-600'}`}>
      <span>{etiqueta}</span>
      <span className={negativo ? 'text-red-500' : ''}>{negativo ? '-' : ''}{formatearPrecio(Math.abs(valor))}</span>
    </div>
  );
}

function TabEstadoResultados({ datos }) {
  if (!datos) return null;
  return (
    <Card className="p-5 max-w-xl">
      <Fila etiqueta="Ingresos por ventas" valor={datos.ingresos_por_ventas} />
      <Fila etiqueta="Costo de mercadería vendida" valor={datos.costo_mercaderia_vendida} negativo />
      <Fila etiqueta="Comisiones" valor={datos.comisiones} negativo />
      <Fila etiqueta="Utilidad bruta" valor={datos.utilidad_bruta} total />
      <Fila etiqueta="Gastos operativos" valor={datos.gastos_operativos} negativo />
      <Fila etiqueta="Utilidad neta" valor={datos.utilidad_neta} total />
    </Card>
  );
}

function TabBalance({ datos }) {
  if (!datos) return null;
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-3xl">
      <Card className="p-5">
        <h3 className="text-sm font-semibold text-slate-700 mb-2">Activos</h3>
        <Fila etiqueta="Disponible en cuentas" valor={datos.disponible} />
        <Fila etiqueta="Por cobrar" valor={datos.por_cobrar} />
        <Fila etiqueta="Inventario (a costo)" valor={datos.inventario} />
        <Fila etiqueta="Total activos" valor={datos.total_activos} total />
      </Card>
      <Card className="p-5">
        <h3 className="text-sm font-semibold text-slate-700 mb-2">Pasivos y patrimonio</h3>
        <Fila etiqueta="Por pagar" valor={datos.por_pagar} />
        <Fila etiqueta="Total pasivos" valor={datos.total_pasivos} total />
        <Fila etiqueta="Patrimonio" valor={datos.patrimonio} total />
      </Card>
    </div>
  );
}

function TabFlujoCaja({ datos }) {
  if (!datos) return null;
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-3xl">
      <Card className="p-5">
        <Fila etiqueta="Saldo inicial del período" valor={datos.saldo_inicial} />
        <Fila etiqueta="Ingresos de caja" valor={datos.ingresos_caja} />
        <Fila etiqueta="Egresos de caja" valor={datos.egresos_caja} negativo />
        <Fila etiqueta="Flujo neto" valor={datos.flujo_neto} total />
        <Fila etiqueta="Saldo final del período" valor={datos.saldo_final} total />
      </Card>
      <Card className="p-5">
        <h3 className="text-sm font-semibold text-slate-700 mb-2">Detalle por categoría</h3>
        {(datos.detalle_por_categoria || []).length === 0 ? (
          <p className="text-sm text-slate-400">Sin movimientos en el período</p>
        ) : (
          datos.detalle_por_categoria.map((d, i) => (
            <Fila key={i} etiqueta={d.categoria} valor={d.monto} negativo={d.tipo === 'egreso'} />
          ))
        )}
      </Card>
    </div>
  );
}
