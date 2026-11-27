const { Router } = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getPool } = require('../config/database');
const { getFirebaseAdmin, getFirestore, getFirestoreFieldValue } = require('../config/firebase');
const { addStudent, saveRoleProfile } = require('../services/firestoreService');

const router = Router();
const allowedRoles = new Set(['student', 'teacher', 'parent']);

function authUnavailable(response) {
  if (typeof process.env.JWT_SECRET !== 'string' || process.env.JWT_SECRET.length < 32) {
    response.status(503).json({ error: 'JWT_SECRET must be configured with at least 32 characters.' });
    return true;
  }

  if (!getPool()) {
    response.status(503).json({ error: 'MySQL is not configured. Set MYSQL_HOST, MYSQL_DATABASE, and MYSQL_USER.' });
    return true;
  }

  return false;
}

function issueToken(user) {
  return jwt.sign({ sub: String(user.id), role: user.role }, process.env.JWT_SECRET, { expiresIn: '8h' });
}

router.post('/register', async (request, response) => {
  if (authUnavailable(response)) return;

  const { name, email, password, role } = request.body;
  if (typeof name !== 'string' || name.trim().length < 2 ||
      typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      typeof password !== 'string' || password.length < 8 || role !== 'student') {
    return response.status(400).json({ error: 'Self-registration is for students. Teacher and parent accounts must be created by the school.' });
  }

  try {
    const pool = getPool();
    const passwordHash = await bcrypt.hash(password, 12);
    const [result] = await pool.execute(
      'INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)',
      [name.trim(), email.trim().toLowerCase(), passwordHash, role],
    );
    const user = { id: result.insertId, name: name.trim(), email: email.trim().toLowerCase(), role };
    return response.status(201).json({ token: issueToken(user), user });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return response.status(409).json({ error: 'An account with that email already exists.' });
    }
    console.error('Registration failed:', error.message);
    return response.status(500).json({ error: 'Unable to create the account.' });
  }
});

router.post('/login', async (request, response) => {
  if (authUnavailable(response)) return;

  const { email, password, role } = request.body;
  if (typeof email !== 'string' || typeof password !== 'string' || !allowedRoles.has(role)) {
    return response.status(400).json({ error: 'Enter your email, password, and account role.' });
  }

  try {
    const [users] = await getPool().execute(
      'SELECT id, name, email, password_hash, role FROM users WHERE email = ? LIMIT 1',
      [email.trim().toLowerCase()],
    );
    const user = users[0];
    if (!user || user.role !== role || !(await bcrypt.compare(password, user.password_hash))) {
      return response.status(401).json({ error: 'Email, password, or account role is incorrect.' });
    }

    return response.json({
      token: issueToken(user),
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    });
  } catch (error) {
    console.error('Login failed:', error.message);
    return response.status(500).json({ error: 'Unable to sign in.' });
  }
});

router.get('/setup-status', async (_request, response) => {
  const firestore = getFirestore();
  if (!firestore) return response.status(503).json({ error: 'Firebase Admin is not configured on the backend.', setupRequired: true });

  try {
    const schoolSnapshot = await firestore.collection('schools').doc('main').get();
    const adminSnapshot = await firestore.collection('admins').limit(1).get();
    const setupRequired = !schoolSnapshot.exists && adminSnapshot.empty;
    return response.json({ setupRequired });
  } catch (error) {
    console.error('Setup status failed:', error.message);
    return response.status(503).json({ error: 'Firebase/Firestore is temporarily unavailable.', setupRequired: true });
  }
});

router.post('/setup-school', async (request, response) => {
  const firebaseAdmin = getFirebaseAdmin();
  const firestore = getFirestore();
  if (!firebaseAdmin || !firestore) return response.status(503).json({ error: 'Firebase Admin is not configured on the backend.' });

  const authorization = request.get('authorization') || '';
  if (!authorization.startsWith('Bearer ')) return response.status(401).json({ error: 'Firebase ID token is required.' });

  try {
    const decoded = await firebaseAdmin.auth().verifyIdToken(authorization.slice(7));
    const schoolRef = firestore.collection('schools').doc('main');
    const schoolSnapshot = await schoolRef.get();
    const adminSnapshot = await firestore.collection('admins').limit(1).get();
    if (schoolSnapshot.exists || !adminSnapshot.empty) {
      return response.status(409).json({ error: 'School setup has already been completed.' });
    }

    const { schoolName, adminName, phone = '', address = '' } = request.body;
    if (typeof schoolName !== 'string' || schoolName.trim().length < 2 || typeof adminName !== 'string' || adminName.trim().length < 2) {
      return response.status(400).json({ error: 'Enter a school name and administrator name.' });
    }

    const email = String(decoded.email || '').trim().toLowerCase();
    if (!email) return response.status(400).json({ error: 'The administrator account must have an email address.' });

    await saveRoleProfile({ uid: decoded.uid, name: adminName.trim(), email, role: 'admin' });

    await schoolRef.create({
      name: schoolName.trim(),
      adminUid: decoded.uid,
      adminName: adminName.trim(),
      adminEmail: email,
      phone: String(phone).trim(),
      address: String(address).trim(),
      createdAt: new Date().toISOString(),
    });

    return response.status(201).json({
      user: { id: decoded.uid, email, name: adminName.trim(), role: 'admin', schoolName: schoolName.trim() },
      claimsRefreshRequired: true,
    });
  } catch (error) {
    console.error('School setup failed:', error.message);
    const credentialFailure = error.code === 'app/invalid-credential' || error.code === 16 || /credential|permission|Firestore/i.test(error.message);
    const status = credentialFailure ? 503 : (error.code === 'auth/id-token-expired' || error.code === 'auth/argument-error' ? 401 : 400);
    return response.status(status).json({ error: credentialFailure ? 'Firebase Admin/Firestore is not connected yet.' : (error.message || 'Unable to complete school setup.') });
  }
});

router.post('/profile', async (request, response) => {
  const firebaseAdmin = getFirebaseAdmin();
  const firestore = getFirestore();
  if (!firebaseAdmin || !firestore) {
    return response.status(503).json({ error: 'Firebase Admin is not configured on the backend.' });
  }

  const authorization = request.get('authorization') || '';
  if (!authorization.startsWith('Bearer ')) {
    return response.status(401).json({ error: 'Firebase ID token is required.' });
  }

  let decoded;
  try {
    decoded = await firebaseAdmin.auth().verifyIdToken(authorization.slice(7));
  } catch (error) {
    console.error('Firebase ID token verification failed:', error.message);
    return response.status(401).json({ error: 'Your Firebase session is invalid or expired. Sign in again.' });
  }

  try {
    const profileRef = firestore.collection('users').doc(decoded.uid);
    let profileSnapshot = await profileRef.get();

    if (!profileSnapshot.exists) {
      const schoolSnapshot = await firestore.collection('schools').doc('main').get();
      const selectedRole = request.body.role;

      if (!schoolSnapshot.exists) {
        return response.status(409).json({ error: 'School setup is required before creating a profile.', setupRequired: true });
      }

      if (selectedRole === 'student') {
        await addStudent(decoded.uid, decoded.name || decoded.email?.split('@')[0] || 'Student', decoded.email || '');
        profileSnapshot = await profileRef.get();
      } else {
        return response.status(403).json({ error: 'This account has not been provisioned by the school administrator.' });
      }
    }

    if (!profileSnapshot.exists) {
      return response.status(500).json({ error: 'Firebase profile could not be created.' });
    }

    const profile = profileSnapshot.data();
    if (!['student', 'teacher', 'parent', 'admin'].includes(profile.role)) {
      return response.status(403).json({ error: 'Your school account has an unsupported role.' });
    }
    if (request.body.role && request.body.role !== profile.role) {
      return response.status(403).json({ error: 'The selected role does not match your school account.' });
    }

    const roleCollection = `${profile.role}s`;
    const roleSnapshot = await firestore.collection(roleCollection).doc(decoded.uid).get();
    if (!roleSnapshot.exists) {
      await saveRoleProfile({
        uid: decoded.uid,
        name: profile.name || decoded.name || profile.email,
        email: decoded.email || profile.email,
        role: profile.role,
        linkedStudents: profile.linkedStudents || profile.studentIds || [],
      });
    }

    const linkedStudents = profile.linkedStudents || profile.studentIds || [];
    return response.json({
      user: {
        id: decoded.uid,
        email: decoded.email || profile.email,
        name: profile.name || decoded.name || profile.email?.split('@')[0] || 'School user',
        role: profile.role,
        studentIds: linkedStudents,
        linkedStudents,
      },
    });
  } catch (error) {
    console.error('Firebase profile processing failed:', error.message);
    return response.status(500).json({ error: 'The backend could not load or create your school profile.' });
  }
});

router.post('/device-token', require('../middleware/authenticate').authenticate, async (request, response) => {
  const firestore = getFirestore();
  const { token } = request.body;
  if (!firestore) return response.status(503).json({ error: 'Firestore is not configured.' });
  if (typeof token !== 'string' || token.length < 20 || token.length > 4096) return response.status(400).json({ error: 'Invalid notification token.' });
  try {
    await firestore.collection('users').doc(request.schoolUser.id).set({ fcmTokens: getFirestoreFieldValue().arrayUnion(token) }, { merge: true });
    return response.status(204).end();
  } catch (error) {
    console.error('Device token save failed:', error.message);
    return response.status(500).json({ error: 'Unable to enable notifications.' });
  }
});

module.exports = router;