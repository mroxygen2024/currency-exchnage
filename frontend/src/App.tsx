import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { Loader2 } from 'lucide-react';

import { useAuth } from './auth/AuthContext';
import { GuestRoute, ProtectedRoute } from './auth/ProtectedRoute';
import { ErrorBoundary } from './components/ui/ErrorBoundary';
import { DashboardLayout } from './components/dashboard/DashboardLayout';
import './App.css';

const LandingPage = lazy(() =>
  import('./pages/LandingPage').then((m) => ({ default: m.LandingPage }))
);
const LoginPage = lazy(() =>
  import('./pages/LoginPage').then((m) => ({ default: m.LoginPage }))
);
const RegisterPage = lazy(() =>
  import('./pages/RegisterPage').then((m) => ({ default: m.RegisterPage }))
);
const DashboardOverview = lazy(() =>
  import('./pages/dashboard/DashboardOverview').then((m) => ({ default: m.DashboardOverview }))
);
const DashboardHistory = lazy(() =>
  import('./pages/dashboard/DashboardHistory').then((m) => ({ default: m.DashboardHistory }))
);
const DashboardFavorites = lazy(() =>
  import('./pages/dashboard/DashboardFavorites').then((m) => ({ default: m.DashboardFavorites }))
);
const DashboardSettings = lazy(() =>
  import('./pages/dashboard/DashboardSettings').then((m) => ({ default: m.DashboardSettings }))
);
const DashboardAnalytics = lazy(() =>
  import('./pages/dashboard/DashboardAnalytics').then((m) => ({ default: m.DashboardAnalytics }))
);

function PageLoader() {
  return (
    <div className="page-loader" role="status" aria-label="Loading page">
      <Loader2 size={28} className="animate-spin text-teal-600" />
    </div>
  );
}

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
      <Suspense fallback={<PageLoader />}>
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
      </Suspense>
    </ErrorBoundary>
  );
}
