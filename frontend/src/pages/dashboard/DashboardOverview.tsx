import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQueryClient } from '@tanstack/react-query';
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
import { CurrencySelector } from '../../components/CurrencySelector';
import {
  useCurrencyRate,
  useCurrencyConversion,
  useConversionHistory,
} from '../../hooks/useCurrency';

// Zod Schema for conversion form validation
const conversionSchema = z.object({
  amount: z.number({
    message: 'Amount is required',
  }).refine((val) => !isNaN(val) && val > 0, {
    message: 'Amount must be greater than 0',
  }),
  fromCurrency: z.string().length(3, 'Source currency is required'),
  toCurrency: z.string().length(3, 'Target currency is required'),
}).refine((data) => data.fromCurrency !== data.toCurrency, {
  message: 'Source and target currencies must be different',
  path: ['toCurrency'],
});

type ConversionFormValues = z.infer<typeof conversionSchema>;

export function DashboardOverview() {
  const queryClient = useQueryClient();
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [queryParams, setQueryParams] = useState<{ from: string; to: string; amount: number } | null>(null);

  // Mock Alert thresholds (remains as is)
  const [alerts, setAlerts] = useState([
    { id: 1, pair: 'EUR/USD', condition: '>', target: 1.12, active: true },
    { id: 2, pair: 'GBP/USD', condition: '<', target: 1.25, active: false },
  ]);

  // React Hook Form setup
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

  // Clear query results/errors when form inputs change
  useEffect(() => {
    console.log('INPUTS CHANGED USEEFFECT RUNS:', watchedAmount, watchedFrom, watchedTo, 'queryParams is:', queryParams);
    if (queryParams) {
      console.log('CLEARING QUERY PARAMS');
      setQueryParams(null);
    }
  }, [watchedAmount, watchedFrom, watchedTo]);

  // Live currency rate query for real-time preview/estimation
  const { data: liveRateData, isLoading: isLoadingLiveRate } = useCurrencyRate(watchedFrom, watchedTo);
  const liveRate = liveRateData?.rate || 0;
  const estimatedResult = watchedAmount && liveRate ? watchedAmount * liveRate : 0;

  // Actual conversion query triggered on form submission
  const {
    data: conversionResult,
    isLoading: isConverting,
    error: conversionError,
  } = useCurrencyConversion(
    queryParams || { from: watchedFrom, to: watchedTo, amount: watchedAmount || 0 },
    !!queryParams
  );

  // Fetch recent conversions from backend history
  const {
    data: historyData,
    isLoading: isLoadingHistory,
    error: historyError,
  } = useConversionHistory({ limit: 4 });

  const recentConversions = historyData?.items || [];

  // Invalidate conversion history when a new conversion successfully registers
  useEffect(() => {
    if (conversionResult) {
      setSuccessMsg(
        `Successfully converted ${conversionResult.amount.toLocaleString(undefined, {
          maximumFractionDigits: 2,
        })} ${conversionResult.from_currency} to ${conversionResult.result.toLocaleString(undefined, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })} ${conversionResult.to_currency}!`
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
    setQueryParams({
      from: data.fromCurrency,
      to: data.toCurrency,
      amount: data.amount,
    });
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
          <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
            <div>
              <label htmlFor="amount" className="block text-xs font-bold text-slate-600 mb-1.5">
                Transaction Amount
              </label>
              <input
                id="amount"
                type="number"
                step="any"
                className={`w-100 h-11 px-3 border rounded-xl bg-white/70 focus:outline-none focus:ring-4 font-semibold ${
                  errors.amount
                    ? 'border-rose-400 focus:border-rose-600 focus:ring-rose-500/10'
                    : 'border-slate-200 focus:border-teal-600 focus:ring-teal-500/10'
                }`}
                placeholder="Enter amount..."
                {...register('amount', { valueAsNumber: true })}
              />
              {errors.amount && (
                <span className="text-xs text-rose-500 font-semibold mt-1 block">
                  {errors.amount.message}
                </span>
              )}
            </div>

            <div className="grid grid-cols-5 gap-4 items-end">
              <div className="col-span-2">
                <Controller
                  control={control}
                  name="fromCurrency"
                  render={({ field }) => (
                    <CurrencySelector
                      label="From"
                      value={field.value}
                      onChange={field.onChange}
                      exclude={[watchedTo]}
                    />
                  )}
                />
              </div>

              <div className="flex justify-center pb-1">
                <button
                  type="button"
                  onClick={handleSwap}
                  className="w-10 h-10 rounded-full bg-slate-800 text-white flex items-center justify-center hover:bg-teal-600 transition-colors shadow-md transform hover:rotate-180 duration-300 cursor-pointer"
                  aria-label="Swap Currencies"
                >
                  <ArrowRightLeft size={16} />
                </button>
              </div>

              <div className="col-span-2">
                <Controller
                  control={control}
                  name="toCurrency"
                  render={({ field }) => (
                    <CurrencySelector
                      label="To"
                      value={field.value}
                      onChange={field.onChange}
                      exclude={[watchedFrom]}
                    />
                  )}
                />
              </div>
            </div>
            {errors.toCurrency && (
              <span className="text-xs text-rose-500 font-semibold block">
                {errors.toCurrency.message}
              </span>
            )}

            {/* Live Rate Preview Card */}
            <div className="p-3 bg-slate-50 border border-slate-200/50 rounded-xl">
              <div className="flex justify-between text-xs text-slate-500">
                <span>Calculated Rate</span>
                <span>Receive Value (Est)</span>
              </div>
              <div className="flex justify-between items-baseline mt-1">
                <span className="text-sm font-bold text-slate-700">
                  {isLoadingLiveRate ? (
                    <span className="inline-block w-24 h-4 bg-slate-200 animate-pulse rounded" />
                  ) : (
                    `1 ${watchedFrom} = ${liveRate.toFixed(5)} ${watchedTo}`
                  )}
                </span>
                <span className="text-xl font-extrabold text-teal-800">
                  {isLoadingLiveRate ? (
                    <span className="inline-block w-20 h-5 bg-slate-200 animate-pulse rounded" />
                  ) : (
                    `${estimatedResult.toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 4,
                    })} ${watchedTo}`
                  )}
                </span>
              </div>
            </div>

            {/* Conversion Result Card */}
            {conversionResult && (
              <div className="p-4 bg-teal-50/80 backdrop-blur-md border border-teal-200/80 rounded-2xl space-y-3 animate-in fade-in slide-in-from-top-3 duration-300">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-teal-800/60 uppercase tracking-wider">Conversion Successful</span>
                  <span className="text-[10px] font-mono bg-teal-200/50 text-teal-900 px-2 py-0.5 rounded-full">
                    ID: #{conversionResult.id}
                  </span>
                </div>
                <div className="flex justify-between items-center py-1">
                  <div className="flex flex-col">
                    <span className="text-xs font-semibold text-slate-500">Converted</span>
                    <span className="text-base font-bold text-slate-800">
                      {conversionResult.amount.toLocaleString(undefined, {
                        maximumFractionDigits: 2,
                      })}{' '}
                      {conversionResult.from_currency}
                    </span>
                  </div>
                  <ArrowRight className="text-teal-600 stroke-[2.5]" size={20} />
                  <div className="flex flex-col text-right">
                    <span className="text-xs font-semibold text-slate-500">Received</span>
                    <span className="text-lg font-extrabold text-teal-900">
                      {conversionResult.result.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}{' '}
                      {conversionResult.to_currency}
                    </span>
                  </div>
                </div>
                <div className="pt-2 border-t border-teal-200/50 flex justify-between text-xs text-teal-800/80 font-medium">
                  <span>Rate: 1 {conversionResult.from_currency} = {conversionResult.rate.toFixed(5)} {conversionResult.to_currency}</span>
                  <span>{new Date(conversionResult.converted_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
              </div>
            )}

            {/* Conversion Error */}
            {conversionError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs font-semibold">
                Conversion failed: {conversionError.message || 'An unexpected error occurred.'}
              </div>
            )}

            <button
              type="submit"
              disabled={isConverting || watchedFrom === watchedTo}
              className="w-100 h-11 bg-gradient-to-r from-teal-700 to-cyan-900 text-white font-bold rounded-xl shadow-lg shadow-teal-700/10 hover:shadow-teal-700/20 hover:scale-[1.01] active:scale-100 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {isConverting ? (
                <>
                  <RefreshCw className="animate-spin" size={16} /> Converting...
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
                {isLoadingHistory ? (
                  Array.from({ length: 4 }).map((_, idx) => (
                    <tr key={idx}>
                      <td colSpan={5} className="py-4 text-center">
                        <div className="h-4 bg-slate-100 animate-pulse rounded w-3/4 mx-auto" />
                      </td>
                    </tr>
                  ))
                ) : historyError ? (
                  <tr>
                    <td colSpan={5} className="text-center py-6 text-rose-500 font-semibold">
                      Failed to load recent conversion history.
                    </td>
                  </tr>
                ) : recentConversions.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-6 text-slate-400 font-medium">
                      No conversions logged yet. Set amounts above to add one.
                    </td>
                  </tr>
                ) : (
                  recentConversions.map((log) => (
                    <tr key={log.id}>
                      <td className="text-xs text-slate-400 font-medium">
                        {new Date(log.converted_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}{' '}
                        <span className="block text-[10px] text-slate-400">
                          {new Date(log.converted_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                        </span>
                      </td>
                      <td className="font-bold text-slate-700">
                        {log.amount.toLocaleString(undefined, { maximumFractionDigits: 2 })} {log.from_currency}
                      </td>
                      <td className="font-extrabold text-teal-800">
                        {log.result.toLocaleString(undefined, { maximumFractionDigits: 2 })} {log.to_currency}
                      </td>
                      <td className="text-sm font-semibold text-slate-500">
                        {log.rate.toFixed(5)}
                      </td>
                      <td>
                        <span className="status-badge status-badge--completed">
                          completed
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
