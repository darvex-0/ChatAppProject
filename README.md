<div align="center">
  <img src="https://raw.githubusercontent.com/github/explore/80688e429a7d4ef2fca1e82350fe8e3517d3494d/topics/react/react.png" width="100" alt="React Logo" />
  <h1>ConnectHub 💬</h1>
  <p>
    <b>A modern, ultra-responsive real-time chat application.</b><br />
    Built with React, Vite, Firebase, and Local AI (FastAPI/Ollama).
  </p>

  <div>
    <img src="https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB" alt="React" />
    <img src="https://img.shields.io/badge/Vite-B73BFE?style=for-the-badge&logo=vite&logoColor=FFD62E" alt="Vite" />
    <img src="https://img.shields.io/badge/firebase-FFCA28?style=for-the-badge&logo=firebase&logoColor=white" alt="Firebase" />
    <img src="https://img.shields.io/badge/FastAPI-009688?style=for-the-badge&logo=fastapi&logoColor=white" alt="FastAPI" />
  </div>

  <br />
  
  <p>
    ConnectHub is designed for seamless communication, offering a feature-rich, interactive, and private messaging experience with a beautiful glass-morphism aesthetic.
  </p>
</div>

<hr />

## ✨ Highlight Experiences

<table width="100%">
  <tr>
    <td width="50%">
      <h3>🤖 Local AI Superpowers</h3>
      <p>Powered locally by Ollama & FastAPI to ensure complete privacy (with Gemini fallback options).</p>
      <ul>
        <li><b>Smart Replies:</b> Context-aware reply suggestions instantly generated based on chat history.</li>
        <li><b>AI Rephrase:</b> Transform messy drafts into professional, polished messages with one click.</li>
        <li><b>Chat Summarizer:</b> Instantly recap a heavy conversation with a 3-sentence TL;DR summary.</li>
        <li><b>@AI Mentions:</b> Drop a direct question to the AI assistant right inside group chats.</li>
      </ul>
    </td>
    <td width="50%">
      <h3>🎨 Premium UI/UX</h3>
      <p>A silky smooth user interface pushing the boundaries of web application aesthetics.</p>
      <ul>
        <li><b>Fluid Dark/Light Modes:</b> Dynamically adapting theme layouts.</li>
        <li><b>3D Spline Login:</b> An interactive, glowing EarthGlobe backdrop on the gateway page.</li>
        <li><b>Glass-morphism:</b> Translucent, blurred overlay modals providing depth and texture.</li>
        <li><b>Responsive Design:</b> PWA-ready out of the box for Native-app feel on mobile iOS and Android.</li>
      </ul>
    </td>
  </tr>
</table>

### 💬 Core Engine Capabilities

- 📞 **WebRTC Calling:** High-fidelity 1:1 Video and Audio peer-to-peer calling. Features background wake-lock and Picture-in-Picture (PiP).
- 📸 **Rich Media & Editing:** Inline crop, trim, and filter overlays for Images and Video before sending.
- 🎙️ **Voice & Video Notes:** WhatsApp-style draggable recording interfaces and instant circular video bubbles.
- ⏱️ **Stories (Status):** Ephemeral 24hr vanishing text/media updates with read-receipt views. 
- 📊 **Advanced Polls:** Media-backed, anonymous, timed, multi-choice opinion polling for groups.
- 📍 **Interactive Messaging:** Forwarding networks, Emoji picker reactions, Message Pinning, and Starred Archives.
- ⚡ **Real-Time Synergy:** Millisecond delivery speeds, precise typing indicators, and background FCM push notifications.

<hr />

## ⚡ Architecture & Performance Specs

ConnectHub is heavily optimized to gracefully handle immense data payloads and low-end mobile hardware through rigorous React render logic.

*   **React Code Splitting (`React.lazy`)**: The critical rendering path is entirely severed from heavy 3D assets. The initial login sequence bundle requires less than `10KB` of Javascript. Large dependency chunks stream asynchronously.
*   **60FPS Memoized Reactivity**: Real-time typing states strictly bypass the primary DOM tree. The application employs aggressive `React.memo` wrapping and surgical `useCallback` hook dependency mapping to prevent the heavy virtualized 200+ message list from re-rendering over keyboard input streams.
*   **Virtualized Dom (`react-virtuoso`)**: Unloads and recycles off-screen DOM nodes automatically, ensuring buttery-smooth native scrolling physics even when navigating chat channels containing upwards of 10,000+ messages.
*   **Client-Side Media Compression (`browser-image-compression`)**: Aggressively shrinks 4K payloads via browser canvas directly on the client's device *before* initiating network transfers. Massively diminishes cloud egress latency and cuts storage overhead significantly.

<hr />

## 📦 Developer Quickstart

<details>
<summary><b>Click to view installation instructions</b></summary>
<br />

### Prerequisites
*   Node.js (v18+)
*   npm or yarn

### Setup

```bash
# 1. Clone the repository
git clone https://github.com/darvex-0/ChatAppProject.git
cd "ChatApp Project"

# 2. Install dependencies
npm install

# 3. Spin up the development server
npm run dev
```

### Firebase Configuration
1. Create a project at [console.firebase.google.com](https://console.firebase.google.com)
2. Enable **Authentication** (Google Provider), **Firestore Database**, and **Storage**.
3. Overwrite `src/services/firebase.js` with your active initialization strings.

</details>

<div align="center">
  <br/>
  <p>Designed and built with ❤️. Released under the <a href="LICENSE">MIT License</a>.</p>
</div>
