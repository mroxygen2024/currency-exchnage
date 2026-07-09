import type { ReactNode } from 'react';
import { cn } from '../../lib/utils';

interface AnimatedCardProps {
  children: ReactNode;
  className?: string;
  delay?: number;
  badge?: string;
}

export function AnimatedCard({ children, className, delay = 0, badge }: AnimatedCardProps) {
  return (
    <div
      className={cn('glass-widget animate-in fade-in slide-in-from-bottom-3 fill-mode-both', className)}
      style={{ animationDelay: `${delay}ms` }}
    >
      {badge && <span className="glass-widget__badge">{badge}</span>}
      {children}
    </div>
  );
}
