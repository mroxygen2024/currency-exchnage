import { useState, useMemo, useEffect, useCallback } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Star, ArrowRightLeft, AlertTriangle, RefreshCw } from 'lucide-react';
import { useFavorites, useAddFavorite, useDeleteFavorite } from '../../hooks/useFavorites';
import { useRealtimeRates } from '../../hooks/useRealtimeRates';
import { useAllRates } from '../../hooks/useCurrency';
import { CurrencySelector } from '../../components/CurrencySelector';
import { FavoriteCard } from '../../components/dashboard/FavoriteCard';
import { AnimatedCard } from '../../components/ui/AnimatedCard';
import { CardSkeleton } from '../../components/ui/LoadingSkeleton';

const addFavoriteSchema = z.object({
  base_currency: z.string().length(3, 'Select a base currency'),
  target_currency: z.string().length(3, 'Select a target currency'),
}).refine((data) => data.base_currency !== data.target_currency, {
  message: 'Currencies must be different',
  path: ['target_currency'],
});

type AddFavoriteForm = z.infer<typeof addFavoriteSchema>;

export function DashboardFavorites() {
  const { data: favorites, isLoading: isLoadingFavs, error: favsError, refetch: refetchFavs } = useFavorites();
  const addFavorite = useAddFavorite();
  const deleteFavorite = useDeleteFavorite();
  const { data: allRates } = useAllRates();
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<AddFavoriteForm>({
    resolver: zodResolver(addFavoriteSchema),
    defaultValues: { base_currency: 'USD', target_currency: 'EUR' },
  });

  const pairKeys = useMemo(
    () => (favorites || []).map((f) => `${f.base_currency}${f.target_currency}`),
    [favorites],
  );
  const wsRates = useRealtimeRates(pairKeys);

  const previousRatesRef = useMemo(() => {
    const map = new Map<string, number>();
    if (allRates) {
      for (const r of allRates) {
        map.set(`${r.base_currency}/${r.target_currency}`, r.rate);
      }
    }
    return map;
  }, [allRates]);

  const handleRemove = useCallback(
    (id: number) => {
      deleteFavorite.mutate(id, {
        onSuccess: () => {
          setSuccessMsg('Pair removed from your favorites.');
        },
      });
    },
    [deleteFavorite],
  );

  const onSubmit = (data: AddFavoriteForm) => {
    addFavorite.mutate(
      { base_currency: data.base_currency, target_currency: data.target_currency },
      {
        onSuccess: () => {
          setSuccessMsg(`${data.base_currency}/${data.target_currency} added to your favorites.`);
          reset();
        },
        onError: () => {},
      },
    );
  };

  useEffect(() => {
    if (!successMsg) return;
    const timer = setTimeout(() => setSuccessMsg(null), 4000);
    return () => clearTimeout(timer);
  }, [successMsg]);

  return (
    <div className="space-y-6">
      <div className="dashboard-page-title">
        <h1>Favorite Currency Pairs</h1>
        <p>Track your monitored pairs with live or cached exchange rate data.</p>
      </div>

      {successMsg && (
        <div className="fav-toast animate-in fade-in slide-in-from-top-3 duration-300">
          <Star className="text-amber-500 flex-shrink-0" size={16} />
          <span className="text-sm font-semibold">{successMsg}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <AnimatedCard delay={0} className="h-fit lg:col-span-1">
          <h2 className="glass-widget__title">
            <Plus size={16} /> Add Favorite Pair
          </h2>
          <form className="space-y-4" onSubmit={handleSubmit(onSubmit)} data-testid="add-favorite-form">
            <Controller
              control={control}
              name="base_currency"
              render={({ field }) => (
                <CurrencySelector
                  label="Base Currency"
                  value={field.value}
                  onChange={field.onChange}
                  exclude={[]}
                />
              )}
            />

            <div className="flex justify-center">
              <button
                type="button"
                onClick={() => {
                  const base = control._formValues.base_currency;
                  const target = control._formValues.target_currency;
                  control.setValue('base_currency', target);
                  control.setValue('target_currency', base);
                }}
                className="fav-form__swap"
                aria-label="Swap currencies"
              >
                <ArrowRightLeft size={14} />
              </button>
            </div>

            <Controller
              control={control}
              name="target_currency"
              render={({ field }) => (
                <CurrencySelector
                  label="Quote Currency"
                  value={field.value}
                  onChange={field.onChange}
                  exclude={[]}
                />
              )}
            />

            {(errors.base_currency || errors.target_currency) && (
              <p className="fav-form__error" data-testid="form-error">
                {errors.base_currency?.message || errors.target_currency?.message}
              </p>
            )}

            {addFavorite.isError && (
              <div className="fav-form__api-error" data-testid="api-error">
                <AlertTriangle size={14} />
                <span>{addFavorite.error?.message || 'Failed to add favorite.'}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={addFavorite.isPending}
              className="fav-form__submit"
              data-testid="add-favorite-submit"
            >
              {addFavorite.isPending ? (
                <>
                  <RefreshCw size={14} className="animate-spin" /> Adding...
                </>
              ) : (
                <>
                  <Star size={14} /> Add to Watchlist
                </>
              )}
            </button>
          </form>
        </AnimatedCard>

        <div className="lg:col-span-3">
          {isLoadingFavs ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <CardSkeleton key={i} />
              ))}
            </div>
          ) : favsError ? (
            <AnimatedCard delay={0}>
              <div className="fav-empty-state">
                <AlertTriangle size={28} className="text-rose-400" />
                <p className="text-sm font-semibold text-rose-700">Failed to load favorites</p>
                <p className="text-xs text-rose-500">{favsError.message}</p>
                <button
                  type="button"
                  onClick={() => refetchFavs()}
                  className="fav-retry-btn"
                  data-testid="retry-favorites"
                >
                  <RefreshCw size={14} /> Retry
                </button>
              </div>
            </AnimatedCard>
          ) : !favorites || favorites.length === 0 ? (
            <AnimatedCard delay={0}>
              <div className="fav-empty-state" data-testid="empty-favorites">
                <Star className="text-slate-300 mb-1" size={36} />
                <p className="text-sm font-semibold text-slate-500">No favorite pairs yet</p>
                <p className="text-xs text-slate-400 mt-1">
                  Use the form on the left to add a currency pair to your watchlist.
                </p>
              </div>
            </AnimatedCard>
          ) : (
            <>
              <div className="fav-count-bar">
                <span className="fav-count-bar__label">
                  Monitoring {favorites.length} {favorites.length === 1 ? 'pair' : 'pairs'}
                </span>
                <span className="fav-count-bar__status">
                  {wsRates.status === 'connected' ? (
                    <span className="fav-count-bar__live">Connected</span>
                  ) : wsRates.status === 'connecting' ? (
                    'Connecting...'
                  ) : (
                    'Offline'
                  )}
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4" data-testid="favorites-grid">
                {favorites.map((fav, idx) => {
                  const wsKey = `${fav.base_currency}${fav.target_currency}`;
                  const wsRate = wsRates.rates[wsKey];
                  const cachedRate = previousRatesRef.get(`${fav.base_currency}/${fav.target_currency}`) || 0;
                  const currentRate = wsRate || cachedRate;

                  return (
                    <FavoriteCard
                      key={fav.id}
                      favorite={fav}
                      currentRate={currentRate}
                      previousRate={cachedRate}
                      isLive={!!wsRate}
                      isRemoving={deleteFavorite.isPending}
                      onRemove={handleRemove}
                      delay={idx * 60}
                    />
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
