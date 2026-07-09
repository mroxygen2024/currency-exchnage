import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';

import { useAuth } from '../auth/AuthContext';
import { AuthShell } from '../components/auth/AuthShell';
import { PasswordInput } from '../components/ui/PasswordInput';
import { ApiError } from '../api/errors';
import { loginRequestSchema } from '../api/schemas/auth';
import type { LoginRequest } from '../api/types';

type LocationState = {
  from?: {
    pathname?: string;
  };
};

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, error: authError, clearError } = useAuth();
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginRequest>({
    resolver: zodResolver(loginRequestSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const onSubmit = async (values: LoginRequest) => {
    setIsSubmitting(true);
    setFormError(null);
    clearError();

    try {
      await login(values);
      const state = location.state as LocationState | null;
      navigate(state?.from?.pathname ?? '/', { replace: true });
    } catch (error) {
      if (error instanceof ApiError) {
        setFormError(error.message);
      } else if (error instanceof Error) {
        setFormError(error.message);
      } else {
        setFormError('Login failed. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthShell
      eyebrow="Welcome back"
      title="Sign in to your account"
      description="Access your conversion history, favorites, and portfolio dashboard."
      footer={
        <p>
          Don't have an account? <Link to="/auth/register">Create one now</Link>.
        </p>
      }
    >
      <form className="auth-form" onSubmit={handleSubmit(onSubmit)} noValidate>
        <div>
          <label htmlFor="email">Email address</label>
          <div className="auth-input-wrapper">
            <input
              id="email"
              type="email"
              autoComplete="email"
              aria-invalid={errors.email ? 'true' : 'false'}
              aria-describedby={errors.email ? 'email-error' : undefined}
              placeholder="name@example.com"
              {...register('email')}
            />
          </div>
          {errors.email ? (
            <span id="email-error" className="field-error" role="alert">
              {errors.email.message}
            </span>
          ) : null}
        </div>

        <div>
          <PasswordInput
            id="password"
            label="Password"
            autoComplete="current-password"
            placeholder="Enter your password"
            error={errors.password?.message}
            errorId="password-error"
            {...register('password')}
          />
        </div>

        {(formError || authError) && (
          <div className="form-alert" role="alert" aria-live="polite">
            {formError ?? authError}
          </div>
        )}

        <button type="submit" className="primary-button" disabled={isSubmitting}>
          {isSubmitting ? (
            <>
              <span className="button-spinner" aria-hidden="true" />
              <span>Signing in...</span>
            </>
          ) : (
            'Sign in'
          )}
        </button>
      </form>
    </AuthShell>
  );
}
