import { useMemo, useState } from 'react';
import {
  Bike,
  CheckCircle2,
  Clock,
  Eye,
  EyeOff,
  MapPin,
  XCircle,
  Zap,
} from 'lucide-react';
import ThemeToggle from './ThemeToggle';
import { requestJson } from '../utils/api';
import { apiUrl } from '../utils/apiBase';
import AccountTypePicker from './AccountTypePicker';

const REGISTER_ENDPOINT = apiUrl('/api/auth/register');
const LOGIN_ENDPOINT = apiUrl('/api/auth/login');
const MIN_PASSWORD_LENGTH = 8;

const initialRegisterForm = {
  fullName: '',
  email: '',
  userType: 'standard',
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
  placeholder,
}) {
  return (
    <div className="input-wrapper">
      <input
        id={id}
        name={name}
        type={isVisible ? 'text' : 'password'}
        className="input"
        autoComplete={autoComplete}
        minLength={minLength}
        value={value}
        onChange={onChange}
        required={required}
        placeholder={placeholder}
        aria-invalid={ariaInvalid || undefined}
      />
      <button
        type="button"
        className="input-wrapper__action"
        onClick={onToggleVisibility}
        aria-pressed={isVisible}
        aria-label={isVisible ? 'Hide password' : 'Show password'}
        title={isVisible ? 'Hide password' : 'Show password'}
      >
        {isVisible ? (
          <EyeOff size={16} aria-hidden="true" />
        ) : (
          <Eye size={16} aria-hidden="true" />
        )}
      </button>
    </div>
  );
}

function FormAlert({ message }) {
  if (!message || !message.text) {
    return null;
  }

  const isError = message.state === 'error';
  const isSuccess = message.state === 'success';

  if (!isError && !isSuccess) {
    return (
      <p role="alert" aria-live="polite">
        {message.text}
      </p>
    );
  }

  return (
    <div
      className={`alert ${isError ? 'alert--error' : 'alert--success'}`}
      role="alert"
      aria-live="polite"
    >
      {isError ? (
        <XCircle size={16} aria-hidden="true" className="alert__icon" />
      ) : (
        <CheckCircle2 size={16} aria-hidden="true" className="alert__icon" />
      )}
      {message.text}
    </div>
  );
}

export default function AuthManager({ session, onSessionChange }) {
  const [activeTab, setActiveTab] = useState('signin');
  const [registerForm, setRegisterForm] = useState(initialRegisterForm);
  const [loginForm, setLoginForm] = useState(initialLoginForm);
  const [registerMessage, setRegisterMessage] = useState({
    text: '',
    state: '',
  });
  const [loginMessage, setLoginMessage] = useState({ text: '', state: '' });
  const [showRegisterPassword, setShowRegisterPassword] = useState(false);
  const [showRegisterConfirmPassword, setShowRegisterConfirmPassword] =
    useState(false);
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [isSubmittingRegister, setIsSubmittingRegister] = useState(false);
  const [isSubmittingLogin, setIsSubmittingLogin] = useState(false);

  const sessionView = useMemo(() => {
    if (!session) {
      return { account: 'None', status: 'Signed out', token: 'Not issued' };
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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: registerForm.fullName,
          email: registerForm.email,
          userType: registerForm.userType,
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
        headers: { 'Content-Type': 'application/json' },
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
    try {
      onSessionChange(null);
    } catch (error) {
      console.error('Clear session failed:', error);
    }
    setRegisterMessage({ text: '', state: '' });
    setLoginMessage({ text: '', state: '' });
  }

  function selectTab(tab) {
    if (tab !== 'signin' && tab !== 'register') {
      console.warn('AuthManager: invalid tab', tab);
      return;
    }
    setActiveTab(tab);
    setRegisterMessage({ text: '', state: '' });
    setLoginMessage({ text: '', state: '' });
  }

  const isSignIn = activeTab === 'signin';

  return (
    <div className="auth-shell">
      <div className="auth-shell__corner">
        <ThemeToggle />
      </div>

      <aside className="auth-brand" aria-hidden="true">
        <div className="auth-brand__top">
          <span className="auth-brand__mark">
            <Zap size={24} />
          </span>
          <span className="auth-brand__name">E-Scooter Hire</span>
        </div>
        <div className="auth-brand__hero">
          <h1 className="auth-brand__headline">Ride Leeds, on demand.</h1>
          <p className="auth-brand__sub">
            Unlock an e-scooter from any of our five city locations. Pay by the
            hour, day, or week — with discounts for students and seniors.
          </p>
          <ul className="auth-brand__points" role="list">
            <li className="auth-brand__point">
              <span className="auth-brand__point-icon">
                <Zap size={16} />
              </span>
              <span className="auth-brand__point-text">
                <strong>Instant access</strong>
                Unlock in seconds with a registered account.
              </span>
            </li>
            <li className="auth-brand__point">
              <span className="auth-brand__point-icon">
                <MapPin size={16} />
              </span>
              <span className="auth-brand__point-text">
                <strong>City-wide network</strong>
                Five staffed locations across central Leeds.
              </span>
            </li>
            <li className="auth-brand__point">
              <span className="auth-brand__point-icon">
                <Clock size={16} />
              </span>
              <span className="auth-brand__point-text">
                <strong>Flexible plans</strong>
                Hourly, daily, and weekly hire to fit any trip.
              </span>
            </li>
          </ul>
        </div>
        <p className="auth-brand__footer">
          &copy; E-Scooter Rental Platform &middot; Leeds
        </p>
      </aside>
      <main className="auth-form-panel">
        <header className="auth-brand-compact">
          <span className="auth-brand-compact__mark">
            <Bike size={20} />
          </span>
          <span className="auth-brand-compact__name">E-Scooter Hire</span>
        </header>
        <section className="auth-form-card" aria-labelledby="auth-card-title">
          <div className="auth-form-card__header">
            <h2 id="auth-card-title" className="auth-form-card__title">
              {isSignIn ? 'Welcome back' : 'Create your account'}
            </h2>
            <p className="auth-form-card__sub">
              {isSignIn
                ? 'Sign in to book a scooter and view your trips.'
                : 'Join in under a minute. No credit card required to register.'}
            </p>
          </div>
          <div className="auth-tabs" role="tablist" aria-label="Authentication">
            <button
              type="button"
              role="tab"
              aria-selected={isSignIn}
              className={`auth-tabs__btn${isSignIn ? ' is-active' : ''}`}
              onClick={() => selectTab('signin')}
            >
              Sign in
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={!isSignIn}
              className={`auth-tabs__btn${!isSignIn ? ' is-active' : ''}`}
              onClick={() => selectTab('register')}
            >
              Create account
            </button>
          </div>
          {isSignIn ? (
            <form className="auth-form" onSubmit={handleLoginSubmit} noValidate>
              <div className="field">
                <label className="field__label" htmlFor="login-email">
                  Email
                </label>
                <input
                  id="login-email"
                  name="email"
                  type="email"
                  className="input"
                  autoComplete="email"
                  placeholder="you@example.com"
                  value={loginForm.email}
                  onChange={(event) =>
                    setLoginForm((current) => ({
                      ...current,
                      email: event.target.value,
                    }))
                  }
                  required
                />
              </div>
              <div className="field">
                <label className="field__label" htmlFor="login-password">
                  Password
                </label>
                <PasswordField
                  id="login-password"
                  name="password"
                  autoComplete="current-password"
                  placeholder="Enter your password"
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
              </div>
              <FormAlert message={loginMessage} />
              <button
                type="submit"
                className="btn btn--primary btn--block auth-form__submit"
                disabled={isSubmittingLogin}
              >
                {isSubmittingLogin ? 'Signing in…' : 'Sign in'}
              </button>
            </form>
          ) : (
            <form
              className="auth-form"
              onSubmit={handleRegisterSubmit}
              noValidate
            >
              <div className="field">
                <label className="field__label" htmlFor="register-full-name">
                  Full name
                </label>
                <input
                  id="register-full-name"
                  name="fullName"
                  type="text"
                  className="input"
                  autoComplete="name"
                  placeholder="Ada Lovelace"
                  value={registerForm.fullName}
                  onChange={(event) =>
                    setRegisterForm((current) => ({
                      ...current,
                      fullName: event.target.value,
                    }))
                  }
                  required
                />
              </div>
              <div className="field">
                <label className="field__label" htmlFor="register-email">
                  Email
                </label>
                <input
                  id="register-email"
                  name="email"
                  type="email"
                  className="input"
                  autoComplete="email"
                  placeholder="you@example.com"
                  value={registerForm.email}
                  onChange={(event) =>
                    setRegisterForm((current) => ({
                      ...current,
                      email: event.target.value,
                    }))
                  }
                  required
                />
              </div>
              <AccountTypePicker
                name="registerUserType"
                legend="Account type"
                hint="Students and seniors receive 20% off hire plans. You can change this later in Profile."
                value={registerForm.userType}
                onChange={(nextType) =>
                  setRegisterForm((current) => ({
                    ...current,
                    userType: nextType,
                  }))
                }
              />
              <div className="field">
                <label className="field__label" htmlFor="register-password">
                  Password
                </label>
                <PasswordField
                  id="register-password"
                  name="password"
                  autoComplete="new-password"
                  minLength={MIN_PASSWORD_LENGTH}
                  placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`}
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
                <span className="field__hint">
                  Minimum {MIN_PASSWORD_LENGTH} characters.
                </span>
              </div>
              <div className="field">
                <label
                  className="field__label"
                  htmlFor="register-confirm-password"
                >
                  Confirm password
                </label>
                <PasswordField
                  id="register-confirm-password"
                  name="confirmPassword"
                  autoComplete="new-password"
                  minLength={MIN_PASSWORD_LENGTH}
                  placeholder="Re-enter your password"
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
                    className="field__error"
                    role="alert"
                    aria-live="polite"
                  >
                    <XCircle size={14} aria-hidden="true" />
                    Passwords do not match.
                  </span>
                ) : null}
              </div>
              <FormAlert message={registerMessage} />
              <button
                type="submit"
                className="btn btn--primary btn--block auth-form__submit"
                disabled={isSubmittingRegister || passwordMismatch}
              >
                {isSubmittingRegister ? 'Creating account…' : 'Create account'}
              </button>
            </form>
          )}
          <details className="auth-debug">
            <summary>Session debug</summary>
            <dl>
              <dt>Status</dt>
              <dd>{sessionView.status}</dd>
              <dt>Account</dt>
              <dd>{sessionView.account}</dd>
              <dt>Token</dt>
              <dd>{sessionView.token}</dd>
            </dl>
            <button
              type="button"
              className="btn btn--ghost"
              onClick={handleLogout}
            >
              Clear session
            </button>
          </details>
        </section>
      </main>
    </div>
  );
}
