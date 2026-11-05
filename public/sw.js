/* Fotsography Studio — service worker (push notifications) */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
    let data = {};
    try {
        data = event.data ? event.data.json() : {};
    } catch {
        data = { title: 'Fotsography Studio', body: event.data ? event.data.text() : '' };
    }
    const title = data.title || 'Fotsography Studio';
    event.waitUntil(
        self.registration.showNotification(title, {
            body: data.body || '',
            icon: data.icon || '/icons/icon-192.png',
            badge: data.badge || '/icons/icon-192.png',
            data: data.data || { url: '/' },
            tag: data.tag,
        }),
    );
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    const url = (event.notification.data && event.notification.data.url) || '/';
    event.waitUntil(
        self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
            for (const client of clients) {
                if ('focus' in client) {
                    client.navigate(url);
                    return client.focus();
                }
            }
            return self.clients.openWindow(url);
        }),
    );
});
