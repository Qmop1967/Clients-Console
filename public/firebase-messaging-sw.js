// Firebase Cloud Messaging Background Service Worker
// Scope: /firebase-cloud-messaging-push-scope (auto-assigned by Firebase SDK)
//
// This SW is SEPARATE from /sw.js (which handles caching). They coexist
// because Firebase owns a dedicated sub-scope and does not interfere
// with our caching SW at '/'.

importScripts('https://www.gstatic.com/firebasejs/11.5.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/11.5.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'AIzaSyD8pEdiRmFWLNcuc4qmOc0p4pTG8t_GUlE',
  authDomain: 'tsh-erp-ecosystem.firebaseapp.com',
  projectId: 'tsh-erp-ecosystem',
  storageBucket: 'tsh-erp-ecosystem.firebasestorage.app',
  messagingSenderId: '1068595963477',
  appId: '1:1068595963477:web:28893bb197d93e029396dc',
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const title = payload.notification?.title || payload.data?.title || 'TSH';
  const options = {
    body: payload.notification?.body || payload.data?.body || 'لديك إشعار جديد',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-192x192.png',
    tag: payload.data?.tag || 'tsh-clients-notification',
    renotify: true,
    requireInteraction: false,
    dir: 'rtl',
    lang: 'ar',
    data: {
      url: payload.data?.url || payload.fcmOptions?.link || '/ar/dashboard',
      ...payload.data,
    },
    actions: [
      { action: 'open', title: 'فتح' },
      { action: 'dismiss', title: 'تجاهل' },
    ],
  };
  return self.registration.showNotification(title, options);
});

// Handle notification clicks — focus existing window or open the URL
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  if (event.action === 'dismiss') return;

  const url = event.notification.data?.url || '/ar/dashboard';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(new URL(url, self.location.origin).pathname) && 'focus' in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })
  );
});
