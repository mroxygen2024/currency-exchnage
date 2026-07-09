import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';

import { useAuth } from '../auth/AuthContext';
import { AuthShell } from '../components/auth/AuthShell';
import { ApiError } from '../api/errors';
import { registerRequestSchema } from '../api/schemas/auth';
import type { RegisterRequest } from '../api/types';

export function RegisterPage() {
  const navigate = useNavigate();
  const { register: registerUser, error: authError, clearError } = useAuth();
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterRequest>({
    resolver: zodResolver(registerRequestSchema),
    defaultValues: {
      email: '',
      password: '',
      first_name: '',
      last_name: '',
    },
  });

  const onSubmit = async (values: RegisterRequest) => {
    setIsSubmitting(true);
    setFormError(null);
    clearError();

    try {
      await registerUser(values);
      navigate('/', { replace: true });
    } catch (error) {
      if (error instanceof ApiError) {
        setFormError(error.message);
      } else if (error instanceof Error) {
        setFormError(error.message);
      } else {
        setFormError('Registration failed.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthShell
      eyebrow="Create account"
      title="Register a new session"
      description="Create a profile, sign in immediately, and keep your access token persisted for future visits."
      footer={
        <p>
          Already have an account? <Link to="/auth/login">Sign in</Link>.
        </p>
      }
    >
      <form className="auth-form" onSubmit={handleSubmit(onSubmit)} noValidate>
        <div className="two-column">
          <div>
            <label htmlFor="first_name">First name</label>
            <div className="auth-input-wrapper">
              <input
                id="first_name"
                type="text"
                autoComplete="given-name"
                aria-invalid={errors.first_name ? 'true' : 'false'}
                aria-describedby={errors.first_name ? 'first-name-error' : undefined}
                placeholder="Jane"
                {...register('first_name')}
              />
            </div>
            {errors.first_name ? (
              <span id="first-name-error" className="field-error" role="alert">
                {errors.first_name.message}
              </span>
            ) : null}
          </div>

          <div>
            <label htmlFor="last_name">Last name</label>
            <div className="auth-input-wrapper">
              <input
                id="last_name"
                type="text"
                autoComplete="family-name"
                aria-invalid={errors.last_name ? 'true' : 'false'}
                aria-describedby={errors.last_name ? 'last-name-error' : undefined}
                placeholder="Doe"
                {...register('last_name')}
              />
            </div>
            {errors.last_name ? (
              <span id="last-name-error" className="field-error" role="alert">
                {errors.last_name.message}
              </span>
            ) : null}
          </div>
        </div>

        <div>
          <label htmlFor="email">Email address</label>
          <div className="auth-input-wrapper">
            <input
              id="email"
              type="email"
              autoComplete="email"
              aria-invalid={errors.email ? 'true' : 'false'}
              aria-describedby={errors.email ? 'email-error' : undefined}
              placeholder="jane.doe@example.com"
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
          <label htmlFor="password">Password</label>
          <div className="auth-input-wrapper">
            <input
              id="password"
              type="password"
              autoComplete="new-password"
              aria-invalid={errors.password ? 'true' : 'false'}
              aria-describedby={errors.password ? 'password-error' : undefined}
              placeholder="••••••••"
              {...register('password')}
            />
          </div>
          {errors.password ? (
            <span id="password-error" className="field-error" role="alert">
              {errors.password.message}
            </span>
          ) : null}
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
              <span>Creating account...</span>
            </>
          ) : (
            'Create account'
          )}
        </button>
      </form>
    </AuthShell>
  );
}