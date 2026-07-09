import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  ArrowRightLeft,
  Coins,
  History,
  Info,
  Plus,
  RefreshCw,
  TrendingUp,
  Wallet,
} from 'lucide-react';

const FALLBACK_RATES: Record<string, number> = {
  USD: 1.0,
  EUR: 0.92,
  GBP: 0.78,
  JPY: 161.4,
  CAD: 1.36,
  AUD: 1.49,
  CHF: 0.89,
};

interface ConversionLog {
  id: string;
  date: string;
  fromCurrency: string;
  fromAmount: number;
  toCurrency: string;
  toAmount: number;
  rate: number;
  status: 'completed' | 'pending' | 'failed';
}

const DEFAULT_CONVERSIONS: ConversionLog[] = [
  { id: 'tx_101', date: '2026-07-09T09:12:00.000Z', fromCurrency: 'USD', fromAmount: 1500, toCurrency: 'EUR', toAmount: 1380, rate: 0.92, status: 'completed' },
  { id: 'tx_102', date: '2026-07-09T08:05:00.000Z', fromCurrency: 'GBP', fromAmount: 750, toCurrency: 'USD', toAmount: 961.5, rate: 1.282, status: 'completed' },
  { id: 'tx_103', date: '2026-07-08T17:40:00.000Z', fromCurrency: 'EUR', fromAmount: 200, toCurrency: 'JPY', toAmount: 34800, rate: 174.0, status: 'completed' },
  { id: 'tx_104', date: '2026-07-08T11:15:00.000Z', fromCurrency: 'USD', fromAmount: 100, toCurrency: 'CAD', toAmount: 136.5, rate: 1.365, status: 'completed' },
  { id: 'tx_105', date: '2026-07-07T14:30:00.000Z', fromCurrency: 'AUD', fromAmount: 3000, toCurrency: 'USD', toAmount: 2010, rate: 0.67, status: 'failed' },
];

export function DashboardOverview() {
  // Conversions log storage in localStorage for cross-component updates
  const [conversions, setConversions] = useState<ConversionLog[]>([]);
  const [amount, setAmount] = useState<number>(1000);
  const [fromCurrency, setFromCurrency] = useState<string>('USD');
  const [toCurrency, setToCurrency] = useState<string>('EUR');
  const [convertedAmount, setConvertedAmount] = useState<number>(920);
  const [rate, setRate] = useState<number>(0.92);
  const [isLogging, setIsLogging] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Mock Alert thresholds
  const [alerts, setAlerts] = useState([
    { id: 1, pair: 'EUR/USD', condition: '>', target: 1.12, active: true },
    { id: 2, pair: 'GBP/USD', condition: '<', target: 1.25, active: false },
  ]);

  // Load conversions on mount
  useEffect(() => {
    const saved = localStorage.getItem('aero:mock-conversions');
    if (saved) {
      setConversions(JSON.parse(saved) as ConversionLog[]);
    } else {
      localStorage.setItem('aero:mock-conversions', JSON.stringify(DEFAULT_CONVERSIONS));
      setConversions(DEFAULT_CONVERSIONS);
    }
  }, []);

  // Recalculate converter rate
  useEffect(() => {
    const rFrom = FALLBACK_RATES[fromCurrency] ?? 1.0;
    const rTo = FALLBACK_RATES[toCurrency] ?? 1.0;
    const calcRate = rTo / rFrom;
    setRate(calcRate);
    setConvertedAmount(Number((amount * calcRate).toFixed(4)));
  }, [amount, fromCurrency, toCurrency]);

  const handleSwap = () => {
    const temp = fromCurrency;
    setFromCurrency(toCurrency);
    setToCurrency(temp);
  };

  const handleConvertSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (amount <= 0) return;

    setIsLogging(true);
    setTimeout(() => {
      const newTx: ConversionLog = {
        id: `tx_${Date.now().toString().slice(-6)}`,
        date: new Date().toISOString(),
        fromCurrency,
        fromAmount: amount,
        toCurrency,
        toAmount: convertedAmount,
        rate,
        status: 'completed',
      };

      const updated = [newTx, ...conversions];
      setConversions(updated);
      localStorage.setItem('aero:mock-conversions', JSON.stringify(updated));

      // Visual feedback success banner
      setSuccessMsg(`Successfully logged conversion of ${amount} ${fromCurrency} to ${convertedAmount} ${toCurrency}!`);
      setIsLogging(false);

      // Clear success notification
      setTimeout(() => setSuccessMsg(null), 5000);
    }, 600);
  };

  const toggleAlert = (id: number) => {
    setAlerts((prev) =>
      prev.map((a) => (a.id === id ? { ...a, active: !a.active } : a))
    );
  };

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="dashboard-page-title">
        <h1>Dashboard Overview</h1>
        <p>Monitor your active balances, check live market pricing, and execute conversions.</p>
      </div>

      {successMsg && (
        <div className="p-4 bg-teal-50 border border-teal-200 text-teal-800 rounded-xl flex items-center gap-3 animate-fade-in">
          <Coins className="text-teal-600 flex-shrink-0" size={18} />
          <span className="text-sm font-semibold">{successMsg}</span>
        </div>
      )}

      {/* Stats Widgets Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Wallet Balance widget */}
        <div className="glass-widget">
          <span className="glass-widget__badge">Active Portfolio</span>
          <h2 className="glass-widget__title">
            <Wallet size={16} />
            Wallet Balances
          </h2>
          <div className="mt-2">
            <span className="text-xs text-slate-500 font-medium">Estimated Combined Value</span>
            <div className="text-3xl font-extrabold text-slate-800 tracking-tight mt-1">
              $14,250.50 <span className="text-sm font-bold text-slate-500">USD</span>
            </div>
            
            <div className="wallet-card-list">
              <div className="wallet-mini-card">
                <span className="wallet-mini-card__currency">USD</span>
                <span className="wallet-mini-card__balance">$5,400.00</span>
                <span className="wallet-mini-card__converted">Base Currency</span>
              </div>
              <div className="wallet-mini-card">
                <span className="wallet-mini-card__currency">EUR</span>
                <span className="wallet-mini-card__balance">€6,200.00</span>
                <span className="wallet-mini-card__converted">≈ $6,739.00 USD</span>
              </div>
              <div className="wallet-mini-card">
                <span className="wallet-mini-card__currency">GBP</span>
                <span className="wallet-mini-card__balance">£1,650.00</span>
                <span className="wallet-mini-card__converted">≈ $2,115.00 USD</span>
              </div>
            </div>
          </div>
        </div>

        {/* Live FX Rates tracker */}
        <div className="glass-widget">
          <h2 className="glass-widget__title">
            <TrendingUp size={16} />
            Live Market Trends
          </h2>
          <div className="space-y-4 flex-1 justify-center">
            <div className="flex items-center justify-between p-2 hover:bg-slate-50/50 rounded-xl transition-colors">
              <div className="flex flex-col">
                <span className="text-sm font-bold text-slate-700">EUR / USD</span>
                <span className="text-xs text-slate-400">Euro vs US Dollar</span>
              </div>
              <div className="flex items-center gap-3">
                <svg className="widget-sparkline" viewBox="0 0 100 40" aria-hidden="true">
                  <path d="M0 25 Q20 12, 40 28 T80 10" />
                </svg>
                <div className="text-right">
                  <span className="text-sm font-bold text-slate-800">1.0870</span>
                  <span className="block text-xs font-semibold text-emerald-600">+0.22%</span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between p-2 hover:bg-slate-50/50 rounded-xl transition-colors">
              <div className="flex flex-col">
                <span className="text-sm font-bold text-slate-700">GBP / USD</span>
                <span className="text-xs text-slate-400">Pound vs US Dollar</span>
              </div>
              <div className="flex items-center gap-3">
                <svg className="widget-sparkline" viewBox="0 0 100 40" aria-hidden="true">
                  <path d="M0 30 Q25 22, 50 15 T80 5" />
                </svg>
                <div className="text-right">
                  <span className="text-sm font-bold text-slate-800">1.2820</span>
                  <span className="block text-xs font-semibold text-emerald-600">+0.48%</span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between p-2 hover:bg-slate-50/50 rounded-xl transition-colors">
              <div className="flex flex-col">
                <span className="text-sm font-bold text-slate-700">USD / JPY</span>
                <span className="text-xs text-slate-400">US Dollar vs Yen</span>
              </div>
              <div className="flex items-center gap-3">
                <svg className="widget-sparkline widget-sparkline--down" viewBox="0 0 100 40" aria-hidden="true">
                  <path d="M0 10 Q20 30, 40 18 T80 32" />
                </svg>
                <div className="text-right">
                  <span className="text-sm font-bold text-slate-800">161.45</span>
                  <span className="block text-xs font-semibold text-red-600">-0.64%</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Conversion alerts widget */}
        <div className="glass-widget">
          <h2 className="glass-widget__title">
            <Info size={16} />
            Active FX Alerts
          </h2>
          <div className="space-y-3 flex-1">
            {alerts.map((alert) => (
              <div
                key={alert.id}
                className="p-3 bg-white/60 border border-slate-200/60 rounded-xl flex items-center justify-between"
              >
                <div>
                  <span className="text-xs font-extrabold text-slate-400 uppercase tracking-wider block">
                    Trigger Condition
                  </span>
                  <span className="text-sm font-bold text-slate-800">
                    {alert.pair} {alert.condition} {alert.target}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] font-bold ${alert.active ? 'text-teal-600' : 'text-slate-400'}`}>
                    {alert.active ? 'ON' : 'OFF'}
                  </span>
                  <button
                    type="button"
                    onClick={() => toggleAlert(alert.id)}
                    className={`w-10 h-6 flex items-center rounded-full p-0.5 transition-colors ${
                      alert.active ? 'bg-teal-600' : 'bg-slate-300'
                    }`}
                    aria-label={`Toggle alert for ${alert.pair}`}
                  >
                    <span
                      className={`bg-white w-5 h-5 rounded-full shadow-md transform transition-transform ${
                        alert.active ? 'translate-x-4' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              </div>
            ))}
            <button
              type="button"
              className="w-100 py-2 border border-dashed border-slate-300 hover:border-teal-500 rounded-xl text-xs font-bold text-slate-500 hover:text-teal-600 transition-colors flex items-center justify-center gap-2"
            >
              <Plus size={14} /> Create Alert Trigger
            </button>
          </div>
        </div>
      </div>

      {/* Main Grid: Converter and Recent conversions */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Converter Card - span 2 */}
        <div className="glass-widget lg:col-span-2">
          <h2 className="glass-widget__title">
            <ArrowRightLeft size={16} />
            Quick Exchange Tool
          </h2>
          <form className="space-y-4" onSubmit={handleConvertSubmit}>
            <div>
              <label htmlFor="amount" className="block text-xs font-bold text-slate-600 mb-1.5">
                Transaction Amount
              </label>
              <input
                id="amount"
                type="number"
                min="1"
                step="any"
                className="w-100 h-11 px-3 border border-slate-200 rounded-xl bg-white/70 focus:outline-none focus:border-teal-600 focus:ring-4 focus:ring-teal-500/10 font-semibold"
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value))}
                required
              />
            </div>

            <div className="grid grid-cols-5 gap-2 items-center">
              <div className="col-span-2">
                <label htmlFor="from" className="block text-xs font-bold text-slate-600 mb-1.5">
                  From
                </label>
                <select
                  id="from"
                  className="w-100 h-11 px-2 border border-slate-200 rounded-xl bg-white/70 focus:outline-none focus:border-teal-600 font-bold"
                  value={fromCurrency}
                  onChange={(e) => setFromCurrency(e.target.value)}
                >
                  {Object.keys(FALLBACK_RATES).map((currency) => (
                    <option key={currency} value={currency}>
                      {currency}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-center pt-5">
                <button
                  type="button"
                  onClick={handleSwap}
                  className="w-9 h-9 rounded-full bg-slate-800 text-white flex items-center justify-center hover:bg-teal-600 transition-colors shadow-md transform hover:rotate-180 duration-300"
                  aria-label="Swap Currencies"
                >
                  <ArrowRightLeft size={14} />
                </button>
              </div>

              <div className="col-span-2">
                <label htmlFor="to" className="block text-xs font-bold text-slate-600 mb-1.5">
                  To
                </label>
                <select
                  id="to"
                  className="w-100 h-11 px-2 border border-slate-200 rounded-xl bg-white/70 focus:outline-none focus:border-teal-600 font-bold"
                  value={toCurrency}
                  onChange={(e) => setToCurrency(e.target.value)}
                >
                  {Object.keys(FALLBACK_RATES).map((currency) => (
                    <option key={currency} value={currency}>
                      {currency}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200/50 rounded-xl">
              <div className="flex justify-between text-xs text-slate-500">
                <span>Calculated Rate</span>
                <span>Receive Value (Est)</span>
              </div>
              <div className="flex justify-between items-baseline mt-1">
                <span className="text-sm font-bold text-slate-700">
                  1 {fromCurrency} = {rate.toFixed(5)} {toCurrency}
                </span>
                <span className="text-xl font-extrabold text-teal-800">
                  {convertedAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })} {toCurrency}
                </span>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLogging || fromCurrency === toCurrency}
              className="w-100 h-11 bg-gradient-to-r from-teal-700 to-cyan-900 text-white font-bold rounded-xl shadow-lg shadow-teal-700/10 hover:shadow-teal-700/20 hover:scale-[1.01] active:scale-100 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLogging ? (
                <>
                  <RefreshCw className="animate-spin" size={16} /> Saving to log...
                </>
              ) : (
                <>
                  Convert &amp; Save Log <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>
        </div>

        {/* Recent Activity Table - span 3 */}
        <div className="glass-widget lg:col-span-3">
          <div className="flex items-center justify-between mb-4">
            <h2 className="glass-widget__title mb-0">
              <History size={16} />
              Recent Conversion Logs
            </h2>
            <Link
              to="/dashboard/history"
              className="text-xs font-bold text-teal-600 hover:text-teal-800 transition-colors"
            >
              View Full History
            </Link>
          </div>

          <div className="custom-table-container flex-1">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Source</th>
                  <th>Target</th>
                  <th>Exchange Rate</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {conversions.slice(0, 4).map((log) => (
                  <tr key={log.id}>
                    <td className="text-xs text-slate-400 font-medium">
                      {new Date(log.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}{' '}
                      <span className="block text-[10px] text-slate-400">
                        {new Date(log.date).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                      </span>
                    </td>
                    <td className="font-bold text-slate-700">
                      {log.fromAmount.toLocaleString(undefined, { maximumFractionDigits: 2 })} {log.fromCurrency}
                    </td>
                    <td className="font-extrabold text-teal-800">
                      {log.toAmount.toLocaleString(undefined, { maximumFractionDigits: 2 })} {log.toCurrency}
                    </td>
                    <td className="text-sm font-semibold text-slate-500">
                      {log.rate.toFixed(5)}
                    </td>
                    <td>
                      <span
                        className={`status-badge ${
                          log.status === 'completed'
                            ? 'status-badge--completed'
                            : log.status === 'pending'
                            ? 'status-badge--pending'
                            : 'status-badge--failed'
                        }`}
                      >
                        {log.status}
                      </span>
                    </td>
                  </tr>
                ))}
                {conversions.length === 0 && (
                  <tr>
                    <td colSpan={5} className="text-center py-6 text-slate-400 font-medium">
                      No conversions logged yet. Set amounts above to add one.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
