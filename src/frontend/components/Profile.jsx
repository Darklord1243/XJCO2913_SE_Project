import { useEffect, useState } from 'react';
import { getSessionToken } from '../session';
import { requestJson } from '../utils/api';
import { apiUrl } from '../utils/apiBase';
import AccountTypePicker from './AccountTypePicker';
import { getAccountTypeLabel } from '../utils/accountTypes';

const PROFILE_ENDPOINT = apiUrl('/api/auth/profile');

export default function Profile({ session, onSessionChange }) {
  const [userType, setUserType] = useState(
    session?.user?.userType || 'standard'
  );
  const [message, setMessage] = useState({ text: '', state: '' });
  const [isSaving, setIsSaving] = useState(false);

  const token = getSessionToken(session);

  useEffect(() => {
    setUserType(session?.user?.userType || 'standard');
  }, [session?.user?.userType]);

  async function handleSubmit(event) {
    event.preventDefault();

    if (!token) {
      setMessage({ text: 'Sign in to update your profile.', state: 'error' });
      return;
    }

    setIsSaving(true);
    setMessage({ text: '', state: '' });

    try {
      const result = await requestJson(PROFILE_ENDPOINT, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userType }),
      });

      onSessionChange?.(result.data);
      setMessage({
        text: result.message || 'Profile updated.',
        state: 'success',
      });
    } catch (error) {
      console.error('Profile update failed:', error);
      setMessage({
        text: error?.message || 'Failed to update profile.',
        state: 'error',
      });
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="bookings-page">
      <article className="page-card" data-id="ID22">
        <div className="page-header">
          <h2 className="page-title">Account profile</h2>
          <p className="page-subtitle">
            Signed in as {session?.user?.fullName || 'Customer'} (
            {session?.user?.email || 'unknown'})
          </p>
        </div>

        <dl className="profile-summary">
          <div className="profile-summary__row">
            <dt>Saved on account</dt>
            <dd>{getAccountTypeLabel(session?.user?.userType)}</dd>
          </div>
          {userType !== session?.user?.userType ? (
            <div className="profile-summary__row profile-summary__row--pending">
              <dt>Your selection</dt>
              <dd>{getAccountTypeLabel(userType)}</dd>
            </div>
          ) : null}
        </dl>

        <form className="page-form" onSubmit={handleSubmit}>
          <AccountTypePicker
            name="profileUserType"
            legend="Account type (discount eligibility)"
            hint="Student and senior accounts receive 20% off hire plans. Frequent riders (8+ hire hours in the last 7 days) also receive 20% off at checkout. Discounts are applied on the server."
            value={userType}
            onChange={setUserType}
          />

          {message.text ? (
            <div
              className={`alert ${message.state === 'error' ? 'alert--error' : 'alert--success'}`}
              aria-live="polite"
            >
              {message.text}
            </div>
          ) : null}

          <button
            type="submit"
            className="btn btn--primary"
            disabled={isSaving}
          >
            {isSaving ? 'Saving...' : 'Save account type'}
          </button>
        </form>
      </article>
    </section>
  );
}
