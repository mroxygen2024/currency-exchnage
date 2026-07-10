import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { cn } from '../../lib/utils';

interface PasswordInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  errorId?: string;
}

export function PasswordInput({
  label,
  error,
  errorId,
  id,
  className,
  'aria-describedby': ariaDescribedBy,
  ...props
}: PasswordInputProps) {
  const [showPassword, setShowPassword] = useState(false);
  const inputId = id || props.name;

  return (
    <div className="password-input-wrapper">
      {label && (
        <label htmlFor={inputId} className="password-input-label">
          {label}
        </label>
      )}
      <div className="password-input-container">
        <input
          id={inputId}
          type={showPassword ? 'text' : 'password'}
          autoComplete={props.autoComplete || 'current-password'}
          aria-invalid={error ? 'true' : 'false'}
          aria-describedby={error ? errorId || `${inputId}-error` : ariaDescribedBy}
          className={cn('password-input-field', error && 'password-input-field--error', className)}
          {...props}
        />
        <button
          type="button"
          className="password-toggle-btn"
          onClick={() => setShowPassword(!showPassword)}
          aria-label={showPassword ? 'Hide password text' : 'Show password text'}
          tabIndex={0}
        >
          {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
      {error && (
        <span id={errorId || `${inputId}-error`} className="password-input-error" role="alert">
          {error}
        </span>
      )}
    </div>
  );
}
