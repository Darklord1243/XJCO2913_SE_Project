import { useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import AdminBookings from './components/AdminBookings';
import AdminFleet from './components/AdminFleet';
import AdminIssues from './components/AdminIssues';
import AuthManager from './components/AuthManager';
import Income from './components/Income';
import Layout from './components/Layout.jsx';
import MyBookings from './components/MyBookings';
import ReportIssue from './components/ReportIssue';
import SavedCards from './components/SavedCards';
import ScooterList from './components/ScooterList';
import ScooterMap from './components/ScooterMap';
import { isAdminSession } from './roles';
import { clearSession, loadSession, saveSession } from './session';

export default function App() {
  const [session, setSession] = useState(() => loadSession());
  const [bookingRefreshKey, setBookingRefreshKey] = useState(0);

  function handleSessionChange(nextSession) {
    if (nextSession) {
      saveSession(nextSession);
    } else {
      clearSession();
    }

    setSession(nextSession);
  }

  function handleLogout() {
    handleSessionChange(null);
  }

  function handleBookingCreated() {
    setBookingRefreshKey((current) => current + 1);
  }

  const isAdmin = isAdminSession(session);
  const homePath = isAdmin ? '/admin/bookings' : '/map';

  return (
    <BrowserRouter>
      <div className="shell app-layout">
        {session ? (
          <Routes>
            <Route path="/" element={<Navigate to={homePath} replace />} />
            <Route
              element={<Layout session={session} onLogout={handleLogout} />}
            >
              {isAdmin ? (
                <>
                  <Route
                    path="admin/bookings"
                    element={<AdminBookings session={session} />}
                  />
                  <Route
                    path="admin/fleet"
                    element={<AdminFleet session={session} />}
                  />
                  <Route
                    path="admin/issues"
                    element={<AdminIssues session={session} />}
                  />
                  <Route
                    path="admin/income"
                    element={<Income session={session} />}
                  />
                  <Route
                    path="*"
                    element={<Navigate to="/admin/bookings" replace />}
                  />
                </>
              ) : (
                <>
                  <Route path="map" element={<ScooterMap />} />
                  <Route
                    path="fleet"
                    element={
                      <ScooterList
                        session={session}
                        onBookingCreated={handleBookingCreated}
                      />
                    }
                  />
                  <Route
                    path="bookings"
                    element={
                      <MyBookings
                        session={session}
                        refreshKey={bookingRefreshKey}
                      />
                    }
                  />
                  <Route
                    path="cards"
                    element={<SavedCards session={session} />}
                  />
                  <Route
                    path="report-issue"
                    element={<ReportIssue session={session} />}
                  />
                  <Route path="*" element={<Navigate to="/map" replace />} />
                </>
              )}
            </Route>
          </Routes>
        ) : (
          <Routes>
            <Route
              path="/"
              element={
                <AuthManager
                  session={session}
                  onSessionChange={handleSessionChange}
                />
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        )}
      </div>
    </BrowserRouter>
  );
}
