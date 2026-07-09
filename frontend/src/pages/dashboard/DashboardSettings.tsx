import { useState } from 'react';
import { Shield, Sparkles, User, Volume2 } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../auth/AuthContext';
import { usersApi } from '../../api/endpoints/users';
import { AnimatedCard } from '../../components/ui/AnimatedCard';
import { ApiError } from '../../api/errors';

export function DashboardSettings() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'profile' | 'security' | 'preferences'>('profile');
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [firstName, setFirstName] = useState(user?.first_name || '');
  const [lastName, setLastName] = useState(user?.last_name || '');

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [defaultCurrency, setDefaultCurrency] = useState('USD');
  const [isDarkMode, setIsDarkMode] = useState(() => document.documentElement.classList.contains('dark'));
  const [prefAlerts, setPrefAlerts] = useState(true);
  const [prefWeekly, setPrefWeekly] = useState(false);
  const [prefLogins, setPrefLogins] = useState(true);

  const updateProfile = useMutation({
    mutationFn: () => usersApi.updateProfile({ first_name: firstName, last_name: lastName }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auth', 'me'] });
      showNotification('Profile information updated successfully!');
    },
    onError: (err: ApiError) => showNotification(err.message || 'Failed to update profile.', true),
  });

  const changePassword = useMutation({
    mutationFn: () => usersApi.changePassword({
      current_password: currentPassword,
      new_password: newPassword,
    }),
    onSuccess: () => {
      showNotification('Password updated successfully!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    },
    onError: (err: ApiError) => showNotification(err.message || 'Failed to update password.', true),
  });

  const showNotification = (msg: string, isError = false) => {
    if (isError) {
      setErrorMsg(msg);
      setSuccessMsg(null);
    } else {
      setSuccessMsg(msg);
      setErrorMsg(null);
    }
    setTimeout(() => { setSuccessMsg(null); setErrorMsg(null); }, 4000);
  };

  const handleProfileSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateProfile.mutate();
  };

  const handleSecuritySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 8) {
      showNotification('New password must be at least 8 characters long.', true);
      return;
    }
    if (newPassword !== confirmPassword) {
      showNotification('Passwords do not match. Please verify.', true);
      return;
    }
    changePassword.mutate();
  };

  const handleToggleTheme = () => {
    const nextDark = !isDarkMode;
    setIsDarkMode(nextDark);
    document.documentElement.classList.toggle('dark', nextDark);
    showNotification(`${nextDark ? 'Dark' : 'Light'} theme activated.`);
  };

  const handlePreferencesSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    showNotification('System preferences saved.');
  };

  return (
    <div className="space-y-6">
      <div className="dashboard-page-title">
        <h1>Account Settings</h1>
        <p>Manage your login credentials, user profile data, and notification rules.</p>
      </div>

      {(successMsg || errorMsg) && (
        <div className={`p-4 rounded-xl flex items-center gap-3 animate-in fade-in slide-in-from-top-3 duration-300 ${successMsg ? 'bg-teal-50 border border-teal-200 text-teal-800' : 'bg-red-50 border border-red-200 text-red-800'}`}>
          {successMsg ? <Sparkles className="text-teal-600 flex-shrink-0" size={18} /> : <Shield className="text-red-600 flex-shrink-0" size={18} />}
          <span className="text-sm font-semibold">{successMsg || errorMsg}</span>
        </div>
      )}

      <div className="flex border-b border-slate-200 gap-6 overflow-x-auto">
        {([
          { key: 'profile' as const, label: 'User Profile', icon: User },
          { key: 'security' as const, label: 'Password & Security', icon: Shield },
          { key: 'preferences' as const, label: 'System Preferences', icon: Volume2 },
        ]).map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            type="button"
            onClick={() => setActiveTab(key)}
            className={`pb-3 text-sm font-bold border-b-2 transition-all whitespace-nowrap cursor-pointer ${
              activeTab === key ? 'border-teal-600 text-teal-700' : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <span className="flex items-center gap-2"><Icon size={16} /> {label}</span>
          </button>
        ))}
      </div>

      <AnimatedCard delay={0} className="p-6">
        {activeTab === 'profile' && (
          <form className="space-y-6 max-w-lg" onSubmit={handleProfileSubmit}>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="first-name" className="block text-xs font-bold text-slate-600 mb-1.5">First Name</label>
                <input id="first-name" type="text" className="w-full h-11 px-3 border border-slate-200 rounded-xl bg-white/70 focus:outline-none focus:border-teal-600 focus:ring-4 focus:ring-teal-500/10 font-semibold" value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
              </div>
              <div>
                <label htmlFor="last-name" className="block text-xs font-bold text-slate-600 mb-1.5">Last Name</label>
                <input id="last-name" type="text" className="w-full h-11 px-3 border border-slate-200 rounded-xl bg-white/70 focus:outline-none focus:border-teal-600 focus:ring-4 focus:ring-teal-500/10 font-semibold" value={lastName} onChange={(e) => setLastName(e.target.value)} required />
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-400 mb-1.5">Email Address (Read-only)</label>
              <input type="email" className="w-full h-11 px-3 border border-slate-200 rounded-xl bg-slate-50/70 text-slate-400 font-semibold cursor-not-allowed" value={user?.email || ''} readOnly />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-400 mb-1.5">Access Credentials</label>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-teal-50 border border-teal-200 rounded-lg text-xs font-bold text-teal-800 uppercase tracking-wider">
                Role: {user?.role || 'user'}
              </div>
            </div>
            <button type="submit" disabled={updateProfile.isPending} className="h-11 px-6 bg-slate-800 text-white font-bold rounded-xl hover:bg-teal-700 transition-colors shadow-md disabled:opacity-50 cursor-pointer">
              {updateProfile.isPending ? 'Saving...' : 'Save Profile Info'}
            </button>
          </form>
        )}

        {activeTab === 'security' && (
          <form className="space-y-6 max-w-lg" onSubmit={handleSecuritySubmit}>
            <div>
              <label htmlFor="curr-pass" className="block text-xs font-bold text-slate-600 mb-1.5">Current Password</label>
              <input id="curr-pass" type="password" className="w-full h-11 px-3 border border-slate-200 rounded-xl bg-white/70 focus:outline-none focus:border-teal-600 focus:ring-4 focus:ring-teal-500/10" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required />
            </div>
            <div>
              <label htmlFor="new-pass" className="block text-xs font-bold text-slate-600 mb-1.5">New Password</label>
              <input id="new-pass" type="password" className="w-full h-11 px-3 border border-slate-200 rounded-xl bg-white/70 focus:outline-none focus:border-teal-600 focus:ring-4 focus:ring-teal-500/10" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required />
            </div>
            <div>
              <label htmlFor="confirm-pass" className="block text-xs font-bold text-slate-600 mb-1.5">Confirm New Password</label>
              <input id="confirm-pass" type="password" className="w-full h-11 px-3 border border-slate-200 rounded-xl bg-white/70 focus:outline-none focus:border-teal-600 focus:ring-4 focus:ring-teal-500/10" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required />
            </div>
            <button type="submit" disabled={changePassword.isPending} className="h-11 px-6 bg-slate-800 text-white font-bold rounded-xl hover:bg-teal-700 transition-colors shadow-md disabled:opacity-50 cursor-pointer">
              {changePassword.isPending ? 'Updating...' : 'Update Credentials'}
            </button>
          </form>
        )}

        {activeTab === 'preferences' && (
          <form className="space-y-6 max-w-lg" onSubmit={handlePreferencesSubmit}>
            <div className="flex items-center justify-between p-3 bg-white/40 border border-slate-200/50 rounded-xl">
              <div>
                <span className="text-sm font-bold text-slate-700 block">Dark Mode</span>
                <span className="text-xs text-slate-500">Toggle dark styling override.</span>
              </div>
              <button type="button" onClick={handleToggleTheme} className={`w-12 h-7 flex items-center rounded-full p-0.5 transition-colors ${isDarkMode ? 'bg-teal-600' : 'bg-slate-300'}`} aria-label="Toggle dark mode theme">
                <span className={`bg-white w-6 h-6 rounded-full shadow-md transform transition-transform ${isDarkMode ? 'translate-x-5' : 'translate-x-0'}`} />
              </button>
            </div>
            <div>
              <label htmlFor="def-curr" className="block text-xs font-bold text-slate-600 mb-1.5">Default Currency Pair Quote</label>
              <select id="def-curr" className="w-full h-11 px-3 border border-slate-200 rounded-xl bg-white/70 font-bold focus:outline-none focus:border-teal-600" value={defaultCurrency} onChange={(e) => setDefaultCurrency(e.target.value)}>
                <option value="USD">USD - US Dollar</option>
                <option value="EUR">EUR - Euro</option>
                <option value="GBP">GBP - British Pound</option>
                <option value="JPY">JPY - Japanese Yen</option>
              </select>
            </div>
            <div className="space-y-3">
              <span className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Email Notification Rules</span>
              {[
                { label: 'Rate Alert Crossing', desc: 'Trigger on fav monitored pairs limits.', value: prefAlerts, toggle: () => setPrefAlerts(!prefAlerts) },
                { label: 'Weekly Summary Report', desc: 'Receive transaction aggregates.', value: prefWeekly, toggle: () => setPrefWeekly(!prefWeekly) },
                { label: 'New Device Alerts', desc: 'Notify immediately on suspicious session creation.', value: prefLogins, toggle: () => setPrefLogins(!prefLogins) },
              ].map(({ label, desc, value, toggle }) => (
                <div key={label} className="flex items-center justify-between p-3 bg-white/40 border border-slate-200/50 rounded-xl">
                  <div>
                    <span className="text-xs font-bold text-slate-700 block">{label}</span>
                    <span className="text-[10px] text-slate-400">{desc}</span>
                  </div>
                  <button type="button" onClick={toggle} className={`w-10 h-6 flex items-center rounded-full p-0.5 transition-colors ${value ? 'bg-teal-600' : 'bg-slate-300'}`} aria-label={`Toggle ${label}`}>
                    <span className={`bg-white w-5 h-5 rounded-full shadow-md transform transition-transform ${value ? 'translate-x-4' : 'translate-x-0'}`} />
                  </button>
                </div>
              ))}
            </div>
            <button type="submit" className="h-11 px-6 bg-slate-800 text-white font-bold rounded-xl hover:bg-teal-700 transition-colors shadow-md cursor-pointer">Save Preferences</button>
          </form>
        )}
      </AnimatedCard>
    </div>
  );
}
