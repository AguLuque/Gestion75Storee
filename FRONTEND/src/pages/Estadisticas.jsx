// src/pages/Estadisticas.jsx
import { useEffect, useMemo, useState } from 'react';
import { Area, AreaChart, CartesianGrid, XAxis } from 'recharts';
import { Pie, PieChart, Label } from 'recharts';
import { Bar, BarChart, YAxis, LabelList, Cell } from 'recharts';
import {
  Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter,
} from '../components/ui/card';
import {
  ChartContainer, ChartTooltip, ChartTooltipContent,
  ChartLegend, ChartLegendContent,
} from '../components/ui/chart';
import { estadisticasApi } from '../services/api';
import { useToast } from '../context/ToastContext';

const formatoMoneda = (valor) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(valor || 0);

const formatoMesCorto = (fechaIso) =>
  new Date(fechaIso).toLocaleDateString('es-AR', { month: 'short', year: '2-digit' });

function KpiCard({ titulo, valor }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription>{titulo}</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-bold">{valor}</p>
      </CardContent>
    </Card>
  );
}

const chartConfigEvolucion = {
  ventas: { label: 'Ventas', color: 'var(--chart-1)' },
  ganancia: { label: 'Ganancia', color: 'var(--chart-2)' },
};

export default function Estadisticas() {
  const { mostrarToast } = useToast();

  const hoy = new Date();
  const primerDiaMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1).toISOString().slice(0, 10);
  const hoyIso = hoy.toISOString().slice(0, 10);

  const [desde, setDesde] = useState(primerDiaMes);
  const [hasta, setHasta] = useState(hoyIso);
  const [cargando, setCargando] = useState(true);

  const [resumenMensual, setResumenMensual] = useState([]);
  const [resumenPeriodo, setResumenPeriodo] = useState(null);
  const [topProductos, setTopProductos] = useState([]);

  useEffect(() => {
    cargarDatos();
  }, [desde, hasta]);

  async function cargarDatos() {
    setCargando(true);
    try {
      const [mensual, periodo, top] = await Promise.all([
        estadisticasApi.resumenMensual(6),
        estadisticasApi.resumenPeriodo(desde, hasta),
        estadisticasApi.topProductos(desde, hasta, 5),
      ]);
      setResumenMensual(mensual);
      setResumenPeriodo(periodo);
      setTopProductos(top);
    } catch (error) {
      mostrarToast(error.message || 'Error al cargar estadísticas', 'error');
    } finally {
      setCargando(false);
    }
  }

  const datosEvolucion = resumenMensual.map((m) => ({
    mes: formatoMesCorto(m.mes),
    ventas: Number(m.total_ventas),
    ganancia: Number(m.ganancia_neta),
  }));

  // Top productos para el donut (distribución por cantidad vendida)
  const chartConfigTop = useMemo(() => {
    const config = { cantidad: { label: 'Unidades vendidas' } };
    topProductos.forEach((p, i) => {
      config[`producto_${p.id}`] = {
        label: p.nombre,
        color: `var(--chart-${(i % 5) + 1})`,
      };
    });
    return config;
  }, [topProductos]);

  const datosTopDonut = topProductos.map((p, i) => ({
    producto: `producto_${p.id}`,
    nombre: p.nombre,
    cantidad: Number(p.cantidad_vendida),
    fill: `var(--chart-${(i % 5) + 1})`,
  }));

  const totalUnidadesTop = useMemo(
    () => datosTopDonut.reduce((acc, curr) => acc + curr.cantidad, 0),
    [datosTopDonut]
  );

  // Top productos para el bar horizontal (por total vendido $)
  const datosTopBar = topProductos.map((p, i) => ({
    nombre: p.nombre,
    total: Number(p.total_vendido),
    fill: `var(--chart-${(i % 5) + 1})`,
  }));

  const chartConfigBar = {
    total: { label: 'Total vendido', color: 'var(--chart-1)' },
    label: { color: 'var(--background)' },
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h1 className="text-2xl font-bold">Estadísticas</h1>
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={desde}
            onChange={(e) => setDesde(e.target.value)}
            className="border rounded-md px-3 py-1.5 text-sm bg-background"
          />
          <span className="text-muted-foreground text-sm">a</span>
          <input
            type="date"
            value={hasta}
            onChange={(e) => setHasta(e.target.value)}
            className="border rounded-md px-3 py-1.5 text-sm bg-background"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard titulo="Total vendido" valor={formatoMoneda(resumenPeriodo?.total_vendido)} />
        <KpiCard titulo="Ganancia neta" valor={formatoMoneda(resumenPeriodo?.ganancia_neta)} />
        <KpiCard titulo="Cantidad de ventas" valor={resumenPeriodo?.cantidad_ventas ?? 0} />
        <KpiCard titulo="Ticket promedio" valor={formatoMoneda(resumenPeriodo?.ticket_promedio)} />
      </div>

      {/* Evolución mensual - Area chart */}
      <Card className="pt-0">
        <CardHeader className="border-b py-5">
          <CardTitle>Evolución mensual</CardTitle>
          <CardDescription>Ventas vs ganancia neta, últimos 6 meses</CardDescription>
        </CardHeader>
        <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
          <ChartContainer config={chartConfigEvolucion} className="aspect-auto h-[280px] w-full">
            <AreaChart data={datosEvolucion}>
              <defs>
                <linearGradient id="fillVentas" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--color-ventas)" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="var(--color-ventas)" stopOpacity={0.1} />
                </linearGradient>
                <linearGradient id="fillGanancia" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--color-ganancia)" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="var(--color-ganancia)" stopOpacity={0.1} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="mes" tickLine={false} axisLine={false} tickMargin={8} />
              <ChartTooltip
                cursor={false}
                content={<ChartTooltipContent indicator="dot" formatter={(v) => formatoMoneda(v)} />}
              />
              <Area dataKey="ganancia" type="natural" fill="url(#fillGanancia)" stroke="var(--color-ganancia)" stackId="a" />
              <Area dataKey="ventas" type="natural" fill="url(#fillVentas)" stroke="var(--color-ventas)" stackId="a" />
              <ChartLegend content={<ChartLegendContent />} />
            </AreaChart>
          </ChartContainer>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Donut: distribución de unidades por producto top */}
        <Card className="flex flex-col">
          <CardHeader className="items-center pb-0">
            <CardTitle>Productos más vendidos</CardTitle>
            <CardDescription>Distribución por unidades, período seleccionado</CardDescription>
          </CardHeader>
          <CardContent className="flex-1 pb-0">
            <ChartContainer config={chartConfigTop} className="mx-auto aspect-square max-h-[260px]">
              <PieChart>
                <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel />} />
                <Pie data={datosTopDonut} dataKey="cantidad" nameKey="nombre" innerRadius={60} strokeWidth={5}>
                  <Label
                    content={({ viewBox }) => {
                      if (viewBox && 'cx' in viewBox && 'cy' in viewBox) {
                        return (
                          <text x={viewBox.cx} y={viewBox.cy} textAnchor="middle" dominantBaseline="middle">
                            <tspan x={viewBox.cx} y={viewBox.cy} className="fill-foreground text-3xl font-bold">
                              {totalUnidadesTop.toLocaleString()}
                            </tspan>
                            <tspan x={viewBox.cx} y={(viewBox.cy || 0) + 24} className="fill-muted-foreground">
                              unidades
                            </tspan>
                          </text>
                        );
                      }
                    }}
                  />
                </Pie>
              </PieChart>
            </ChartContainer>
          </CardContent>
          <CardFooter className="flex-col gap-2 text-sm">
            <div className="leading-none text-muted-foreground">
              Top {datosTopDonut.length} productos del {desde} al {hasta}
            </div>
          </CardFooter>
        </Card>

        {/* Bar horizontal: total vendido por producto top */}
        <Card>
          <CardHeader>
            <CardTitle>Ranking por facturación</CardTitle>
            <CardDescription>Total vendido por producto, período seleccionado</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfigBar}>
              <BarChart accessibilityLayer data={datosTopBar} layout="vertical" margin={{ right: 16 }}>
                <CartesianGrid horizontal={false} />
                <YAxis dataKey="nombre" type="category" tickLine={false} tickMargin={10} axisLine={false} hide />
                <XAxis dataKey="total" type="number" hide />
                <ChartTooltip
                  cursor={false}
                  content={<ChartTooltipContent indicator="line" formatter={(v) => formatoMoneda(v)} />}
                />
                <Bar dataKey="total" radius={4}>
                  {datosTopBar.map((d, i) => (
                    <Bar key={i} dataKey="total" fill={d.fill} />
                  ))}
                  <LabelList dataKey="nombre" position="insideLeft" offset={8} className="fill-(--color-label)" fontSize={12} />
                  <LabelList dataKey="total" position="right" offset={8} className="fill-foreground" formatter={(v) => formatoMoneda(v)} fontSize={12} />
                </Bar>
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      {cargando && <p className="text-sm text-muted-foreground">Actualizando datos…</p>}
    </div>
  );
}