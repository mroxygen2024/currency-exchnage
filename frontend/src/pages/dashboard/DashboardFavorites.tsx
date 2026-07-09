import { useState, useMemo } from 'react';
import { Plus, Star, Trash2, TrendingDown, TrendingUp } from 'lucide-react';
import { useFavorites, useAddFavorite, useDeleteFavorite } from '../../hooks/useFavorites';
import { useRealtimeRates } from '../../hooks/useRealtimeRates';
import { useAllRates, useSupportedCurrencies } from '../../hooks/useCurrency';
import { AnimatedCard } from '../../components/ui/AnimatedCard';
import { CardSkeleton } from '../../components/ui/LoadingSkeleton';

const FALLBACK_CURRENCIES = ['USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD', 'CHF'];

export function DashboardFavorites() {
  const { data: favorites, isLoading: isLoadingFavs } = useFavorites();
  const addFavorite = useAddFavorite();
  const deleteFavorite = useDeleteFavorite();
  const { data: currencies } = useSupportedCurrencies();
  const { data: allRates } = useAllRates();

  const [fromCurrency, setFromCurrency] = useState('USD');
  const [toCurrency, setToCurrency] = useState('EUR');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const pairKeys = useMemo(() => (favorites || []).map((f) => `${f.base_currency}${f.target_currency}`), [favorites]);
  const wsRates = useRealtimeRates(pairKeys);

  const rateMap = useMemo(() => {
    const m = new Map<string, number>();
    if (allRates) {
      for (const r of allRates) {
        m.set(`${r.base_currency}/${r.target_currency}`, r.rate);
      }
    }
    return m;
  }, [allRates]);

  const displayCurrencies = currencies || FALLBACK_CURRENCIES;

  const handleAddFavorite = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    if (fromCurrency === toCurrency) {
      setErrorMsg('Cannot pair a currency with itself.');
      return;
    }
    addFavorite.mutate(
      { base_currency: fromCurrency, target_currency: toCurrency },
      {
        onError: (err) => setErrorMsg(err.message || 'Failed to add favorite.'),
        onSuccess: () => {
          setFromCurrency('USD');
          setToCurrency('EUR');
        },
      }
    );
  };

  return (
    <div className="space-y-6">
      <div className="dashboard-page-title">
        <h1>Favorite Currency Pairs</h1>
        <p>Monitor real-time price updates for your configured target pairings.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <AnimatedCard delay={0} className="h-fit">
          <h2 className="glass-widget__title"><Plus size={16} /> Add Favorite Pair</h2>
          <form className="space-y-4" onSubmit={handleAddFavorite}>
            <div>
              <label htmlFor="fav-from" className="block text-xs font-bold text-slate-600 mb-1.5">Base Currency (From)</label>
              <select
                id="fav-from"
                className="w-full h-11 px-3 border border-slate-200 rounded-xl bg-white/70 focus:outline-none focus:border-teal-600 font-bold"
                value={fromCurrency}
                onChange={(e) => setFromCurrency(e.target.value)}
              >
                {displayCurrencies.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="fav-to" className="block text-xs font-bold text-slate-600 mb-1.5">Quote Currency (To)</label>
              <select
                id="fav-to"
                className="w-full h-11 px-3 border border-slate-200 rounded-xl bg-white/70 focus:outline-none focus:border-teal-600 font-bold"
                value={toCurrency}
                onChange={(e) => setToCurrency(e.target.value)}
              >
                {displayCurrencies.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            {errorMsg && <p className="text-xs font-bold text-red-600 p-2 bg-red-50 rounded-lg border border-red-200">{errorMsg}</p>}
            {addFavorite.isError && (
              <p className="text-xs font-bold text-red-600 p-2 bg-red-50 rounded-lg border border-red-200">
                {addFavorite.error?.message || 'Failed to add favorite.'}
              </p>
            )}
            <button
              type="submit"
              disabled={addFavorite.isPending}
              className="w-full h-11 bg-slate-800 text-white font-bold rounded-xl hover:bg-teal-700 transition-colors shadow-md flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              {addFavorite.isPending ? 'Adding...' : <><Star size={16} /> Add to Monitor list</>}
            </button>
          </form>
        </AnimatedCard>

        <div className="lg:col-span-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {isLoadingFavs ? (
              Array.from({ length: 2 }).map((_, i) => <CardSkeleton key={i} />)
            ) : !favorites || favorites.length === 0 ? (
              <div className="col-span-full glass-widget text-center py-12 text-slate-400 animate-in fade-in">
                <Star className="mx-auto text-slate-300 mb-2" size={32} />
                <p className="font-semibold text-sm">No favorite pairs monitored.</p>
                <p className="text-xs text-slate-400 mt-1">Configure pair selection on the left to add one.</p>
              </div>
            ) : (
              favorites.map((fav, idx) => {
                const pairKey = `${fav.base_currency}${fav.target_currency}`;
                const wsRate = wsRates.rates[pairKey];
                const cachedRate = rateMap.get(`${fav.base_currency}/${fav.target_currency}`) || 0;
                const currentRate = wsRate || cachedRate || 0;
                const bid = currentRate * 0.9995;
                const ask = currentRate * 1.0005;
                const direction = wsRate && cachedRate ? (wsRate > cachedRate ? 'up' : 'down') : 'up';
                const change = wsRate && cachedRate
                  ? `${((wsRate - cachedRate) / cachedRate * 100).toFixed(2)}%`
                  : '+0.00%';

                return (
                  <div
                    key={fav.id}
                    className="glass-widget flex-row justify-between items-center gap-4 hover:scale-[1.01] animate-in fade-in slide-in-from-bottom-2 fill-mode-both"
                    style={{ animationDelay: `${idx * 80}ms` }}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-base font-extrabold text-slate-800">{fav.base_currency} / {fav.target_currency}</span>
                        <span className={`inline-flex items-center gap-0.5 text-xs font-bold px-2 py-0.5 rounded-full ${direction === 'up' ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
                          {direction === 'up' ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                          {change}
                        </span>
                      </div>
                      <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider">
                        {wsRates.status === 'connected' ? 'Live Feed' : 'Cached'}
                      </span>
                      <div className="grid grid-cols-2 gap-4 mt-3 border-t border-slate-100 pt-3">
                        <div>
                          <span className="block text-[10px] text-slate-400 font-bold uppercase">Bid (Sell)</span>
                          <span className="text-sm font-extrabold text-slate-700 tabular-nums">{bid.toFixed(4)}</span>
                        </div>
                        <div>
                          <span className="block text-[10px] text-slate-400 font-bold uppercase">Ask (Buy)</span>
                          <span className="text-sm font-extrabold text-slate-700 tabular-nums">{ask.toFixed(4)}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-3 self-stretch justify-between">
                      <div className="text-right">
                        <span className="text-xs font-extrabold text-slate-400 block">MID PRICE</span>
                        <span className="text-xl font-black text-slate-800 tabular-nums">{currentRate.toFixed(4)}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => deleteFavorite.mutate(fav.id)}
                        disabled={deleteFavorite.isPending}
                        className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50 cursor-pointer"
                        aria-label={`Remove ${fav.base_currency}/${fav.target_currency} from favorites`}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
