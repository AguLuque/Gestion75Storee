import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, Package, ShoppingCart, TrendingUp,
  Tag, Truck, DollarSign, Users, X, LogOut, BarChart3
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { cn } from '../lib/utils.js';

const items = [
  { a: '/', icono: LayoutDashboard, etiqueta: 'Principal' },
  { a: '/productos', icono: Package, etiqueta: 'Productos' },
  { a: '/ventas', icono: TrendingUp, etiqueta: 'Ventas' },
  { a: '/compras', icono: ShoppingCart, etiqueta: 'Compras' },
  { a: '/gastos', icono: DollarSign, etiqueta: 'Gastos' },
  { a: '/categorias', icono: Tag, etiqueta: 'Categorías' },
  { a: '/proveedores', icono: Truck, etiqueta: 'Proveedores' },
  { a: '/deudores', icono: Users, etiqueta: 'Deudores' },
  { a: '/estadisticas', icono: BarChart3, etiqueta: 'Estadísticas' },
];

export default function Sidebar({ cerrar, cerrarMenu }) {
  const { cerrarSesion } = useAuth();

  return (
    <aside className="w-56 bg-card border-r border-border h-full flex flex-col">
      <div className="flex items-center justify-between px-5 py-5 border-b border-border">
        <div className="flex items-center justify-center p-0">
          <img src="/Logo.png" alt="FluxoGest" className="h-30 w-auto object-contain" />
        </div>
        {cerrar && (
          <button onClick={cerrar} className="text-muted-foreground hover:text-foreground lg:hidden">
            <X size={18} />
          </button>
        )}
      </div>

      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {items.map(({ a, icono: Icono, etiqueta }) => (
          <NavLink
            key={a}
            to={a}
            end={a === '/'}
            onClick={cerrarMenu}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all',
                isActive
                  ? 'bg-accent text-accent-foreground'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
              )
            }
          >
            <Icono size={16} />
            {etiqueta}
          </NavLink>
        ))}
      </nav>

      <div className="px-3 py-4 border-t border-border">
        <button
          onClick={cerrarSesion}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-all w-full"
        >
          <LogOut size={16} />
          Cerrar sesión
        </button>
      </div>
    </aside>
  );
}