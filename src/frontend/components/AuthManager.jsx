import { useMemo, useState } from 'react';

const REGISTER_ENDPOINT = 'http://127.0.0.1:3000/api/auth/register';
const LOGIN_ENDPOINT = 'http://127.0.0.1:3000/api/auth/login';

async function requestJson(url, options = {}) {
  const response = await fetch(url, options);
  let payload = null;

  try {
    payload = await response.json();
  } catch (_error) {
    payload = null;
  }

  if (!response.ok) {
    throw new Error(payload?.message || 'Request failed.');
  }

  return payload;
}

export default function AuthManager({ session, onSessionChange }) {
  const [registerForm, setRegisterForm] = useState({
    fullName: '',
    email: '',
    password: '',
  });
  const [loginForm, setLoginForm] = useState({
    email: '',
    password: '',
  });
  const [registerMessage, setRegisterMessage] = useState({
    text: '',
    state: '',
  });
  const [loginMessage, setLoginMessage] = useState({
    text: '',
    state: '',
  });

  const sessionView = useMemo(() => {
    if (!session) {
      return {
        account: 'None',
        status: 'Signed out',
        token: 'Not issued',
      };
    }

    const fullName = session?.user?.fullName || 'Unknown user';
    const email = session?.user?.email || 'No email';

    return {
      account: `${fullName} (${email})`,
      status: 'Signed in',
      token: session?.token || 'Not issued',
    };
  }, [session]);

  async function handleRegisterSubmit(event) {
    event.preventDefault();
    setRegisterMessage({ text: '', state: '' });
    setLoginMessage({ text: '', state: '' });

    try {
      const result = await requestJson(REGISTER_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(registerForm),
      });

      onSessionChange(result.data);
      setRegisterMessage({
        text: result.message || 'Account created successfully.',
        state: 'success',
      });
      setRegisterForm({
        fullName: '',
        email: '',
        password: '',
      });
    } catch (error) {
      console.error('Register request failed:', error);
      setRegisterMessage({
        text: error?.message || 'Unable to create account.',
        state: 'error',
      });
    }
  }

  async function handleLoginSubmit(event) {
    event.preventDefault();
    setRegisterMessage({ text: '', state: '' });
    setLoginMessage({ text: '', state: '' });

    try {
      const result = await requestJson(LOGIN_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(loginForm),
      });

      onSessionChange(result.data);
      setLoginMessage({
        text: result.message || 'Login successful.',
        state: 'success',
      });
      setLoginForm({
        email: '',
        password: '',
      });
    } catch (error) {
      console.error('Login request failed:', error);
      setLoginMessage({
        text: error?.message || 'Unable to log in.',
        state: 'error',
      });
    }
  }

  function handleLogout() {
    onSessionChange(null);
    setRegisterMessage({ text: '', state: '' });
    setLoginMessage({ text: '', state: '' });
  }

  return (
    <section className="panel-stack">
      <article className="panel">
        <div className="panel-header">
          <p className="panel-kicker">Create Account</p>
          <h2>New customer</h2>
        </div>

        <form className="form-grid" onSubmit={handleRegisterSubmit}>
          <label htmlFor="register-full-name">
            Full name
            <input
              id="register-full-name"
              name="fullName"
              type="text"
              value={registerForm.fullName}
              onChange={(event) =>
                setRegisterForm((current) => ({
                  ...current,
                  fullName: event.target.value,
                }))
              }
              required
            />
          </label>

          <label htmlFor="register-email">
            Email
            <input
              id="register-email"
              name="email"
              type="email"
              value={registerForm.email}
              onChange={(event) =>
                setRegisterForm((current) => ({
                  ...current,
                  email: event.target.value,
                }))
              }
              required
            />
          </label>

          <label htmlFor="register-password">
            Password
            <input
              id="register-password"
              name="password"
              type="password"
              minLength={8}
              value={registerForm.password}
              onChange={(event) =>
                setRegisterForm((current) => ({
                  ...current,
                  password: event.target.value,
                }))
              }
              required
            />
          </label>

          <button type="submit">Create account</button>
        </form>

        <p
          className="message"
          data-state={registerMessage.state || undefined}
          aria-live="polite"
        >
          {registerMessage.text}
        </p>
      </article>

      <article className="panel">
        <div className="panel-header">
          <p className="panel-kicker">Sign In</p>
          <h2>Existing customer</h2>
        </div>

        <form className="form-grid" onSubmit={handleLoginSubmit}>
          <label htmlFor="login-email">
            Email
            <input
              id="login-email"
              name="email"
              type="email"
              value={loginForm.email}
              onChange={(event) =>
                setLoginForm((current) => ({
                  ...current,
                  email: event.target.value,
                }))
              }
              required
            />
          </label>

          <label htmlFor="login-password">
            Password
            <input
              id="login-password"
              name="password"
              type="password"
              value={loginForm.password}
              onChange={(event) =>
                setLoginForm((current) => ({
                  ...current,
                  password: event.target.value,
                }))
              }
              required
            />
          </label>

          <button type="submit">Log in</button>
        </form>

        <p
          className="message"
          data-state={loginMessage.state || undefined}
          aria-live="polite"
        >
          {loginMessage.text}
        </p>
      </article>

      <article className="panel panel-accent">
        <div className="panel-header">
          <p className="panel-kicker">Session</p>
          <h2>Current login state</h2>
        </div>

        <dl className="session-view">
          <div>
            <dt>Status</dt>
            <dd>{sessionView.status}</dd>
          </div>
          <div>
            <dt>Account</dt>
            <dd>{sessionView.account}</dd>
          </div>
          <div>
            <dt>Token</dt>
            <dd>{sessionView.token}</dd>
          </div>
        </dl>

        <button type="button" className="secondary" onClick={handleLogout}>
          Clear session
        </button>
      </article>
    </section>
  );
}
