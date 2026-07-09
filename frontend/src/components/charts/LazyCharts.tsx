import { lazy, Suspense, type ComponentProps } from 'react';
import { Loader2 } from 'lucide-react';

type AreaChartProps = ComponentProps<typeof import('recharts').AreaChart>;
type BarChartProps = ComponentProps<typeof import('recharts').BarChart>;

function ChartLoader() {
  return (
    <div className="flex items-center justify-center h-[300px] text-slate-400">
      <Loader2 size={24} className="animate-spin" />
    </div>
  );
}

const LazyAreaChart = lazy(() =>
  import('recharts').then((m) => ({
    default: ({ children, ...props }: AreaChartProps) => (
      <m.AreaChart {...props}>{children}</m.AreaChart>
    ),
  }))
);

const LazyBarChart = lazy(() =>
  import('recharts').then((m) => ({
    default: ({ children, ...props }: BarChartProps) => (
      <m.BarChart {...props}>{children}</m.BarChart>
    ),
  }))
);

export {
  LazyAreaChart,
  LazyBarChart,
  ChartLoader,
};

export {
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Bar,
  Cell,
} from 'recharts';
