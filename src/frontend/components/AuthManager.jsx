import { useMemo, useState } from 'react';
import { requestJson } from '../utils/api';

const REGISTER_ENDPOINT = 'http://127.0.0.1:3000/api/auth/register';
const LOGIN_ENDPOINT = 'http://127.0.0.1:3000/api/auth/login';
const MIN_PASSWORD_LENGTH = 8;

const initialRegisterForm = {
  fullName: '',
  email: '',
  password: '',
  confirmPassword: '',
};

const initialLoginForm = {
  email: '',
  password: '',
};

function PasswordField({
  id,
  name,
  value,
  onChange,
  isVisible,
  onToggleVisibility,
  required = true,
  minLength,
  autoComplete,
  ariaInvalid,
}) {
  return (
    <div className="password-field">
      <input
        id={id}
        name={name}
        type={isVisible ? 'text' : 'password'}
        autoComplete={autoComplete}
        minLength={minLength}
        value={value}
        onChange={onChange}
        required={required}
        aria-invalid={ariaInvalid || undefined}
      />
      <button
        type="button"
        className="password-field__toggle secondary"
        onClick={onToggleVisibility}
        aria-pressed={isVisible}
        aria-label={isVisible ? 'Hide password' : 'Show password'}
      >
        {isVisible ? 'Hide' : 'Show'}
      </button>
    </div>
  );
}

export default function AuthManager({ session, onSessionChange }) {
  const [registerForm, setRegisterForm] = useState(initialRegisterForm);
  const [loginForm, setLoginForm] = useState(initialLoginForm);
  const [registerMessage, setRegisterMessage] = useState({
    text: '',
    state: '',
  });
  const [loginMessage, setLoginMessage] = useState({
    text: '',
    state: '',
  });
  const [showRegisterPassword, setShowRegisterPassword] = useState(false);
  const [showRegisterConfirmPassword, setShowRegisterConfirmPassword] =
    useState(false);
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [isSubmittingRegister, setIsSubmittingRegister] = useState(false);
  const [isSubmittingLogin, setIsSubmittingLogin] = useState(false);

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

  const passwordMismatch =
    registerForm.confirmPassword.length > 0 &&
    registerForm.password !== registerForm.confirmPassword;

  async function handleRegisterSubmit(event) {
    event.preventDefault();
    setRegisterMessage({ text: '', state: '' });
    setLoginMessage({ text: '', state: '' });

    if (registerForm.password.length < MIN_PASSWORD_LENGTH) {
      setRegisterMessage({
        text: `Password must contain at least ${MIN_PASSWORD_LENGTH} characters.`,
        state: 'error',
      });
      return;
    }

    if (registerForm.password !== registerForm.confirmPassword) {
      setRegisterMessage({
        text: 'Password and confirmation do not match.',
        state: 'error',
      });
      return;
    }

    setIsSubmittingRegister(true);

    try {
      const result = await requestJson(REGISTER_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fullName: registerForm.fullName,
          email: registerForm.email,
          password: registerForm.password,
          confirmPassword: registerForm.confirmPassword,
        }),
      });

      onSessionChange(result.data);
      setRegisterMessage({
        text: result.message || 'Account created successfully.',
        state: 'success',
      });
      setRegisterForm(initialRegisterForm);
      setShowRegisterPassword(false);
      setShowRegisterConfirmPassword(false);
    } catch (error) {
      console.error('Register request failed:', error);
      setRegisterMessage({
        text: error?.message || 'Unable to create account.',
        state: 'error',
      });
    } finally {
      setIsSubmittingRegister(false);
    }
  }

  async function handleLoginSubmit(event) {
    event.preventDefault();
    setRegisterMessage({ text: '', state: '' });
    setLoginMessage({ text: '', state: '' });
    setIsSubmittingLogin(true);

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
      setLoginForm(initialLoginForm);
      setShowLoginPassword(false);
    } catch (error) {
      console.error('Login request failed:', error);
      setLoginMessage({
        text: error?.message || 'Unable to log in.',
        state: 'error',
      });
    } finally {
      setIsSubmittingLogin(false);
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

        <form className="form-grid" onSubmit={handleRegisterSubmit} noValidate>
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
            <PasswordField
              id="register-password"
              name="password"
              autoComplete="new-password"
              minLength={MIN_PASSWORD_LENGTH}
              value={registerForm.password}
              onChange={(event) =>
                setRegisterForm((current) => ({
                  ...current,
                  password: event.target.value,
                }))
              }
              isVisible={showRegisterPassword}
              onToggleVisibility={() =>
                setShowRegisterPassword((current) => !current)
              }
            />
          </label>

          <label htmlFor="register-confirm-password">
            Confirm password
            <PasswordField
              id="register-confirm-password"
              name="confirmPassword"
              autoComplete="new-password"
              minLength={MIN_PASSWORD_LENGTH}
              value={registerForm.confirmPassword}
              onChange={(event) =>
                setRegisterForm((current) => ({
                  ...current,
                  confirmPassword: event.target.value,
                }))
              }
              isVisible={showRegisterConfirmPassword}
              onToggleVisibility={() =>
                setShowRegisterConfirmPassword((current) => !current)
              }
              ariaInvalid={passwordMismatch}
            />
            {passwordMismatch ? (
              <span
                className="message"
                data-state="error"
                role="alert"
                aria-live="polite"
              >
                Passwords do not match.
              </span>
            ) : null}
          </label>

          <button
            type="submit"
            disabled={isSubmittingRegister || passwordMismatch}
          >
            {isSubmittingRegister ? 'Creating...' : 'Create account'}
          </button>
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

        <form className="form-grid" onSubmit={handleLoginSubmit} noValidate>
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
            <PasswordField
              id="login-password"
              name="password"
              autoComplete="current-password"
              value={loginForm.password}
              onChange={(event) =>
                setLoginForm((current) => ({
                  ...current,
                  password: event.target.value,
                }))
              }
              isVisible={showLoginPassword}
              onToggleVisibility={() =>
                setShowLoginPassword((current) => !current)
              }
            />
          </label>

          <button type="submit" disabled={isSubmittingLogin}>
            {isSubmittingLogin ? 'Signing in...' : 'Log in'}
          </button>
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
