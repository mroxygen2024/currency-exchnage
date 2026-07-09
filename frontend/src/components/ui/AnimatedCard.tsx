import type { ReactNode } from 'react';
import { cn } from '../../lib/utils';

interface AnimatedCardProps {
  children: ReactNode;
  className?: string;
  delay?: number;
  badge?: string;
  'data-testid'?: string;
}

export function AnimatedCard({ children, className, delay = 0, badge, 'data-testid': testId }: AnimatedCardProps) {
  return (
    <div
      className={cn('glass-widget animate-in fade-in slide-in-from-bottom-3 fill-mode-both', className)}
      style={{ animationDelay: `${delay}ms` }}
      data-testid={testId}
    >
      {badge && <span className="glass-widget__badge">{badge}</span>}
      {children}
    </div>
  );
}
