import { NavLink, Outlet } from 'react-router-dom';
import { getRoleLabel, isAdminSession } from '../roles';

const CUSTOMER_NAV_ITEMS = [
  { to: '/map', label: 'Map' },
  { to: '/fleet', label: 'Fleet' },
  { to: '/bookings', label: 'My Bookings' },
  { to: '/cards', label: 'My Cards' },
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

  return (
    <div className="layout-root">
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>
      <header>
        <nav
          className={`app-nav${isAdmin ? ' app-nav--admin' : ''}`}
          aria-label="Main"
        >
          <div className="app-nav__inner">
            <div className="app-nav__brand" aria-hidden="true">
              <span className="app-nav__brand-name">E-Scooter Hire</span>
              <span className="app-nav__brand-mode">{roleLabel}</span>
            </div>
            <div className="app-nav__links">
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    `app-nav__link${isActive ? ' app-nav__link--active' : ''}`
                  }
                >
                  {item.label}
                </NavLink>
              ))}
            </div>
            <button
              type="button"
              className="app-nav__logout secondary"
              onClick={handleLogout}
              aria-label="Log out of your account"
            >
              Logout
            </button>
          </div>
        </nav>
      </header>
      <main id="main-content" tabIndex={-1} className="layout-outlet">
        <Outlet />
      </main>
    </div>
  );
}
