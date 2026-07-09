import { useEffect, useState } from 'react';
import { Plus, Star, Trash2, TrendingDown, TrendingUp } from 'lucide-react';

interface FavoritePair {
  id: string;
  from: string;
  to: string;
  change: string;
  direction: 'up' | 'down';
  baseRate: number;
}

const DEFAULT_FAVORITES: FavoritePair[] = [
  { id: 'fav_1', from: 'EUR', to: 'USD', change: '+0.22%', direction: 'up', baseRate: 1.087 },
  { id: 'fav_2', from: 'GBP', to: 'USD', change: '+0.48%', direction: 'up', baseRate: 1.282 },
  { id: 'fav_3', from: 'USD', to: 'JPY', change: '-0.64%', direction: 'down', baseRate: 161.45 },
  { id: 'fav_4', from: 'AUD', to: 'USD', change: '-0.08%', direction: 'down', baseRate: 0.671 },
];

const CURRENCIES = ['USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD', 'CHF'];

export function DashboardFavorites() {
  const [favorites, setFavorites] = useState<FavoritePair[]>([]);
  const [fromCurrency, setFromCurrency] = useState('USD');
  const [toCurrency, setToCurrency] = useState('GBP');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  // Real-time pricing fluctuations simulation state
  const [rates, setRates] = useState<Record<string, number>>({});

  useEffect(() => {
    const saved = localStorage.getItem('aero:mock-favorites');
    let loaded: FavoritePair[] = [];
    if (saved) {
      loaded = JSON.parse(saved) as FavoritePair[];
    } else {
      loaded = DEFAULT_FAVORITES;
      localStorage.setItem('aero:mock-favorites', JSON.stringify(DEFAULT_FAVORITES));
    }
    setFavorites(loaded);

    // Initialize simulation rates
    const initialRates: Record<string, number> = {};
    loaded.forEach((fav) => {
      initialRates[fav.id] = fav.baseRate;
    });
    setRates(initialRates);
  }, []);

  // Simulate pricing updates every 3 seconds to wow the user
  useEffect(() => {
    if (favorites.length === 0) return;

    const interval = setInterval(() => {
      setRates((prev) => {
        const next = { ...prev };
        favorites.forEach((fav) => {
          const current = prev[fav.id] ?? fav.baseRate;
          // Random change between -0.05% and +0.05%
          const pct = (Math.random() - 0.5) * 0.001; 
          next[fav.id] = Number((current * (1 + pct)).toFixed(4));
        });
        return next;
      });
    }, 3000);

    return () => clearInterval(interval);
  }, [favorites]);

  const handleAddFavorite = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (fromCurrency === toCurrency) {
      setErrorMsg('Cannot pair a currency with itself.');
      return;
    }

    // Check duplicate
    const exists = favorites.some(
      (f) => f.from === fromCurrency && f.to === toCurrency
    );

    if (exists) {
      setErrorMsg(`Favorite pair ${fromCurrency}/${toCurrency} already exists.`);
      return;
    }

    // Mock initial rate factor
    const baseRates: Record<string, number> = {
      USD: 1.0,
      EUR: 0.92,
      GBP: 0.78,
      JPY: 161.4,
      CAD: 1.36,
      AUD: 1.49,
      CHF: 0.89,
    };
    const rateFrom = baseRates[fromCurrency] ?? 1.0;
    const rateTo = baseRates[toCurrency] ?? 1.0;
    const calcRate = Number((rateTo / rateFrom).toFixed(4));

    const newFav: FavoritePair = {
      id: `fav_${Date.now()}`,
      from: fromCurrency,
      to: toCurrency,
      change: Math.random() > 0.5 ? '+0.15%' : '-0.12%',
      direction: Math.random() > 0.5 ? 'up' : 'down',
      baseRate: calcRate,
    };

    const updated = [...favorites, newFav];
    setFavorites(updated);
    localStorage.setItem('aero:mock-favorites', JSON.stringify(updated));
    setRates((prev) => ({ ...prev, [newFav.id]: calcRate }));
  };

  const handleDeleteFavorite = (id: string) => {
    const updated = favorites.filter((f) => f.id !== id);
    setFavorites(updated);
    localStorage.setItem('aero:mock-favorites', JSON.stringify(updated));
  };

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="dashboard-page-title">
        <h1>Favorite Currency Pairs</h1>
        <p>Monitor real-time price updates for your configured target pairings.</p>
      </div>

      {/* Main Grid: Add favorites & List favorites */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left column: Add Pair */}
        <div className="glass-widget h-fit">
          <h2 className="glass-widget__title">
            <Plus size={16} />
            Add Favorite Pair
          </h2>
          <form className="space-y-4" onSubmit={handleAddFavorite}>
            <div>
              <label htmlFor="fav-from" className="block text-xs font-bold text-slate-600 mb-1.5">
                Base Currency (From)
              </label>
              <select
                id="fav-from"
                className="w-100 h-11 px-3 border border-slate-200 rounded-xl bg-white/70 focus:outline-none focus:border-teal-600 font-bold"
                value={fromCurrency}
                onChange={(e) => setFromCurrency(e.target.value)}
              >
                {CURRENCIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="fav-to" className="block text-xs font-bold text-slate-600 mb-1.5">
                Quote Currency (To)
              </label>
              <select
                id="fav-to"
                className="w-100 h-11 px-3 border border-slate-200 rounded-xl bg-white/70 focus:outline-none focus:border-teal-600 font-bold"
                value={toCurrency}
                onChange={(e) => setToCurrency(e.target.value)}
              >
                {CURRENCIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            {errorMsg && (
              <p className="text-xs font-bold text-red-600 p-2 bg-red-50 rounded-lg border border-red-200">
                {errorMsg}
              </p>
            )}

            <button
              type="submit"
              className="w-100 h-11 bg-slate-800 text-white font-bold rounded-xl hover:bg-teal-700 transition-colors shadow-md flex items-center justify-center gap-2"
            >
              <Star size={16} /> Add to Monitor list
            </button>
          </form>
        </div>

        {/* Right column: Monitoring list (3 cols) */}
        <div className="lg:col-span-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {favorites.map((pair) => {
              const currentRate = rates[pair.id] ?? pair.baseRate;
              // Simulate bid/ask spread
              const bid = Number((currentRate * 0.9995).toFixed(4));
              const ask = Number((currentRate * 1.0005).toFixed(4));

              return (
                <div
                  key={pair.id}
                  className="glass-widget flex-row justify-between items-center gap-4 hover:scale-[1.01]"
                >
                  <div className="flex-1 min-width-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-base font-extrabold text-slate-800">
                        {pair.from} / {pair.to}
                      </span>
                      <span
                        className={`inline-flex items-center gap-0.5 text-xs font-bold px-2 py-0.5 rounded-full ${
                          pair.direction === 'up'
                            ? 'bg-emerald-50 text-emerald-600'
                            : 'bg-red-50 text-red-600'
                        }`}
                      >
                        {pair.direction === 'up' ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                        {pair.change}
                      </span>
                    </div>
                    <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider">
                      Live Feed (Simulated)
                    </span>

                    {/* Pricing Spread info */}
                    <div className="grid grid-cols-2 gap-4 mt-3 border-t border-slate-100 pt-3">
                      <div>
                        <span className="block text-[10px] text-slate-400 font-bold uppercase">
                          Bid (Sell)
                        </span>
                        <span className="text-sm font-extrabold text-slate-700">
                          {bid}
                        </span>
                      </div>
                      <div>
                        <span className="block text-[10px] text-slate-400 font-bold uppercase">
                          Ask (Buy)
                        </span>
                        <span className="text-sm font-extrabold text-slate-700">
                          {ask}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-3 self-stretch justify-between">
                    <div className="text-right">
                      <span className="text-xs font-extrabold text-slate-400 block">MID PRICE</span>
                      <span className="text-xl font-black text-slate-800 tabular-nums">
                        {currentRate.toFixed(4)}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleDeleteFavorite(pair.id)}
                      className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      aria-label={`Remove ${pair.from}/${pair.to} from favorites`}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              );
            })}

            {favorites.length === 0 && (
              <div className="col-span-full glass-widget text-center py-12 text-slate-400">
                <Star className="mx-auto text-slate-300 mb-2" size={32} />
                <p className="font-semibold text-sm">No favorite pairs monitored.</p>
                <p className="text-xs text-slate-400 mt-1">Configure pair selection on the left to add one.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
