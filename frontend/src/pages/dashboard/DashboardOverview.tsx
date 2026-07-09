import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQueryClient } from '@tanstack/react-query';
import {
  ArrowRight,
  ArrowRightLeft,
  Bell,
  Coins,
  History,
  Plus,
  RefreshCw,
  TrendingUp,
  Wallet,
  X,
} from 'lucide-react';
import { CurrencySelector } from '../../components/CurrencySelector';
import {
  useCurrencyRate,
  useCurrencyConversion,
  useConversionHistory,
  useAllRates,
} from '../../hooks/useCurrency';
import { useRealtimeRates } from '../../hooks/useRealtimeRates';
import { useNotificationSubscriptions, useDeleteAlert } from '../../hooks/useNotifications';
import { useSystemAnalytics } from '../../hooks/useAnalytics';
import { useAuth } from '../../auth/AuthContext';
import { AnimatedCard } from '../../components/ui/AnimatedCard';
import { CardSkeleton, TableSkeleton } from '../../components/ui/LoadingSkeleton';

const conversionSchema = z.object({
  amount: z.number({ message: 'Amount is required' }).refine((val) => !isNaN(val) && val > 0, {
    message: 'Amount must be greater than 0',
  }),
  fromCurrency: z.string().length(3, 'Source currency is required'),
  toCurrency: z.string().length(3, 'Target currency is required'),
}).refine((data) => data.fromCurrency !== data.toCurrency, {
  message: 'Source and target currencies must be different',
  path: ['toCurrency'],
});

type ConversionFormValues = z.infer<typeof conversionSchema>;

const PORTFOLIO_ALLOCATION: Record<string, number> = {
  USD: 5400,
  EUR: 6200,
  GBP: 1650,
};

export function DashboardOverview() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [queryParams, setQueryParams] = useState<{ from: string; to: string; amount: number } | null>(null);

  const { data: allRates, isLoading: isLoadingRates } = useAllRates();
  const analytics = useSystemAnalytics();
  const { data: alerts, isLoading: isLoadingAlerts } = useNotificationSubscriptions();
  const deleteAlert = useDeleteAlert();

  const pairToRate = new Map<string, number>();
  if (allRates) {
    for (const r of allRates) {
      pairToRate.set(`${r.base_currency}/${r.target_currency}`, r.rate);
    }
  }

  const eurUsdRate = pairToRate.get('EUR/USD') || 0;
  const gbpUsdRate = pairToRate.get('GBP/USD') || 0;
  const portfolioTotal = Object.entries(PORTFOLIO_ALLOCATION).reduce((sum, [cur, amt]) => {
    if (cur === 'USD') return sum + amt;
    const rate = cur === 'EUR' ? eurUsdRate : gbpUsdRate;
    return sum + amt * rate;
  }, 0);

  const wsRates = useRealtimeRates(['EURUSD', 'GBPUSD', 'USDJPY'], { autoReconnect: true });
  const liveEurUsd = wsRates.rates['EURUSD'] || eurUsdRate || 1.0870;
  const liveGbpUsd = wsRates.rates['GBPUSD'] || gbpUsdRate || 1.2820;
  const liveUsdJpy = wsRates.rates['USDJPY'] || 161.45;

  const {
    register,
    handleSubmit,
    control,
    setValue,
    getValues,
    watch,
    formState: { errors },
  } = useForm<ConversionFormValues>({
    resolver: zodResolver(conversionSchema),
    defaultValues: {
      amount: 1000,
      fromCurrency: 'USD',
      toCurrency: 'EUR',
    },
  });

  const watchedAmount = watch('amount');
  const watchedFrom = watch('fromCurrency');
  const watchedTo = watch('toCurrency');

  useEffect(() => {
    if (queryParams) setQueryParams(null);
  }, [watchedAmount, watchedFrom, watchedTo]);

  const { data: liveRateData, isLoading: isLoadingLiveRate } = useCurrencyRate(watchedFrom, watchedTo);
  const liveRate = liveRateData?.rate || 0;
  const estimatedResult = watchedAmount && liveRate ? watchedAmount * liveRate : 0;

  const {
    data: conversionResult,
    isLoading: isConverting,
    error: conversionError,
  } = useCurrencyConversion(
    queryParams || { from: watchedFrom, to: watchedTo, amount: watchedAmount || 0 },
    !!queryParams
  );

  const { data: historyData, isLoading: isLoadingHistory, error: historyError } = useConversionHistory({ limit: 4 });
  const recentConversions = historyData?.items || [];

  useEffect(() => {
    if (conversionResult) {
      setSuccessMsg(
        `Successfully converted ${conversionResult.amount.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${conversionResult.from_currency} to ${conversionResult.result.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${conversionResult.to_currency}!`
      );
      queryClient.invalidateQueries({ queryKey: ['history'] });
      const timer = setTimeout(() => setSuccessMsg(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [conversionResult, queryClient]);

  const handleSwap = () => {
    const from = getValues('fromCurrency');
    const to = getValues('toCurrency');
    setValue('fromCurrency', to);
    setValue('toCurrency', from);
  };

  const onSubmit = (data: ConversionFormValues) => {
    setQueryParams({ from: data.fromCurrency, to: data.toCurrency, amount: data.amount });
  };

  return (
    <div className="space-y-6">
      <div className="dashboard-page-title">
        <h1>Dashboard Overview</h1>
        <p>Monitor your active balances, check live market pricing, and execute conversions.</p>
      </div>

      {successMsg && (
        <div className="p-4 bg-teal-50 border border-teal-200 text-teal-800 rounded-xl flex items-center gap-3 animate-in fade-in slide-in-from-top-3 duration-300">
          <Coins className="text-teal-600 flex-shrink-0" size={18} />
          <span className="text-sm font-semibold">{successMsg}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <AnimatedCard delay={0} badge="Active Portfolio">
          <h2 className="glass-widget__title"><Wallet size={16} /> Wallet Balances</h2>
          {isLoadingRates ? (
            <CardSkeleton />
          ) : (
            <>
              <span className="text-xs text-slate-500 font-medium">Estimated Combined Value</span>
              <div className="text-3xl font-extrabold text-slate-800 tracking-tight mt-1">
                ${portfolioTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}{' '}
                <span className="text-sm font-bold text-slate-500">USD</span>
              </div>
              <div className="wallet-card-list">
                {Object.entries(PORTFOLIO_ALLOCATION).map(([cur, amt]) => {
                  const usdValue = cur === 'USD' ? amt : amt * (cur === 'EUR' ? liveEurUsd : liveGbpUsd);
                  return (
                    <div key={cur} className="wallet-mini-card">
                      <span className="wallet-mini-card__currency">{cur}</span>
                      <span className="wallet-mini-card__balance">
                        {cur === 'USD' && '$'}{cur === 'EUR' && '€'}{cur === 'GBP' && '£'}
                        {amt.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </span>
                      <span className="wallet-mini-card__converted">
                        {cur === 'USD' ? 'Base Currency' : `≈ $${usdValue.toFixed(2)} USD`}
                      </span>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </AnimatedCard>

        <AnimatedCard delay={100}>
          <h2 className="glass-widget__title"><TrendingUp size={16} /> Live Market Trends</h2>
          {wsRates.status === 'connecting' && isLoadingRates ? (
            <CardSkeleton />
          ) : (
            <div className="space-y-4 flex-1 justify-center">
              {[
                { pair: 'EUR / USD', desc: 'Euro vs US Dollar', rate: liveEurUsd, change: '+0.22%', up: true },
                { pair: 'GBP / USD', desc: 'Pound vs US Dollar', rate: liveGbpUsd, change: '+0.48%', up: true },
                { pair: 'USD / JPY', desc: 'US Dollar vs Yen', rate: liveUsdJpy, change: '-0.64%', up: false },
              ].map((item) => (
                <div key={item.pair} className="flex items-center justify-between p-2 hover:bg-slate-50/50 rounded-xl transition-colors">
                  <div className="flex flex-col">
                    <span className="text-sm font-bold text-slate-700">{item.pair}</span>
                    <span className="text-xs text-slate-400">{item.desc}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <svg className={`widget-sparkline${item.up ? '' : ' widget-sparkline--down'}`} viewBox="0 0 100 40" aria-hidden="true">
                      <path d={item.up ? 'M0 25 Q20 12, 40 28 T80 10' : 'M0 10 Q20 30, 40 18 T80 32'} />
                    </svg>
                    <div className="text-right min-w-[80px]">
                      <span className="text-sm font-bold text-slate-800 tabular-nums">
                        {item.rate.toFixed(item.pair.includes('JPY') ? 2 : 4)}
                      </span>
                      <span className={`block text-xs font-semibold ${item.up ? 'text-emerald-600' : 'text-red-600'}`}>
                        {item.change}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
              <div className="text-[10px] text-slate-400 text-center pt-1">
                {wsRates.status === 'connected' ? 'Live' : wsRates.status === 'connecting' ? 'Connecting...' : 'Offline'}
              </div>
            </div>
          )}
        </AnimatedCard>

        <AnimatedCard delay={200}>
          <h2 className="glass-widget__title"><Bell size={16} /> Active FX Alerts</h2>
          <div className="space-y-3 flex-1">
            {isLoadingAlerts ? (
              <CardSkeleton />
            ) : !alerts || alerts.length === 0 ? (
              <div className="text-center py-6 text-slate-400 text-sm font-medium">
                <Bell className="mx-auto text-slate-300 mb-2" size={28} />
                No active alerts. Create one to get notified on rate thresholds.
              </div>
            ) : (
              alerts.map((alert) => (
                <div key={alert.id} className="p-3 bg-white/60 border border-slate-200/60 rounded-xl flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">
                      {alert.condition === 'above' ? 'Above' : 'Below'} Threshold
                    </span>
                    <span className="text-sm font-bold text-slate-800">
                      {alert.base_currency}/{alert.target_currency} {alert.condition === 'above' ? '>' : '<'} {alert.threshold}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => deleteAlert.mutate(alert.id)}
                    disabled={deleteAlert.isPending}
                    className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                    aria-label={`Delete alert ${alert.id}`}
                  >
                    <X size={14} />
                  </button>
                </div>
              ))
            )}
            <Link
              to="/dashboard/settings"
              className="w-full py-2 border border-dashed border-slate-300 hover:border-teal-500 rounded-xl text-xs font-bold text-slate-500 hover:text-teal-600 transition-colors flex items-center justify-center gap-2"
            >
              <Plus size={14} /> Create Alert Trigger
            </Link>
          </div>
        </AnimatedCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <AnimatedCard delay={300} className="lg:col-span-2">
          <h2 className="glass-widget__title"><ArrowRightLeft size={16} /> Quick Exchange Tool</h2>
          <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
            <div>
              <label htmlFor="amount" className="block text-xs font-bold text-slate-600 mb-1.5">Transaction Amount</label>
              <input
                id="amount"
                type="number"
                step="any"
                className={`w-full h-11 px-3 border rounded-xl bg-white/70 focus:outline-none focus:ring-4 font-semibold ${errors.amount ? 'border-rose-400 focus:border-rose-600 focus:ring-rose-500/10' : 'border-slate-200 focus:border-teal-600 focus:ring-teal-500/10'}`}
                placeholder="Enter amount..."
                {...register('amount', { valueAsNumber: true })}
              />
              {errors.amount && <span className="text-xs text-rose-500 font-semibold mt-1 block">{errors.amount.message}</span>}
            </div>

            <div className="grid grid-cols-5 gap-4 items-end">
              <div className="col-span-2">
                <Controller control={control} name="fromCurrency" render={({ field }) => (
                  <CurrencySelector label="From" value={field.value} onChange={field.onChange} exclude={[watchedTo]} />
                )} />
              </div>
              <div className="flex justify-center pb-1">
                <button type="button" onClick={handleSwap} className="w-10 h-10 rounded-full bg-slate-800 text-white flex items-center justify-center hover:bg-teal-600 transition-colors shadow-md transform hover:rotate-180 duration-300 cursor-pointer" aria-label="Swap Currencies">
                  <ArrowRightLeft size={16} />
                </button>
              </div>
              <div className="col-span-2">
                <Controller control={control} name="toCurrency" render={({ field }) => (
                  <CurrencySelector label="To" value={field.value} onChange={field.onChange} exclude={[watchedFrom]} />
                )} />
              </div>
            </div>
            {errors.toCurrency && <span className="text-xs text-rose-500 font-semibold block">{errors.toCurrency.message}</span>}

            <div className="p-3 bg-slate-50 border border-slate-200/50 rounded-xl">
              <div className="flex justify-between text-xs text-slate-500">
                <span>Calculated Rate</span>
                <span>Receive Value (Est)</span>
              </div>
              <div className="flex justify-between items-baseline mt-1">
                <span className="text-sm font-bold text-slate-700">
                  {isLoadingLiveRate ? (
                    <span className="inline-block w-24 h-4 bg-slate-200 animate-pulse rounded" />
                  ) : `1 ${watchedFrom} = ${liveRate.toFixed(5)} ${watchedTo}`}
                </span>
                <span className="text-xl font-extrabold text-teal-800 tabular-nums">
                  {isLoadingLiveRate ? (
                    <span className="inline-block w-20 h-5 bg-slate-200 animate-pulse rounded" />
                  ) : `${estimatedResult.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })} ${watchedTo}`}
                </span>
              </div>
            </div>

            {conversionResult && (
              <div className="p-4 bg-teal-50/80 backdrop-blur-md border border-teal-200/80 rounded-2xl space-y-3 animate-in fade-in slide-in-from-top-3 duration-300">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-teal-800/60 uppercase tracking-wider">Conversion Successful</span>
                  <span className="text-[10px] font-mono bg-teal-200/50 text-teal-900 px-2 py-0.5 rounded-full">ID: #{conversionResult.id}</span>
                </div>
                <div className="flex justify-between items-center py-1">
                  <div className="flex flex-col">
                    <span className="text-xs font-semibold text-slate-500">Converted</span>
                    <span className="text-base font-bold text-slate-800">{conversionResult.amount.toLocaleString(undefined, { maximumFractionDigits: 2 })} {conversionResult.from_currency}</span>
                  </div>
                  <ArrowRight className="text-teal-600 stroke-[2.5]" size={20} />
                  <div className="flex flex-col text-right">
                    <span className="text-xs font-semibold text-slate-500">Received</span>
                    <span className="text-lg font-extrabold text-teal-900">{conversionResult.result.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {conversionResult.to_currency}</span>
                  </div>
                </div>
                <div className="pt-2 border-t border-teal-200/50 flex justify-between text-xs text-teal-800/80 font-medium">
                  <span>Rate: 1 {conversionResult.from_currency} = {conversionResult.rate.toFixed(5)} {conversionResult.to_currency}</span>
                  <span>{new Date(conversionResult.converted_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
              </div>
            )}

            {conversionError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs font-semibold">
                Conversion failed: {conversionError.message || 'An unexpected error occurred.'}
              </div>
            )}

            <button
              type="submit"
              disabled={isConverting || watchedFrom === watchedTo}
              className="w-full h-11 bg-gradient-to-r from-teal-700 to-cyan-900 text-white font-bold rounded-xl shadow-lg shadow-teal-700/10 hover:shadow-teal-700/20 hover:scale-[1.01] active:scale-100 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {isConverting ? <><RefreshCw className="animate-spin" size={16} /> Converting...</> : <>Convert &amp; Save Log <ArrowRight size={16} /></>}
            </button>
          </form>
        </AnimatedCard>

        <AnimatedCard delay={400} className="lg:col-span-3">
          <div className="flex items-center justify-between mb-4">
            <h2 className="glass-widget__title mb-0"><History size={16} /> Recent Conversion Logs</h2>
            <Link to="/dashboard/history" className="text-xs font-bold text-teal-600 hover:text-teal-800 transition-colors">View Full History</Link>
          </div>

          {isLoadingHistory ? (
            <TableSkeleton rows={4} cols={5} />
          ) : historyError ? (
            <div className="text-center py-6 text-rose-500 font-semibold">Failed to load recent conversion history.</div>
          ) : recentConversions.length === 0 ? (
            <div className="text-center py-6 text-slate-400 font-medium">No conversions logged yet. Set amounts above to add one.</div>
          ) : (
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
                  {recentConversions.map((log) => (
                    <tr key={log.id}>
                      <td className="text-xs text-slate-400 font-medium">
                        {new Date(log.converted_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        <span className="block text-[10px] text-slate-400">{new Date(log.converted_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}</span>
                      </td>
                      <td className="font-bold text-slate-700">{log.amount.toLocaleString(undefined, { maximumFractionDigits: 2 })} {log.from_currency}</td>
                      <td className="font-extrabold text-teal-800">{log.result.toLocaleString(undefined, { maximumFractionDigits: 2 })} {log.to_currency}</td>
                      <td className="text-sm font-semibold text-slate-500 tabular-nums">{log.rate.toFixed(5)}</td>
                      <td><span className="status-badge status-badge--completed">completed</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </AnimatedCard>
      </div>
    </div>
  );
}
