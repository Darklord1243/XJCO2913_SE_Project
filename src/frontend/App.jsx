import { useState } from 'react';
import AuthManager from './components/AuthManager';
import MyBookings from './components/MyBookings';
import ScooterList from './components/ScooterList';
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

  function handleBookingCreated() {
    setBookingRefreshKey((current) => current + 1);
  }

  return (
    <main className="shell app-layout">
      <AuthManager session={session} onSessionChange={handleSessionChange} />
      <ScooterList session={session} onBookingCreated={handleBookingCreated} />
      <MyBookings session={session} refreshKey={bookingRefreshKey} />
    </main>
  );
}
