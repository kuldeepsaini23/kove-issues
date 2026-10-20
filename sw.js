// Kove Remote service worker: makes the app installable and opens the shell
// offline. Only same-origin GETs are cached; WebSocket traffic never passes here.
const CACHE = "kove-remote-v7";
// The app may live in a folder (GitHub Pages: /kove-issues/): paths are relative to it.
const ROOT = new URL("./", self.registration.scope).pathname;

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll([ROOT, ROOT + "manifest.webmanifest", ROOT + "icon.svg"])));
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))));
  self.clients.claim();
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin || url.pathname.includes("/ws/")) return;
  // Network first, so a new build shows up at once; the cache covers being offline.
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(url.pathname === ROOT || e.request.mode === "navigate" ? ROOT : e.request, copy));
        }
        return res;
      })
      .catch(() => caches.match(e.request.mode === "navigate" ? ROOT : e.request).then((r) => r || Response.error())),
  );
});

// A push from your PC (encrypted end to end; the browser decrypted it): show it.
self.addEventListener("push", (e) => {
  let m = {};
  try {
    m = e.data ? e.data.json() : {};
  } catch {
    m = { title: "Kove", body: e.data ? e.data.text() : "" };
  }
  e.waitUntil(
    self.registration.showNotification(m.title || "Kove", {
      body: m.body || "",
      tag: m.tab || "kove",
      renotify: true,
      icon: ROOT + "icon.svg",
      data: { tab: m.tab || "" },
    }),
  );
});

// A tap opens Kove at that tab (an open window is reused).
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = ROOT + (e.notification.data && e.notification.data.tab ? "?tab=" + encodeURIComponent(e.notification.data.tab) : "");
  e.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if ("navigate" in c) return c.navigate(url).then((w) => (w || c).focus());
      }
      return self.clients.openWindow(url);
    }),
  );
});
