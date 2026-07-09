import { Navigate, Route, Routes } from 'react-router-dom';

import { useAuth } from './auth/AuthContext';
import { GuestRoute, ProtectedRoute } from './auth/ProtectedRoute';
import { LandingPage } from './pages/LandingPage';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { SessionPage } from './pages/SessionPage';
import './App.css';

export default function App() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <main className="shell shell--centered">
        <section className="status-card">
          <p className="eyebrow">Loading</p>
          <h1>Preparing the application</h1>
          <p>Initializing bearer auth, restoring the session, and loading protected routes.</p>
        </section>
      </main>
    );
  }

  return (
    <Routes>
      <Route element={<GuestRoute />}>
        <Route path="/auth/login" element={<LoginPage />} />
        <Route path="/auth/register" element={<RegisterPage />} />
      </Route>

      <Route element={<ProtectedRoute />}>
        <Route path="/dashboard" element={<SessionPage />} />
      </Route>

      <Route path="/" element={<LandingPage />} />

      <Route path="*" element={<Navigate to={isAuthenticated ? '/dashboard' : '/'} replace />} />
    </Routes>
  );
}

