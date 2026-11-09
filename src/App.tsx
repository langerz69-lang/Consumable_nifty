import React from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider, useAuth } from './components/AuthContext';
import { Layout } from './components/Layout';
import Login from './pages/Login';
import Inventory from './pages/logistics/Inventory';
import LogisticsOrders from './pages/logistics/Orders';
import OrderHistory from './pages/logistics/OrderHistory';
import Settings from './pages/logistics/Settings';
import AreaCatalogs from './pages/logistics/AreaCatalogs';
import GoodsIn from './pages/logistics/GoodsIn';
import Analytics from './pages/logistics/Analytics';
import StockTake from './pages/logistics/StockTake';
import Catalog from './pages/production/Catalog';
import MyOrders from './pages/production/MyOrders';
import SelectArea from './pages/production/SelectArea';

import { Role } from './types';

function RoleBasedRoute({ 
  allowedRoles, 
  children 
}: { 
  allowedRoles: Role[], 
  children: React.ReactNode 
}) {
  const { profile, loading } = useAuth();
  
  if (loading) return null;
  if (!profile) return null;
  if (!allowedRoles.includes(profile.role)) {
    return <div className="p-8 font-medium text-slate-700">Access Denied. Your role is {profile.role}.</div>;
  }
  
  return <>{children}</>;
}

function RoleRouter() {
  const { profile, loading } = useAuth();
  
  if (loading) return <div className="flex h-screen items-center justify-center">Loading...</div>;
  if (!profile) return null;
  
  if (profile.role === 'LOGISTICS' || profile.role === 'PRODUCTION_ENGINEERING') {
    return <Inventory />;
  } else {
    return <Catalog />;
  }
}

function MainApp() {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-900 text-white">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
          <p className="text-slate-400 text-sm font-medium">Authenticating workspace...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Login />;
  }

  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<RoleRouter />} />
        
        {/* Logistics & Production Engineering Routes */}
        <Route path="goods-in" element={
          <RoleBasedRoute allowedRoles={['LOGISTICS']}>
            <GoodsIn />
          </RoleBasedRoute>
        } />
        <Route path="area-forms" element={
          <RoleBasedRoute allowedRoles={['LOGISTICS', 'PRODUCTION_ENGINEERING']}>
            <AreaCatalogs />
          </RoleBasedRoute>
        } />
        <Route path="orders" element={
          <RoleBasedRoute allowedRoles={['LOGISTICS']}>
            <LogisticsOrders />
          </RoleBasedRoute>
        } />
        <Route path="history" element={
          <RoleBasedRoute allowedRoles={['LOGISTICS']}>
            <OrderHistory />
          </RoleBasedRoute>
        } />
        <Route path="analytics" element={
          <RoleBasedRoute allowedRoles={['LOGISTICS', 'PRODUCTION_ENGINEERING']}>
            <Analytics />
          </RoleBasedRoute>
        } />
        <Route path="stock-take" element={
          <RoleBasedRoute allowedRoles={['LOGISTICS']}>
            <StockTake />
          </RoleBasedRoute>
        } />
        <Route path="settings" element={
          <RoleBasedRoute allowedRoles={['LOGISTICS']}>
            <Settings />
          </RoleBasedRoute>
        } />
        
        {/* Production & Cross-Role Routes */}
        <Route path="catalogue" element={
          <RoleBasedRoute allowedRoles={['PRODUCTION', 'LOGISTICS', 'PRODUCTION_ENGINEERING']}>
            <Catalog />
          </RoleBasedRoute>
        } />
        <Route path="select-area" element={
          <RoleBasedRoute allowedRoles={['PRODUCTION', 'LOGISTICS', 'PRODUCTION_ENGINEERING']}>
            <SelectArea />
          </RoleBasedRoute>
        } />
        <Route path="my-orders" element={
          <RoleBasedRoute allowedRoles={['PRODUCTION', 'LOGISTICS', 'PRODUCTION_ENGINEERING']}>
            <MyOrders />
          </RoleBasedRoute>
        } />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <HashRouter>
        <MainApp />
      </HashRouter>
    </AuthProvider>
  );
}
