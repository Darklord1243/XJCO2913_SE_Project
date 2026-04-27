import { useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import AuthManager from './components/AuthManager';
import Income from './components/Income';
import Layout from './components/Layout.jsx';
import MyBookings from './components/MyBookings';
import ScooterList from './components/ScooterList';
import ScooterMap from './components/ScooterMap';
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

  return (
    <BrowserRouter>
      <div className="shell app-layout">
        {session ? (
          <Routes>
            <Route path="/" element={<Navigate to="/fleet" replace />} />
            <Route element={<Layout onLogout={handleLogout} />}>
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
              <Route path="map" element={<ScooterMap />} />
              <Route path="income" element={<Income session={session} />} />
              <Route path="*" element={<Navigate to="/fleet" replace />} />
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
