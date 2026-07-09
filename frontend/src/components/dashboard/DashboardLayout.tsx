import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  ArrowRightLeft,
  Bell,
  ChevronDown,
  History,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings,
  Star,
  User,
  X,
  AlertTriangle,
} from 'lucide-react';

import { useAuth } from '../../auth/AuthContext';
import { useNotificationSubscriptions } from '../../hooks/useNotifications';
import '../../pages/dashboard/Dashboard.css';

export function DashboardLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);

  const { data: subscriptions, isLoading: notifLoading } = useNotificationSubscriptions();

  const notifications = (subscriptions || []).map((sub) => ({
    id: String(sub.id),
    title: `${sub.base_currency}/${sub.target_currency} ${sub.condition} ${sub.threshold}`,
    desc: sub.is_active ? 'Active alert rule' : 'Inactive alert rule',
    time: new Date(sub.created_at).toLocaleDateString(),
    unread: sub.is_active,
  }));

  const notificationsRef = useRef<HTMLDivElement>(null);
  const profileMenuRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        notificationsRef.current &&
        !notificationsRef.current.contains(event.target as Node)
      ) {
        setIsNotificationsOpen(false);
      }
      if (
        profileMenuRef.current &&
        !profileMenuRef.current.contains(event.target as Node)
      ) {
        setIsProfileMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Close mobile sidebar on route change
  useEffect(() => {
    setIsMobileSidebarOpen(false);
  }, [location]);

  const handleLogout = async () => {
    await logout();
    navigate('/', { replace: true });
  };

  const unreadCount = notifications.filter((n) => n.unread).length;

  // Breadcrumbs generator
  const getBreadcrumbs = () => {
    const paths = location.pathname.split('/').filter(Boolean);
    // paths typically: ['dashboard'] or ['dashboard', 'history'] etc.
    return paths.map((path, idx) => {
      const isLast = idx === paths.length - 1;
      const label = path.charAt(0).toUpperCase() + path.slice(1);
      const url = '/' + paths.slice(0, idx + 1).join('/');

      return {
        label,
        url,
        isLast,
      };
    });
  };

  const breadcrumbs = getBreadcrumbs();

  const userInitial = user?.email?.charAt(0).toUpperCase() || 'U';

  const sidebarContent = (
    <>
      <Link to="/" className="dashboard-sidebar__logo" aria-label="AeroExchange Home">
        <ArrowRightLeft size={24} />
        <span>AeroExchange</span>
      </Link>

      <nav className="dashboard-sidebar__nav" aria-label="Dashboard Navigation">
        <NavLink
          to="/dashboard"
          end
          className={({ isActive }) =>
            `dashboard-sidebar__link ${isActive ? 'dashboard-sidebar__link--active' : ''}`
          }
        >
          <LayoutDashboard size={18} />
          Overview
        </NavLink>

        <NavLink
          to="/dashboard/history"
          className={({ isActive }) =>
            `dashboard-sidebar__link ${isActive ? 'dashboard-sidebar__link--active' : ''}`
          }
        >
          <History size={18} />
          Conversions
        </NavLink>

        <NavLink
          to="/dashboard/favorites"
          className={({ isActive }) =>
            `dashboard-sidebar__link ${isActive ? 'dashboard-sidebar__link--active' : ''}`
          }
        >
          <Star size={18} />
          Favorites
        </NavLink>

        <NavLink
          to="/dashboard/settings"
          className={({ isActive }) =>
            `dashboard-sidebar__link ${isActive ? 'dashboard-sidebar__link--active' : ''}`
          }
        >
          <Settings size={18} />
          Settings
        </NavLink>
      </nav>

      <div className="dashboard-sidebar__footer">
        <div className="user-profile-summary">
          <div className="user-profile-summary__avatar">{userInitial}</div>
          <div className="user-profile-summary__info">
            <span className="user-profile-summary__name">
              {user?.first_name ? `${user.first_name} ${user.last_name || ''}` : 'FX Trader'}
            </span>
            <span className="user-profile-summary__email">{user?.email}</span>
          </div>
        </div>
      </div>
    </>
  );

  return (
    <div className="dashboard-container">
      {/* Mobile Sidebar Overlay */}
      {isMobileSidebarOpen && (
        <div
          className="sidebar-overlay"
          onClick={() => setIsMobileSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Desktop & Mobile Sidebar */}
      <aside
        className={`dashboard-sidebar ${isMobileSidebarOpen ? 'dashboard-sidebar--open' : ''}`}
        aria-label="Primary Dashboard Sidebar"
      >
        {/* Mobile Close Button */}
        {isMobileSidebarOpen && (
          <button
            type="button"
            className="absolute top-4 right-4 p-2 text-slate-500 hover:text-slate-800 transition-colors"
            onClick={() => setIsMobileSidebarOpen(false)}
            aria-label="Close sidebar menu"
          >
            <X size={20} />
          </button>
        )}
        {sidebarContent}
      </aside>

      {/* Main Panel Wrapper */}
      <div className="dashboard-main">
        {/* Header */}
        <header className="dashboard-header" aria-label="Dashboard Top Header">
          <div className="dashboard-header__left">
            <button
              type="button"
              className="dashboard-header__toggle"
              onClick={() => setIsMobileSidebarOpen(true)}
              aria-label="Open sidebar menu"
              aria-expanded={isMobileSidebarOpen}
            >
              <Menu size={22} />
            </button>

            {/* Dynamic Breadcrumbs */}
            <nav className="breadcrumbs" aria-label="Breadcrumb Navigation">
              {breadcrumbs.map((crumb, idx) => (
                <span key={crumb.url} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {idx > 0 && <span className="breadcrumbs__separator">/</span>}
                  <Link
                    to={crumb.url}
                    className={`breadcrumbs__item ${crumb.isLast ? 'breadcrumbs__item--active' : ''}`}
                  >
                    {crumb.label}
                  </Link>
                </span>
              ))}
            </nav>
          </div>

          <div className="dashboard-header__right">
            {/* Notifications Dropdown */}
            <div className="dropdown-wrapper" ref={notificationsRef}>
              <button
                type="button"
                className="icon-button"
                onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
                aria-label={`System Notifications (${unreadCount} unread)`}
                aria-expanded={isNotificationsOpen}
              >
                <Bell size={20} />
                {unreadCount > 0 && (
                  <span className="icon-button__badge">{unreadCount}</span>
                )}
              </button>

              {isNotificationsOpen && (
                <div className="glass-dropdown" role="menu">
                  <div className="glass-dropdown__header">
                    <span className="glass-dropdown__title">Notifications</span>
                  </div>
                  <div className="glass-dropdown__list">
                    {notifLoading ? (
                      <div className="glass-dropdown__empty">
                        Loading...
                      </div>
                    ) : notifications.length === 0 ? (
                      <div className="glass-dropdown__empty">
                        <AlertTriangle size={16} className="text-slate-400" />
                        <span>No alert rules configured.</span>
                      </div>
                    ) : (
                      notifications.map((notif) => (
                        <div
                          key={notif.id}
                          className={`glass-dropdown__item ${
                            notif.unread ? 'glass-dropdown__item--unread' : ''
                          }`}
                          role="menuitem"
                        >
                          <div className="glass-dropdown__item-content">
                            <div className="glass-dropdown__item-title">
                              {notif.title}
                            </div>
                            <div className="glass-dropdown__item-desc">
                              {notif.desc}
                            </div>
                            <span className="glass-dropdown__item-time">
                              {notif.time}
                            </span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Profile Dropdown */}
            <div className="dropdown-wrapper" ref={profileMenuRef}>
              <button
                type="button"
                className="header-profile-trigger"
                onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
                aria-label="User profile settings menu"
                aria-expanded={isProfileMenuOpen}
              >
                <div className="header-profile-trigger__avatar">{userInitial}</div>
                <span className="header-profile-trigger__name">
                  {user?.first_name || 'FX Trader'}
                </span>
                <ChevronDown size={14} className="text-slate-400" />
              </button>

              {isProfileMenuOpen && (
                <div className="glass-dropdown glass-dropdown--profile" role="menu">
                  <div className="profile-menu-header">
                    <div className="profile-menu-header__email">{user?.email}</div>
                    <div className="profile-menu-header__role">{user?.role || 'user'}</div>
                  </div>
                  
                  <Link
                    to="/dashboard/settings"
                    className="profile-menu-item"
                    role="menuitem"
                    onClick={() => setIsProfileMenuOpen(false)}
                  >
                    <User size={16} />
                    Account Settings
                  </Link>
                  
                  <button
                    type="button"
                    className="profile-menu-item profile-menu-item--logout"
                    role="menuitem"
                    onClick={handleLogout}
                  >
                    <LogOut size={16} />
                    Log Out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Dashboard Content */}
        <main className="dashboard-content" id="dashboard-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
