import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle, Shield, Trash2, User } from 'lucide-react';
import { useAuth } from '../../auth/AuthContext';
import { usersApi } from '../../api/endpoints/users';
import { AnimatedCard } from '../../components/ui/AnimatedCard';
import { ApiError } from '../../api/errors';
import { useNavigate } from 'react-router-dom';

const profileSchema = z.object({
  first_name: z.string().min(1, 'First name is required').max(100, 'First name is too long'),
  last_name: z.string().min(1, 'Last name is required').max(100, 'Last name is too long'),
});

type ProfileFormData = z.infer<typeof profileSchema>;

const passwordSchema = z.object({
  current_password: z.string().min(8, 'Current password must be at least 8 characters'),
  new_password: z.string().min(8, 'New password must be at least 8 characters'),
  confirm_password: z.string().min(8, 'Please confirm your new password'),
}).refine((data) => data.new_password === data.confirm_password, {
  message: 'Passwords do not match',
  path: ['confirm_password'],
}).refine((data) => data.current_password !== data.new_password, {
  message: 'New password must be different from current password',
  path: ['new_password'],
});

type PasswordFormData = z.infer<typeof passwordSchema>;

function DeleteAccountDialog({
  onConfirm,
  onCancel,
  isPending,
}: {
  onConfirm: () => void;
  onCancel: () => void;
  isPending: boolean;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Confirm account deletion"
    >
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onCancel} />

      <div className="relative w-full max-w-sm bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in">
        <div className="px-6 pt-6 pb-4 text-center">
          <div className="mx-auto h-12 w-12 rounded-full bg-red-50 flex items-center justify-center mb-4">
            <AlertTriangle size={22} className="text-red-500" />
          </div>
          <h2 className="text-base font-bold text-slate-800">Delete Account</h2>
          <p className="text-sm text-slate-500 mt-2">
            Are you sure you want to delete your account? This action cannot be undone.
            All your data will be permanently removed.
          </p>
        </div>

        <div className="px-6 pb-6 flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={isPending}
            className="flex-1 h-10 text-xs font-bold border border-slate-200 rounded-xl bg-white hover:bg-slate-50 text-slate-600 transition-colors disabled:opacity-50 cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isPending}
            className="flex-1 h-10 text-xs font-bold rounded-xl bg-red-500 hover:bg-red-600 text-white transition-colors disabled:opacity-50 cursor-pointer"
          >
            {isPending ? 'Deleting...' : 'Delete My Account'}
          </button>
        </div>
      </div>
    </div>
  );
}

export function DashboardSettings() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const userInitial = (user?.first_name || user?.email || 'U')[0].toUpperCase();

  const showNotification = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 4000);
  };

  const profileForm = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      first_name: user?.first_name || '',
      last_name: user?.last_name || '',
    },
  });

  const passwordForm = useForm<PasswordFormData>({
    resolver: zodResolver(passwordSchema),
    defaultValues: {
      current_password: '',
      new_password: '',
      confirm_password: '',
    },
  });

  const updateProfile = useMutation({
    mutationFn: (data: ProfileFormData) => usersApi.updateProfile(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auth', 'me'] });
      showNotification('success', 'Profile information updated successfully!');
    },
    onError: (err: ApiError) => {
      showNotification('error', err.message || 'Failed to update profile.');
    },
  });

  const changePassword = useMutation({
    mutationFn: (data: { current_password: string; new_password: string }) =>
      usersApi.changePassword(data),
    onSuccess: () => {
      showNotification('success', 'Password updated successfully!');
      passwordForm.reset();
    },
    onError: (err: ApiError) => {
      showNotification('error', err.message || 'Failed to update password.');
    },
  });

  const deleteAccount = useMutation({
    mutationFn: () => usersApi.deleteAccount(),
    onSuccess: () => {
      queryClient.clear();
      logout();
      navigate('/', { replace: true });
    },
    onError: (err: ApiError) => {
      showNotification('error', err.message || 'Failed to delete account.');
      setShowDeleteDialog(false);
    },
  });

  const onProfileSubmit = (data: ProfileFormData) => {
    updateProfile.mutate(data);
  };

  const onPasswordSubmit = (data: PasswordFormData) => {
    changePassword.mutate({
      current_password: data.current_password,
      new_password: data.new_password,
    });
  };

  const handleDeleteAccount = () => {
    deleteAccount.mutate();
  };

  return (
    <div className="space-y-6" data-testid="settings-page">
      <div className="dashboard-page-title">
        <h1>Account Settings</h1>
        <p>Manage your profile, password, and account preferences.</p>
      </div>

      {notification && (
        <div
          className={`p-4 rounded-xl flex items-center gap-3 animate-in fade-in slide-in-from-top-3 duration-300 ${
            notification.type === 'success'
              ? 'bg-teal-50 border border-teal-200 text-teal-800'
              : 'bg-red-50 border border-red-200 text-red-800'
          }`}
          data-testid="settings-notification"
        >
          {notification.type === 'success' ? (
            <CheckCircle className="text-teal-600 flex-shrink-0" size={18} />
          ) : (
            <AlertTriangle className="text-red-600 flex-shrink-0" size={18} />
          )}
          <span className="text-sm font-semibold">{notification.message}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <AnimatedCard delay={0} className="p-6" data-testid="profile-section">
            <div className="flex items-center gap-3 mb-6">
              <User size={20} className="text-teal-600" />
              <h2 className="text-lg font-bold text-slate-800">Profile Information</h2>
            </div>

            <form className="space-y-6 max-w-lg" onSubmit={profileForm.handleSubmit(onProfileSubmit)} data-testid="profile-form">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="first-name" className="block text-xs font-bold text-slate-600 mb-1.5">
                    First Name
                  </label>
                  <input
                    id="first-name"
                    type="text"
                    className={`w-full h-11 px-3 border rounded-xl bg-white/70 focus:outline-none focus:border-teal-600 focus:ring-4 focus:ring-teal-500/10 font-semibold ${
                      profileForm.formState.errors.first_name ? 'border-red-300' : 'border-slate-200'
                    }`}
                    {...profileForm.register('first_name')}
                  />
                  {profileForm.formState.errors.first_name && (
                    <p className="text-xs text-red-500 mt-1" data-testid="profile-error">
                      {profileForm.formState.errors.first_name.message}
                    </p>
                  )}
                </div>
                <div>
                  <label htmlFor="last-name" className="block text-xs font-bold text-slate-600 mb-1.5">
                    Last Name
                  </label>
                  <input
                    id="last-name"
                    type="text"
                    className={`w-full h-11 px-3 border rounded-xl bg-white/70 focus:outline-none focus:border-teal-600 focus:ring-4 focus:ring-teal-500/10 font-semibold ${
                      profileForm.formState.errors.last_name ? 'border-red-300' : 'border-slate-200'
                    }`}
                    {...profileForm.register('last_name')}
                  />
                  {profileForm.formState.errors.last_name && (
                    <p className="text-xs text-red-500 mt-1" data-testid="profile-error">
                      {profileForm.formState.errors.last_name.message}
                    </p>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1.5">Email Address (Read-only)</label>
                <input
                  type="email"
                  className="w-full h-11 px-3 border border-slate-200 rounded-xl bg-slate-50/70 text-slate-400 font-semibold cursor-not-allowed"
                  value={user?.email || ''}
                  readOnly
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1.5">Access Credentials</label>
                <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-teal-50 border border-teal-200 rounded-lg text-xs font-bold text-teal-800 uppercase tracking-wider">
                  <Shield size={14} />
                  Role: {user?.role || 'user'}
                </div>
              </div>

              <button
                type="submit"
                disabled={updateProfile.isPending}
                className="h-11 px-6 bg-slate-800 text-white font-bold rounded-xl hover:bg-teal-700 transition-colors shadow-md disabled:opacity-50 cursor-pointer"
                data-testid="profile-submit"
              >
                {updateProfile.isPending ? 'Saving...' : 'Save Profile Info'}
              </button>
            </form>
          </AnimatedCard>

          <AnimatedCard delay={100} className="p-6" data-testid="password-section">
            <div className="flex items-center gap-3 mb-6">
              <Shield size={20} className="text-teal-600" />
              <h2 className="text-lg font-bold text-slate-800">Password & Security</h2>
            </div>

            <form className="space-y-6 max-w-lg" onSubmit={passwordForm.handleSubmit(onPasswordSubmit)} data-testid="password-form">
              <div>
                <label htmlFor="current-password" className="block text-xs font-bold text-slate-600 mb-1.5">
                  Current Password
                </label>
                <input
                  id="current-password"
                  type="password"
                  className={`w-full h-11 px-3 border rounded-xl bg-white/70 focus:outline-none focus:border-teal-600 focus:ring-4 focus:ring-teal-500/10 ${
                    passwordForm.formState.errors.current_password ? 'border-red-300' : 'border-slate-200'
                  }`}
                  {...passwordForm.register('current_password')}
                />
                {passwordForm.formState.errors.current_password && (
                  <p className="text-xs text-red-500 mt-1" data-testid="password-error">
                    {passwordForm.formState.errors.current_password.message}
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="new-password" className="block text-xs font-bold text-slate-600 mb-1.5">
                  New Password
                </label>
                <input
                  id="new-password"
                  type="password"
                  className={`w-full h-11 px-3 border rounded-xl bg-white/70 focus:outline-none focus:border-teal-600 focus:ring-4 focus:ring-teal-500/10 ${
                    passwordForm.formState.errors.new_password ? 'border-red-300' : 'border-slate-200'
                  }`}
                  {...passwordForm.register('new_password')}
                />
                {passwordForm.formState.errors.new_password && (
                  <p className="text-xs text-red-500 mt-1" data-testid="password-error">
                    {passwordForm.formState.errors.new_password.message}
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="confirm-password" className="block text-xs font-bold text-slate-600 mb-1.5">
                  Confirm New Password
                </label>
                <input
                  id="confirm-password"
                  type="password"
                  className={`w-full h-11 px-3 border rounded-xl bg-white/70 focus:outline-none focus:border-teal-600 focus:ring-4 focus:ring-teal-500/10 ${
                    passwordForm.formState.errors.confirm_password ? 'border-red-300' : 'border-slate-200'
                  }`}
                  {...passwordForm.register('confirm_password')}
                />
                {passwordForm.formState.errors.confirm_password && (
                  <p className="text-xs text-red-500 mt-1" data-testid="password-error">
                    {passwordForm.formState.errors.confirm_password.message}
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={changePassword.isPending}
                className="h-11 px-6 bg-slate-800 text-white font-bold rounded-xl hover:bg-teal-700 transition-colors shadow-md disabled:opacity-50 cursor-pointer"
                data-testid="password-submit"
              >
                {changePassword.isPending ? 'Updating...' : 'Update Credentials'}
              </button>
            </form>
          </AnimatedCard>
        </div>

        <div className="space-y-6">
          <AnimatedCard delay={50} className="p-6" data-testid="avatar-card">
            <div className="flex flex-col items-center text-center">
              <div className="w-20 h-20 rounded-full bg-teal-100 border-4 border-teal-200 flex items-center justify-center mb-4">
                <span className="text-2xl font-bold text-teal-700" data-testid="user-avatar">
                  {userInitial}
                </span>
              </div>
              <h3 className="text-base font-bold text-slate-800">
                {user?.first_name || ''} {user?.last_name || ''}
              </h3>
              <p className="text-sm text-slate-500 mt-1">{user?.email || ''}</p>
              <div className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 bg-teal-50 border border-teal-200 rounded-lg text-xs font-bold text-teal-800 uppercase tracking-wider">
                <Shield size={12} />
                {user?.role || 'user'}
              </div>
            </div>
          </AnimatedCard>

          <AnimatedCard delay={150} className="p-6" data-testid="delete-section">
            <div className="flex items-center gap-3 mb-4">
              <Trash2 size={20} className="text-red-500" />
              <h2 className="text-lg font-bold text-slate-800">Delete Account</h2>
            </div>

            <p className="text-sm text-slate-500 mb-6">
              Permanently delete your account and all associated data. This action cannot be undone.
            </p>

            <button
              type="button"
              onClick={() => setShowDeleteDialog(true)}
              className="w-full h-11 px-6 bg-red-500 text-white font-bold rounded-xl hover:bg-red-600 transition-colors shadow-md cursor-pointer"
              data-testid="delete-account-btn"
            >
              <Trash2 size={16} className="inline mr-2" />
              Delete My Account
            </button>
          </AnimatedCard>
        </div>
      </div>

      {showDeleteDialog && (
        <DeleteAccountDialog
          onConfirm={handleDeleteAccount}
          onCancel={() => setShowDeleteDialog(false)}
          isPending={deleteAccount.isPending}
        />
      )}
    </div>
  );
}
