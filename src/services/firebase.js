import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getDatabase } from "firebase/database";
import { getMessaging } from "firebase/messaging";

const firebaseConfig = {
    apiKey: "AIzaSyC0N-K5E7pfOs1wPYuSVIZ3bvUzSNA4qcY",
    authDomain: "chatapp-f20ea.firebaseapp.com",
    projectId: "chatapp-f20ea",
    storageBucket: "chatapp-f20ea.firebasestorage.app",
    databaseURL: "https://chatapp-f20ea-default-rtdb.firebaseio.com",
    messagingSenderId: "853734238442",
    appId: "1:853734238442:web:4f06be4ba7fd55419fcf93"
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

let messagingInstance = null;
try {
    messagingInstance = getMessaging(app);
} catch (error) {
    console.warn("Firebase Messaging not supported in this environment (likely due to http vs https).");
}
export const messaging = messagingInstance;
