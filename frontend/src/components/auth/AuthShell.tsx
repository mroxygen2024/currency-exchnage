import { ArrowRightLeft, LockKeyhole, RefreshCw, ShieldCheck } from 'lucide-react';
import type { ReactNode } from 'react';

type AuthShellProps = {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
  footer?: ReactNode;
};

export function AuthShell({ eyebrow, title, description, children, footer }: AuthShellProps) {
  return (
    <main className="shell auth-shell">
      <section className="auth-hero">
        <div className="auth-hero__badge">
          <ArrowRightLeft size={16} />
          Currency Exchange
        </div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p className="auth-hero__copy">{description}</p>

        <div className="auth-feature-list">
          <article>
            <ShieldCheck size={18} />
            <div>
              <h2>Bearer authentication</h2>
              <p>Requests attach your access token automatically.</p>
            </div>
          </article>
          <article>
            <RefreshCw size={18} />
            <div>
              <h2>Refresh rotation</h2>
              <p>Expired sessions rotate once and retry in place.</p>
            </div>
          </article>
          <article>
            <LockKeyhole size={18} />
            <div>
              <h2>Persistent session</h2>
              <p>Credentials survive reloads until you log out.</p>
            </div>
          </article>
        </div>
      </section>

      <section className="auth-card">
        {children}
        {footer ? <div className="auth-card__footer">{footer}</div> : null}
      </section>
    </main>
  );
}