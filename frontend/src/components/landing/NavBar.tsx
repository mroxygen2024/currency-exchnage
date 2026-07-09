import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRightLeft, LayoutDashboard, LogOut, Menu, X } from 'lucide-react';
import { useAuth } from '../../auth/AuthContext';

export function NavBar() {
  const { isAuthenticated, logout } = useAuth();
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleLogout = async () => {
    await logout();
    window.location.href = '/';
  };

  return (
    <>
      <a href="#main-content" className="sr-only">
        Skip to main content
      </a>

      <header className={`nav-header ${isScrolled ? 'nav-header--scrolled' : ''}`}>
        <div className="nav-container">
          <Link to="/" className="nav-logo" aria-label="AeroExchange Home">
            <ArrowRightLeft size={24} />
            <span>AeroExchange</span>
          </Link>

          <nav className="nav-menu" aria-label="Desktop Navigation">
            <a href="#rates" className="nav-link">Rates</a>
            <a href="#features" className="nav-link">Features</a>
            <a href="#faq" className="nav-link">FAQ</a>
          </nav>

          <div className="nav-actions">
            {isAuthenticated ? (
              <>
                <Link to="/dashboard" className="primary-button nav-actions__dashboard btn-signup">
                  <LayoutDashboard size={16} />
                  Dashboard
                </Link>
                <button
                  type="button"
                  className="secondary-button btn-login"
                  onClick={handleLogout}
                  aria-label="Log out"
                >
                  <LogOut size={16} />
                  Log out
                </button>
              </>
            ) : (
              <>
                <Link to="/auth/login" className="btn-login">
                  Sign In
                </Link>
                <Link to="/auth/register" className="primary-button btn-signup">
                  Get Started
                </Link>
              </>
            )}
          </div>

          <button
            type="button"
            className="hamburger-btn"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            aria-expanded={isMobileMenuOpen}
            aria-label="Toggle navigation menu"
          >
            {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </header>

      <div
        className={`mobile-nav-drawer ${isMobileMenuOpen ? 'mobile-nav-drawer--open' : ''}`}
        aria-hidden={!isMobileMenuOpen}
      >
        <nav aria-label="Mobile Navigation" onClick={() => setIsMobileMenuOpen(false)}>
          <ul className="nav-menu">
            <li><a href="#rates" className="nav-link">Rates</a></li>
            <li><a href="#features" className="nav-link">Features</a></li>
            <li><a href="#faq" className="nav-link">FAQ</a></li>
          </ul>
        </nav>

        <div className="nav-actions" onClick={() => setIsMobileMenuOpen(false)}>
          {isAuthenticated ? (
            <>
              <Link to="/dashboard" className="primary-button btn-signup">
                <LayoutDashboard size={18} />
                Go to Dashboard
              </Link>
              <button type="button" className="secondary-button btn-login" onClick={handleLogout}>
                <LogOut size={18} />
                Log out
              </button>
            </>
          ) : (
            <>
              <Link to="/auth/login" className="btn-login">Sign In</Link>
              <Link to="/auth/register" className="primary-button btn-signup">Create Account</Link>
            </>
          )}
        </div>
      </div>
    </>
  );
}
