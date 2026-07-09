import { type ReactNode, useCallback } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useFocusTrap, useEscapeKey } from '@/hooks/useFocusTrap';

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'default' | 'destructive';
  icon?: ReactNode;
}

export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
  variant = 'default',
  icon,
}: DialogProps) {
  const trapRef = useFocusTrap(open);
  useEscapeKey(onClose, open);

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) onClose();
    },
    [onClose],
  );

  if (!open) return null;

  return (
    <div
      className="dialog-overlay"
      onClick={handleBackdropClick}
      role="presentation"
    >
      <div
        ref={trapRef}
        className={cn('dialog', `dialog--${size}`)}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="dialog__header">
          <div className="dialog__header-left">
            {icon && <div className="dialog__icon">{icon}</div>}
            <div>
              <h2 className={cn('dialog__title', variant === 'destructive' && 'dialog__title--destructive')}>
                {title}
              </h2>
              {description && <p className="dialog__description">{description}</p>}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="dialog__close"
            aria-label="Close dialog"
          >
            <X size={18} />
          </button>
        </div>

        <div className="dialog__body">{children}</div>

        {footer && <div className="dialog__footer">{footer}</div>}
      </div>
    </div>
  );
}

export function DialogActions({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('dialog__actions', className)}>{children}</div>;
}

export function DialogButton({
  children,
  variant = 'default',
  disabled,
  onClick,
  isLoading,
  type = 'button',
}: {
  children: ReactNode;
  variant?: 'default' | 'primary' | 'destructive' | 'ghost';
  disabled?: boolean;
  onClick?: () => void;
  isLoading?: boolean;
  type?: 'button' | 'submit';
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || isLoading}
      className={cn('dialog-btn', `dialog-btn--${variant}`)}
    >
      {isLoading ? (
        <span className="dialog-btn__spinner" aria-hidden="true" />
      ) : (
        children
      )}
    </button>
  );
}
