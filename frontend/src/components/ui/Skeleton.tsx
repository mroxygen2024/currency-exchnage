import { cn } from '@/lib/utils';

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      className={cn('animate-pulse rounded-md bg-slate-200/70', className)}
      aria-hidden="true"
    />
  );
}

export function CardSkeleton() {
  return (
    <div className="glass-widget animate-pulse" aria-hidden="true">
      <div className="flex items-center gap-2 mb-4">
        <Skeleton className="h-4 w-4 rounded-full" />
        <Skeleton className="h-4 w-32" />
      </div>
      <Skeleton className="h-8 w-48 mb-3" />
      <div className="space-y-2">
        <Skeleton className="h-10 w-full rounded-xl" />
        <Skeleton className="h-10 w-full rounded-xl" />
        <Skeleton className="h-10 w-3/4 rounded-xl" />
      </div>
    </div>
  );
}

export function TableSkeleton({ rows = 4, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="custom-table-container">
      <table className="custom-table" aria-hidden="true">
        <thead>
          <tr>
            {Array.from({ length: cols }).map((_, i) => (
              <th key={i}>
                <Skeleton className="h-3 w-16" />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, r) => (
            <tr key={r}>
              {Array.from({ length: cols }).map((_, c) => (
                <td key={c}>
                  <Skeleton className="h-4 w-full max-w-[120px]" />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function SparklineSkeleton() {
  return <Skeleton className="h-10 w-[100px] rounded" />;
}

export function ListSkeleton({ items = 3 }: { items?: number }) {
  return (
    <div className="space-y-3" aria-hidden="true">
      {Array.from({ length: items }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 p-3">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function WidgetSkeleton() {
  return (
    <div className="glass-widget animate-pulse" aria-hidden="true">
      <Skeleton className="h-5 w-40 mb-4" />
      <Skeleton className="h-12 w-full mb-3" />
      <Skeleton className="h-10 w-full mb-2" />
      <Skeleton className="h-10 w-3/4" />
    </div>
  );
}

export function StatCardSkeleton() {
  return (
    <div className="glass-widget animate-pulse" aria-hidden="true">
      <Skeleton className="h-8 w-8 rounded-lg mb-3" />
      <Skeleton className="h-3 w-16 mb-2" />
      <Skeleton className="h-6 w-24" />
    </div>
  );
}
