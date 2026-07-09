import { LogOut, ShieldCheck, UserRound } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { useAuth } from '../auth/AuthContext';

export function SessionPage() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const handleLogout = async () => {
    await logout();
    navigate('/auth/login', { replace: true });
  };

  return (
    <main className="shell session-shell">
      <section className="session-card">
        <div className="session-card__header">
          <div>
            <p className="eyebrow">Active session</p>
            <h1>Welcome back</h1>
            <p>
              You are signed in and your session is secure.
            </p>
          </div>

          <button type="button" className="secondary-button" onClick={handleLogout}>
            <LogOut size={16} />
            Log out
          </button>
        </div>

        <div className="session-grid">
          <article className="session-tile">
            <UserRound size={18} />
            <div>
              <span>Account</span>
              <strong>{user?.email}</strong>
            </div>
          </article>
          <article className="session-tile">
            <ShieldCheck size={18} />
            <div>
              <span>Role</span>
              <strong>{user?.role}</strong>
            </div>
          </article>
        </div>

        <div className="session-notice">
          Visit your dashboard to access conversions, analytics, and account settings.
        </div>
      </section>
    </main>
  );
}
