const apiKey = import.meta.env.VITE_FIREBASE_API_KEY;

export const firebaseConfig = {
  apiKey,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

let firebaseAppPromise;

async function getFirebaseApp() {
  if (!apiKey) return null;
  firebaseAppPromise ||= import('firebase/app').then(({ initializeApp, getApps }) =>
    getApps()[0] || initializeApp(firebaseConfig));
  return firebaseAppPromise;
}

export async function getFirestoreDb() {
  const app = await getFirebaseApp();
  if (!app) return null;
  const { getFirestore } = await import('firebase/firestore');
  return getFirestore(app);
}

function firebaseAuthError(code) {
  const messages = {
    EMAIL_EXISTS: 'An account already exists with this email.',
    EMAIL_NOT_FOUND: 'No account was found with this email.',
    INVALID_LOGIN_CREDENTIALS: 'The email or password is incorrect.',
    INVALID_PASSWORD: 'The email or password is incorrect.',
    USER_DISABLED: 'This account has been disabled.',
    TOO_MANY_ATTEMPTS_TRY_LATER: 'Too many attempts. Try again later.',
    WEAK_PASSWORD: 'The password must contain at least 6 characters.',
  };
  return messages[code] || 'Firebase Authentication could not complete that request.';
}

export const firebaseAuth = apiKey ? {
  async authenticate(mode, { email, password, name }) {
    const endpoint = mode === 'register' ? 'signUp' : 'signInWithPassword';
    let response;
    try {
      response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:${endpoint}?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, displayName: name, returnSecureToken: true }),
      });
    } catch {
      throw new Error('Cannot reach Firebase Authentication. Check your connection.');
    }
    const result = await response.json();
    if (!response.ok) {
      throw new Error(firebaseAuthError(result.error?.message));
    }
    return result;
  },
  async sendPasswordReset(email) {
    const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requestType: 'PASSWORD_RESET', email }),
    });
    const result = await response.json();
    if (!response.ok) {
      throw new Error(firebaseAuthError(result.error?.message));
    }
    return result;
  },
  async refreshIdToken(refreshToken) {
    const response = await fetch(`https://securetoken.googleapis.com/v1/token?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refreshToken }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error('Your Firebase session could not be refreshed. Sign in again.');
    return result;
  },
} : null;

export async function registerForNotifications() {
  const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY || import.meta.env.VITE_VAPID_PUBLIC_KEY;
  if (!apiKey || !vapidKey || typeof Notification === 'undefined') return null;
  const { getMessaging, getToken, isSupported } = await import('firebase/messaging');
  if (!(await isSupported())) return null;
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return null;
  const firebaseApp = await getFirebaseApp();
  const registration = await navigator.serviceWorker.register(`/firebase-messaging-sw.js?apiKey=${encodeURIComponent(apiKey)}&authDomain=${encodeURIComponent(firebaseConfig.authDomain)}&projectId=${encodeURIComponent(firebaseConfig.projectId)}&appId=${encodeURIComponent(firebaseConfig.appId)}&messagingSenderId=${encodeURIComponent(firebaseConfig.messagingSenderId)}`);
  return getToken(getMessaging(firebaseApp), { vapidKey, serviceWorkerRegistration: registration });
}

export async function listenForMessages(onNotification) {
  if (!apiKey) return () => {};
  const { getMessaging, isSupported, onMessage } = await import('firebase/messaging');
  if (!(await isSupported())) return () => {};
  const firebaseApp = await getFirebaseApp();
  return onMessage(getMessaging(firebaseApp), onNotification);
}