import { useEffect, useRef, useState } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { QRCodeSVG } from 'qrcode.react';
import { ArrowRight, Bell, BookOpen, Check, CreditCard, GraduationCap, QrCode, Search, Send, UserRoundCheck, Users } from 'lucide-react';
import { listenForMessages, registerForNotifications } from './firebase.js';
import { apiRequest as requestApi } from './api/client.js';

function apiRequest(path, session, options = {}) {
  return requestApi(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.token}`,
      ...options.headers,
    },
  });
}

function AttendancePage({ role, session, notify }) {
  const [records, setRecords] = useState([]);
  const [studentId, setStudentId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const scannerElementId = useRef(`qr-reader-${Math.random().toString(36).slice(2)}`);

  async function loadAttendance() {
    try {
      const result = await apiRequest('/api/attendance', session);
      setRecords(result.records);
      setError('');
    } catch (loadError) {
      setError(loadError.message);
    }
  }

  async function markAttendance(scannedId, source = 'online') {
    setBusy(true);
    setError('');
    try {
      await apiRequest('/api/attendance', session, {
        method: 'POST',
        body: JSON.stringify({ studentId: scannedId, source }),
      });
      setStudentId('');
      notify('Attendance recorded.');
      await loadAttendance();
    } catch (markError) {
      setError(markError.message);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => { loadAttendance(); }, [session.token]);

  useEffect(() => {
    if (!['teacher', 'admin'].includes(role)) return undefined;
    const scanner = new Html5QrcodeScanner(scannerElementId.current, { fps: 8, qrbox: { width: 220, height: 220 } }, false);
    scanner.render((decodedText) => {
      scanner.clear().catch(() => {});
      markAttendance(decodedText.trim(), 'qr');
    }, () => {});
    return () => scanner.clear().catch(() => {});
  }, [role, session.token]);

  return <section className="feature-workspace">
    <div className="feature-panel attendance-feature"><div className="feature-heading"><span className="feature-icon"><UserRoundCheck size={17} /></span><div><h2>Attendance register</h2><p>Current date · Entries are saved securely to Firestore</p></div></div>
      {['teacher', 'admin'].includes(role) && <div className="attendance-tools"><div className="scanner-wrap"><div className="feature-subheading"><QrCode size={15} /><strong>Scan student QR code</strong></div><div id={scannerElementId.current} className="qr-scanner" /><small>Allow camera access to scan a student’s personal attendance code.</small></div><form className="manual-mark" onSubmit={(event) => { event.preventDefault(); if (studentId.trim()) markAttendance(studentId.trim()); }}><strong>Or enter student ID</strong><label>Student ID<input value={studentId} onChange={(event) => setStudentId(event.target.value)} placeholder="Firebase student UID" required /></label><button className="feature-button" disabled={busy}>{busy ? 'Saving…' : 'Mark present'}<Check size={13} /></button></form></div>}
      {role === 'student' && <div className="student-qr"><div><strong>Your attendance code</strong><p>Show this code to a teacher when you arrive.</p></div><QRCodeSVG value={session.id} size={126} level="M" includeMargin /></div>}
      {role === 'parent' && <p className="feature-empty">Attendance for linked students appears here after their accounts are connected.</p>}
      {error && <p className="feature-error" role="alert">{error}</p>}
      <div className="record-list">{records.map((record) => <div className="record-item" key={record.id}><span className="record-dot" /><div><strong>{record.date}</strong><small>{record.source === 'qr' ? 'QR check-in' : 'Online attendance'}</small></div><span className={`record-status ${record.status}`}>{record.status}</span></div>)}{!records.length && !error && <p className="feature-empty">No attendance records yet.</p>}</div>
    </div>
  </section>;
}

function GradesPage({ role, session, notify }) {
  const [records, setRecords] = useState([]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function loadGrades() {
    try { const result = await apiRequest('/api/grades', session); setRecords(result.records); setError(''); }
    catch (loadError) { setError(loadError.message); }
  }

  async function submitGrade(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setSaving(true);
    setError('');
    try {
      await apiRequest('/api/grades', session, { method: 'POST', body: JSON.stringify({ studentId: form.get('studentId'), subject: form.get('subject'), assessment: form.get('assessment'), score: Number(form.get('score')), maxScore: Number(form.get('maxScore')), report: form.get('report') }) });
      event.currentTarget.reset();
      notify('Grade published to the student report.');
      await loadGrades();
    } catch (saveError) { setError(saveError.message); }
    finally { setSaving(false); }
  }

  useEffect(() => { loadGrades(); }, [session.token]);

  return <section className="feature-workspace">
    {['teacher', 'admin'].includes(role) && <form className="feature-panel grade-form" onSubmit={submitGrade}><div className="feature-heading"><span className="feature-icon"><Check size={17} /></span><div><h2>Publish a grade</h2><p>Students see published assessments in their reports.</p></div></div><div className="feature-form-grid"><label>Student UID<input name="studentId" required /></label><label>Subject<input name="subject" placeholder="Mathematics" required /></label><label>Assessment<input name="assessment" placeholder="Unit test" required /></label><label>Score<input name="score" type="number" min="0" required /></label><label>Maximum score<input name="maxScore" type="number" min="1" defaultValue="100" required /></label><label className="wide-field">Teacher report<textarea name="report" rows="2" maxLength="2000" placeholder="Feedback for the student" /></label></div><button className="feature-button" disabled={saving}>{saving ? 'Publishing…' : 'Publish grade'}<Check size={15} /></button></form>}
    <div className="feature-panel"><div className="feature-heading"><span className="feature-icon"><Check size={17} /></span><div><h2>{role === 'teacher' ? 'Recent submissions' : 'Grades & reports'}</h2><p>Saved grades and teacher feedback</p></div></div>{error && <p className="feature-error" role="alert">{error}</p>}<div className="record-list">{records.map((record) => <article className="grade-record" key={record.id}><div className="grade-score">{Math.round((record.score / record.maxScore) * 100)}<small>%</small></div><div><strong>{record.subject} · {record.assessment}</strong><small>{record.score} / {record.maxScore} points · {new Date(record.createdAt).toLocaleDateString()}</small>{record.report && <p>{record.report}</p>}</div></article>)}{!records.length && !error && <p className="feature-empty">No grades have been published yet.</p>}</div></div>
  </section>;
}

function FeesPage({ session, role, notify }) {
  const [records, setRecords] = useState([]);
  const [error, setError] = useState('');
  const [paying, setPaying] = useState('');

  async function loadFees() {
    try { const result = await apiRequest('/api/fees', session); setRecords(result.records); setError(''); }
    catch (loadError) { setError(loadError.message); }
  }

  useEffect(() => {
    loadFees();
    const reference = new URLSearchParams(window.location.search).get('reference');
    if (reference) {
      apiRequest(`/api/payments/verify/${encodeURIComponent(reference)}`, session)
        .then((result) => { notify(result.status === 'success' ? 'Payment verified.' : 'Payment has not completed.'); loadFees(); })
        .catch((verifyError) => setError(verifyError.message));
    }
  }, [session.token]);

  async function pay(fee) {
    setPaying(fee.id);
    setError('');
    try {
      const result = await apiRequest('/api/payments/initialize', session, { method: 'POST', body: JSON.stringify({ feeId: fee.id }) });
      window.location.assign(result.authorizationUrl);
    } catch (paymentError) { setError(paymentError.message); setPaying(''); }
  }

  return <section className="feature-workspace"><div className="feature-panel"><div className="feature-heading"><span className="feature-icon"><CreditCard size={17} /></span><div><h2>School fees</h2><p>Secure payments are processed by Paystack.</p></div></div>{error && <p className="feature-error" role="alert">{error}</p>}<div className="record-list">{records.map((fee) => <article className="fee-record" key={fee.id}><div><strong>{fee.title || fee.description || 'School fee'}</strong><small>Due {fee.dueDate || 'date not set'} · {fee.studentId}</small></div><strong className="fee-amount">₦{(fee.amountKobo / 100).toLocaleString()}</strong><span className={`record-status ${fee.status}`}>{fee.status}</span>{role === 'parent' && fee.status !== 'paid' && <button className="feature-button small-feature-button" onClick={() => pay(fee)} disabled={paying === fee.id}>{paying === fee.id ? 'Opening…' : 'Pay now'}<CreditCard size={14} /></button>}</article>)}{!records.length && !error && <p className="feature-empty">No fees are linked to this parent account yet.</p>}</div></div></section>;
}

function AdminOverviewPage({ session }) {
  const [overview, setOverview] = useState(null);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    apiRequest('/api/admin/overview', session)
      .then((result) => { if (active) setOverview(result); })
      .catch((loadError) => { if (active) setError(loadError.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [session.token]);

  const accounts = (overview?.accounts || []).filter((account) =>
    `${account.name} ${account.email} ${account.role} ${account.uid}`.toLowerCase().includes(search.toLowerCase()));
  const counts = overview?.counts || {};
  const summaryCards = [
    { label: 'Total accounts', value: counts.total || 0, icon: Users, tint: 'green' },
    { label: 'Students', value: counts.students || 0, icon: GraduationCap, tint: 'yellow' },
    { label: 'Teachers', value: counts.teachers || 0, icon: BookOpen, tint: 'blue' },
    { label: 'Parents', value: counts.parents || 0, icon: Users, tint: 'coral' },
  ];

  return <section className="feature-workspace admin-overview">
    <div className="metric-grid admin-account-counts">
      {summaryCards.map(({ label, value, icon: Icon, tint }) => <article className="metric-card" key={label}>
        <div className="metric-top"><span>{label}</span><span className={`metric-icon ${tint}`}><Icon size={17} /></span></div>
        <div className="metric-value">{value}</div>
      </article>)}
    </div>
    <div className="feature-panel">
      <div className="admin-accounts-heading">
        <div className="feature-heading"><span className="feature-icon"><Users size={17} /></span><div>
          <h2>{overview?.schoolName || session.schoolName || 'School'} accounts</h2>
          <p>Every administrator, teacher, student, and parent in this school.</p>
        </div></div>
        <label className="table-search admin-account-search"><Search size={15} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search accounts" aria-label="Search school accounts" /></label>
      </div>
      {error && <p className="feature-error" role="alert">{error}</p>}
      {loading ? <p className="feature-empty">Loading school accounts…</p> : error ? null : accounts.length ? <div className="table-wrap">
        <table className="admin-account-table"><thead><tr><th>NAME</th><th>EMAIL</th><th>ROLE</th><th>FIREBASE UID</th><th>LINKED STUDENTS</th><th>ADDED</th></tr></thead>
          <tbody>{accounts.map((account) => <tr key={account.uid}>
            <td><strong>{account.name || '—'}</strong></td>
            <td>{account.email || '—'}</td>
            <td><span className={`admin-role-badge ${account.role}`}>{account.role}</span></td>
            <td><code className="admin-account-uid" title={account.uid}>{account.uid}</code></td>
            <td>{account.role === 'parent' ? account.linkedStudentCount : '—'}</td>
            <td>{account.createdAt ? new Date(account.createdAt).toLocaleDateString() : '—'}</td>
          </tr>)}</tbody>
        </table>
      </div> : <p className="feature-empty">{search ? 'No accounts match your search.' : 'No school accounts have been added yet.'}</p>}
    </div>
  </section>;
}

function NotificationsPage({ role, session, notify }) {
  const [records, setRecords] = useState([]);
  const [error, setError] = useState('');
  const [pushMessage, setPushMessage] = useState('');
  const [sending, setSending] = useState(false);

  async function loadAnnouncements() {
    try { const result = await apiRequest('/api/announcements', session); setRecords(result.records); setError(''); }
    catch (loadError) { setError(loadError.message); }
  }

  useEffect(() => {
    loadAnnouncements();
    let unsubscribe;
    listenForMessages((payload) => setPushMessage(payload.notification?.title || 'New school notification.')).then((stop) => { unsubscribe = stop; });
    return () => unsubscribe?.();
  }, [session.token]);

  async function publish(event) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setSending(true);
    setError('');
    try {
      const result = await apiRequest('/api/announcements', session, { method: 'POST', body: JSON.stringify({ title: form.get('title'), body: form.get('body'), audience: form.get('audience') }) });
      formElement.reset();
      notify(result.pushWarning || `${role === 'admin' ? 'Message sent' : 'Announcement published'}${result.pushRecipients ? ` to ${result.pushRecipients} devices` : ''}.`);
      await loadAnnouncements();
    } catch (publishError) { setError(publishError.message); }
    finally { setSending(false); }
  }

  async function enablePush() {
    try {
      const token = await registerForNotifications();
      if (!token) throw new Error('Notifications are unavailable or permission was not granted.');
      await apiRequest('/api/auth/device-token', session, { method: 'POST', body: JSON.stringify({ token }) });
      notify('Notifications enabled on this device.');
    } catch (pushError) { setError(pushError.message); }
  }

  return <section className="feature-workspace"><div className="feature-panel"><div className="feature-heading"><span className="feature-icon"><Bell size={17} /></span><div><h2>{role === 'admin' ? 'Send a school message' : 'School announcements'}</h2><p>{role === 'admin' ? 'Send an update to everyone or a specific school group.' : 'Updates and reminders from your school community.'}</p></div><button className="quiet-button push-enable" onClick={enablePush}>Enable push</button></div>{pushMessage && <div className="push-message">{pushMessage}</div>}{error && <p className="feature-error" role="alert">{error}</p>}
    {['teacher', 'admin'].includes(role) && <form className="announcement-form" onSubmit={publish}><label>Title<input name="title" minLength="3" maxLength="120" required /></label><label>Message<textarea name="body" rows="3" minLength="3" maxLength="2000" required /></label><div className="announcement-submit"><select name="audience" defaultValue="all"><option value="all">All school</option><option value="students">Students</option><option value="parents">Parents</option><option value="teachers">Teachers</option></select><button className="feature-button" disabled={sending}>{sending ? 'Sending…' : role === 'admin' ? 'Send message' : 'Publish announcement'}<Send size={15} /></button></div></form>}
    <div className="record-list announcement-list">{records.map((record) => <article className="announcement-record" key={record.id}><span className="announcement-mark"><Bell size={15} /></span><div><strong>{record.title}</strong><small>{record.audience} · {new Date(record.createdAt).toLocaleString()}</small><p>{record.body}</p></div></article>)}{!records.length && !error && <p className="feature-empty">No announcements have been posted.</p>}</div></div></section>;
}

function ProvisioningPage({ session, notify }) {
  const [error, setError] = useState('');
  const [setupLink, setSetupLink] = useState('');
  const [saving, setSaving] = useState(false);

  async function submit(event, kind) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const body = Object.fromEntries(form.entries());
    if (kind === 'Parent') body.linkedStudents = String(body.linkedStudents).split(/[\s,]+/).map((uid) => uid.trim()).filter(Boolean);
    setSaving(true);
    setError('');
    setSetupLink('');
    try {
      const result = await apiRequest(`/api/add${kind}`, session, { method: 'POST', body: JSON.stringify(body) });
      formElement.reset();
      setSetupLink(result[kind.toLowerCase()].passwordSetupLink || '');
      notify(`${kind} account provisioned.`);
    } catch (submitError) { setError(submitError.message); }
    finally { setSaving(false); }
  }

  return <section className="feature-workspace provisioning-grid">
    <form className="feature-panel provisioning-form" onSubmit={(event) => submit(event, 'Teacher')}><div className="feature-heading"><span className="feature-icon"><BookOpen size={17} /></span><div><h2>Create teacher account</h2><p>Creates the Firebase login, teacher profile, and role access.</p></div></div><label>Name<input name="name" minLength="2" required /></label><label>Email<input name="email" type="email" required /></label><button className="feature-button" disabled={saving}>{saving ? 'Creating…' : 'Create teacher'}<ArrowRight size={15} /></button></form>
    <form className="feature-panel provisioning-form" onSubmit={(event) => submit(event, 'Parent')}><div className="feature-heading"><span className="feature-icon"><Users size={17} /></span><div><h2>Create parent account</h2><p>Links this parent to students from the account overview.</p></div></div><label>Name<input name="name" minLength="2" required /></label><label>Email<input name="email" type="email" required /></label><label>Linked student UIDs<textarea name="linkedStudents" rows="3" placeholder="One student UID per line" required /></label><button className="feature-button" disabled={saving}>{saving ? 'Creating…' : 'Create parent'}<ArrowRight size={15} /></button></form>
    <form className="feature-panel provisioning-form" onSubmit={(event) => submit(event, 'Student')}><div className="feature-heading"><span className="feature-icon"><GraduationCap size={17} /></span><div><h2>Create student account</h2><p>Creates a Firebase login and student profile.</p></div></div><label>Name<input name="name" minLength="2" required /></label><label>Email<input name="email" type="email" required /></label><button className="feature-button" disabled={saving}>{saving ? 'Creating…' : 'Create student'}<ArrowRight size={15} /></button></form>
    {error && <p className="feature-error" role="alert">{error}</p>}
    {setupLink && <div className="setup-link"><strong>One-time password setup link</strong><a href={setupLink} target="_blank" rel="noreferrer">Open account setup</a><span>Send this link to the account holder using your approved private channel.</span></div>}
  </section>;
}

function FeaturePages({ activeSection, role, session, notify }) {
  if (activeSection === 'Overview' && role === 'admin') return <AdminOverviewPage session={session} />;
  if (['Accounts', 'Provisioning'].includes(activeSection) && role === 'admin') return <ProvisioningPage session={session} notify={notify} />;
  if (activeSection === 'Messages' && role === 'admin') return <NotificationsPage role={role} session={session} notify={notify} />;
  if (activeSection === 'Attendance') return <AttendancePage role={role} session={session} notify={notify} />;
  if (activeSection === 'Grades') return <GradesPage role={role} session={session} notify={notify} />;
  if (activeSection === 'Fees' && ['parent', 'admin'].includes(role)) return <FeesPage session={session} role={role} notify={notify} />;
  if (activeSection === 'Notifications') return <NotificationsPage role={role} session={session} notify={notify} />;
  return <div className="feature-workspace"><p className="feature-empty">This section is not available for your account role.</p></div>;
}

export default FeaturePages;