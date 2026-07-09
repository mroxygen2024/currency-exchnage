import { type RefObject } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ArrowRightLeft, Coins } from 'lucide-react';

interface HeroSectionProps {
  heroCalculatorRef: RefObject<HTMLDivElement | null>;
  scrollToCalculator: () => void;
  amount: number;
  setAmount: (v: number) => void;
  fromCurrency: string;
  setFromCurrency: (v: string) => void;
  toCurrency: string;
  setToCurrency: (v: string) => void;
  convertedAmount: number | null;
  exchangeRate: number | null;
  isConverting: boolean;
  lastUpdated: string | null;
  supportedCurrencies: string[];
  isAuthenticated: boolean;
  handleSwap: () => void;
}

export function HeroSection({
  heroCalculatorRef,
  scrollToCalculator,
  amount,
  setAmount,
  fromCurrency,
  setFromCurrency,
  toCurrency,
  setToCurrency,
  convertedAmount,
  exchangeRate,
  isConverting,
  lastUpdated,
  supportedCurrencies,
  isAuthenticated,
  handleSwap,
}: HeroSectionProps) {
  return (
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
            <button type="button" onClick={scrollToCalculator} className="primary-button">
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
                    <option key={code} value={code}>{code}</option>
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
                    <option key={code} value={code}>{code}</option>
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
  );
}
