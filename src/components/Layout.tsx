import React from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { Package, ShoppingCart, LayoutDashboard, FileText, Settings, MapPin, ArrowDownToLine, ClipboardCheck, LogOut, User } from 'lucide-react';
import { useAuth } from './AuthContext';
import { DynamicIcon } from './EditAreaModal';

export function Layout() {
  const { profile, loading, logout, availableAreas } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900"></div>
          <p className="text-slate-500 text-sm font-medium">Loading system components...</p>
        </div>
      </div>
    );
  }

  // Active user profile (with safety fallback if still loading initial record)
  const currentProfile = profile || {
    id: 'default',
    name: 'Logistics User',
    email: 'admin@logistics.co',
    role: 'LOGISTICS' as const,
    areaId: null
  };

  const isLogistics = currentProfile.role === 'LOGISTICS';
  const isProdEng = currentProfile.role === 'PRODUCTION_ENGINEERING';

  const logisticsLinks = [
    { to: '/', label: 'Master Inventory', icon: Package },
    { to: '/goods-in', label: 'Goods In', icon: ArrowDownToLine },
    { to: '/stock-take', label: 'Stock Take', icon: ClipboardCheck },
    { to: '/area-forms', label: 'Area Forms', icon: FileText },
    { to: '/orders', label: 'Fulfillment', icon: FileText },
    { to: '/history', label: 'Order History', icon: FileText },
    { to: '/analytics', label: 'Analytics', icon: LayoutDashboard },
    { to: '/catalogue', label: 'Area Catalogue', icon: ShoppingCart },
    { to: '/select-area', label: 'Select Area', icon: MapPin },
    { to: '/my-orders', label: 'Area Orders', icon: FileText },
    { to: '/settings', label: 'Settings', icon: Settings },
  ];

  const engineeringLinks = [
    { to: '/', label: 'Inventory', icon: Package },
    { to: '/area-forms', label: 'Area Forms', icon: FileText },
    { to: '/analytics', label: 'Analytics', icon: LayoutDashboard },
    { to: '/catalogue', label: 'Area Catalogue', icon: ShoppingCart },
    { to: '/select-area', label: 'Select Area', icon: MapPin },
  ];

  const productionLinks = [
    { to: '/', label: 'Catalogue', icon: LayoutDashboard },
    { to: '/select-area', label: 'Select Area', icon: MapPin },
    { to: '/my-orders', label: 'My Orders', icon: ShoppingCart },
  ];

  const links = isLogistics ? logisticsLinks : isProdEng ? engineeringLinks : productionLinks;
  const activeArea = availableAreas.find(a => a.id === currentProfile.areaId);

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-900 text-white flex flex-col print:hidden">
        <div className="p-6">
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Package className="h-6 w-6" />
            Consumables
          </h1>
          <p className="text-xs text-slate-400 mt-1 uppercase tracking-wider font-semibold">
            {currentProfile.role.replace('_', ' ')} WORKSPACE
          </p>
        </div>
        
        <nav className="flex-1 px-4 space-y-1.5 overflow-y-auto">
          {/* Active Area Card */}
          <div className="mb-4 px-3 py-2 rounded-lg bg-slate-800 border border-slate-700/40">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Active Area Context</span>
              {activeArea && (
                <span className={`h-2 w-2 rounded-full ${
                  activeArea.color === 'red' ? 'bg-red-500' :
                  activeArea.color === 'green' ? 'bg-green-500' :
                  activeArea.color === 'amber' ? 'bg-amber-500' :
                  activeArea.color === 'purple' ? 'bg-purple-500' :
                  activeArea.color === 'slate' ? 'bg-slate-400' : 'bg-blue-500'
                }`}></span>
              )}
            </div>
            {activeArea ? (
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="p-1 rounded bg-slate-700/60 text-slate-300 flex-shrink-0">
                    <DynamicIcon name={activeArea.icon || 'Wrench'} className="h-3.5 w-3.5" />
                  </div>
                  <p className="text-xs font-bold text-white truncate">{activeArea.name}</p>
                </div>
                <Link 
                  to="/select-area"
                  className="block w-full text-center py-1 rounded bg-slate-750 hover:bg-slate-700 text-[10px] font-bold text-slate-200 hover:text-white border border-slate-700/60 transition-all shadow-sm"
                >
                  Switch Area
                </Link>
              </div>
            ) : (
              <Link 
                to="/select-area"
                className="block w-full text-center py-1.5 rounded bg-blue-600 hover:bg-blue-500 text-xs font-bold text-white transition-all shadow-sm"
              >
                Select Area
              </Link>
            )}
          </div>

          {links.map((link) => {
            const Icon = link.icon;
            const isActive = location.pathname === link.to;
            return (
              <Link
                key={link.to}
                to={link.to}
                className={`flex items-center gap-3 px-3 py-2 rounded-md transition-colors ${
                  isActive 
                    ? 'bg-slate-800 text-white' 
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <Icon className="h-5 w-5" />
                {link.label}
              </Link>
            );
          })}
        </nav>

        {/* User Account & Logout Panel */}
        <div className="p-4 border-t border-slate-800 space-y-3">
          <div className="px-1 text-xs">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
              Active User
            </span>
            <div className="flex items-center gap-2.5 bg-slate-800/80 p-2.5 rounded-lg border border-slate-700/60">
              <div className="h-8 w-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-xs flex-shrink-0">
                {currentProfile.name ? currentProfile.name.charAt(0).toUpperCase() : 'U'}
              </div>
              <div className="min-w-0 flex-1">
                <span className="font-bold text-white text-xs block truncate">{currentProfile.name}</span>
                <span className="text-[11px] text-slate-400 block truncate font-mono">{currentProfile.email}</span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={logout}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-slate-800 hover:bg-red-950/40 text-slate-300 hover:text-red-400 border border-slate-700/60 hover:border-red-900/50 text-xs font-semibold transition-all shadow-sm"
          >
            <LogOut className="h-4 w-4" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto print:overflow-visible">
        <div className="p-8 max-w-7xl mx-auto print:p-0 print:m-0 print:max-w-none">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

