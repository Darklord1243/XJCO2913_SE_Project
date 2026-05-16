import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { LogOut, Menu, X, Zap } from 'lucide-react';
import ThemeToggle from './ThemeToggle';
import { getRoleLabel, isAdminSession } from '../roles';

const CUSTOMER_NAV_ITEMS = [
  { to: '/map', label: 'Map' },
  { to: '/fleet', label: 'Fleet' },
  { to: '/bookings', label: 'My Bookings' },
  { to: '/cards', label: 'My Cards' },
  { to: '/profile', label: 'Profile' },
  { to: '/report-issue', label: 'Report Issue' },
];

const ADMIN_NAV_ITEMS = [
  { to: '/admin/bookings', label: 'Bookings' },
  { to: '/admin/fleet', label: 'Fleet Manage' },
  { to: '/admin/issues', label: 'Issues' },
  { to: '/admin/income', label: 'Income' },
];

export default function Layout({ session, onLogout }) {
  const isAdmin = isAdminSession(session);
  const navItems = isAdmin ? ADMIN_NAV_ITEMS : CUSTOMER_NAV_ITEMS;
  const roleLabel = getRoleLabel(session);
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const previous = document.body.getAttribute('data-area');
    document.body.setAttribute('data-area', isAdmin ? 'admin' : 'customer');
    return () => {
      if (previous === null) {
        document.body.removeAttribute('data-area');
      } else {
        document.body.setAttribute('data-area', previous);
      }
    };
  }, [isAdmin]);

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  function handleLogout() {
    if (typeof onLogout !== 'function') {
      console.warn('Layout: onLogout handler is missing or not a function.');
      return;
    }
    try {
      onLogout();
    } catch (error) {
      console.error('Layout: logout handler threw an error.', error);
    }
  }

  function toggleMenu() {
    setMenuOpen((open) => !open);
  }

  return (
    <div className="shell-root">
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>
      <header>
        <nav className="nav" aria-label="Main">
          <div className="nav__inner">
            <div className="nav__brand">
              <span className="nav__brand-mark" aria-hidden="true">
                <Zap size={18} />
              </span>
              <span className="nav__brand-name">E-Scooter Hire</span>
              <span
                className="nav__role"
                aria-label={`Logged in as ${roleLabel}`}
              >
                {roleLabel}
              </span>
            </div>
            <div className="nav__center">
              <div className="nav__links">
                {navItems.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    className={({ isActive }) =>
                      `nav__link${isActive ? ' is-active' : ''}`
                    }
                  >
                    {item.label}
                  </NavLink>
                ))}
              </div>
            </div>
            <div className="nav__actions">
              <ThemeToggle />
              <button
                type="button"
                className="nav__menu-toggle nav__icon-btn"
                onClick={toggleMenu}
                aria-label={
                  menuOpen ? 'Close navigation menu' : 'Open navigation menu'
                }
                aria-expanded={menuOpen}
                aria-controls="nav-drawer"
              >
                {menuOpen ? (
                  <X size={18} aria-hidden="true" />
                ) : (
                  <Menu size={18} aria-hidden="true" />
                )}
              </button>
              <button
                type="button"
                className="nav__logout"
                onClick={handleLogout}
                aria-label="Log out of your account"
              >
                <LogOut size={16} aria-hidden="true" />
                <span>Logout</span>
              </button>
            </div>
          </div>
          <div
            id="nav-drawer"
            className={`nav__drawer${menuOpen ? ' is-open' : ''}`}
            hidden={!menuOpen}
          >
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `nav__drawer-link${isActive ? ' is-active' : ''}`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </div>
        </nav>
      </header>
      <main id="main-content" tabIndex={-1} className="shell-main">
        <Outlet />
      </main>
    </div>
  );
}
