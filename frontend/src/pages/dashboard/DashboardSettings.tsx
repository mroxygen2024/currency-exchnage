import { useState } from 'react';
import { Shield, Sparkles, User, Volume2 } from 'lucide-react';
import { useAuth } from '../../auth/AuthContext';

export function DashboardSettings() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'profile' | 'security' | 'preferences'>('profile');

  // Success message feedback
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Form States - Profile
  const [firstName, setFirstName] = useState(user?.first_name || 'FX');
  const [lastName, setLastName] = useState(user?.last_name || 'Trader');

  // Form States - Security
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Form States - Preferences
  const [defaultCurrency, setDefaultCurrency] = useState('USD');
  const [isDarkMode, setIsDarkMode] = useState(() =>
    document.documentElement.classList.contains('dark')
  );
  const [prefAlerts, setPrefAlerts] = useState(true);
  const [prefWeekly, setPrefWeekly] = useState(false);
  const [prefLogins, setPrefLogins] = useState(true);

  const showNotification = (msg: string, isError = false) => {
    if (isError) {
      setErrorMsg(msg);
      setSuccessMsg(null);
      setTimeout(() => setErrorMsg(null), 4000);
    } else {
      setSuccessMsg(msg);
      setErrorMsg(null);
      setTimeout(() => setSuccessMsg(null), 4000);
    }
  };

  const handleProfileSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Simulate API update
    showNotification('Profile information updated successfully!');
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
    // Simulate API update
    showNotification('Password updated successfully!');
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
  };

  const handleToggleTheme = () => {
    const nextDark = !isDarkMode;
    setIsDarkMode(nextDark);
    if (nextDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    showNotification(`${nextDark ? 'Dark' : 'Light'} theme activated.`);
  };

  const handlePreferencesSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Simulate API update
    showNotification('System preferences saved.');
  };

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="dashboard-page-title">
        <h1>Account Settings</h1>
        <p>Manage your login credentials, user profile data, and notification rules.</p>
      </div>

      {/* Success / Error Banners */}
      {successMsg && (
        <div className="p-4 bg-teal-50 border border-teal-200 text-teal-800 rounded-xl flex items-center gap-3 animate-fade-in">
          <Sparkles className="text-teal-600 flex-shrink-0" size={18} />
          <span className="text-sm font-semibold">{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-800 rounded-xl flex items-center gap-3 animate-fade-in">
          <Shield className="text-red-600 flex-shrink-0" size={18} />
          <span className="text-sm font-semibold">{errorMsg}</span>
        </div>
      )}

      {/* Tab Select Header */}
      <div className="flex border-b border-slate-200 gap-6">
        <button
          type="button"
          onClick={() => setActiveTab('profile')}
          className={`pb-3 text-sm font-bold border-b-2 transition-all ${
            activeTab === 'profile'
              ? 'border-teal-600 text-teal-700'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <span className="flex items-center gap-2">
            <User size={16} /> User Profile
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('security')}
          className={`pb-3 text-sm font-bold border-b-2 transition-all ${
            activeTab === 'security'
              ? 'border-teal-600 text-teal-700'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <span className="flex items-center gap-2">
            <Shield size={16} /> Password &amp; Security
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('preferences')}
          className={`pb-3 text-sm font-bold border-b-2 transition-all ${
            activeTab === 'preferences'
              ? 'border-teal-600 text-teal-700'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <span className="flex items-center gap-2">
            <Volume2 size={16} /> System Preferences
          </span>
        </button>
      </div>

      {/* Tab Contents */}
      <div className="glass-widget p-6">
        {activeTab === 'profile' && (
          <form className="space-y-6 max-w-lg" onSubmit={handleProfileSubmit}>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="first-name" className="block text-xs font-bold text-slate-600 mb-1.5">
                  First Name
                </label>
                <input
                  id="first-name"
                  type="text"
                  className="w-100 h-11 px-3 border border-slate-200 rounded-xl bg-white/70 focus:outline-none focus:border-teal-600 focus:ring-4 focus:ring-teal-500/10 font-semibold"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  required
                />
              </div>
              <div>
                <label htmlFor="last-name" className="block text-xs font-bold text-slate-600 mb-1.5">
                  Last Name
                </label>
                <input
                  id="last-name"
                  type="text"
                  className="w-100 h-11 px-3 border border-slate-200 rounded-xl bg-white/70 focus:outline-none focus:border-teal-600 focus:ring-4 focus:ring-teal-500/10 font-semibold"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  required
                />
              </div>
            </div>

            <div>
              <label htmlFor="email" className="block text-xs font-bold text-slate-400 mb-1.5">
                Email Address (Read-only)
              </label>
              <input
                id="email"
                type="email"
                className="w-100 h-11 px-3 border border-slate-200 rounded-xl bg-slate-50/70 text-slate-400 font-semibold cursor-not-allowed"
                value={user?.email || ''}
                readOnly
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-400 mb-1.5">
                Access Credentials
              </label>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-teal-50 border border-teal-200 rounded-lg text-xs font-bold text-teal-800 uppercase tracking-wider">
                Role: {user?.role || 'user'}
              </div>
            </div>

            <button
              type="submit"
              className="h-11 px-6 bg-slate-800 text-white font-bold rounded-xl hover:bg-teal-700 transition-colors shadow-md"
            >
              Save Profile Info
            </button>
          </form>
        )}

        {activeTab === 'security' && (
          <form className="space-y-6 max-w-lg" onSubmit={handleSecuritySubmit}>
            <div>
              <label htmlFor="curr-pass" className="block text-xs font-bold text-slate-600 mb-1.5">
                Current Password
              </label>
              <input
                id="curr-pass"
                type="password"
                className="w-100 h-11 px-3 border border-slate-200 rounded-xl bg-white/70 focus:outline-none focus:border-teal-600 focus:ring-4 focus:ring-teal-500/10"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
              />
            </div>

            <div>
              <label htmlFor="new-pass" className="block text-xs font-bold text-slate-600 mb-1.5">
                New Password
              </label>
              <input
                id="new-pass"
                type="password"
                className="w-100 h-11 px-3 border border-slate-200 rounded-xl bg-white/70 focus:outline-none focus:border-teal-600 focus:ring-4 focus:ring-teal-500/10"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
              />
            </div>

            <div>
              <label htmlFor="confirm-pass" className="block text-xs font-bold text-slate-600 mb-1.5">
                Confirm New Password
              </label>
              <input
                id="confirm-pass"
                type="password"
                className="w-100 h-11 px-3 border border-slate-200 rounded-xl bg-white/70 focus:outline-none focus:border-teal-600 focus:ring-4 focus:ring-teal-500/10"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            </div>

            <button
              type="submit"
              className="h-11 px-6 bg-slate-800 text-white font-bold rounded-xl hover:bg-teal-700 transition-colors shadow-md"
            >
              Update Credentials
            </button>
          </form>
        )}

        {activeTab === 'preferences' && (
          <form className="space-y-6 max-w-lg" onSubmit={handlePreferencesSubmit}>
            {/* Theme Toggle (Working Action!) */}
            <div className="flex items-center justify-between p-3 bg-white/40 border border-slate-200/50 rounded-xl">
              <div>
                <span className="text-sm font-bold text-slate-700 block">Dark Mode</span>
                <span className="text-xs text-slate-500">Toggle dark styling override.</span>
              </div>
              <button
                type="button"
                onClick={handleToggleTheme}
                className={`w-12 h-7 flex items-center rounded-full p-0.5 transition-colors ${
                  isDarkMode ? 'bg-teal-600' : 'bg-slate-300'
                }`}
                aria-label="Toggle dark mode theme"
              >
                <span
                  className={`bg-white w-6 h-6 rounded-full shadow-md transform transition-transform ${
                    isDarkMode ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            <div>
              <label htmlFor="def-curr" className="block text-xs font-bold text-slate-600 mb-1.5">
                Default Currency Pair Quote
              </label>
              <select
                id="def-curr"
                className="w-100 h-11 px-3 border border-slate-200 rounded-xl bg-white/70 font-bold focus:outline-none focus:border-teal-600"
                value={defaultCurrency}
                onChange={(e) => setDefaultCurrency(e.target.value)}
              >
                <option value="USD">USD - US Dollar</option>
                <option value="EUR">EUR - Euro</option>
                <option value="GBP">GBP - British Pound</option>
                <option value="JPY">JPY - Japanese Yen</option>
              </select>
            </div>

            {/* Email Notification Switch Toggles */}
            <div className="space-y-3">
              <span className="block text-xs font-bold text-slate-500 uppercase tracking-wider">
                Email Notification Rules
              </span>

              <div className="flex items-center justify-between p-3 bg-white/40 border border-slate-200/50 rounded-xl">
                <div>
                  <span className="text-xs font-bold text-slate-700 block">Rate Alert Crossing</span>
                  <span className="text-[10px] text-slate-400">Trigger on fav monitored pairs limits.</span>
                </div>
                <button
                  type="button"
                  onClick={() => setPrefAlerts(!prefAlerts)}
                  className={`w-10 h-6 flex items-center rounded-full p-0.5 transition-colors ${
                    prefAlerts ? 'bg-teal-600' : 'bg-slate-300'
                  }`}
                  aria-label="Toggle rate alert notifications"
                >
                  <span
                    className={`bg-white w-5 h-5 rounded-full shadow-md transform transition-transform ${
                      prefAlerts ? 'translate-x-4' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              <div className="flex items-center justify-between p-3 bg-white/40 border border-slate-200/50 rounded-xl">
                <div>
                  <span className="text-xs font-bold text-slate-700 block">Weekly Summary Report</span>
                  <span className="text-[10px] text-slate-400">Receive transaction aggregates.</span>
                </div>
                <button
                  type="button"
                  onClick={() => setPrefWeekly(!prefWeekly)}
                  className={`w-10 h-6 flex items-center rounded-full p-0.5 transition-colors ${
                    prefWeekly ? 'bg-teal-600' : 'bg-slate-300'
                  }`}
                  aria-label="Toggle weekly summary notifications"
                >
                  <span
                    className={`bg-white w-5 h-5 rounded-full shadow-md transform transition-transform ${
                      prefWeekly ? 'translate-x-4' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              <div className="flex items-center justify-between p-3 bg-white/40 border border-slate-200/50 rounded-xl">
                <div>
                  <span className="text-xs font-bold text-slate-700 block">New Device Alerts</span>
                  <span className="text-[10px] text-slate-400">Notify immediately on suspicious session creation.</span>
                </div>
                <button
                  type="button"
                  onClick={() => setPrefLogins(!prefLogins)}
                  className={`w-10 h-6 flex items-center rounded-full p-0.5 transition-colors ${
                    prefLogins ? 'bg-teal-600' : 'bg-slate-300'
                  }`}
                  aria-label="Toggle security alerts"
                >
                  <span
                    className={`bg-white w-5 h-5 rounded-full shadow-md transform transition-transform ${
                      prefLogins ? 'translate-x-4' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="h-11 px-6 bg-slate-800 text-white font-bold rounded-xl hover:bg-teal-700 transition-colors shadow-md"
            >
              Save Preferences
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
