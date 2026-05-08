import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Menu } from 'lucide-react';
import Sidebar from './Sidebar';

export default function Layout() {
  const [menuAbierto, setMenuAbierto] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      {/* Sidebar desktop */}
      <div className="hidden lg:block flex-shrink-0">
        <div className="h-full">
          <Sidebar />
        </div>
      </div>

      {/* Sidebar mobile overlay */}
      {menuAbierto && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMenuAbierto(false)} />
          <div className="absolute left-0 top-0 h-full z-50">
            <Sidebar cerrar={() => setMenuAbierto(false)} cerrarMenu={() => setMenuAbierto(false)} />
          </div>
        </div>
      )}

      {/* Contenido principal */}
      <main className="flex-1 overflow-y-auto">
        {/* Header mobile */}
        <div className="lg:hidden flex items-center gap-3 px-4 py-3 bg-white border-b border-slate-200 sticky top-0 z-30">
          <button onClick={() => setMenuAbierto(true)} className="text-slate-600">
            <Menu size={20} />
          </button>
          <span className="font-semibold text-slate-800">75Storee</span>
        </div>

        <div className="p-4 lg:p-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
