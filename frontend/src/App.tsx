import { Navigate, Route, Routes } from 'react-router-dom';
import { Loader2 } from 'lucide-react';

import { useAuth } from './auth/AuthContext';
import { GuestRoute, ProtectedRoute } from './auth/ProtectedRoute';
import { ErrorBoundary } from './components/ui/ErrorBoundary';
import { LandingPage } from './pages/LandingPage';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { DashboardLayout } from './components/dashboard/DashboardLayout';
import { DashboardOverview } from './pages/dashboard/DashboardOverview';
import { DashboardHistory } from './pages/dashboard/DashboardHistory';
import { DashboardFavorites } from './pages/dashboard/DashboardFavorites';
import { DashboardSettings } from './pages/dashboard/DashboardSettings';
import { DashboardAnalytics } from './pages/dashboard/DashboardAnalytics';
import './App.css';

function AppLoading() {
  return (
    <main className="shell shell--centered">
      <section className="status-card">
        <div className="status-card__spinner" role="status" aria-label="Loading">
          <Loader2 size={32} className="animate-spin text-teal-600" />
        </div>
        <p className="eyebrow">Loading</p>
        <h1>Preparing your experience</h1>
        <p>Setting up your secure session and loading market data.</p>
      </section>
    </main>
  );
}

export default function App() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <AppLoading />;
  }

  return (
    <ErrorBoundary>
      <Routes>
        <Route element={<GuestRoute />}>
          <Route path="/auth/login" element={<LoginPage />} />
          <Route path="/auth/register" element={<RegisterPage />} />
        </Route>

        <Route element={<ProtectedRoute />}>
          <Route path="/dashboard" element={<DashboardLayout />}>
            <Route
              index
              element={
                <ErrorBoundary>
                  <DashboardOverview />
                </ErrorBoundary>
              }
            />
            <Route
              path="history"
              element={
                <ErrorBoundary>
                  <DashboardHistory />
                </ErrorBoundary>
              }
            />
            <Route
              path="favorites"
              element={
                <ErrorBoundary>
                  <DashboardFavorites />
                </ErrorBoundary>
              }
            />
            <Route
              path="settings"
              element={
                <ErrorBoundary>
                  <DashboardSettings />
                </ErrorBoundary>
              }
            />
            <Route
              path="analytics"
              element={
                <ErrorBoundary>
                  <DashboardAnalytics />
                </ErrorBoundary>
              }
            />
          </Route>
        </Route>

        <Route path="/" element={<LandingPage />} />

        <Route path="*" element={<Navigate to={isAuthenticated ? '/dashboard' : '/'} replace />} />
      </Routes>
    </ErrorBoundary>
  );
}
