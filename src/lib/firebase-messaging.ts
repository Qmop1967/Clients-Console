// Firebase Cloud Messaging (FCM) for tsh-clients PWA
// Separate from src/lib/firebase.ts which handles OTP auth only.
//
// Reuses the same Firebase app instance (singleton across both modules)
// so there is no duplicate initialization and both features share a
// single Firebase connection.

import { getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import { getMessaging, getToken, onMessage, isSupported, type Messaging } from 'firebase/messaging';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

let messagingInstance: Messaging | null = null;

function getApp(): FirebaseApp | null {
  if (typeof window === 'undefined') return null;
  if (!firebaseConfig.apiKey || !firebaseConfig.projectId) return null;
  const existing = getApps();
  return existing.length ? existing[0] : initializeApp(firebaseConfig);
}

async function getMessagingInstance(): Promise<Messaging | null> {
  if (typeof window === 'undefined') return null;
  const supported = await isSupported().catch(() => false);
  if (!supported) return null;
  if (messagingInstance) return messagingInstance;
  const app = getApp();
  if (!app) return null;
  messagingInstance = getMessaging(app);
  return messagingInstance;
}

/**
 * Ask the user for notification permission and return an FCM token.
 * Returns null if permission is denied, browser does not support FCM,
 * VAPID key is missing, or any step in the flow fails.
 *
 * Safe to call from any page — all failures are caught and logged.
 */
export async function requestFcmToken(): Promise<string | null> {
  try {
    if (!('Notification' in window)) return null;

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return null;

    const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;
    if (!vapidKey) {
      console.warn('[FCM] VAPID key missing — push disabled');
      return null;
    }

    const msg = await getMessagingInstance();
    if (!msg) return null;

    // Register the dedicated Firebase messaging service worker at its own scope,
    // separate from our /sw.js (which handles caching). The two coexist because
    // they have non-overlapping scopes.
    let swReg = await navigator.serviceWorker.getRegistration('/firebase-cloud-messaging-push-scope');
    if (!swReg) {
      swReg = await navigator.serviceWorker.register('/firebase-messaging-sw.js', {
        scope: '/firebase-cloud-messaging-push-scope',
      });
    }

    const token = await getToken(msg, {
      vapidKey,
      serviceWorkerRegistration: swReg,
    });

    return token || null;
  } catch (err) {
    console.warn('[FCM] requestFcmToken failed:', err);
    return null;
  }
}

/**
 * Subscribe to foreground messages (app is open + tab is focused).
 * Background messages are handled by firebase-messaging-sw.js directly.
 *
 * Returns an unsubscribe function; null if FCM is not available.
 */
export async function subscribeForegroundMessages(
  callback: (payload: { title?: string; body?: string; data?: Record<string, string> }) => void
): Promise<(() => void) | null> {
  const msg = await getMessagingInstance();
  if (!msg) return null;
  const unsub = onMessage(msg, (payload) => {
    callback({
      title: payload.notification?.title || (payload.data?.title as string | undefined),
      body: payload.notification?.body || (payload.data?.body as string | undefined),
      data: (payload.data as Record<string, string>) || {},
    });
  });
  return unsub;
}
