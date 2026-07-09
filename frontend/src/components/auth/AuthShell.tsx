import { Link } from 'react-router-dom';
import { ArrowRightLeft, TrendingUp, ShieldCheck, Globe } from 'lucide-react';
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
        <Link to="/" className="auth-hero__badge" style={{ textDecoration: 'none' }} aria-label="AeroExchange Home">
          <ArrowRightLeft size={16} />
          AeroExchange
        </Link>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p className="auth-hero__copy">{description}</p>

        <div className="auth-feature-list">
          <article>
            <ShieldCheck size={18} />
            <div>
              <h2>Bank-level security</h2>
              <p>Your data is protected with enterprise-grade encryption.</p>
            </div>
          </article>
          <article>
            <TrendingUp size={18} />
            <div>
              <h2>Real-time rates</h2>
              <p>Access live exchange rates from global currency markets.</p>
            </div>
          </article>
          <article>
            <Globe size={18} />
            <div>
              <h2>Global coverage</h2>
              <p>Convert between 150+ currencies worldwide.</p>
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
