# ConnectHub 💬

A modern, real-time chat application built with **React**, **Vite**, and **Firebase**.  
Fully responsive, feature-rich, and designed for seamless communication.

## 🚀 Features

### Core Messaging & Media
*   **Real-time Chat**: Instant delivery for 1:1 and Group messages.
*   **Rich Media & Editing**: Send **Images** and **Videos** with an advanced inline editor (Crop, Filter, Trim, Caption).
*   **Voice & Video Notes**: Record draggable voice messages and circular instant video bubbles directly from the input.
*   **Interactive Components**: Full Emoji picker reactions, Message Pinning, Starred Messages, and Forwarding networks.
*   **Message Management**: Edit text messages, Unsend (Delete), and schedule messages to be sent in the future.

### Advanced Features
*   **WebRTC Calling**: Integrated peer-to-peer Audio & Video calling with Picture-in-Picture (PiP) and Background Wake-Lock support. Includes comprehensive persistent Call History.
*   **Status/Stories**: 24h ephemeral WhatsApp-style stories with read receipts.
*   **Advanced Polls**: Create anonymous, timed, multi-select polls with image attachments.
*   **Local AI Integration**: Powered locally by Ollama/FastAPI for maximum privacy (and Gemini fallback). Enables features like:
    *   ✨ **AI Rephrase**: Clean up messy drafts into professional tones.
    *   📑 **Chat Summarizer**: Get a quick AI summary of the last 50 messages.
    *   🤖 **Smart Replies**: Predictive context-aware reply suggestions.
    *   🧠 **@AI Mentions**: Ask the AI assistant questions directly inside group chats.

### Group Management
*   **Create Groups**: Add members instantly from your recent friends list or via email.
*   **Mentioning System**: Advanced `@mention` system with keyboard navigation and reliable UID tracking.
*   **Admin Controls**: Promote members to Admin, Kick users, and Manage group details.

### User Experience
*   **Authentication**: Secure Google Sign-In via Firebase Auth.
*   **Premium UI**: Glass-morphism modals, dynamic 3D Earth login page, and fluid dark/light modes.
*   **Search**: Filter conversations instantly or search for new users globally by email.
*   **Push Notifications**: Receive alerts for new messages and incoming calls even when the app is in the background via Firebase Cloud Messaging (FCM).
*   **PWA Ready**: Installable natively on iOS/Android and Desktop environments.

## 🛠️ Tech Stack

*   **Frontend**: React.js, Vite
*   **Styling**: Vanilla CSS (Custom Design System, CSS Variables)
*   **Backend**: Firebase (Firestore, Auth, Storage, Cloud Messaging)
*   **Advanced Add-ons**: WebRTC, `react-virtuoso` (Virtualized Lists), `react-easy-crop`, Local FastAPI Server
*   **State Management**: Context API (AuthContext, UIContext, CallContext)

## 📦 Installation & Setup

### Prerequisites
*   Node.js (v18+)
*   npm or yarn

### Steps

1.  **Clone the Repository**
    ```bash
    git clone https://github.com/darvex-0/ChatAppProject.git
    cd "ChatApp Project"
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
    *   Update `src/services/firebase.js` with your config keys.

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

## ⚡ Performance & Scalability

The application includes advanced architectural optimizations for handling large datasets and slow devices:

*   **React Code Splitting**: Utilizing `React.lazy()` and `<Suspense>`, initial asset chunks are kept under 10KB. Heavy 3D libraries (like the EarthGlobe) load asynchronously in the background.
*   **Memoized Reactivity**: Real-time typing triggers bypass the DOM tree. `MessageList` and heavy UI components are wrapped in `React.memo` paired with strict `useCallback` mapping to enable 60FPS input even with complex DOMs.
*   **Smart Pagination (Virtualized Lists)**: `react-virtuoso` unloads off-screen DOM nodes dynamically, allowing instantaneous scrolling through chats with 10,000+ messages.
*   **Client-Side Compression**: `browser-image-compression` minimizes 4K payloads locally before Firebase upload, vastly reducing cloud egress costs and bandwidth wait.

## 📜 License

This project is licensed under the [MIT License](LICENSE).
