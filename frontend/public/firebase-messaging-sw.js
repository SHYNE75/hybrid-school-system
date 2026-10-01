importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js');

const config = new URL(self.location.href).searchParams;
firebase.initializeApp({
  apiKey: config.get('apiKey'),
  authDomain: config.get('authDomain'),
  projectId: config.get('projectId'),
  appId: config.get('appId'),
  messagingSenderId: config.get('messagingSenderId'),
});

const messaging = firebase.messaging();
messaging.onBackgroundMessage(({ notification = {} }) => {
  self.registration.showNotification(notification.title || 'School update', {
    body: notification.body || 'You have a new school notification.',
    icon: '/favicon.ico',
  });
});