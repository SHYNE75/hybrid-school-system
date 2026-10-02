const admin = require('firebase-admin');
const fs = require('node:fs');
const path = require('node:path');

const serviceAccountPaths = [
  process.env.FIREBASE_SERVICE_ACCOUNT_PATH,
  '/etc/secrets/serviceAccountKey.json',
  path.resolve(__dirname, '../../serviceAccountKey.json'),
].filter(Boolean);

function getFirebaseAdmin() {
  const { FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY } = process.env;
  const serviceAccountPath = serviceAccountPaths.find((candidate) => fs.existsSync(candidate));
  const serviceAccount = serviceAccountPath
    ? JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'))
    : null;
  if (!serviceAccount && (!FIREBASE_PROJECT_ID || !FIREBASE_CLIENT_EMAIL || !FIREBASE_PRIVATE_KEY)) return null;

  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount || {
        projectId: FIREBASE_PROJECT_ID,
        clientEmail: FIREBASE_CLIENT_EMAIL,
        privateKey: FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      }),
    });
  }

  return admin;
}

function getFirestore() {
  const firebaseAdmin = getFirebaseAdmin();
  return firebaseAdmin ? firebaseAdmin.firestore() : null;
}

module.exports = { getFirebaseAdmin, getFirestore };