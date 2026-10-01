const jwt = require('jsonwebtoken');
const { getFirebaseAdmin, getFirestore } = require('../config/firebase');

async function authenticate(request, response, next) {
  const authorization = request.get('authorization') || '';
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
  if (!token) return response.status(401).json({ error: 'Authentication is required.' });

  if (process.env.JWT_SECRET) {
    try {
      const claims = jwt.verify(token, process.env.JWT_SECRET);
      request.schoolUser = { id: String(claims.sub), role: claims.role, email: claims.email || null };
      request.firebaseUser = false;
      return next();
    } catch {
      // Firebase ID tokens are verified below when Admin credentials are available.
    }
  }

  const firebaseAdmin = getFirebaseAdmin();
  if (!firebaseAdmin) return response.status(503).json({ error: 'Firebase Admin credentials are not configured.' });

  try {
    const decoded = await firebaseAdmin.auth().verifyIdToken(token);
    const profileSnapshot = await getFirestore().collection('users').doc(decoded.uid).get();
    if (!profileSnapshot.exists) return response.status(403).json({ error: 'School profile has not been provisioned.' });
    request.schoolUser = { id: decoded.uid, email: decoded.email || null, ...profileSnapshot.data() };
    request.firebaseUser = true;
    return next();
  } catch (error) {
    console.error('Token verification failed:', error.message);
    return response.status(401).json({ error: 'Your session is invalid or expired.' });
  }
}

function requireRoles(...roles) {
  return (request, response, next) => {
    if (!request.schoolUser || !roles.includes(request.schoolUser.role)) {
      return response.status(403).json({ error: 'This action is not allowed for your account role.' });
    }
    return next();
  };
}

module.exports = { authenticate, requireRoles };