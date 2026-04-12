import { NavLink, Outlet } from 'react-router-dom';

export default function Layout({ onLogout }) {
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
      <nav className="app-nav" aria-label="Main">
        <div className="app-nav__inner">
          <div className="app-nav__links">
            <NavLink
              to="/fleet"
              className={({ isActive }) =>
                `app-nav__link${isActive ? ' app-nav__link--active' : ''}`
              }
            >
              Fleet
            </NavLink>
            <NavLink
              to="/bookings"
              className={({ isActive }) =>
                `app-nav__link${isActive ? ' app-nav__link--active' : ''}`
              }
            >
              My Bookings
            </NavLink>
          </div>
          <button
            type="button"
            className="app-nav__logout secondary"
            onClick={handleLogout}
          >
            Logout
          </button>
        </div>
      </nav>
      <main className="layout-outlet">
        <Outlet />
      </main>
    </div>
  );
}
