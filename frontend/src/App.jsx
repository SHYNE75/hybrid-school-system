import { Suspense, lazy, useMemo, useState } from 'react';
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  Bell,
  BookOpen,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  ClipboardCheck,
  CreditCard,
  Ellipsis,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  Megaphone,
  Search,
  Settings2,
  Sparkles,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import Login from './Login.jsx';
import { firebaseAuth } from './firebase.js';
const FeaturePages = lazy(() => import('./FeaturePages.jsx'));

const navigationByRole = {
  student: [
    { label: 'Overview', icon: LayoutDashboard },
    { label: 'Attendance', icon: ClipboardCheck },
    { label: 'Grades', icon: BookOpen },
    { label: 'Notifications', icon: Bell, count: '3' },
  ],
  teacher: [
    { label: 'Overview', icon: LayoutDashboard },
    { label: 'Attendance', icon: ClipboardCheck, count: '2' },
    { label: 'Grades', icon: BookOpen },
    { label: 'Notifications', icon: Bell, count: '3' },
  ],
  parent: [
    { label: 'Overview', icon: LayoutDashboard },
    { label: 'Attendance', icon: ClipboardCheck },
    { label: 'Grades', icon: BookOpen },
    { label: 'Fees', icon: CreditCard },
    { label: 'Notifications', icon: Bell, count: '3' },
  ],
};

const students = [
  { name: 'Amara Okafor', id: 'ST-2048', className: 'Grade 8 · Blue', status: 'Present', initials: 'AO', color: 'mint' },
  { name: 'Noah Mensah', id: 'ST-2036', className: 'Grade 8 · Blue', status: 'Present', initials: 'NM', color: 'peach' },
  { name: 'Zara Adebayo', id: 'ST-2029', className: 'Grade 8 · Blue', status: 'Late', initials: 'ZA', color: 'lilac' },
  { name: 'Ethan Kamau', id: 'ST-2017', className: 'Grade 8 · Blue', status: 'Absent', initials: 'EK', color: 'sky' },
];

const sectionContent = {
  Overview: {
    eyebrow: 'Monday, 16 September 2024',
    title: 'Good morning, Mara',
    subtitle: 'Here’s what’s happening across your school today.',
    metrics: [
      { label: 'Enrolled students', value: '1,284', change: '+4.8%', direction: 'up', icon: Users, tint: 'green' },
      { label: 'Present today', value: '1,176', change: '91.6%', direction: 'up', icon: ClipboardCheck, tint: 'yellow' },
      { label: 'Fee collection', value: '₦8.42m', change: '78% of term', direction: 'up', icon: Wallet, tint: 'blue' },
      { label: 'Average grade', value: 'B+', change: '0.3 this term', direction: 'up', icon: GraduationCap, tint: 'coral' },
    ],
    panelTitle: 'Attendance overview',
    panelNote: 'Across all grades · Today',
    tableTitle: 'Morning attendance',
    tableNote: 'Grade 8 · Blue · 32 students',
  },
  Attendance: {
    eyebrow: 'Monday, 16 September 2024',
    title: 'Attendance',
    subtitle: 'A clear view of who made it in, and who still needs a check-in.',
    metrics: [
      { label: 'Marked present', value: '1,176', change: '91.6% of school', direction: 'up', icon: ClipboardCheck, tint: 'green' },
      { label: 'Running late', value: '42', change: '3.3% of school', direction: 'down', icon: Activity, tint: 'yellow' },
      { label: 'Not yet marked', value: '18', change: '2 classes open', direction: 'down', icon: Users, tint: 'blue' },
      { label: 'Attendance rate', value: '94.2%', change: '+1.2% this week', direction: 'up', icon: GraduationCap, tint: 'coral' },
    ],
    panelTitle: 'Weekly attendance',
    panelNote: 'School-wide · This week',
    tableTitle: 'Grade 8 · Blue',
    tableNote: 'Morning register · 32 students',
  },
  Grades: {
    eyebrow: 'Term 3 · 2024',
    title: 'Academic progress',
    subtitle: 'Keep an eye on class performance and assessments in progress.',
    metrics: [
      { label: 'Class average', value: 'B+', change: '+0.3 this term', direction: 'up', icon: GraduationCap, tint: 'green' },
      { label: 'Assessments due', value: '12', change: 'Across 6 classes', direction: 'down', icon: BookOpen, tint: 'yellow' },
      { label: 'Results published', value: '86%', change: '4 awaiting review', direction: 'up', icon: ClipboardCheck, tint: 'blue' },
      { label: 'Teacher check-ins', value: '24', change: 'This week', direction: 'up', icon: Users, tint: 'coral' },
    ],
    panelTitle: 'Assessment completion',
    panelNote: 'Term 3 · By week',
    tableTitle: 'Recent results',
    tableNote: 'Grade 8 · Updated today',
  },
  Fees: {
    eyebrow: 'Term 3 · 2024',
    title: 'Fees & payments',
    subtitle: 'Track collections, outstanding balances and recent payments.',
    metrics: [
      { label: 'Collected this term', value: '₦8.42m', change: '+12.4% vs last term', direction: 'up', icon: Wallet, tint: 'green' },
      { label: 'Outstanding', value: '₦2.36m', change: '186 accounts', direction: 'down', icon: CreditCard, tint: 'yellow' },
      { label: 'Paid in full', value: '78%', change: '1,002 students', direction: 'up', icon: Check, tint: 'blue' },
      { label: 'Due this week', value: '₦640k', change: '48 families', direction: 'down', icon: CalendarDays, tint: 'coral' },
    ],
    panelTitle: 'Collections by week',
    panelNote: 'Term 3 · ₦ millions',
    tableTitle: 'Recent payments',
    tableNote: 'Settled · Today',
  },
  Notifications: {
    eyebrow: 'School community',
    title: 'Announcements',
    subtitle: 'Keep families and staff in the loop with timely updates.',
    metrics: [
      { label: 'Published this term', value: '18', change: '+3 this month', direction: 'up', icon: Megaphone, tint: 'green' },
      { label: 'Scheduled', value: '4', change: 'Next: tomorrow', direction: 'up', icon: CalendarDays, tint: 'yellow' },
      { label: 'Family reach', value: '94%', change: '+6% this term', direction: 'up', icon: Users, tint: 'blue' },
      { label: 'Unread notices', value: '127', change: 'Across 3 groups', direction: 'down', icon: Bell, tint: 'coral' },
    ],
    panelTitle: 'Notice engagement',
    panelNote: 'Open rate · This term',
    tableTitle: 'Latest announcements',
    tableNote: 'Shared with the school community',
  },
};

const roleOverview = {
  student: {
    title: 'Welcome back',
    subtitle: 'Here’s your learning day at a glance.',
    metrics: [
      { label: 'Attendance this term', value: '94.2%', change: '+1.2% this week', direction: 'up', icon: ClipboardCheck, tint: 'green' },
      { label: 'Current average', value: 'B+', change: '0.3 this term', direction: 'up', icon: GraduationCap, tint: 'yellow' },
      { label: 'Assignments due', value: '3', change: 'Next: tomorrow', direction: 'down', icon: BookOpen, tint: 'blue' },
      { label: 'New notifications', value: '3', change: 'Since your last visit', direction: 'up', icon: Bell, tint: 'coral' },
    ],
    panelTitle: 'My attendance',
    panelNote: 'Your school week · This week',
    tableTitle: 'Recent class activity',
    tableNote: 'Your latest attendance updates',
  },
  teacher: {
    title: 'Good morning',
    subtitle: 'Your classes and school tasks for today.',
    metrics: [
      { label: 'Students in your classes', value: '126', change: 'Across 4 classes', direction: 'up', icon: Users, tint: 'green' },
      { label: 'Attendance to review', value: '2', change: 'Registers still open', direction: 'down', icon: ClipboardCheck, tint: 'yellow' },
      { label: 'Grades to publish', value: '8', change: 'Across 3 assessments', direction: 'down', icon: BookOpen, tint: 'blue' },
      { label: 'New notifications', value: '3', change: 'Since your last visit', direction: 'up', icon: Bell, tint: 'coral' },
    ],
    panelTitle: 'Class attendance',
    panelNote: 'Your classes · This week',
    tableTitle: 'Your class registers',
    tableNote: 'Recent attendance updates',
  },
  parent: {
    title: 'Welcome back',
    subtitle: 'Your family’s school updates, together in one place.',
    metrics: [
      { label: 'Attendance this term', value: '94.2%', change: '+1.2% this week', direction: 'up', icon: ClipboardCheck, tint: 'green' },
      { label: 'Latest grade average', value: 'B+', change: '0.3 this term', direction: 'up', icon: GraduationCap, tint: 'yellow' },
      { label: 'Fees due', value: '₦64,000', change: 'Due 30 September', direction: 'down', icon: Wallet, tint: 'blue' },
      { label: 'New notifications', value: '3', change: 'Since your last visit', direction: 'up', icon: Bell, tint: 'coral' },
    ],
    panelTitle: 'School updates',
    panelNote: 'Your child’s week · This week',
    tableTitle: 'Recent family updates',
    tableNote: 'Attendance and school activity',
  },
};

const detailItems = {
  Grades: [
    { title: 'Mathematics', subtitle: 'Fractions assessment · 12 Sep', value: 'A · 92%', state: 'Published' },
    { title: 'English language', subtitle: 'Book review · 10 Sep', value: 'B+ · 88%', state: 'Published' },
    { title: 'Integrated science', subtitle: 'Ecosystems quiz · 9 Sep', value: 'B · 84%', state: 'Published' },
  ],
  Fees: [
    { title: 'Term 3 tuition', subtitle: 'Due 30 September 2024', value: '₦64,000', state: 'Outstanding' },
    { title: 'Learning materials', subtitle: 'Paid 4 September 2024', value: '₦18,500', state: 'Paid' },
    { title: 'Transport', subtitle: 'Paid 1 September 2024', value: '₦22,000', state: 'Paid' },
  ],
  Notifications: [
    { title: 'Sports day schedule', subtitle: 'From School administration · 10:24', value: 'Today', state: 'New' },
    { title: 'Grade 8 parent meeting', subtitle: 'From Class coordinator · 13 Sep', value: '16 Sep', state: 'Reminder' },
    { title: 'Term 3 calendar published', subtitle: 'From School administration · 11 Sep', value: '11 Sep', state: 'Read' },
  ],
};

const chartData = [
  { day: 'Mon', value: 77 }, { day: 'Tue', value: 88 }, { day: 'Wed', value: 82 },
  { day: 'Thu', value: 95 }, { day: 'Fri', value: 91 },
];

function App() {
  const [session, setSession] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem('school-session')); }
    catch { return null; }
  });
  const [activeSection, setActiveSection] = useState(() => new URLSearchParams(window.location.search).has('reference') ? 'Fees' : 'Overview');
  const [search, setSearch] = useState('');
  const [marked, setMarked] = useState({});
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [notice, setNotice] = useState('');
  const role = session?.role || 'student';
  const navigation = navigationByRole[role] || navigationByRole.student;
  const overview = roleOverview[role] || roleOverview.student;
  const firstName = (session?.name || session?.email?.split('@')[0] || '').split(' ')[0];
  const current = activeSection === 'Overview'
    ? { ...sectionContent.Overview, ...overview }
    : sectionContent[activeSection] || sectionContent.Overview;
  const filteredStudents = useMemo(() => students.filter((student) =>
    `${student.name} ${student.id} ${student.className}`.toLowerCase().includes(search.toLowerCase())), [search]);

  if (!session) return <Login onAuthenticated={establishSession} />;

  function establishSession(value) {
    sessionStorage.setItem('school-session', JSON.stringify(value));
    setSession(value);
  }

  function toggleAttendance(id) {
    setMarked((previous) => ({ ...previous, [id]: !previous[id] }));
  }

  function notify(message) {
    setNotice(message);
    window.setTimeout(() => setNotice(''), 2800);
  }

  function logout() {
    sessionStorage.removeItem('school-session');
    setSession(null);
    setActiveSection('Overview');
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="#overview" onClick={() => setActiveSection('Overview')} aria-label="Fieldnote home">
          <span className="brand-mark"><span /></span>
          <span className="brand-name">fieldnote<span className="brand-period">.</span></span>
        </a>

        <div className="school-switcher">
          <div className="school-crest">A</div>
          <div className="school-copy"><strong>Abiola Academy</strong><span>School workspace</span></div>
          <ChevronDown size={15} />
        </div>

        <div className="nav-label">WORKSPACE</div>
        <nav className="main-nav" aria-label="Main navigation">
          {navigation.map(({ label, icon: Icon, count }) => (
            <button key={label} className={`nav-link ${activeSection === label ? 'active' : ''}`} onClick={() => setActiveSection(label)}>
              <Icon size={17} strokeWidth={1.8} />
              <span>{label}</span>
              {count && <span className={`nav-count ${label === 'Announcements' ? 'soft-count' : ''}`}>{count}</span>}
            </button>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <div className="term-card">
            <div className="term-icon"><Sparkles size={15} /></div>
            <div><span>Current term</span><strong>Term 3 · 2024</strong></div>
            <ChevronRight size={15} />
          </div>
          <button className="nav-link" onClick={() => notify('Settings are ready to connect to your school account.')}><Settings2 size={17} /><span>Settings</span></button>
          <button className="nav-link" onClick={() => notify('Help centre is coming soon.')}><CircleHelp size={17} /><span>Help centre</span></button>
          <div className="sidebar-user">
            <div className="avatar avatar-admin">{(session.name || session.email).slice(0, 2).toUpperCase()}</div>
            <div className="user-copy"><strong>{session.name || session.email.split('@')[0]}</strong><span>{role[0].toUpperCase() + role.slice(1)}</span></div>
            <button aria-label="Open account menu" className="icon-button user-menu" onClick={() => setProfileOpen(!profileOpen)}><Ellipsis size={18} /></button>
            {profileOpen && <div className="profile-menu"><button onClick={() => notify(`Signed in as ${session.email}.`)}><Settings2 size={15} /> Account settings</button><button onClick={logout}><LogOut size={15} /> Sign out</button></div>}
          </div>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div className="breadcrumbs"><span>Abiola Academy</span><ChevronRight size={14} /><strong>{activeSection}</strong></div>
          <div className="topbar-actions">
            <label className="search-box"><Search size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search students, classes..." aria-label="Search students and classes" /><kbd>⌘ K</kbd></label>
            <div className="notification-wrap">
              <button className={`icon-button notification-button ${notificationsOpen ? 'pressed' : ''}`} aria-label="Notifications" onClick={() => setNotificationsOpen(!notificationsOpen)}><Bell size={18} /><i /></button>
              {notificationsOpen && <div className="notification-popover"><div className="popover-heading"><strong>Notifications</strong><span>3 new</span></div><p><b>Attendance needs attention</b><br />2 classes haven’t submitted their register.</p><p><b>Payment received</b><br />₦48,000 from T. Okafor · 12 min ago</p><p><b>New announcement</b><br />Sports day update is ready to review.</p></div>}
            </div>
            <div className="topbar-date"><CalendarDays size={16} /><span>Mon, 16 Sep</span></div>
          </div>
        </header>

        <div className="page-content">
          <section className="welcome-row">
            <div><div className="eyebrow"><span className="eyebrow-dot" />{current.eyebrow}</div><h1>{activeSection === 'Overview' ? `${current.title}, ${firstName}` : current.title}<span className="title-period">.</span></h1><p>{current.subtitle}</p></div>
            <button className="primary-button" onClick={() => notify(activeSection === 'Attendance' ? 'Attendance register opened.' : activeSection === 'Grades' && role === 'teacher' ? 'Grade entry is coming in the next module.' : 'Your workspace is up to date.')}><span>+</span>{activeSection === 'Attendance' && role === 'teacher' ? 'Take attendance' : activeSection === 'Grades' && role === 'teacher' ? 'Add grades' : 'Quick action'}</button>
          </section>

          <section className="metric-grid" aria-label="Key school metrics">
            {current.metrics.map(({ label, value, change, direction, icon: Icon, tint }) => (
              <article className="metric-card" key={label}>
                <div className="metric-top"><span>{label}</span><span className={`metric-icon ${tint}`}><Icon size={17} strokeWidth={1.8} /></span></div>
                <div className="metric-value">{value}</div>
                <div className="metric-change"><span className={direction === 'down' ? 'change-down' : ''}>{direction === 'down' ? <ArrowDownRight size={14} /> : <ArrowUpRight size={14} />}{change}</span>{activeSection === 'Overview' && label === 'Present today' ? <em>on track</em> : null}</div>
              </article>
            ))}
          </section>

          {activeSection !== 'Overview' && <Suspense fallback={<section className="feature-workspace"><p className="feature-empty">Opening school records…</p></section>}><FeaturePages activeSection={activeSection} role={role} session={session} notify={notify} /></Suspense>}

          <section className={`dashboard-grid ${activeSection === 'Overview' ? '' : 'is-hidden'}`}>
            <article className="panel attendance-panel">
              <div className="panel-heading"><div><h2>{current.panelTitle}</h2><p>{current.panelNote}</p></div><button className="quiet-button">This week <ChevronDown size={14} /></button></div>
              <div className="chart-summary"><div><strong>{activeSection === 'Attendance' ? '94.2%' : activeSection === 'Grades' ? '86%' : activeSection === 'Fees' ? '₦8.42m' : '91.6%'}</strong><span><i />{activeSection === 'Fees' ? 'collected so far' : 'vs. 88.4% last week'}</span></div><div className="chart-legend"><span><i className="legend-current" />This week</span><span><i className="legend-last" />Last week</span></div></div>
              <div className="bar-chart" aria-label="Weekly school performance chart">
                <div className="chart-guides"><span>100%</span><span>75%</span><span>50%</span><span>25%</span></div>
                <div className="bar-columns">{chartData.map((item, index) => <div className="bar-group" key={item.day}><div className="bars"><div className="bar last-bar" style={{ height: `${item.value - 12}%` }} /><div className={`bar current-bar ${index === 3 ? 'highlight-bar' : ''}`} style={{ height: `${item.value}%` }} /></div><span>{item.day}</span></div>)}</div>
              </div>
            </article>

            <article className="panel schedule-panel">
              <div className="panel-heading"><div><h2>On the calendar</h2><p>What’s coming up today</p></div><button className="icon-button small-icon" aria-label="See full calendar" onClick={() => notify('Calendar view opened.')}><ChevronRight size={17} /></button></div>
              <div className="calendar-day"><button aria-label="Previous day"><ChevronLeft size={15} /></button><div><strong>Monday</strong><span>16 September</span></div><button aria-label="Next day"><ChevronRight size={15} /></button></div>
              <div className="event-list">
                <div className="event-item"><span className="event-time">09:00</span><span className="event-line green-line" /><div><strong>Staff assembly</strong><span>School hall · All staff</span></div><span className="event-tag green-tag">Now</span></div>
                <div className="event-item"><span className="event-time">11:30</span><span className="event-line yellow-line" /><div><strong>Grade 8 parent meeting</strong><span>Room 204 · 12 attendees</span></div></div>
                <div className="event-item"><span className="event-time">14:00</span><span className="event-line blue-line" /><div><strong>Science fair planning</strong><span>Science lab · Grade leads</span></div></div>
              </div>
              <button className="text-action" onClick={() => notify('Full calendar opened.')}>View full calendar <ArrowUpRight size={14} /></button>
            </article>
          </section>

          {activeSection === 'Overview' ? <section className="panel register-panel">
            <div className="panel-heading register-heading"><div><div className="heading-with-icon"><span className="mini-heading-icon"><ClipboardCheck size={15} /></span><h2>{current.tableTitle}</h2></div><p>{current.tableNote}</p></div><div className="register-actions"><label className="table-search"><Search size={15} /><input placeholder="Find a student" value={search} onChange={(event) => setSearch(event.target.value)} aria-label="Find a student" /></label><button className="quiet-button" onClick={() => notify('Register exported as a report.')}>Export <ArrowUpRight size={14} /></button></div></div>
            <div className="table-wrap"><table><thead><tr><th>STUDENT</th><th>CLASS</th><th>STATUS</th><th className="action-column">ACTION</th></tr></thead><tbody>{filteredStudents.map((student) => { const isPresent = marked[student.id] ?? student.status === 'Present'; return <tr key={student.id}><td><div className="student-cell"><span className={`avatar avatar-${student.color}`}>{student.initials}</span><span><strong>{student.name}</strong><small>{student.id}</small></span></div></td><td className="class-cell">{student.className}</td><td><span className={`status-pill ${isPresent ? 'present' : student.status === 'Late' ? 'late' : 'absent'}`}><i />{isPresent ? 'Present' : student.status === 'Late' ? 'Late' : 'Absent'}</span></td><td className="action-column"><button className={`mark-button ${isPresent ? 'marked' : ''}`} onClick={() => toggleAttendance(student.id)} aria-label={`${isPresent ? 'Mark absent' : 'Mark present'}: ${student.name}`}>{isPresent ? <><Check size={13} /> Marked</> : 'Mark present'}</button></td></tr>; })}</tbody></table>{filteredStudents.length === 0 && <div className="empty-state">No students match “{search}”.</div>}</div>
            <div className="table-footer"><span>Showing <strong>{filteredStudents.length ? '1–' + filteredStudents.length : '0'}</strong> of 32 students</span><div><button className="icon-button pager-button" aria-label="Previous page"><ChevronLeft size={15} /></button><button className="icon-button pager-button" aria-label="Next page"><ChevronRight size={15} /></button></div></div>
          </section> : <section className="panel register-panel detail-panel">
            <div className="panel-heading register-heading"><div><div className="heading-with-icon"><span className="mini-heading-icon"><BookOpen size={15} /></span><h2>{current.tableTitle}</h2></div><p>{current.tableNote}</p></div><button className="quiet-button" onClick={() => notify(`${activeSection} report prepared.`)}>View all <ArrowUpRight size={14} /></button></div>
            <div className="detail-list">{(detailItems[activeSection] || []).map((item) => <article className="detail-row" key={item.title}><span className="detail-marker" /><div className="detail-copy"><strong>{item.title}</strong><span>{item.subtitle}</span></div><span className="detail-value">{item.value}</span><span className={`detail-state ${item.state.toLowerCase()}`}>{item.state}</span><button className="icon-button small-icon" aria-label={`Open ${item.title}`} onClick={() => notify(`${item.title} details opened.`)}><ChevronRight size={16} /></button></article>)}</div>
            <div className="table-footer"><span>Showing <strong>{(detailItems[activeSection] || []).length}</strong> recent items</span><div><button className="icon-button pager-button" aria-label="Previous page"><ChevronLeft size={15} /></button><button className="icon-button pager-button" aria-label="Next page"><ChevronRight size={15} /></button></div></div>
          </section>}
          <footer className="page-footer"><span>Fieldnote <i>·</i> Abiola Academy</span><span>Last synced just now <span className="sync-dot" /></span></footer>
        </div>
      </main>
      {notice && <div className="toast" role="status"><Check size={16} />{notice}<button onClick={() => setNotice('')} aria-label="Dismiss"><X size={15} /></button></div>}
    </div>
  );
}

export default App;