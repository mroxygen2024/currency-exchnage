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
      <form className="auth-form" onSubmit={handleSubmit(onSubmit)}>
        <div className="two-column">
          <div>
            <label htmlFor="first_name">First name</label>
            <input id="first_name" type="text" autoComplete="given-name" {...register('first_name')} />
            {errors.first_name ? <span className="field-error">{errors.first_name.message}</span> : null}
          </div>

          <div>
            <label htmlFor="last_name">Last name</label>
            <input id="last_name" type="text" autoComplete="family-name" {...register('last_name')} />
            {errors.last_name ? <span className="field-error">{errors.last_name.message}</span> : null}
          </div>
        </div>

        <div>
          <label htmlFor="email">Email</label>
          <input id="email" type="email" autoComplete="email" {...register('email')} />
          {errors.email ? <span className="field-error">{errors.email.message}</span> : null}
        </div>

        <div>
          <label htmlFor="password">Password</label>
          <input id="password" type="password" autoComplete="new-password" {...register('password')} />
          {errors.password ? <span className="field-error">{errors.password.message}</span> : null}
        </div>

        {(formError || authError) && <div className="form-alert">{formError ?? authError}</div>}

        <button type="submit" className="primary-button" disabled={isSubmitting}>
          {isSubmitting ? 'Creating account...' : 'Create account'}
        </button>
      </form>
    </AuthShell>
  );
}