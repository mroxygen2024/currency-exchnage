import { ShieldCheck, TrendingUp, Globe, CheckCircle2 } from 'lucide-react';

export function FeaturesSection() {
  return (
    <section id="features" className="features-section">
      <div className="section-header">
        <span className="eyebrow">Platform Capabilities</span>
        <h2>Built for Speed &amp; Security</h2>
        <p>Professional-grade currency conversion with real-time data and secure authentication.</p>
      </div>

      <div className="bento-grid">
        <article className="bento-card bento-card--col-2">
          <div className="bento-card__icon">
            <ShieldCheck size={22} />
          </div>
          <h3>Secure Authentication</h3>
          <p>
            Your account is protected with secure, encrypted authentication. Sessions persist safely across visits while keeping your data fully protected.
          </p>
        </article>

        <article className="bento-card">
          <div className="bento-card__icon">
            <TrendingUp size={22} />
          </div>
          <h3>Live Market Data</h3>
          <p>
            Access real-time exchange rates updated continuously from global currency markets with sub-second latency.
          </p>
        </article>

        <article className="bento-card">
          <div className="bento-card__icon">
            <Globe size={22} />
          </div>
          <h3>150+ Currencies</h3>
          <p>
            Convert between major, minor, and exotic currencies from over 150 countries worldwide.
          </p>
        </article>

        <article className="bento-card bento-card--col-2">
          <div className="bento-card__icon">
            <CheckCircle2 size={22} />
          </div>
          <h3>Conversion History &amp; Analytics</h3>
          <p>
            Every conversion is logged with full details. Track your activity, analyze trends, and export your history as CSV anytime.
          </p>
        </article>
      </div>
    </section>
  );
}
