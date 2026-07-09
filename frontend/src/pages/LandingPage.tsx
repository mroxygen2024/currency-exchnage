import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Activity,
  ArrowRight,
  ArrowRightLeft,
  CheckCircle2,
  ChevronDown,
  Coins,
  Globe,
  LayoutDashboard,
  Lock,
  LogOut,
  Menu,
  RefreshCw,
  ShieldCheck,
  Terminal,
  User,
  X,
} from 'lucide-react';

import { useAuth } from '../auth/AuthContext';
import { currencyApi } from '../api/endpoints/currency';

// Fallback rates if backend is down or loading
const FALLBACK_SYMBOLS: Record<string, string> = {
  USD: 'United States Dollar',
  EUR: 'Euro',
  GBP: 'British Pound',
  JPY: 'Japanese Yen',
  CAD: 'Canadian Dollar',
  AUD: 'Australian Dollar',
  CHF: 'Swiss Franc',
};

const FALLBACK_RATES: Record<string, number> = {
  USD: 1.0,
  EUR: 0.92,
  GBP: 0.78,
  JPY: 161.4,
  CAD: 1.36,
  AUD: 1.49,
  CHF: 0.89,
};

export function LandingPage() {
  const navigate = useNavigate();
  const { isAuthenticated, logout } = useAuth();

  // Scroll listener for sticky header
  const [isScrolled, setIsScrolled] = useState(false);
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Responsive Drawer Menu State
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Conversion Widget State
  const [symbols, setSymbols] = useState<Record<string, string>>(FALLBACK_SYMBOLS);
  const [supportedCurrencies, setSupportedCurrencies] = useState<string[]>(Object.keys(FALLBACK_SYMBOLS));
  const [amount, setAmount] = useState<number>(1000);
  const [fromCurrency, setFromCurrency] = useState<string>('USD');
  const [toCurrency, setToCurrency] = useState<string>('EUR');
  const [convertedAmount, setConvertedAmount] = useState<number | null>(null);
  const [exchangeRate, setExchangeRate] = useState<number | null>(null);
  const [isConverting, setIsConverting] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  // Live rates table state
  const [ratesTableData, setRatesTableData] = useState<Array<{
    pair: string;
    from: string;
    to: string;
    rate: number;
    trend: 'up' | 'down';
    change: string;
    sparkline: string;
  }>>([]);
  const [isLoadingRatesTable, setIsLoadingRatesTable] = useState(true);

  // FAQ Accordion State
  const [expandedFaqIndex, setExpandedFaqIndex] = useState<number | null>(null);

  const heroCalculatorRef = useRef<HTMLDivElement>(null);

  // Fetch supported symbols
  useEffect(() => {
    async function loadSymbols() {
      try {
        const fetchedSymbols = await currencyApi.getSymbols();
        if (fetchedSymbols && Object.keys(fetchedSymbols).length > 0) {
          setSymbols(fetchedSymbols);
        }
        const fetchedSupported = await currencyApi.getSupported();
        if (fetchedSupported && fetchedSupported.length > 0) {
          setSupportedCurrencies(fetchedSupported);
        }
      } catch (err) {
        console.warn('Failed to load supported currencies from API, using local fallbacks.', err);
      }
    }
    void loadSymbols();
  }, []);

  // Fetch active conversion
  const handleConvert = async (
    currentAmount: number,
    currentFrom: string,
    currentTo: string
  ) => {
    if (currentAmount <= 0) {
      setConvertedAmount(0);
      setExchangeRate(null);
      return;
    }

    setIsConverting(true);

    try {
      const response = await currencyApi.convert({
        from: currentFrom,
        to: currentTo,
        amount: currentAmount,
      });

      setConvertedAmount(response.result);
      setExchangeRate(response.rate);
      setLastUpdated(new Date().toLocaleTimeString());
    } catch (err) {
      console.warn('API conversion failed, utilizing client fallback.', err);
      // Fallback conversion logic
      const rateFrom = FALLBACK_RATES[currentFrom] ?? 1.0;
      const rateTo = FALLBACK_RATES[currentTo] ?? 1.0;
      // Convert to base (USD) then to target
      const usdAmount = currentAmount / rateFrom;
      const finalAmount = usdAmount * rateTo;
      const fallbackRate = rateTo / rateFrom;

      setConvertedAmount(Number(finalAmount.toFixed(4)));
      setExchangeRate(Number(fallbackRate.toFixed(6)));
      setLastUpdated(new Date().toLocaleTimeString() + ' (Local calculation)');
    } finally {
      setIsConverting(false);
    }
  };

  // Convert when params change
  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      void handleConvert(amount, fromCurrency, toCurrency);
    }, 200);

    return () => clearTimeout(delayDebounceFn);
  }, [amount, fromCurrency, toCurrency]);

  // Load major rates table mock / live data
  useEffect(() => {
    async function loadRatesTable() {
      setIsLoadingRatesTable(true);
      try {
        // Build table from major pairs
        const pairs = [
          { from: 'EUR', to: 'USD', trend: 'up' as const, change: '+0.24%', sparkline: 'M0 16 Q20 5, 40 18 T80 4' },
          { from: 'GBP', to: 'USD', trend: 'up' as const, change: '+0.12%', sparkline: 'M0 18 Q20 10, 40 8 T80 6' },
          { from: 'USD', to: 'JPY', trend: 'down' as const, change: '-0.45%', sparkline: 'M0 5 Q20 22, 40 10 T80 20' },
          { from: 'AUD', to: 'USD', trend: 'down' as const, change: '-0.08%', sparkline: 'M0 10 Q20 18, 40 12 T80 16' },
          { from: 'USD', to: 'CAD', trend: 'up' as const, change: '+0.05%', sparkline: 'M0 15 Q20 15, 40 10 T80 8' },
        ];

        const resolvedPairs = await Promise.all(
          pairs.map(async (p) => {
            try {
              // Try getting rate from API
              const rateData = await currencyApi.getRate(p.from, p.to);
              return {
                pair: `${p.from}/${p.to}`,
                from: p.from,
                to: p.to,
                rate: rateData.rate,
                trend: p.trend,
                change: p.change,
                sparkline: p.sparkline,
              };
            } catch {
              // Fallback calculations
              const rateFrom = FALLBACK_RATES[p.from] ?? 1.0;
              const rateTo = FALLBACK_RATES[p.to] ?? 1.0;
              const calcRate = rateTo / rateFrom;
              return {
                pair: `${p.from}/${p.to}`,
                from: p.from,
                to: p.to,
                rate: Number(calcRate.toFixed(5)),
                trend: p.trend,
                change: p.change,
                sparkline: p.sparkline,
              };
            }
          })
        );
        setRatesTableData(resolvedPairs);
      } catch (err) {
        console.error('Failed to populate rates table', err);
      } finally {
        setIsLoadingRatesTable(false);
      }
    }
    void loadRatesTable();
  }, []);

  const handleSwap = () => {
    const temp = fromCurrency;
    setFromCurrency(toCurrency);
    setToCurrency(temp);
  };

  const handleLogoutClick = async () => {
    await logout();
    navigate('/', { replace: true });
  };

  const scrollToCalculator = () => {
    if (heroCalculatorRef.current) {
      heroCalculatorRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      // Focus on amount input for accessibility
      const amountInput = heroCalculatorRef.current.querySelector('input');
      if (amountInput) {
        amountInput.focus();
      }
    }
  };

  const handleRatesConvertShortcut = (from: string, to: string) => {
    setFromCurrency(from);
    setToCurrency(to);
    scrollToCalculator();
  };

  const faqs = [
    {
      q: 'How secure is the bearer token authentication system?',
      a: 'Extremely secure. The application stores access tokens temporarily in memory and uses modern HTTP refresh token rotation. Requests securely append the authorization headers automatically to maintain type-safe validation checkpoints with the backend FastAPI architecture.',
    },
    {
      q: 'What is Refresh Token Rotation and how does it protect my session?',
      a: 'Whenever your short-lived access token expires, the application automatically requests a rotation from the backend using a secure, HTTP-only refresh token. This provides automated session survival and security rotation without logging you out, preventing session hijacking.',
    },
    {
      q: 'Are the exchange rates in the calculator real-time?',
      a: 'Yes. The platform communicates directly with our backend currency providers, caching live rates inside a Redis layer to guarantee low latency. In the event of network disruption, the client utilizes robust local calculations to ensure zero interface down-time.',
    },
    {
      q: 'Can guest accounts access all conversion features?',
      a: 'Guests can perform instant, real-time currency calculations. However, signing up unlocks exclusive professional features: authenticated conversion history logging, persistent profile customization, live web-sockets sync, and target alerts.',
    },
  ];

  return (
    <div className="animate-fade-in" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Skip Navigation Link for Accessibility */}
      <a href="#main-content" className="sr-only">
        Skip to main content
      </a>

      {/* Navigation Header */}
      <header className={`nav-header ${isScrolled ? 'nav-header--scrolled' : ''}`}>
        <div className="nav-container">
          <Link to="/" className="nav-logo" aria-label="AeroExchange Home">
            <ArrowRightLeft size={24} />
            <span>AeroExchange</span>
          </Link>

          {/* Desktop Navigation Links */}
          <nav className="nav-menu" aria-label="Desktop Navigation">
            <a href="#rates" className="nav-link">Rates</a>
            <a href="#features" className="nav-link">Features</a>
            <a href="#architecture" className="nav-link">Architecture</a>
            <a href="#faq" className="nav-link">FAQ</a>
          </nav>

          {/* Header Action Buttons */}
          <div className="nav-actions">
            {isAuthenticated ? (
              <>
                <Link to="/dashboard" className="primary-button nav-actions__dashboard btn-signup">
                  <LayoutDashboard size={16} />
                  Dashboard
                </Link>
                <button
                  type="button"
                  className="secondary-button btn-login"
                  onClick={handleLogoutClick}
                  aria-label="Log out"
                >
                  <LogOut size={16} />
                  Log out
                </button>
              </>
            ) : (
              <>
                <Link to="/auth/login" className="btn-login">
                  Sign In
                </Link>
                <Link to="/auth/register" className="primary-button btn-signup">
                  Get Started
                </Link>
              </>
            )}
          </div>

          {/* Mobile Hamburger Trigger */}
          <button
            type="button"
            className="hamburger-btn"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            aria-expanded={isMobileMenuOpen}
            aria-label="Toggle navigation menu"
          >
            {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </header>

      {/* Mobile Drawer Overlay */}
      <div
        className={`mobile-nav-drawer ${isMobileMenuOpen ? 'mobile-nav-drawer--open' : ''}`}
        aria-hidden={!isMobileMenuOpen}
      >
        <nav aria-label="Mobile Navigation" onClick={() => setIsMobileMenuOpen(false)}>
          <ul className="nav-menu">
            <li>
              <a href="#rates" className="nav-link">Rates</a>
            </li>
            <li>
              <a href="#features" className="nav-link">Features</a>
            </li>
            <li>
              <a href="#architecture" className="nav-link">Architecture</a>
            </li>
            <li>
              <a href="#faq" className="nav-link">FAQ</a>
            </li>
          </ul>
        </nav>

        <div className="nav-actions" onClick={() => setIsMobileMenuOpen(false)}>
          {isAuthenticated ? (
            <>
              <Link to="/dashboard" className="primary-button btn-signup">
                <LayoutDashboard size={18} />
                Go to Dashboard
              </Link>
              <button
                type="button"
                className="secondary-button btn-login"
                onClick={handleLogoutClick}
              >
                <LogOut size={18} />
                Log out
              </button>
            </>
          ) : (
            <>
              <Link to="/auth/login" className="btn-login">
                Sign In
              </Link>
              <Link to="/auth/register" className="primary-button btn-signup">
                Create Account
              </Link>
            </>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <main id="main-content" style={{ flexGrow: 1 }}>
        
        {/* HERO SECTION */}
        <section className="landing-shell">
          <div className="hero-grid">
            {/* Hero Left Content */}
            <div className="hero-content animate-slide-up">
              <div className="hero-badge">
                <Coins size={16} />
                <span>Next-Gen FX Architecture</span>
              </div>
              <h1>
                Institutional-Grade <span>Currency Exchange</span>
              </h1>
              <p>
                Experience ultra low-latency conversion built on FastAPI, Redis Cache,
                and high-security bearer authentication. Fully responsive, highly accessible.
              </p>
              
              <div className="hero-cta-group">
                <button
                  type="button"
                  onClick={scrollToCalculator}
                  className="primary-button"
                >
                  Convert Now
                  <ArrowRight size={16} />
                </button>
                <a href="#architecture" className="secondary-button">
                  Tech Stack
                </a>
              </div>

              {/* Stats Block */}
              <div className="hero-stats">
                <div className="stat-item">
                  <span className="stat-val">150+</span>
                  <span className="stat-lbl">Supported Pairs</span>
                </div>
                <div className="stat-item">
                  <span className="stat-val">&lt;50ms</span>
                  <span className="stat-lbl">Redis Cache Speed</span>
                </div>
                <div className="stat-item">
                  <span className="stat-val">100%</span>
                  <span className="stat-lbl">Token Security</span>
                </div>
              </div>
            </div>

            {/* Hero Right Calculator Widget */}
            <div ref={heroCalculatorRef} className="animate-slide-up" style={{ animationDelay: '0.15s' }}>
              <div className="converter-card">
                <h2 className="converter-card__title">Exchange Calculator</h2>
                <p className="converter-card__desc">Enter source amount and target currency pair</p>

                {/* Amount Field */}
                <div className="converter-row">
                  <label htmlFor="convert-amount">
                    <span>Send Amount</span>
                    {isConverting && <span className="eyebrow" style={{ fontSize: '0.7rem' }}>Syncing rates...</span>}
                  </label>
                  <div className="converter-input-wrapper">
                    <input
                      id="convert-amount"
                      type="number"
                      min="0.01"
                      step="any"
                      placeholder="0.00"
                      value={amount}
                      onChange={(e) => setAmount(Number(e.target.value))}
                      disabled={isConverting}
                    />
                    <select
                      aria-label="Source Currency"
                      value={fromCurrency}
                      onChange={(e) => setFromCurrency(e.target.value)}
                      disabled={isConverting}
                    >
                      {supportedCurrencies.map((code) => (
                        <option key={code} value={code}>
                          {code}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Swap Icon */}
                <div className="swap-btn-container">
                  <button
                    type="button"
                    className="swap-btn"
                    onClick={handleSwap}
                    disabled={isConverting}
                    aria-label="Swap Currencies"
                  >
                    <ArrowRightLeft size={16} />
                  </button>
                </div>

                {/* Target Result Field */}
                <div className="converter-row">
                  <label htmlFor="convert-result">
                    <span>Receive Amount</span>
                  </label>
                  <div className="converter-input-wrapper" style={{ background: 'rgba(255,255,255,0.6)' }}>
                    <input
                      id="convert-result"
                      type="text"
                      readOnly
                      placeholder="0.00"
                      value={convertedAmount !== null ? convertedAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 }) : ''}
                      aria-live="polite"
                    />
                    <select
                      aria-label="Target Currency"
                      value={toCurrency}
                      onChange={(e) => setToCurrency(e.target.value)}
                      disabled={isConverting}
                    >
                      {supportedCurrencies.map((code) => (
                        <option key={code} value={code}>
                          {code}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Rate details overlay */}
                {exchangeRate && (
                  <div className="rate-details animate-slide-down">
                    <div>
                      Rate: <strong>1 {fromCurrency} = {exchangeRate} {toCurrency}</strong>
                    </div>
                    {lastUpdated && (
                      <span style={{ fontSize: '0.75rem', opacity: 0.7 }}>
                        Last Updated: {lastUpdated}
                      </span>
                    )}
                  </div>
                )}

                {/* Action for guests */}
                {!isAuthenticated && (
                  <Link
                    to="/auth/register"
                    className="primary-button"
                    style={{ marginTop: '8px', textDecoration: 'none' }}
                  >
                    Save Conversion History
                  </Link>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* RATES TABLE SECTION */}
        <section id="rates" className="rates-section">
          <div className="section-header">
            <span className="eyebrow">Market Rates</span>
            <h2>Top Currency Pairs</h2>
            <p>Monitor top currencies with institutional precision and instant calculator sync.</p>
          </div>

          <div className="rates-table-container">
            {isLoadingRatesTable ? (
              <div style={{ padding: '40px', textAlign: 'center' }}>
                <div className="button-spinner" style={{ borderColor: 'rgba(11, 105, 116, 0.2)', borderTopColor: '#0b6974', width: '32px', height: '32px', marginBottom: '16px' }} />
                <p className="eyebrow">Fetching market rates...</p>
              </div>
            ) : (
              <table className="rates-table">
                <thead>
                  <tr>
                    <th>Currency Pair</th>
                    <th>Exchange Rate</th>
                    <th>24h Trend</th>
                    <th>Weekly Trend</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {ratesTableData.map((row) => (
                    <tr key={row.pair}>
                      <td>
                        <div className="currency-cell">
                          <span className="currency-flag-mock">{row.from}</span>
                          <span>{symbols[row.from] ?? row.from}</span>
                          <span style={{ color: 'var(--muted-foreground)', fontWeight: 400 }}>/</span>
                          <span className="currency-flag-mock" style={{ background: '#f0f3f5' }}>{row.to}</span>
                          <span style={{ color: 'var(--muted-foreground)', fontWeight: 400 }}>{row.to}</span>
                        </div>
                      </td>
                      <td style={{ fontWeight: 700, color: '#10354a' }}>
                        {row.rate.toFixed(5)}
                      </td>
                      <td>
                        <span className={`trend-badge ${row.trend === 'up' ? 'trend-badge--up' : 'trend-badge--down'}`}>
                          {row.trend === 'up' ? '▲' : '▼'} {row.change}
                        </span>
                      </td>
                      <td>
                        <svg className={`sparkline-svg ${row.trend === 'up' ? 'sparkline-svg--up' : 'sparkline-svg--down'}`} aria-hidden="true">
                          <path d={row.sparkline} />
                        </svg>
                      </td>
                      <td>
                        <button
                          type="button"
                          className="btn-convert-shortcut"
                          onClick={() => handleRatesConvertShortcut(row.from, row.to)}
                          aria-label={`Convert ${row.from} to ${row.to}`}
                        >
                          Select
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>

        {/* FEATURES BENTO GRID SECTION */}
        <section id="features" className="features-section">
          <div className="section-header">
            <span className="eyebrow">Platform Capabilities</span>
            <h2>Architected for Speed &amp; Security</h2>
            <p>Our platform handles token credentials, session rotation, and calculations dynamically.</p>
          </div>

          <div className="bento-grid">
            <article className="bento-card bento-card--col-2">
              <div className="bento-card__icon">
                <ShieldCheck size={22} />
              </div>
              <h3>Bearer Token Authentication Flow</h3>
              <p>
                API requests automatically attach short-lived JSON Web Tokens (JWT) inside authorization headers.
                Strict validation checks exist across all secure endpoints to protect user converter logs and history.
              </p>
            </article>

            <article className="bento-card">
              <div className="bento-card__icon">
                <RefreshCw size={22} />
              </div>
              <h3>Zero-Interruption Rotation</h3>
              <p>
                Session cookies rotate seamlessly. If an access key expires, the frontend client requests renewal
                and retries pending calls immediately in place.
              </p>
            </article>

            <article className="bento-card">
              <div className="bento-card__icon">
                <Lock size={22} />
              </div>
              <h3>Persistent Auth Sessions</h3>
              <p>
                Credentials securely persist across tabs and page reloads, using encrypted cookies and internal state management.
              </p>
            </article>

            <article className="bento-card bento-card--col-2">
              <div className="bento-card__icon">
                <Globe size={22} />
              </div>
              <h3>Low-Latency Redis Cache Layer</h3>
              <p>
                FastAPI endpoints queue active exchange rates in memory via Redis, lowering API latency to under 50ms and preventing rate limits.
              </p>
            </article>
          </div>
        </section>

        {/* SECURITY & ARCHITECTURE SHOWCASE */}
        <section id="architecture" className="architecture-section">
          <div className="section-header">
            <span className="eyebrow">System Topology</span>
            <h2>API Integration Infrastructure</h2>
            <p>Review the client-server data flow representing our token refresh and query execution system.</p>
          </div>

          <div className="arch-diagram-wrapper">
            <div className="arch-flow">
              <div className="arch-node">
                <User size={24} />
                <strong>Client React SPA</strong>
                <span>Axios interceptors</span>
              </div>
              
              <div className="arch-connector">
                <span className="arch-connector__label">Bearer JWT</span>
              </div>

              <div className="arch-node">
                <Terminal size={24} />
                <strong>FastAPI Gateway</strong>
                <span>CORS &amp; Zod Validation</span>
              </div>

              <div className="arch-connector">
                <span className="arch-connector__label">In-Memory Sync</span>
              </div>

              <div className="arch-node">
                <Activity size={24} />
                <strong>Redis Cache</strong>
                <span>Cached Rates &amp; Queues</span>
              </div>
            </div>

            <div className="arch-details-grid">
              <div className="arch-detail-item">
                <h4>
                  <CheckCircle2 size={16} />
                  Axios Interceptors
                </h4>
                <p>
                  Handles automated request enrichment with authorization credentials, and handles asynchronous queueing of failed API calls.
                </p>
              </div>
              <div className="arch-detail-item">
                <h4>
                  <CheckCircle2 size={16} />
                  FastAPI Architecture
                </h4>
                <p>
                  Built on high-concurrency Python ASGI principles. Performs runtime structural schema checking with pydantic schemas.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* FAQ ACCORDION SECTION */}
        <section id="faq" className="faq-section">
          <div className="section-header">
            <span className="eyebrow">Got Questions?</span>
            <h2>Frequently Asked Questions</h2>
            <p>Everything you need to know about security tokens, rate limits, and conversions.</p>
          </div>

          <div className="faq-list">
            {faqs.map((faq, idx) => {
              const isExpanded = expandedFaqIndex === idx;
              return (
                <article
                  key={idx}
                  className={`faq-item ${isExpanded ? 'faq-item--expanded' : ''}`}
                >
                  <button
                    type="button"
                    className="faq-trigger"
                    onClick={() => setExpandedFaqIndex(isExpanded ? null : idx)}
                    aria-expanded={isExpanded}
                    aria-controls={`faq-answer-${idx}`}
                  >
                    <span>{faq.q}</span>
                    <ChevronDown size={18} />
                  </button>
                  <div
                    id={`faq-answer-${idx}`}
                    className="faq-content"
                    aria-hidden={!isExpanded}
                  >
                    <div className="faq-content-inner">
                      <p>{faq.a}</p>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </section>

      </main>

      {/* FOOTER */}
      <footer className="footer">
        <div className="footer-container">
          <div className="footer-brand">
            <Link to="/" className="logo">
              <ArrowRightLeft size={24} />
              <span>AeroExchange</span>
            </Link>
            <p>
              Demo currency conversion system illustrating JWT authorization, Axios automatic token renewal, and FastAPI database bindings.
            </p>
          </div>

          <div className="footer-col">
            <h5>Product</h5>
            <ul className="footer-links">
              <li><a href="#rates">Live Rates</a></li>
              <li><a href="#features">Features</a></li>
              <li><a href="#architecture">Architecture</a></li>
            </ul>
          </div>

          <div className="footer-col">
            <h5>Resources</h5>
            <ul className="footer-links">
              <li><a href="#faq">FAQ</a></li>
              <li><Link to="/auth/login">Sign In</Link></li>
              <li><Link to="/auth/register">Sign Up</Link></li>
            </ul>
          </div>

          <div className="footer-col">
            <h5>Security</h5>
            <ul className="footer-links">
              <li><span style={{ fontSize: '0.9rem' }}>JWT Bearer Auth</span></li>
              <li><span style={{ fontSize: '0.9rem' }}>Refresh Rotation</span></li>
              <li><span style={{ fontSize: '0.9rem' }}>Rate Limit Protection</span></li>
            </ul>
          </div>
        </div>

        <div className="footer-bottom">
          <p>© {new Date().getFullYear()} AeroExchange. All rights reserved.</p>
          <div className="footer-bottom-links">
            <a href="#">Privacy Policy</a>
            <a href="#">Terms of Service</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
