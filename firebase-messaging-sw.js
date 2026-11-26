// خدمة الإشعارات لنظام الاستشارات: تعرض التنبيهات القادمة من Firebase حتى والنظام مغلق
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'AIzaSyDUDzOYvFnChyU3QU81RapJ7wG5VtzG0tU',
  authDomain: 'aq-consults.firebaseapp.com',
  projectId: 'aq-consults',
  storageBucket: 'aq-consults.firebasestorage.app',
  messagingSenderId: '1006318779836',
  appId: '1:1006318779836:web:d73eacdb83dea69e1abfb9'
});
firebase.messaging();

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

// عند الضغط على التنبيه: افتح النظام أو انتقل إلى نافذته المفتوحة
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = new URL('./', self.registration.scope).href;
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
    for (const c of list) { if (c.url.startsWith(url) && 'focus' in c) return c.focus(); }
    return self.clients.openWindow(url);
  }));
});
