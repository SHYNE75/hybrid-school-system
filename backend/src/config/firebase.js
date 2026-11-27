const fs = require('node:fs');
const path = require('node:path');
const { cert, getApps, initializeApp } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { getMessaging } = require('firebase-admin/messaging');

const serviceAccountPaths = [
  process.env.FIREBASE_SERVICE_ACCOUNT_PATH,
  '/etc/secrets/serviceAccountKey.json',
  path.resolve(__dirname, '../../serviceAccountKey.json'),
].filter(Boolean);

let firebaseApp = null;

function getFirebaseAdmin() {
  const { FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY } = process.env;

  if (!firebaseApp) {
    const existingApps = getApps();
    if (existingApps.length) {
      firebaseApp = existingApps[0];
    } else {
      const serviceAccountPath = serviceAccountPaths.find((candidate) => {
        try { return fs.existsSync(candidate); } catch { return false; }
      });

      let serviceAccount = null;
      if (serviceAccountPath) {
        try {
          serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
        } catch (error) {
          console.error('Firebase service account file is invalid:', error.message);
        }
      }

      let credential;
      if (serviceAccount?.project_id && serviceAccount?.client_email && serviceAccount?.private_key) {
        credential = cert(serviceAccount);
      } else if (FIREBASE_PROJECT_ID && FIREBASE_CLIENT_EMAIL && FIREBASE_PRIVATE_KEY) {
        credential = cert({
          projectId: FIREBASE_PROJECT_ID,
          clientEmail: FIREBASE_CLIENT_EMAIL,
          privateKey: FIREBASE_PRIVATE_KEY.replace(/\\r\\n/g, '\n').replace(/\\n/g, '\n').replace(/\r\n/g, '\n').trim(),
        });
      }

      if (!credential) return null;

      try {
        firebaseApp = initializeApp({ credential });
      } catch (error) {
        console.error('Firebase Admin initialization failed:', error.message);
        return null;
      }
    }
  }

  return {
    auth: () => getAuth(firebaseApp),
    firestore: () => getFirestore(firebaseApp),
    messaging: () => getMessaging(firebaseApp),
  };
}

function getFirestoreInstance() {
  const firebaseAdmin = getFirebaseAdmin();
  return firebaseAdmin ? firebaseAdmin.firestore() : null;
}

module.exports = {
  getFirebaseAdmin,
  getFirestore: getFirestoreInstance,
  getFirestoreFieldValue: () => FieldValue,
};