// Import and initialize the Firebase SDK
importScripts("https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js");

// Use the SAME config from your index.html
firebase.initializeApp({
  apiKey: "AIzaSyC0N-K5E7pfOs1wPYuSVIZ3bvUzSNA4qcY",
  authDomain: "chatapp-f20ea.firebaseapp.com",
  projectId: "chatapp-f20ea",
  storageBucket: "chatapp-f20ea.firebasestorage.app",
  databaseURL: "https://chatapp-f20ea-default-rtdb.firebaseio.com",
  messagingSenderId: "853734238442",
  appId: "1:853734238442:web:4f06be4ba7fd55419fcf93"
});

// Get the messaging service
const messaging = firebase.messaging();

// Optional: Handle background messages
messaging.onBackgroundMessage((payload) => {
  console.log("Received background message: ", payload);
});