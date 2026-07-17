// Firebase Cloud Messaging Background Service Worker
// Scope: /firebase-cloud-messaging-push-scope (auto-assigned by Firebase SDK)
//
// This SW is SEPARATE from /sw.js (which handles caching). They coexist
// because Firebase owns a dedicated sub-scope and does not interfere
// with our caching SW at '/'.
//
// DEEP-LINK FIX: our notificationclick handler is registered BEFORE
// importScripts, so it runs ahead of the Firebase SDK's internal click
// handler. The SDK wraps auto-displayed notifications' payload inside
// event.notification.data.FCM_MSG — we resolve the URL from every
// possible location, then stopImmediatePropagation.

function tshResolveUrl(notification) {
  var d = (notification && notification.data) || {};
  var fcm = d.FCM_MSG || {};
  var url = d.url
    || (fcm.data && fcm.data.url)
    || (fcm.fcmOptions && fcm.fcmOptions.link)
    || (fcm.notification && fcm.notification.click_action)
    || '/ar/dashboard';
  try {
    var u = new URL(url, self.location.origin);
    url = (u.origin === self.location.origin) ? (u.pathname + u.search + u.hash) : '/ar/dashboard';
  } catch (e) { url = '/ar/dashboard'; }
  return url;
}

self.addEventListener('notificationclick', function (event) {
  if (event.action === 'dismiss') { event.notification.close(); return; }
  var url = tshResolveUrl(event.notification);
  event.stopImmediatePropagation();
  event.notification.close();
  event.waitUntil((async function () {
    var list = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (var i = 0; i < list.length; i++) {
      var client = list[i];
      if (client.url && client.url.indexOf(self.location.origin) === 0) {
        try { await client.focus(); } catch (e) {}
        try {
          if ('navigate' in client) { await client.navigate(url); }
          else { client.postMessage({ type: 'PUSH_NAVIGATE', url: url }); }
        } catch (e) {
          try { client.postMessage({ type: 'PUSH_NAVIGATE', url: url }); } catch (e2) {}
        }
        return;
      }
    }
    if (self.clients.openWindow) { try { await self.clients.openWindow(url); } catch (e) {} }
  })());
});

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

var messaging = firebase.messaging();

messaging.onBackgroundMessage(function (payload) {
  var n = payload.notification || {};
  var d = payload.data || {};
  var title = n.title || d.title || 'TSH';
  var options = {
    body: n.body || d.body || 'لديك إشعار جديد',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-192x192.png',
    tag: d.tag || 'tsh-clients-notification',
    renotify: true,
    requireInteraction: false,
    dir: 'rtl',
    lang: 'ar',
    data: Object.assign({ url: d.url || (payload.fcmOptions && payload.fcmOptions.link) || '/ar/dashboard' }, d),
    actions: [
      { action: 'open', title: 'فتح' },
      { action: 'dismiss', title: 'تجاهل' },
    ],
  };
  return self.registration.showNotification(title, options);
});
