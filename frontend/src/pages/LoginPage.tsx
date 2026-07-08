import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';

import { useAuth } from '../auth/AuthContext';
import { AuthShell } from '../components/auth/AuthShell';
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
        setFormError('Login failed.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthShell
      eyebrow="Welcome back"
      title="Sign in to continue"
      description="Use your account to access protected conversion history, favorites, notifications, and profile routes."
      footer={
        <p>
          Need an account? <Link to="/auth/register">Create one here</Link>.
        </p>
      }
    >
      <form className="auth-form" onSubmit={handleSubmit(onSubmit)}>
        <div>
          <label htmlFor="email">Email</label>
          <input id="email" type="email" autoComplete="email" {...register('email')} />
          {errors.email ? <span className="field-error">{errors.email.message}</span> : null}
        </div>

        <div>
          <label htmlFor="password">Password</label>
          <input id="password" type="password" autoComplete="current-password" {...register('password')} />
          {errors.password ? <span className="field-error">{errors.password.message}</span> : null}
        </div>

        {(formError || authError) && <div className="form-alert">{formError ?? authError}</div>}

        <button type="submit" className="primary-button" disabled={isSubmitting}>
          {isSubmitting ? 'Signing in...' : 'Sign in'}
        </button>
      </form>
    </AuthShell>
  );
}