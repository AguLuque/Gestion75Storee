import { NavLink } from 'react-router-dom';
import { 
  LayoutDashboard, Package, ShoppingCart, TrendingUp, 
  Tag, Truck, DollarSign, X
} from 'lucide-react';
import { cn } from '../utils.js';

const items = [
  { a: '/', icono: LayoutDashboard, etiqueta: 'Dashboard' },
  { a: '/productos', icono: Package, etiqueta: 'Productos' },
  { a: '/ventas', icono: TrendingUp, etiqueta: 'Ventas' },
  { a: '/compras', icono: ShoppingCart, etiqueta: 'Compras' },
  { a: '/gastos', icono: DollarSign, etiqueta: 'Gastos' },
  { a: '/categorias', icono: Tag, etiqueta: 'Categorías' },
  { a: '/proveedores', icono: Truck, etiqueta: 'Proveedores' },
];

export default function Sidebar({ cerrar, cerrarMenu }) {
  return (
    <aside className="w-56 bg-white border-r border-slate-200 h-full flex flex-col">
      {/* Logo */}
      <div className="flex items-center justify-between px-5 py-5 border-b border-slate-100">
        <div>
          <span className="font-bold text-slate-800 text-lg">75Store</span>
          <p className="text-xs text-slate-400 mt-0.5">Gestión</p>
        </div>
        {cerrar && (
          <button onClick={cerrar} className="text-slate-400 hover:text-slate-600 lg:hidden">
            <X size={18} />
          </button>
        )}
      </div>

      {/* Navegación */}
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
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-800'
              )
            }
          >
            <Icono size={16} />
            {etiqueta}
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div className="px-5 py-4 border-t border-slate-100">
        <p className="text-xs text-slate-400">v1.0.0</p>
      </div>
    </aside>
  );
}
