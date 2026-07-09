import { useState, useMemo } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
} from 'recharts';
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  ArrowRightLeft,
  RefreshCw,
  AlertTriangle,
  Calendar,
  Minus,
  BarChart as BarChartIcon,
  Hash,
  Coins,
} from 'lucide-react';
import { CurrencySelector } from '../../components/CurrencySelector';
import { useSystemAnalytics, useTrends } from '../../hooks/useAnalytics';
import { AnimatedCard } from '../../components/ui/AnimatedCard';
import { CardSkeleton } from '../../components/ui/LoadingSkeleton';

const PAIR_COLORS = [
  '#0d7380', '#d48c37', '#10354a', '#16a34a', '#8b5cf6',
  '#ef4444', '#f59e0b', '#06b6d4', '#ec4899', '#84cc16',
];

const PRESETS: { label: string; days: number }[] = [
  { label: '7D', days: 7 },
  { label: '30D', days: 30 },
  { label: '90D', days: 90 },
  { label: '1Y', days: 365 },
];

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

function subDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() - days);
  return d;
}

interface ChartTooltipProps {
  active?: boolean;
  payload?: Array<{ value: number }>;
  label?: string;
  base: string;
  target: string;
}

function ChartTooltip({ active, payload, label, base, target }: ChartTooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="analytics-tooltip">
      <p className="analytics-tooltip__date">{label}</p>
      <p className="analytics-tooltip__rate">
        1 {base} = {payload[0].value.toFixed(5)} {target}
      </p>
    </div>
  );
}

interface StatCardProps {
  label: string;
  value: string;
  icon: React.ReactNode;
  positive?: boolean;
  negative?: boolean;
}

function StatCard({ label, value, icon, positive, negative }: StatCardProps) {
  return (
    <div className="analytics-stat-card">
      <div className="analytics-stat-card__icon">{icon}</div>
      <span className="analytics-stat-card__label">{label}</span>
      <span
        className={`analytics-stat-card__value ${
          positive ? 'analytics-stat-card__value--up' : ''
        } ${negative ? 'analytics-stat-card__value--down' : ''}`}
      >
        {value}
      </span>
    </div>
  );
}

export function DashboardAnalytics() {
  const [baseCurrency, setBaseCurrency] = useState('USD');
  const [targetCurrency, setTargetCurrency] = useState('EUR');
  const [activePreset, setActivePreset] = useState(30);
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [useCustomDates, setUseCustomDates] = useState(false);

  const now = useMemo(() => new Date(), []);
  const defaultStartDate = useMemo(() => subDays(now, activePreset), [now, activePreset]);
  const defaultEndDate = useMemo(() => now, [now]);

  const startDate = useCustomDates && customStart ? customStart : formatDate(defaultStartDate);
  const endDate = useCustomDates && customEnd ? customEnd : formatDate(defaultEndDate);

  const trendParams = useMemo(
    () => ({
      base: baseCurrency,
      target: targetCurrency,
      start_date: startDate,
      end_date: endDate,
    }),
    [baseCurrency, targetCurrency, startDate, endDate]
  );

  const {
    data: trendsData,
    isLoading: isLoadingTrends,
    error: trendsError,
    refetch: refetchTrends,
    isFetching: isFetchingTrends,
  } = useTrends(trendParams);

  const {
    data: analyticsData,
    isLoading: isLoadingAnalytics,
    error: analyticsError,
    refetch: refetchAnalytics,
  } = useSystemAnalytics();

  const chartData = useMemo(() => {
    if (!trendsData?.trends) return [];
    return trendsData.trends.map((item) => ({
      date: new Date(item.timestamp).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      }),
      rate: Number(item.rate.toFixed(5)),
      timestamp: item.timestamp,
    }));
  }, [trendsData]);

  const stats = trendsData?.stats;

  const formatStatValue = (val: number, isCurrency = false) => {
    if (isCurrency) {
      return val.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
    }
    return val.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 5,
    });
  };

  const formatPercentage = (val: number) => {
    const prefix = val > 0 ? '+' : '';
    return `${prefix}${val.toFixed(2)}%`;
  };

  const volumeEntries = useMemo(() => {
    if (!analyticsData?.total_volume_by_currency) return [];
    return Object.entries(analyticsData.total_volume_by_currency)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 8);
  }, [analyticsData]);

  const popularPairs = analyticsData?.popular_pairs || [];

  return (
    <div className="space-y-6">
      <div className="dashboard-page-title">
        <h1>Analytics</h1>
        <p>Track exchange rate trends, view statistics, and explore platform-wide conversion data.</p>
      </div>

      {/* Filters Row */}
      <AnimatedCard delay={0}>
        <div className="analytics-filters">
          <div className="analytics-filters__pair">
            <span className="analytics-filters__label">Currency Pair</span>
            <div className="analytics-filters__selectors">
              <CurrencySelector
                value={baseCurrency}
                onChange={setBaseCurrency}
                exclude={[targetCurrency]}
              />
              <button
                type="button"
                className="analytics-filters__swap"
                onClick={() => {
                  const b = baseCurrency;
                  const t = targetCurrency;
                  setBaseCurrency(t);
                  setTargetCurrency(b);
                }}
                aria-label="Swap currencies"
              >
                <ArrowRightLeft size={16} />
              </button>
              <CurrencySelector
                value={targetCurrency}
                onChange={setTargetCurrency}
                exclude={[baseCurrency]}
              />
            </div>
          </div>

          <div className="analytics-filters__date">
            <span className="analytics-filters__label">Date Range</span>
            <div className="analytics-filters__dates">
              {!useCustomDates && (
                <div className="analytics-filters__presets">
                  {PRESETS.map((preset) => (
                    <button
                      key={preset.days}
                      type="button"
                      className={`analytics-filters__preset ${
                        activePreset === preset.days && !useCustomDates
                          ? 'analytics-filters__preset--active'
                          : ''
                      }`}
                      onClick={() => {
                        setActivePreset(preset.days);
                        setUseCustomDates(false);
                      }}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              )}
              <div className="analytics-filters__custom-dates">
                <Calendar size={14} className="text-slate-400 flex-shrink-0" />
                <input
                  type="date"
                  value={useCustomDates ? customStart : formatDate(defaultStartDate)}
                  onChange={(e) => {
                    setCustomStart(e.target.value);
                    setUseCustomDates(true);
                  }}
                  className="analytics-filters__date-input"
                  aria-label="Start date"
                />
                <span className="text-slate-300 text-xs">to</span>
                <input
                  type="date"
                  value={useCustomDates ? customEnd : formatDate(defaultEndDate)}
                  onChange={(e) => {
                    setCustomEnd(e.target.value);
                    setUseCustomDates(true);
                  }}
                  className="analytics-filters__date-input"
                  aria-label="End date"
                />
                {useCustomDates && (
                  <button
                    type="button"
                    className="analytics-filters__clear-dates"
                    onClick={() => {
                      setUseCustomDates(false);
                      setCustomStart('');
                      setCustomEnd('');
                    }}
                    aria-label="Reset to preset"
                  >
                    Reset
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </AnimatedCard>

      {/* Statistics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {isLoadingTrends ? (
          <>
            {Array.from({ length: 4 }).map((_, i) => (
              <AnimatedCard key={i} delay={i * 50}>
                <CardSkeleton />
              </AnimatedCard>
            ))}
          </>
        ) : trendsError ? (
          <AnimatedCard delay={0} className="col-span-2 md:col-span-4">
            <div className="analytics-error">
              <AlertTriangle size={20} className="text-rose-400" />
              <div>
                <p className="font-semibold text-rose-700">Failed to load trend statistics</p>
                <p className="text-xs text-rose-500">{trendsError.message}</p>
              </div>
              <button
                type="button"
                onClick={() => refetchTrends()}
                className="analytics-error__retry"
              >
                <RefreshCw size={14} /> Retry
              </button>
            </div>
          </AnimatedCard>
        ) : stats ? (
          <>
            <AnimatedCard delay={0}>
              <StatCard
                label="Average Rate"
                value={formatStatValue(stats.average_rate)}
                icon={<BarChart3 size={16} />}
              />
            </AnimatedCard>
            <AnimatedCard delay={50}>
              <StatCard
                label="Highest Rate"
                value={formatStatValue(stats.max_rate)}
                icon={<TrendingUp size={16} />}
                positive
              />
            </AnimatedCard>
            <AnimatedCard delay={100}>
              <StatCard
                label="Lowest Rate"
                value={formatStatValue(stats.min_rate)}
                icon={<TrendingDown size={16} />}
                negative
              />
            </AnimatedCard>
            <AnimatedCard delay={150}>
              <StatCard
                label="Period Change"
                value={formatPercentage(stats.percentage_change)}
                icon={
                  stats.percentage_change > 0 ? (
                    <TrendingUp size={16} />
                  ) : stats.percentage_change < 0 ? (
                    <TrendingDown size={16} />
                  ) : (
                    <Minus size={16} />
                  )
                }
                positive={stats.percentage_change > 0}
                negative={stats.percentage_change < 0}
              />
            </AnimatedCard>
          </>
        ) : null}
      </div>

      {/* Trend Chart */}
      <AnimatedCard delay={200}>
        <div className="analytics-chart-header">
          <h2 className="glass-widget__title mb-0">
            <TrendingUp size={16} />
            Rate Trend: {baseCurrency} / {targetCurrency}
          </h2>
          {isFetchingTrends && !isLoadingTrends && (
            <RefreshCw size={14} className="animate-spin text-teal-500" />
          )}
        </div>

        {isLoadingTrends ? (
          <div className="analytics-chart-skeleton">
            <CardSkeleton />
          </div>
        ) : trendsError ? (
          <div className="analytics-chart-error">
            <AlertTriangle size={24} className="text-rose-300" />
            <p className="text-sm text-rose-600 font-semibold">Unable to load trend data</p>
            <p className="text-xs text-slate-400">{trendsError.message}</p>
            <button
              type="button"
              onClick={() => refetchTrends()}
              className="analytics-error__retry"
            >
              <RefreshCw size={14} /> Retry
            </button>
          </div>
        ) : chartData.length === 0 ? (
          <div className="analytics-chart-empty">
            <BarChart3 size={32} className="text-slate-300" />
            <p className="text-sm text-slate-400 font-medium">
              No trend data available for this pair and date range.
            </p>
          </div>
        ) : (
          <div className="analytics-chart">
            <ResponsiveContainer width="100%" height={340}>
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="rateGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0d7380" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#0d7380" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11, fill: '#94a3b8' }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  domain={['auto', 'auto']}
                  tick={{ fontSize: 11, fill: '#94a3b8' }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v: number) => v.toFixed(4)}
                  width={70}
                />
                <Tooltip
                  content={
                    <ChartTooltip base={baseCurrency} target={targetCurrency} />
                  }
                />
                <Area
                  type="monotone"
                  dataKey="rate"
                  stroke="#0d7380"
                  strokeWidth={2}
                  fill="url(#rateGradient)"
                  dot={false}
                  activeDot={{ r: 5, fill: '#0d7380', stroke: '#fff', strokeWidth: 2 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </AnimatedCard>

      {/* Bottom Row: Popular Pairs + Volume */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Popular Pairs Table */}
        <AnimatedCard delay={300}>
          <h2 className="glass-widget__title">
            <ArrowRightLeft size={16} /> Most Popular Pairs
          </h2>
          {isLoadingAnalytics ? (
            <CardSkeleton />
          ) : analyticsError ? (
            <div className="analytics-error">
              <AlertTriangle size={18} className="text-rose-400" />
              <div>
                <p className="font-semibold text-rose-700 text-sm">Failed to load</p>
                <p className="text-xs text-rose-500">{analyticsError.message}</p>
              </div>
              <button
                type="button"
                onClick={() => refetchAnalytics()}
                className="analytics-error__retry"
              >
                <RefreshCw size={14} /> Retry
              </button>
            </div>
          ) : popularPairs.length === 0 ? (
            <div className="analytics-chart-empty">
              <ArrowRightLeft size={24} className="text-slate-300" />
              <p className="text-sm text-slate-400">No popular pair data available.</p>
            </div>
          ) : (
            <div className="custom-table-container">
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Pair</th>
                    <th>Conversions</th>
                    <th>Volume</th>
                  </tr>
                </thead>
                <tbody>
                  {popularPairs.map((pair, idx) => (
                    <tr key={`${pair.from_currency}-${pair.to_currency}`}>
                      <td>
                        <span
                          className="analytics-pair-rank"
                          style={{ background: PAIR_COLORS[idx % PAIR_COLORS.length] + '15', color: PAIR_COLORS[idx % PAIR_COLORS.length] }}
                        >
                          {idx + 1}
                        </span>
                      </td>
                      <td className="font-bold text-slate-700">
                        {pair.from_currency} / {pair.to_currency}
                      </td>
                      <td className="tabular-nums font-semibold text-slate-500">
                        {pair.count.toLocaleString()}
                      </td>
                      <td className="tabular-nums font-semibold text-teal-800">
                        ${pair.total_amount.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </AnimatedCard>

        {/* Volume by Currency Chart */}
        <AnimatedCard delay={400}>
          <h2 className="glass-widget__title">
            <Coins size={16} /> Volume by Currency
          </h2>
          {isLoadingAnalytics ? (
            <CardSkeleton />
          ) : analyticsError ? (
            <div className="analytics-error">
              <AlertTriangle size={18} className="text-rose-400" />
              <div>
                <p className="font-semibold text-rose-700 text-sm">Failed to load</p>
                <p className="text-xs text-rose-500">{analyticsError.message}</p>
              </div>
              <button
                type="button"
                onClick={() => refetchAnalytics()}
                className="analytics-error__retry"
              >
                <RefreshCw size={14} /> Retry
              </button>
            </div>
          ) : volumeEntries.length === 0 ? (
            <div className="analytics-chart-empty">
              <Coins size={24} className="text-slate-300" />
              <p className="text-sm text-slate-400">No volume data available.</p>
            </div>
          ) : (
            <div className="analytics-chart">
              <ResponsiveContainer width="100%" height={280}>
                <BarChart
                  data={volumeEntries.map(([currency, volume]) => ({
                    currency,
                    volume: Number(volume.toFixed(0)),
                  }))}
                  margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                  <XAxis
                    dataKey="currency"
                    tick={{ fontSize: 11, fill: '#94a3b8' }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: '#94a3b8' }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`}
                    width={50}
                  />
                  <Tooltip
                    formatter={(value: number) => [
                      `$${value.toLocaleString()}`,
                      'Volume',
                    ]}
                    contentStyle={{
                      background: 'rgba(255,255,255,0.95)',
                      border: '1px solid #e2e8f0',
                      borderRadius: '12px',
                      fontSize: '12px',
                      fontWeight: 600,
                    }}
                  />
                  <Bar dataKey="volume" radius={[6, 6, 0, 0]} maxBarSize={48}>
                    {volumeEntries.map((_, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={PAIR_COLORS[index % PAIR_COLORS.length]}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </AnimatedCard>
      </div>

      {/* Total Conversions Summary */}
      <AnimatedCard delay={500}>
        <div className="analytics-summary">
          <div className="analytics-summary__item">
            <Hash size={18} className="text-teal-600" />
            <div>
              <span className="analytics-summary__value">
                {isLoadingAnalytics ? (
                  <span className="inline-block w-16 h-5 bg-slate-200 animate-pulse rounded" />
                ) : (
                  analyticsData?.total_conversions.toLocaleString() ?? '0'
                )}
              </span>
              <span className="analytics-summary__label">Total Conversions</span>
            </div>
          </div>
          <div className="analytics-summary__item">
            <BarChartIcon size={18} className="text-amber-600" />
            <div>
              <span className="analytics-summary__value">
                {isLoadingAnalytics ? (
                  <span className="inline-block w-16 h-5 bg-slate-200 animate-pulse rounded" />
                ) : (
                  analyticsData?.popular_pairs.length.toString() ?? '0'
                )}
              </span>
              <span className="analytics-summary__label">Unique Pairs Tracked</span>
            </div>
          </div>
          <div className="analytics-summary__item">
            <Coins size={18} className="text-purple-600" />
            <div>
              <span className="analytics-summary__value">
                {isLoadingAnalytics ? (
                  <span className="inline-block w-16 h-5 bg-slate-200 animate-pulse rounded" />
                ) : (
                  `$${Object.values(analyticsData?.total_volume_by_currency || {}).reduce((a, b) => a + b, 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`
                )}
              </span>
              <span className="analytics-summary__label">Total Platform Volume</span>
            </div>
          </div>
        </div>
      </AnimatedCard>
    </div>
  );
}
