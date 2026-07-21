// BassBuddy service worker — exists so the game installs to the home screen
// like a real app. It deliberately caches NOTHING: every request goes straight
// to the network, so version bumps keep cache-busting exactly as before.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => {});   // network passthrough
