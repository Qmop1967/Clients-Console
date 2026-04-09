// Empty service worker - prevents 404 errors from external Flutter requests
// This file exists to gracefully handle requests from Flutter web apps
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', () => self.clients.claim());
