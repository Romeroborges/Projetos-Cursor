import React from 'react';
import { Navigate, NavLink, Route, Routes, useLocation } from 'react-router-dom';
import { clearSession, getToken, getSessionUser } from './lib/auth';
import { Button } from './components/UI';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import TablesPage from './pages/TablesPage';
import OrdersPage from './pages/OrdersPage';
import OrderDetailsPage from './pages/OrderDetailsPage';
import ProductsPage from './pages/ProductsPage';
import CashPage from './pages/CashPage';
import ReportsPage from './pages/ReportsPage';

function RequireAuth(props: { children: React.ReactNode }) {
  const token = getToken();
  const loc = useLocation();
  if (!token) return <Navigate to="/login" replace state={{ from: loc.pathname }} />;
  return <>{props.children}</>;
}

function Shell(props: { children: React.ReactNode }) {
  const user = getSessionUser();
  return (
    <div className="container">
      <div className="shell">
        <div className="card nav">
          <div className="cardHeader">
            <div>
              <div className="h1">Bar Clube</div>
              <div className="h2">{user ? `${user.nome} • ${user.papel}` : '—'}</div>
            </div>
          </div>
          <div className="cardBody">
            <div style={{ display: 'grid', gap: 6 }}>
              <NavLink to="/dashboard" className={({ isActive }) => (isActive ? 'active' : '')}>Dashboard</NavLink>
              <NavLink to="/mesas" className={({ isActive }) => (isActive ? 'active' : '')}>Mesas</NavLink>
              <NavLink to="/comandas" className={({ isActive }) => (isActive ? 'active' : '')}>Comandas</NavLink>
              <NavLink to="/produtos" className={({ isActive }) => (isActive ? 'active' : '')}>Produtos</NavLink>
              <NavLink to="/caixa" className={({ isActive }) => (isActive ? 'active' : '')}>Caixa</NavLink>
              <NavLink to="/relatorios" className={({ isActive }) => (isActive ? 'active' : '')}>Relatórios</NavLink>
            </div>
            <div style={{ height: 12 }} />
            <Button
              variant="danger"
              onClick={() => {
                clearSession();
                window.location.href = '/login';
              }}
            >
              Sair
            </Button>
          </div>
        </div>
        <div style={{ display: 'grid', gap: 16 }}>{props.children}</div>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/*"
        element={
          <RequireAuth>
            <Shell>
              <Routes>
                <Route path="/" element={<Navigate to="/dashboard" replace />} />
                <Route path="/dashboard" element={<DashboardPage />} />
                <Route path="/mesas" element={<TablesPage />} />
                <Route path="/comandas" element={<OrdersPage />} />
                <Route path="/comandas/:id" element={<OrderDetailsPage />} />
                <Route path="/produtos" element={<ProductsPage />} />
                <Route path="/caixa" element={<CashPage />} />
                <Route path="/relatorios" element={<ReportsPage />} />
                <Route path="*" element={<Navigate to="/dashboard" replace />} />
              </Routes>
            </Shell>
          </RequireAuth>
        }
      />
    </Routes>
  );
}
