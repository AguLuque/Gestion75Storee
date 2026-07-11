import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Menu } from 'lucide-react';
import Sidebar from './Sidebar';
import FiltroPeriodoGlobal from './FiltroPeriodoGlobal.jsx';

export default function Layout() {
  const [menuAbierto, setMenuAbierto] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <div className="hidden lg:block flex-shrink-0">
        <div className="h-full">
          <Sidebar />
        </div>
      </div>

      {menuAbierto && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMenuAbierto(false)} />
          <div className="absolute left-0 top-0 h-full z-50">
            <Sidebar cerrar={() => setMenuAbierto(false)} cerrarMenu={() => setMenuAbierto(false)} />
          </div>
        </div>
      )}

      <main className="flex-1 overflow-y-auto">
        <div className="bg-card border-b border-border sticky top-0 z-30">
          <div className="flex items-center justify-between px-4 lg:px-6 py-3">
            <div className="flex items-center gap-2">
              <button onClick={() => setMenuAbierto(true)} className="text-muted-foreground lg:hidden">
                <Menu size={20} />
              </button>
              <span className="font-semibold text-foreground lg:hidden">FluxoGest</span>
            </div>
            <div className="hidden lg:block">
              <FiltroPeriodoGlobal />
            </div>
          </div>
          <div className="lg:hidden px-4 pb-3 overflow-x-auto">
            <FiltroPeriodoGlobal />
          </div>
        </div>

        <div className="p-4 lg:p-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}