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

export const firebaseAuth = apiKey ? {
  async authenticate(mode, { email, password, name }) {
    const endpoint = mode === 'register' ? 'signUp' : 'signInWithPassword';
    const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:${endpoint}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, displayName: name, returnSecureToken: true }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error?.message || 'Firebase sign-in failed.');
    return result;
  },
} : null;

export async function registerForNotifications() {
  if (!apiKey || !import.meta.env.VITE_FIREBASE_VAPID_KEY || typeof Notification === 'undefined') return null;
  const { getMessaging, getToken, isSupported } = await import('firebase/messaging');
  if (!(await isSupported())) return null;
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return null;
  const firebaseApp = await getFirebaseApp();
  const registration = await navigator.serviceWorker.register(`/firebase-messaging-sw.js?apiKey=${encodeURIComponent(apiKey)}&authDomain=${encodeURIComponent(firebaseConfig.authDomain)}&projectId=${encodeURIComponent(firebaseConfig.projectId)}&appId=${encodeURIComponent(firebaseConfig.appId)}&messagingSenderId=${encodeURIComponent(firebaseConfig.messagingSenderId)}`);
  return getToken(getMessaging(firebaseApp), { vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY, serviceWorkerRegistration: registration });
}

export async function listenForMessages(onNotification) {
  if (!apiKey) return () => {};
  const { getMessaging, isSupported, onMessage } = await import('firebase/messaging');
  if (!(await isSupported())) return () => {};
  const firebaseApp = await getFirebaseApp();
  return onMessage(getMessaging(firebaseApp), onNotification);
}