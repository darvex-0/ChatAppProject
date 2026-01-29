# ConnectHub 💬

A modern, real-time chat application built with **React**, **Vite**, and **Firebase**.  
Fully responsive, feature-rich, and designed for seamless communication.

## 🚀 Features

### Core Messaging
*   **Real-time Chat**: Instant delivery for 1:1 and Group messages.
*   **Rich Media**: Send **Images**, **Voice Messages**, and Files.
*   **Interactive**: Message Reactions (❤️, 😂, 👍), Reply to specific messages, and Read Receipts.
*   **Typing Indicators**: See when others are typing in real-time.

### Group Management
*   **Create Groups**: Add members instantly from your recent friends list or via email.
*   **Admin Controls**: Promote members to Admin, Kick users, and Manage group details.
*   **Smart Info**: View all members, their roles, and online status.

### User Experience
*   **Authentication**: Secure Google Sign-In via Firebase Auth.
*   **Search**: Filter conversations instantly or search for new users globally by email.
*   **Push Notifications**: Receive alerts for new messages even when the app is in the background (FCM).
*   **Responsive Design**: Optimized for Desktop and Mobile (PWA-ready).

## 🛠️ Tech Stack

*   **Frontend**: React.js, Vite
*   **Styling**: Vanilla CSS (Custom Design System)
*   **Backend**: Firebase (Firestore, Auth, Storage, Cloud Messaging)
*   **State Management**: Context API (AuthContext, UIContext)

## 📦 Installation & Setup

### Prerequisites
*   Node.js (v16+)
*   npm or yarn

### Steps

1.  **Clone the Repository**
    ```bash
    git clone https://github.com/your-username/connecthub.git
    cd ConnectHub
    ```

2.  **Install Dependencies**
    ```bash
    npm install
    ```

3.  **Configure Firebase**
    *   Create a project at [console.firebase.google.com](https://console.firebase.google.com)
    *   Enable **Authentication** (Google Provider)
    *   Enable **Firestore Database**
    *   Enable **Storage**
    *   Update `src/services/firebase.js` with your config keys:
        ```javascript
        const firebaseConfig = {
          apiKey: "YOUR_API_KEY",
          authDomain: "YOUR_PROJECT.firebaseapp.com",
          projectId: "YOUR_PROJECT_ID",
          storageBucket: "YOUR_PROJECT.appspot.com",
          messagingSenderId: "YOUR_SENDER_ID",
          appId: "YOUR_APP_ID"
        };
        ```

4.  **Run Locally**
    ```bash
    npm run dev
    ```
    Open `http://localhost:5173` in your browser.

## 🚀 Deployment

This project is optimized for **Firebase Hosting**.

1.  **Build the project**
    ```bash
    npm run build
    ```

2.  **Deploy**
    ```bash
    firebase deploy
    ```

## 🔒 Security Rules

Ensure your Firestore rules allow authenticated access:
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

## ⚡ Performance & Scalability

The application includes advanced optimizations for handling large datasets:

*   **Smart Pagination**: Messages are loaded in small batches (Infinite Scroll), ensuring instant load times even for chats with 10,000+ messages.
*   **Effective Caching**: User profiles are cached locally to prevent redundant database queries (N+1 problem) in the sidebar.
*   **Optimized Assets**: Lazy loading strategies for improved initial render.

## 📜 License

This project is licensed under the [MIT License](LICENSE).
