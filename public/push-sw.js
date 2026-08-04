// Plain-JS service-worker script for per-user Web Push notifications (see
// NOTIFICATIONS_PLAN.md). Pulled into the Workbox-generated service worker via
// `workbox.importScripts: ["push-sw.js"]` in vite.config.ts, so this runs in
// the SAME service-worker scope as the generated sw.js — do not redeclare
// Workbox globals here, just add event listeners.
//
// Payload shape sent by the backend (api/utils/push.py `notify_users`):
//   { title: string, body: string, url: string }

self.addEventListener("push", (event) => {
  let title = "Greenroom";
  let body = "You have a new notification.";
  let url = "/";

  if (event.data) {
    try {
      const payload = event.data.json();
      if (payload && payload.title) title = payload.title;
      if (payload && payload.body) body = payload.body;
      if (payload && payload.url) url = payload.url;
    } catch {
      // Not JSON — fall back to plain text as the body.
      body = event.data.text();
    }
  }

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: "/icons/mac-192.png",
      badge: "/icons/mac-192.png",
      data: { url },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if ("focus" in client) {
            client.focus();
            // The page listens for this (see useNotificationsSync.ts) and
            // resolves `url` through the same /open/... deep-link logic
            // AppManager uses at boot, rather than a raw location change.
            client.postMessage({ type: "greenroom:notification-click", url });
            return;
          }
        }
        if (self.clients.openWindow) {
          return self.clients.openWindow(url);
        }
      })
  );
});
