const { Router } = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getPool } = require('../config/database');
const { getFirebaseAdmin, getFirestore } = require('../config/firebase');

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

router.post('/profile', async (request, response) => {
  const firebaseAdmin = getFirebaseAdmin();
  const firestore = getFirestore();
  if (!firebaseAdmin || !firestore) return response.status(503).json({ error: 'Firebase Admin credentials are not configured.' });
  const authorization = request.get('authorization') || '';
  if (!authorization.startsWith('Bearer ')) return response.status(401).json({ error: 'Firebase ID token is required.' });

  try {
    const decoded = await firebaseAdmin.auth().verifyIdToken(authorization.slice(7));
    const profileRef = firestore.collection('users').doc(decoded.uid);
    let profileSnapshot = await profileRef.get();
    if (!profileSnapshot.exists) {
      const profile = {
        uid: decoded.uid,
        email: decoded.email || '',
        name: decoded.name || '',
        role: 'student',
        studentIds: ['' + decoded.uid],
        createdAt: new Date().toISOString(),
      };
      await profileRef.create(profile);
      profileSnapshot = await profileRef.get();
    }
    const profile = profileSnapshot.data();
    if (!['student', 'teacher', 'parent'].includes(profile.role)) return response.status(403).json({ error: 'Your school account has an unsupported role.' });
    if (request.body.role && request.body.role !== profile.role) return response.status(403).json({ error: 'The selected role does not match your school account.' });
    return response.json({ user: { id: decoded.uid, email: decoded.email || profile.email, name: profile.name || decoded.name || '', role: profile.role, studentIds: profile.studentIds || [] } });
  } catch (error) {
    console.error('Firebase profile verification failed:', error.message);
    return response.status(401).json({ error: 'Unable to verify your school account.' });
  }
});

router.post('/device-token', require('../middleware/authenticate').authenticate, async (request, response) => {
  const firestore = getFirestore();
  const { token } = request.body;
  if (!firestore) return response.status(503).json({ error: 'Firestore is not configured.' });
  if (typeof token !== 'string' || token.length < 20 || token.length > 4096) return response.status(400).json({ error: 'Invalid notification token.' });
  try {
    const { getFirebaseAdmin } = require('../config/firebase');
    await firestore.collection('users').doc(request.schoolUser.id).set({ fcmTokens: getFirebaseAdmin().firestore.FieldValue.arrayUnion(token) }, { merge: true });
    return response.status(204).end();
  } catch (error) {
    console.error('Device token save failed:', error.message);
    return response.status(500).json({ error: 'Unable to enable notifications.' });
  }
});

module.exports = router;