import { Navigate, Outlet, useLocation } from 'react-router-dom';

import { useAuth } from './AuthContext';

export function ProtectedRoute() {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <main className="shell shell--centered">
        <section className="status-card">
          <p className="eyebrow">Session</p>
          <h1>Restoring secure access</h1>
          <p>Checking your bearer token and rotating refresh credentials if needed.</p>
        </section>
      </main>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/auth/login" replace state={{ from: location }} />;
  }

  return <Outlet />;
}

export function GuestRoute() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <main className="shell shell--centered">
        <section className="status-card">
          <p className="eyebrow">Session</p>
          <h1>Checking your session</h1>
          <p>Making sure your account state is current before loading the form.</p>
        </section>
      </main>
    );
  }

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}