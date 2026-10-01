import { useEffect, useRef, useState } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { QRCodeSVG } from 'qrcode.react';
import { Bell, Check, CreditCard, QrCode, Send, UserRoundCheck } from 'lucide-react';
import { listenForMessages, registerForNotifications } from './firebase.js';

async function apiRequest(path, session, options = {}) {
  const response = await fetch(`${import.meta.env.VITE_API_URL || ''}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.token}`,
      ...options.headers,
    },
  });
  const result = response.status === 204 ? {} : await response.json();
  if (!response.ok) throw new Error(result.error || 'The request could not be completed.');
  return result;
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
    if (role !== 'teacher') return undefined;
    const scanner = new Html5QrcodeScanner(scannerElementId.current, { fps: 8, qrbox: { width: 220, height: 220 } }, false);
    scanner.render((decodedText) => {
      scanner.clear().catch(() => {});
      markAttendance(decodedText.trim(), 'qr');
    }, () => {});
    return () => scanner.clear().catch(() => {});
  }, [role, session.token]);

  return <section className="feature-workspace">
    <div className="feature-panel attendance-feature"><div className="feature-heading"><span className="feature-icon"><UserRoundCheck size={17} /></span><div><h2>Attendance register</h2><p>Current date · Entries are saved securely to Firestore</p></div></div>
      {role === 'teacher' && <div className="attendance-tools"><div className="scanner-wrap"><div className="feature-subheading"><QrCode size={15} /><strong>Scan student QR code</strong></div><div id={scannerElementId.current} className="qr-scanner" /><small>Allow camera access to scan a student’s personal attendance code.</small></div><form className="manual-mark" onSubmit={(event) => { event.preventDefault(); if (studentId.trim()) markAttendance(studentId.trim()); }}><strong>Or enter student ID</strong><label>Student ID<input value={studentId} onChange={(event) => setStudentId(event.target.value)} placeholder="Firebase student UID" required /></label><button className="feature-button" disabled={busy}>{busy ? 'Saving…' : 'Mark present'}<Check size={15} /></button></form></div>}
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
    {role === 'teacher' && <form className="feature-panel grade-form" onSubmit={submitGrade}><div className="feature-heading"><span className="feature-icon"><Check size={17} /></span><div><h2>Publish a grade</h2><p>Students see published assessments in their reports.</p></div></div><div className="feature-form-grid"><label>Student UID<input name="studentId" required /></label><label>Subject<input name="subject" placeholder="Mathematics" required /></label><label>Assessment<input name="assessment" placeholder="Unit test" required /></label><label>Score<input name="score" type="number" min="0" required /></label><label>Maximum score<input name="maxScore" type="number" min="1" defaultValue="100" required /></label><label className="wide-field">Teacher report<textarea name="report" rows="2" maxLength="2000" placeholder="Feedback for the student" /></label></div><button className="feature-button" disabled={saving}>{saving ? 'Publishing…' : 'Publish grade'}<Check size={15} /></button></form>}
    <div className="feature-panel"><div className="feature-heading"><span className="feature-icon"><Check size={17} /></span><div><h2>{role === 'teacher' ? 'Recent submissions' : 'Grades & reports'}</h2><p>Saved grades and teacher feedback</p></div></div>{error && <p className="feature-error" role="alert">{error}</p>}<div className="record-list">{records.map((record) => <article className="grade-record" key={record.id}><div className="grade-score">{Math.round((record.score / record.maxScore) * 100)}<small>%</small></div><div><strong>{record.subject} · {record.assessment}</strong><small>{record.score} / {record.maxScore} points · {new Date(record.createdAt).toLocaleDateString()}</small>{record.report && <p>{record.report}</p>}</div></article>)}{!records.length && !error && <p className="feature-empty">No grades have been published yet.</p>}</div></div>
  </section>;
}

function FeesPage({ session, notify }) {
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

  return <section className="feature-workspace"><div className="feature-panel"><div className="feature-heading"><span className="feature-icon"><CreditCard size={17} /></span><div><h2>School fees</h2><p>Secure payments are processed by Paystack.</p></div></div>{error && <p className="feature-error" role="alert">{error}</p>}<div className="record-list">{records.map((fee) => <article className="fee-record" key={fee.id}><div><strong>{fee.title || fee.description || 'School fee'}</strong><small>Due {fee.dueDate || 'date not set'} · {fee.studentId}</small></div><strong className="fee-amount">₦{(fee.amountKobo / 100).toLocaleString()}</strong><span className={`record-status ${fee.status}`}>{fee.status}</span>{fee.status !== 'paid' && <button className="feature-button small-feature-button" onClick={() => pay(fee)} disabled={paying === fee.id}>{paying === fee.id ? 'Opening…' : 'Pay now'}<CreditCard size={14} /></button>}</article>)}{!records.length && !error && <p className="feature-empty">No fees are linked to this parent account yet.</p>}</div></div></section>;
}

function NotificationsPage({ role, session, notify }) {
  const [records, setRecords] = useState([]);
  const [error, setError] = useState('');
  const [pushMessage, setPushMessage] = useState('');

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
    const form = new FormData(event.currentTarget);
    try {
      const result = await apiRequest('/api/announcements', session, { method: 'POST', body: JSON.stringify({ title: form.get('title'), body: form.get('body'), audience: form.get('audience') }) });
      event.currentTarget.reset();
      notify(`Announcement published${result.pushRecipients ? ` to ${result.pushRecipients} devices` : ''}.`);
      await loadAnnouncements();
    } catch (publishError) { setError(publishError.message); }
  }

  async function enablePush() {
    try {
      const token = await registerForNotifications();
      if (!token) throw new Error('Notifications are unavailable or permission was not granted.');
      await apiRequest('/api/auth/device-token', session, { method: 'POST', body: JSON.stringify({ token }) });
      notify('Notifications enabled on this device.');
    } catch (pushError) { setError(pushError.message); }
  }

  return <section className="feature-workspace"><div className="feature-panel"><div className="feature-heading"><span className="feature-icon"><Bell size={17} /></span><div><h2>School announcements</h2><p>Updates and reminders from your school community.</p></div><button className="quiet-button push-enable" onClick={enablePush}>Enable push</button></div>{pushMessage && <div className="push-message">{pushMessage}</div>}{error && <p className="feature-error" role="alert">{error}</p>}
    {role === 'teacher' && <form className="announcement-form" onSubmit={publish}><label>Title<input name="title" minLength="3" maxLength="120" required /></label><label>Message<textarea name="body" rows="3" minLength="3" maxLength="2000" required /></label><div className="announcement-submit"><select name="audience" defaultValue="all"><option value="all">All school</option><option value="students">Students</option><option value="parents">Parents</option><option value="teachers">Teachers</option></select><button className="feature-button">Publish announcement<Send size={15} /></button></div></form>}
    <div className="record-list announcement-list">{records.map((record) => <article className="announcement-record" key={record.id}><span className="announcement-mark"><Bell size={15} /></span><div><strong>{record.title}</strong><small>{record.audience} · {new Date(record.createdAt).toLocaleString()}</small><p>{record.body}</p></div></article>)}{!records.length && !error && <p className="feature-empty">No announcements have been posted.</p>}</div></div></section>;
}

function FeaturePages({ activeSection, role, session, notify }) {
  if (activeSection === 'Attendance') return <AttendancePage role={role} session={session} notify={notify} />;
  if (activeSection === 'Grades') return <GradesPage role={role} session={session} notify={notify} />;
  if (activeSection === 'Fees' && role === 'parent') return <FeesPage session={session} notify={notify} />;
  if (activeSection === 'Notifications') return <NotificationsPage role={role} session={session} notify={notify} />;
  return <div className="feature-workspace"><p className="feature-empty">This section is not available for your account role.</p></div>;
}

export default FeaturePages;