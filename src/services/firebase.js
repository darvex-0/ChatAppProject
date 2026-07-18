import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getDatabase } from "firebase/database";
import { getMessaging } from "firebase/messaging";
import { getFunctions } from "firebase/functions";

const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = initializeFirestore(app, {
    localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager()
    })
});
export const storage = getStorage(app);
export const rtdb = getDatabase(app);
export const cloudFunctions = getFunctions(app);

let messagingInstance = null;
try {
    // Dynamically register service worker with configuration parameters to avoid hardcoding secrets
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
        const configParams = new URLSearchParams({
            apiKey: firebaseConfig.apiKey || "",
            authDomain: firebaseConfig.authDomain || "",
            projectId: firebaseConfig.projectId || "",
            storageBucket: firebaseConfig.storageBucket || "",
            databaseURL: firebaseConfig.databaseURL || "",
            messagingSenderId: firebaseConfig.messagingSenderId || "",
            appId: firebaseConfig.appId || ""
        }).toString();

        navigator.serviceWorker.register(`/firebase-messaging-sw.js?${configParams}`)
            .then((registration) => {
                console.log("FCM Service Worker registered with query params:", registration.scope);
            })
            .catch((err) => {
                console.error("FCM Service Worker registration failed:", err);
            });
    }
    messagingInstance = getMessaging(app);
} catch (error) {
    console.warn("Firebase Messaging not supported in this environment (likely due to http vs https or SW registration error).", error);
}
export const messaging = messagingInstance;
