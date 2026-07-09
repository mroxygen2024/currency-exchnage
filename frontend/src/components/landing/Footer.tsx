import { Link } from 'react-router-dom';
import { ArrowRightLeft } from 'lucide-react';

export function Footer() {
  return (
    <footer className="footer">
      <div className="footer-container">
        <div className="footer-brand">
          <Link to="/" className="logo">
            <ArrowRightLeft size={24} />
            <span>AeroExchange</span>
          </Link>
          <p>
            Professional currency exchange platform with real-time rates, secure authentication, and comprehensive analytics.
          </p>
        </div>

        <div className="footer-col">
          <h5>Product</h5>
          <ul className="footer-links">
            <li><a href="#rates">Live Rates</a></li>
            <li><a href="#features">Features</a></li>
            <li><a href="#faq">FAQ</a></li>
          </ul>
        </div>

        <div className="footer-col">
          <h5>Account</h5>
          <ul className="footer-links">
            <li><Link to="/auth/login">Sign In</Link></li>
            <li><Link to="/auth/register">Create Account</Link></li>
            <li><Link to="/dashboard">Dashboard</Link></li>
          </ul>
        </div>

        <div className="footer-col">
          <h5>Security</h5>
          <ul className="footer-links">
            <li><span>Encrypted Authentication</span></li>
            <li><span>Secure Session Management</span></li>
            <li><span>Data Protection</span></li>
          </ul>
        </div>
      </div>

      <div className="footer-bottom">
        <p>&copy; {new Date().getFullYear()} AeroExchange. All rights reserved.</p>
        <div className="footer-bottom-links">
          <a href="#">Privacy Policy</a>
          <a href="#">Terms of Service</a>
        </div>
      </div>
    </footer>
  );
}
