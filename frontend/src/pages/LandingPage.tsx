import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  ArrowRightLeft,
  CheckCircle2,
  ChevronDown,
  Coins,
  Globe,
  LayoutDashboard,
  LogOut,
  Menu,
  ShieldCheck,
  TrendingUp,
  X,
} from 'lucide-react';

import { useAuth } from '../auth/AuthContext';
import { currencyApi } from '../api/endpoints/currency';

export function LandingPage() {
  const navigate = useNavigate();
  const { isAuthenticated, logout } = useAuth();

  const [isScrolled, setIsScrolled] = useState(false);
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const [symbols, setSymbols] = useState<Record<string, string>>({});
  const [supportedCurrencies, setSupportedCurrencies] = useState<string[]>([]);
  const [amount, setAmount] = useState<number>(1000);
  const [fromCurrency, setFromCurrency] = useState<string>('USD');
  const [toCurrency, setToCurrency] = useState<string>('EUR');
  const [convertedAmount, setConvertedAmount] = useState<number | null>(null);
  const [exchangeRate, setExchangeRate] = useState<number | null>(null);
  const [isConverting, setIsConverting] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

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

  const [expandedFaqIndex, setExpandedFaqIndex] = useState<number | null>(null);

  const heroCalculatorRef = useRef<HTMLDivElement>(null);

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
      } catch {
        // Keep empty state
      }
    }
    void loadSymbols();
  }, []);

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
    } catch {
      setConvertedAmount(null);
      setExchangeRate(null);
    } finally {
      setIsConverting(false);
    }
  };

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      void handleConvert(amount, fromCurrency, toCurrency);
    }, 200);

    return () => clearTimeout(delayDebounceFn);
  }, [amount, fromCurrency, toCurrency]);

  useEffect(() => {
    async function loadRatesTable() {
      setIsLoadingRatesTable(true);
      try {
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
              return {
                pair: `${p.from}/${p.to}`,
                from: p.from,
                to: p.to,
                rate: 0,
                trend: p.trend,
                change: p.change,
                sparkline: p.sparkline,
              };
            }
          })
        );
        setRatesTableData(resolvedPairs);
      } catch {
        // Keep empty state
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
      q: 'How are exchange rates calculated?',
      r: 'Rates are sourced from trusted global currency providers and updated in real-time. Our platform ensures you always see the latest market prices.',
    },
    {
      q: 'Is my financial data secure?',
      r: 'Absolutely. We use bank-level encryption and secure authentication to protect your account, conversion history, and personal information.',
    },
    {
      q: 'Can I track my conversion history?',
      r: 'Yes. Every conversion you make is logged with full details including rates, timestamps, and amounts. You can export your history anytime.',
    },
    {
      q: 'What features are available after signing up?',
      r: 'Registered users get access to conversion history, favorite currency pairs, real-time alerts, analytics dashboards, and portfolio tracking.',
    },
  ];

  return (
    <div className="animate-fade-in" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <a href="#main-content" className="sr-only">
        Skip to main content
      </a>

      <header className={`nav-header ${isScrolled ? 'nav-header--scrolled' : ''}`}>
        <div className="nav-container">
          <Link to="/" className="nav-logo" aria-label="AeroExchange Home">
            <ArrowRightLeft size={24} />
            <span>AeroExchange</span>
          </Link>

          <nav className="nav-menu" aria-label="Desktop Navigation">
            <a href="#rates" className="nav-link">Rates</a>
            <a href="#features" className="nav-link">Features</a>
            <a href="#faq" className="nav-link">FAQ</a>
          </nav>

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

      <main id="main-content" style={{ flexGrow: 1 }}>
        
        <section className="landing-shell">
          <div className="hero-grid">
            <div className="hero-content animate-slide-up">
              <div className="hero-badge">
                <Coins size={16} />
                <span>Trusted by traders worldwide</span>
              </div>
              <h1>
                Live Currency Exchange <span>at Your Fingertips</span>
              </h1>
              <p>
                Convert currencies in real-time with institutional-grade accuracy. Track market trends, build your portfolio, and never miss a rate movement.
              </p>
              
              <div className="hero-cta-group">
                <button
                  type="button"
                  onClick={scrollToCalculator}
                  className="primary-button"
                >
                  Start Converting
                  <ArrowRight size={16} />
                </button>
                <a href="#features" className="secondary-button">
                  Learn More
                </a>
              </div>

              <div className="hero-stats">
                <div className="stat-item">
                  <span className="stat-val">150+</span>
                  <span className="stat-lbl">Supported Currencies</span>
                </div>
                <div className="stat-item">
                  <span className="stat-val">Real-time</span>
                  <span className="stat-lbl">Live Market Rates</span>
                </div>
                <div className="stat-item">
                  <span className="stat-val">256-bit</span>
                  <span className="stat-lbl">Data Encryption</span>
                </div>
              </div>
            </div>

            <div ref={heroCalculatorRef} className="animate-slide-up" style={{ animationDelay: '0.15s' }}>
              <div className="converter-card">
                <h2 className="converter-card__title">Exchange Calculator</h2>
                <p className="converter-card__desc">Enter an amount and select currencies</p>

                <div className="converter-row">
                  <label htmlFor="convert-amount">
                    <span>Send Amount</span>
                    {isConverting && <span className="eyebrow" style={{ fontSize: '0.7rem' }}>Fetching rates...</span>}
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
                      aria-label="Amount to convert"
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

                <div className="swap-btn-container">
                  <button
                    type="button"
                    className="swap-btn"
                    onClick={handleSwap}
                    disabled={isConverting}
                    aria-label="Swap currencies"
                  >
                    <ArrowRightLeft size={16} />
                  </button>
                </div>

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
                      aria-label="Converted amount"
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

        <section id="rates" className="rates-section">
          <div className="section-header">
            <span className="eyebrow">Market Rates</span>
            <h2>Top Currency Pairs</h2>
            <p>Monitor major currencies with real-time rates and instant calculator integration.</p>
          </div>

          <div className="rates-table-container">
            {isLoadingRatesTable ? (
              <div style={{ padding: '40px', textAlign: 'center' }}>
                <div className="button-spinner" style={{ borderColor: 'rgba(11, 105, 116, 0.2)', borderTopColor: '#0b6974', width: '32px', height: '32px', marginBottom: '16px' }} />
                <p className="eyebrow">Fetching market rates...</p>
              </div>
            ) : (
              <table className="rates-table" role="table" aria-label="Exchange rates for major currency pairs">
                <thead>
                  <tr>
                    <th scope="col">Currency Pair</th>
                    <th scope="col">Exchange Rate</th>
                    <th scope="col">24h Trend</th>
                    <th scope="col">Weekly Trend</th>
                    <th scope="col">Action</th>
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
                        {row.rate > 0 ? row.rate.toFixed(5) : '--'}
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

        <section id="faq" className="faq-section">
          <div className="section-header">
            <span className="eyebrow">Got Questions?</span>
            <h2>Frequently Asked Questions</h2>
            <p>Everything you need to know about using AeroExchange.</p>
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
                      <p>{faq.r}</p>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </section>

      </main>

      <footer className="footer">
        <div className="footer-container">
          <div className="footer-brand">
            <Link to="/" className="logo">
              <ArrowRightLeft size={24} />
              <span>AeroExchange</span>
            </Link>
            <p>
              Professional currency exchange platform with real-time rates, secure authentication, and comprehensive analytics.
            </p>
          </div>

          <div className="footer-col">
            <h5>Product</h5>
            <ul className="footer-links">
              <li><a href="#rates">Live Rates</a></li>
              <li><a href="#features">Features</a></li>
              <li><a href="#faq">FAQ</a></li>
            </ul>
          </div>

          <div className="footer-col">
            <h5>Account</h5>
            <ul className="footer-links">
              <li><Link to="/auth/login">Sign In</Link></li>
              <li><Link to="/auth/register">Create Account</Link></li>
              <li><Link to="/dashboard">Dashboard</Link></li>
            </ul>
          </div>

          <div className="footer-col">
            <h5>Security</h5>
            <ul className="footer-links">
              <li><span>Encrypted Authentication</span></li>
              <li><span>Secure Session Management</span></li>
              <li><span>Data Protection</span></li>
            </ul>
          </div>
        </div>

        <div className="footer-bottom">
          <p>&copy; {new Date().getFullYear()} AeroExchange. All rights reserved.</p>
          <div className="footer-bottom-links">
            <a href="#">Privacy Policy</a>
            <a href="#">Terms of Service</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
