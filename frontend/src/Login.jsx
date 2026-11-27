import { useEffect, useState } from 'react';
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
	const [confirmPassword, setConfirmPassword] = useState('');
	const [schoolName, setSchoolName] = useState('');
	const [adminName, setAdminName] = useState('');
	const [schoolPhone, setSchoolPhone] = useState('');
	const [schoolAddress, setSchoolAddress] = useState('');
	const [setupRequired, setSetupRequired] = useState(false);
	const [setupChecking, setSetupChecking] = useState(true);
	const [resetSent, setResetSent] = useState(false);
	const [error, setError] = useState('');
	const [loading, setLoading] = useState(false);

	useEffect(() => {
		const apiOrigin = import.meta.env.VITE_API_URL?.replace(/\/+$/, '') || '';
		if (!apiOrigin) {
			setSetupRequired(false);
			setSetupChecking(false);
			return;
		}

		fetch(`${apiOrigin}/api/auth/setup-status`)
			.then(async (response) => {
				const result = await response.json();
				if (!response.ok) throw new Error(result.error || 'Unable to check setup status.');
				setSetupRequired(Boolean(result.setupRequired));
			})
			.catch((statusError) => {
				setSetupRequired(true);
				setError(statusError.message);
			})
			.finally(() => setSetupChecking(false));
	}, []);

	async function submit(event) {
		event.preventDefault();
		setError('');

		if (mode === 'register' && role !== 'student') {
			setError('Teacher and parent accounts must be created by the school administrator.');
			return;
		}

		setLoading(true);
		try {
			if (!firebaseAuth) throw new Error('Firebase Authentication is not configured.');

			const user = await firebaseAuth.authenticate(mode, { email, password, name: name.trim() });
			const profileResult = await apiRequest('/api/auth/profile', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${user.idToken}` },
				body: JSON.stringify({ role }),
			});
			const refreshedUser = await firebaseAuth.refreshIdToken(user.refreshToken);

			onAuthenticated({
				...profileResult.user,
				name: profileResult.user.name || user.displayName || name.trim() || email.split('@')[0],
				token: refreshedUser.id_token,
				refreshToken: refreshedUser.refresh_token,
				provider: 'firebase',
			});
			setPassword('');
		} catch (submitError) {
			setError(submitError.message || 'Unable to sign in.');
		} finally {
			setLoading(false);
		}
	}

	async function createSchoolSetup(event) {
		event.preventDefault();
		setError('');

		if (!schoolName.trim() || !adminName.trim()) {
			setError('Enter both the school name and administrator name.');
			return;
		}
		if (!email.trim() || password.length < 8) {
			setError('Enter a valid email and a password of at least 8 characters.');
			return;
		}
		if (password !== confirmPassword) {
			setError('Passwords do not match.');
			return;
		}

		setLoading(true);
		try {
			if (!firebaseAuth) throw new Error('Firebase Authentication is not configured.');

			const user = await firebaseAuth.authenticate('register', {
				email,
				password,
				name: adminName.trim(),
			});
			const setupResult = await apiRequest('/api/auth/setup-school', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${user.idToken}`,
				},
				body: JSON.stringify({
					schoolName: schoolName.trim(),
					adminName: adminName.trim(),
					phone: schoolPhone.trim(),
					address: schoolAddress.trim(),
				}),
			});
			const refreshedUser = await firebaseAuth.refreshIdToken(user.refreshToken);

			onAuthenticated({
				...setupResult.user,
				token: refreshedUser.id_token,
				refreshToken: refreshedUser.refresh_token,
				provider: 'firebase',
			});
			setPassword('');
			setConfirmPassword('');
			setSetupRequired(false);
		} catch (setupError) {
			setError(setupError.message || 'Unable to create the school administrator account.');
		} finally {
			setLoading(false);
		}
	}

	async function sendPasswordReset() {
		setError('');
		setResetSent(false);
		if (!email.trim()) {
			setError('Enter your email address first.');
			return;
		}
		if (!firebaseAuth) {
			setError('Password reset requires Firebase Authentication.');
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

	const showSetup = role === 'admin' && setupRequired;

	return (
		<main className="login-screen">
			<div className="login-topline">
				<a className="brand" href="#login"><span className="brand-mark"><span /></span><span className="brand-name">fieldnote<span className="brand-period">.</span></span></a>
				<span>ABIOLA ACADEMY <i>·</i> SCHOOL PORTAL</span>
			</div>

			<section className="login-layout">
				<div className="login-welcome">
					<div className="login-illustration" aria-hidden="true"><div className="orbit orbit-one" /><div className="orbit orbit-two" /><div className="book-shape"><span /><span /></div><i className="spark spark-one">✳</i><i className="spark spark-two">✳</i></div>
					<div className="login-copy">
						<div className="eyebrow"><span className="eyebrow-dot" />YOUR SCHOOL, IN SYNC</div>
						<h1>A good day<br />starts <em>together.</em></h1>
						<p>One place for learning, teaching, and staying close to the school community.</p>
						<div className="login-trust"><span><i />Attendance</span><span><i />Learning</span><span><i />Community</span></div>
					</div>
				</div>

				<section className="login-card" aria-labelledby="login-title">
					<div className="login-card-heading">
						<span className="login-card-kicker">{showSetup ? 'FIRST-TIME SCHOOL SETUP' : 'WELCOME BACK'}</span>
						<h2 id="login-title">{showSetup ? 'Create your school administrator' : 'Sign in to Fieldnote'}</h2>
						<p>{showSetup ? 'Set up this school and the first administrator account.' : 'Use your school account to continue.'}</p>
					</div>

					<div className="role-picker" aria-label="Choose account type">
						{roles.map(({ id, label }) => (
							<button type="button" key={id} className={role === id ? 'selected' : ''} onClick={() => { setRole(id); setMode(id === 'admin' ? 'login' : mode); setError(''); setResetSent(false); }}>{label}</button>
						))}
					</div>

					{setupChecking ? (
						<p className="setup-checking">Checking school setup…</p>
					) : showSetup ? (
						<form className="school-setup-form" onSubmit={createSchoolSetup}>
							<label className="field-label">School name<input value={schoolName} onChange={(event) => setSchoolName(event.target.value)} placeholder="School name" required minLength={2} /></label>
							<label className="field-label">Administrator name<input value={adminName} onChange={(event) => setAdminName(event.target.value)} placeholder="Your full name" required minLength={2} /></label>
							<label className="field-label">School email<input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="admin@school.edu" required /></label>
							<label className="field-label">School phone<input value={schoolPhone} onChange={(event) => setSchoolPhone(event.target.value)} placeholder="Optional phone number" /></label>
							<label className="field-label">School address<textarea value={schoolAddress} onChange={(event) => setSchoolAddress(event.target.value)} placeholder="Optional school address" rows="2" /></label>
							<label className="field-label">Password<input type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="At least 8 characters" required minLength={8} /></label>
							<label className="field-label">Confirm password<input type="password" autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder="Repeat password" required minLength={8} /></label>
							{error && <div className="login-error" role="alert">{error}</div>}
							<button className="login-submit" type="submit" disabled={loading}>{loading ? 'Creating school…' : 'Create school administrator'}<ArrowRight size={16} /></button>
						</form>
					) : (
						<>
							<form onSubmit={submit}>
								{mode === 'register' && <label className="field-label">Full name<input autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Your name" required minLength={2} /></label>}
								<label className="field-label">School email<input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@school.edu" required /></label>
								<label className="field-label">Password<input type="password" autoComplete={mode === 'register' ? 'new-password' : 'current-password'} value={password} onChange={(event) => setPassword(event.target.value)} placeholder={mode === 'register' ? 'At least 8 characters' : 'Enter your password'} required minLength={8} /></label>
								{error && <div className="login-error" role="alert">{error}</div>}
								<button className="login-submit" type="submit" disabled={loading}>{loading ? 'Please wait…' : mode === 'register' ? 'Create account' : 'Sign in'}<ArrowRight size={16} /></button>
							</form>
							<div className="login-switch">{mode === 'register' ? 'Already have an account?' : 'New to the school portal?'} <button type="button" onClick={() => { setMode(mode === 'register' ? 'login' : 'register'); setError(''); }}>{mode === 'register' ? 'Sign in' : 'Create account'}</button></div>
							{mode === 'register' && <p className="auth-mode-note">Teacher, parent, and additional admin accounts are created by the school administrator.</p>}
							{!firebaseAuth && <p className="auth-mode-note">Firebase isn’t configured yet; sign-in uses the Express API.</p>}
							{resetSent && <div className="reset-success" role="status">Password reset email sent. Check your inbox and spam folder.</div>}
							{mode === 'login' && <button type="button" className="forgot-password" onClick={sendPasswordReset} disabled={loading}>Forgot password?</button>}
						</>
					)}

					<div className="login-card-foot">By continuing, you agree to the school’s <a href="#privacy">acceptable use policy</a>.</div>
				</section>
			</section>

			<footer className="login-footer"><span>© 2024 Abiola Academy</span><span>Learning happens everywhere <span className="footer-leaf">✳</span></span></footer>
		</main>
	);
}

export default Login;