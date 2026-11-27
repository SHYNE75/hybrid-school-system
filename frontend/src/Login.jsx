import { useState } from 'react';
import { ArrowRight, BookOpen, GraduationCap, ShieldCheck, Users } from 'lucide-react';
import { firebaseAuth } from './firebase.js';
import { apiRequest } from './api/client.js';

const roles = [
  { id: 'student', label: 'Student', icon: GraduationCap },
  { id: 'teacher', label: 'Teacher', icon: BookOpen },
  { id: 'parent', label: 'Parent', icon: Users },
  { id: 'admin', label: 'Admin', icon: ShieldCheck },
];

function Login({ onAuthenticated }) {
  const [role, setRole] = useState('student');
  const [mode, setMode] = useState('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setError('');
    if (mode === 'register' && role !== 'student') {
      setError('Teacher and parent accounts must be created by the school.');
      return;
    }
    setLoading(true);

    try {
      if (firebaseAuth) {
        const user = await firebaseAuth.authenticate(mode, { email, password, name: name.trim() });
        let profileResult;
        try {
          profileResult = await apiRequest('/api/auth/profile', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${user.idToken}` },
            body: JSON.stringify({ role }),
          });
        } catch (profileError) {
          throw new Error(profileError.message || 'Sign-in succeeded, but the backend could not load your school profile.');
        }

        const refreshedUser = await firebaseAuth.refreshIdToken(user.refreshToken);
        onAuthenticated({
          ...profileResult.user,
          name: profileResult.user.name || user.displayName || name.trim() || email.split('@')[0],
          token: refreshedUser.id_token,
          refreshToken: refreshedUser.refresh_token,
          provider: 'firebase',
          limitedMode: false,
        });
        setPassword('');
      } else {
        const result = await apiRequest(`/api/auth/${mode}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: name.trim(), email, password, role }),
        });
        onAuthenticated({ ...result.user, token: result.token, provider: 'jwt' });
      }
    } catch (submitError) {
      setError(submitError.message || 'Unable to sign in. Check your details and try again.');
    } finally {
      setLoading(false);
    }
  }

  async function sendPasswordReset() {
    setError('');
    setResetSent(false);
    if (!email.trim() || !firebaseAuth) {
      setError(firebaseAuth ? 'Enter your email address first.' : 'Password reset requires Firebase Authentication to be configured.');
      return;
    }
    setLoading(true);
    try {
      await firebaseAuth.sendPasswordReset(email.trim());
      setResetSent(true);
    } catch (resetError) {
      setError(resetError.message || 'Unable to send the password reset email.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="login-screen">
      <div className="login-topline"><a className="brand" href="#login"><span className="brand-mark"><span /></span><span className="brand-name">fieldnote<span className="brand-period">.</span></span></a><span>ABIOLA ACADEMY <i>·</i> SCHOOL PORTAL</span></div>
      <section className="login-layout">
        <div className="login-welcome">
          <div className="login-illustration" aria-hidden="true"><div className="orbit orbit-one" /><div className="orbit orbit-two" /><div className="book-shape"><span /><span /></div><i className="spark spark-one">✳</i><i className="spark spark-two">✳</i></div>
          <div className="login-copy"><div className="eyebrow"><span className="eyebrow-dot" />YOUR SCHOOL, IN SYNC</div><h1>A good day<br />starts <em>together.</em></h1><p>One place for learning, teaching, and staying close to the school community.</p><div className="login-trust"><span><i />Attendance</span><span><i />Learning</span><span><i />Community</span></div></div>
        </div>
        <section className="login-card" aria-labelledby="login-title">
          <div className="login-card-heading"><span className="login-card-kicker">WELCOME BACK</span><h2 id="login-title">{mode === 'register' ? 'Create your account' : 'Sign in to Fieldnote'}</h2><p>Use your school account to continue.</p></div>
          <div className="role-picker" aria-label="Choose account type">{roles.map(({ id, label }) => <button type="button" key={id} className={role === id ? 'selected' : ''} onClick={() => setRole(id)}>{label}</button>)}</div>
          <form onSubmit={submit}>
            {mode === 'register' && <label className="field-label">Full name<input autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Your name" required minLength={2} /></label>}
            <label className="field-label">School email<input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@school.edu" required /></label>
            <label className="field-label">Password<input type="password" autoComplete={mode === 'register' ? 'new-password' : 'current-password'} value={password} onChange={(event) => setPassword(event.target.value)} placeholder={mode === 'register' ? 'At least 8 characters' : 'Enter your password'} required minLength={8} /></label>
            {error && <div className="login-error" role="alert">{error}</div>}
            <button className="login-submit" type="submit" disabled={loading}>{loading ? 'Please wait…' : mode === 'register' ? 'Create account' : 'Sign in'}<ArrowRight size={16} /></button>
          </form>
          <div className="login-switch">{mode === 'register' ? 'Already have an account?' : 'New to the school portal?'} <button type="button" onClick={() => { setMode(mode === 'register' ? 'login' : 'register'); setError(''); }}>{mode === 'register' ? 'Sign in' : 'Create account'}</button></div>
          {mode === 'register' && <p className="auth-mode-note">Teacher and parent accounts are provisioned by the school.</p>}
          {!firebaseAuth && <p className="auth-mode-note">Firebase isn’t configured yet; sign-in uses the Express API.</p>}
          <div className="login-card-foot">By continuing, you agree to the school’s <a href="#privacy">acceptable use policy</a>.</div>
        </section>
        {resetSent && <div className="reset-success" role="status">Password reset email sent. Check your inbox and spam folder.</div>}
        {mode === 'login' && <button type="button" className="forgot-password" onClick={sendPasswordReset} disabled={loading}>Forgot password?</button>}
      </section>
      <footer className="login-footer"><span>© 2024 Abiola Academy</span><span>Learning happens everywhere <span className="footer-leaf">✳</span></span></footer>
    </main>
  );
}

export default Login;