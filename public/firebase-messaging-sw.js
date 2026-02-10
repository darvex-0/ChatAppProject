// Scripts for firebase messaging service worker
importScripts('https://www.gstatic.com/firebasejs/9.22.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.22.0/firebase-messaging-compat.js');

const firebaseConfig = {
    apiKey: "AIzaSyC0N-K5E7pfOs1wPYuSVIZ3bvUzSNA4qcY",
    authDomain: "chatapp-f20ea.firebaseapp.com",
    projectId: "chatapp-f20ea",
    storageBucket: "chatapp-f20ea.firebasestorage.app",
    databaseURL: "https://chatapp-f20ea-default-rtdb.firebaseio.com",
    messagingSenderId: "853734238442",
    appId: "1:853734238442:web:4f06be4ba7fd55419fcf93"
};

firebase.initializeApp(firebaseConfig);

const messaging = firebase.messaging();

messaging.onBackgroundMessage(function (payload) {
    console.log('[firebase-messaging-sw.js] Received background message ', payload);

    // Check if this is an incoming call data message (from onCallCreated Cloud Function)
    if (payload.data && payload.data.type === 'INCOMING_CALL') {
        const callerName = payload.data.callerName || 'Someone';
        const callType = payload.data.callType || 'audio';
        const icon = callType === 'video' ? '📹' : '📞';

        return self.registration.showNotification(`${icon} Incoming ${callType} call`, {
            body: `${callerName} is calling...`,
            icon: '/icon-192.png',
            tag: 'incoming-call',
            requireInteraction: true,
            vibrate: [200, 100, 200, 100, 200, 100, 200],
            data: payload.data, // Pass call data for click handling
            actions: [
                { action: 'answer', title: '📞 Answer' },
                { action: 'decline', title: '❌ Decline' }
            ]
        });
    }

    // Regular chat notification (has notification key)
    if (payload.notification) {
        const notificationTitle = payload.notification.title;
        const notificationOptions = {
            body: payload.notification.body,
            icon: '/icon-192.png'
        };
        self.registration.showNotification(notificationTitle, notificationOptions);
    }
});

// PWA Offline Caching
const CACHE_NAME = 'connecthub-v1';
const urlsToCache = [
    '/',
    '/index.html',
    '/icon-192.png',
    '/icon-512.png'
];

// Install event - cache resources
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => cache.addAll(urlsToCache))
    );
    self.skipWaiting();
});

// Activate event - cleanup old caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
    self.clients.claim();
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
    // Skip non-GET requests
    if (event.request.method !== 'GET') return;

    // Skip Firebase API calls (let them hit network)
    if (event.request.url.includes('firebasestorage.googleapis.com') ||
        event.request.url.includes('firebaseio.com') ||
        event.request.url.includes('firestore.googleapis.com')) {
        return;
    }

    event.respondWith(
        caches.match(event.request)
            .then((response) => {
                // Cache hit - return response
                if (response) {
                    return response;
                }

                // Clone request for fetch
                return fetch(event.request).then((response) => {
                    // Don't cache if not a valid response
                    if (!response || response.status !== 200 || response.type !== 'basic') {
                        return response;
                    }

                    // Clone response to cache
                    const responseToCache = response.clone();
                    caches.open(CACHE_NAME)
                        .then((cache) => {
                            cache.put(event.request, responseToCache);
                        });

                    return response;
                });
            })
    );
});

// ============================================
// PWA VIDEO CALLING - NOTIFICATION HANDLERS
// ============================================

// Handle incoming call notifications from client
self.addEventListener('message', (event) => {
    if (event.data?.type === 'INCOMING_CALL') {
        self.registration.showNotification('Incoming Call', {
            body: `${event.data.callerName} is calling...`,
            icon: '/icon-192.png',
            tag: 'incoming-call',
            requireInteraction: true,
            vibrate: [200, 100, 200, 100, 200], // Vibration pattern
            actions: [
                { action: 'answer', title: '📞 Answer' },
                { action: 'decline', title: '❌ Decline' }
            ]
        });
    } else if (event.data?.type === 'CLOSE_CALL_NOTIFICATION') {
        // Close notification when call ends/is answered
        self.registration.getNotifications({ tag: 'incoming-call' }).then(notifications => {
            notifications.forEach(n => n.close());
        });
    }
});

// Handle notification button clicks
self.addEventListener('notificationclick', (event) => {
    const notification = event.notification;
    const action = event.action;
    notification.close();

    if (notification.tag === 'incoming-call') {
        if (action === 'decline') {
            // Notify client to decline call without opening window
            clients.matchAll({ type: 'window' }).then(cls => {
                cls.forEach(client => client.postMessage({ type: 'DECLINE_CALL' }));
            });
        } else {
            // Answer or default click -> focus/open window
            event.waitUntil(
                clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
                    if (clientList.length > 0) {
                        // Find focused window or focus the first one
                        const focusedClient = clientList.find(c => c.focused);
                        if (focusedClient) return focusedClient;
                        return clientList[0].focus();
                    }
                    return clients.openWindow('/');
                })
            );
        }
    }
});
