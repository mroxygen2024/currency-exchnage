import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuth } from './AuthContext';

function RouteLoading({ label }: { label: string }) {
  return (
    <main className="shell shell--centered">
      <section className="status-card">
        <div className="status-card__spinner" role="status" aria-label="Loading">
          <Loader2 size={32} className="animate-spin text-teal-600" />
        </div>
        <p className="eyebrow">Session</p>
        <h1>{label}</h1>
        <p>Verifying your session and restoring secure access.</p>
      </section>
    </main>
  );
}

export function ProtectedRoute() {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return <RouteLoading label="Restoring secure access" />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/auth/login" replace state={{ from: location }} />;
  }

  return <Outlet />;
}

export function GuestRoute() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <RouteLoading label="Checking your session" />;
  }

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
}
