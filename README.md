# ConnectHub 💬

**🔗 Live Web Application Demo:** [chatapp-f20ea.web.app](https://chatapp-f20ea.web.app)

![React](https://img.shields.io/badge/React-18.x-61DAFB?style=for-the-badge&logo=react&logoColor=black)
![Vite](https://img.shields.io/badge/Vite-5.x-646CFF?style=for-the-badge&logo=vite&logoColor=white)
![Firebase](https://img.shields.io/badge/Firebase-v10-FFCA28?style=for-the-badge&logo=firebase&logoColor=black)
![FastAPI](https://img.shields.io/badge/FastAPI-0.x-009688?style=for-the-badge&logo=fastapi&logoColor=white)
![Ollama](https://img.shields.io/badge/Local%20AI-Ollama-000000?style=for-the-badge&logo=ollama&logoColor=white)
![PWA](https://img.shields.io/badge/PWA-Supported-5A0FC8?style=for-the-badge&logo=progressive-web-apps&logoColor=white)

A real-time chat application built with React, Vite, and Firebase, featuring WebRTC video/audio calling, in-chat multiplayer board games, and an offline-first local AI assistant powered by FastAPI and Ollama.

---

## 🚀 Key Features

### 💬 Messaging Engine
* **Real-time Sync**: Instant message delivery with optimistic UI updates, online/offline presence states, typing indicators, and read receipts.
* **Rich Interactions**: Threaded replies, emoji reactions, message forwarding, and a dedicated "Personal Notes" self-chat.
* **Moderation & Control**: Message editing, deletion (recall for everyone or delete for self), and starred message archives.
* **Message Pinning**: Pin up to 5 messages per conversation with auto-expiry options (1h, 12h, 1d, 1w).

### 🎮 In-Chat Multiplayer Games
* **Chess & Ludo**: Start and play interactive multiplayer Chess or Ludo games directly inside any chat window.
* **Real-Time Sync**: Game state updates are synchronized instantly across players using Firebase database nodes.

### 📞 WebRTC Calls
* **1-on-1 Calling**: High-quality Peer-to-Peer video and audio calls.
* **Multitasking & Background Support**:
  * **Picture-in-Picture (PiP)**: Keep your video stream active in a floating window while browsing other parts of the app.
  * **Background Wake-up**: The PWA service worker wakes up the client to receive call invites even when the application tab is closed.

### 🤖 Local AI Assistant
* **Smart Replies**: Contextual suggestions generated based on recent chat history.
* **AI Rephrase**: Clean up or adjust the tone of message drafts with a single click.
* **Chat Summarizer**: Condense long conversation histories into a quick 3-sentence summary.
* **Group Mentions**: Query the assistant directly in group chats using the `@AI` prefix.
* **Resilient Fallbacks**: If the local AI backend is offline, the app falls back to Google Gemini (via Cloud Functions), and finally to a static pattern-matching engine.

### 📸 Media & Sharing
* **Image Editor**: Built-in canvas tools to crop, zoom, and apply filters (Vivid, B&W, Sepia, etc.) before sending.
* **Voice Notes**: Draggable voice recorder with pause/resume, real-time waveform visualization, and swipe-to-cancel.
* **Video Trimmer & Media Compressor**: Client-side media compression reduces upload sizes before sending, saving storage and bandwidth.
* **Interactive Polls**: Timed, multi-choice opinion polls for group chats.

---

## 🛠️ Tech Stack
* **Frontend**: React, Vite, Tailwind CSS, Framer Motion, React Virtuoso (for list virtualization).
* **Backend**: Firebase Authentication, Cloud Firestore, Realtime Database, Cloud Storage, Cloud Functions.
* **AI Gateway**: FastAPI (Python), Ollama (running local LLMs).

---

## 🔒 Configuration & Security
To keep project credentials secure, all keys are decoupled from the codebase:
- Environment variables (`.env.local`) hold the Firebase client config and are excluded from version control.
- The service worker loads configurations dynamically at runtime, ensuring no API keys are hardcoded in static asset files.

---

## 🚀 Quickstart

### 1. Setup Environment Variables
Clone the repository and copy the template configuration file:
```bash
git clone https://github.com/darvex-0/ChatAppProject.git
cd ChatAppProject
cp .env.example .env.local
```
Open `.env.local` and fill in your Firebase project credentials.

### 2. Run the Frontend
```bash
# Install dependencies
npm install

# Run Vite dev server
npm run dev
```
The application will be available at `http://localhost:5173`.

### 3. Setup the Local AI Backend (Optional)
Ensure you have [Ollama](https://ollama.com/) installed and running. Pull your preferred local model (e.g., `llama3` or `mistral`):
```bash
# Example using Llama 3
ollama pull llama3
```
Clone your companion FastAPI backend ([ConnectHubBackend](https://github.com/darvex-0/ConnectHubBackend)), setup the Python environment, and start the server:
```bash
cd ../ConnectHubBackend

# Create and activate a virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install requirements and run server
pip install -r requirements.txt
uvicorn server:app --reload --port 8000
```

---

## ⚙️ Configuring Local AI in the Web UI

You do not need to modify any code to use or configure the local AI:
1. Open the application in your browser.
2. Go to **Settings** (gear icon) -> **AI Settings**.
3. Toggle **Enable Local AI** to `ON`.
4. Enter your custom backend URL (default: `http://localhost:8000`).
5. Click **Test** to verify connection to the running FastAPI backend.

---

## 🌐 Deploying & Setting Up ngrok (Mixed Content Fix)

When you deploy the frontend to a secure domain (e.g., Firebase Hosting at `https://your-app.web.app`), modern browsers block calls to insecure local endpoints (`http://localhost:8000`) due to **Mixed Content (HTTPS -> HTTP)** restrictions. 

To run the local AI backend while using the deployed web app:
1. Ensure your FastAPI server is running locally on port `8000`.
2. Expose the port through a secure HTTPS tunnel using [ngrok](https://ngrok.com/):
   ```bash
   ngrok http 8000
   ```
3. Copy the secure forwarding URL generated by ngrok (looks like `https://xxxx-xx-xx.ngrok-free.app`).
4. Open the deployed website's **Settings UI** and paste the ngrok HTTPS URL as your custom AI Base URL.

---

## 🛡️ Security Rules Deployment
Before deploying, make sure your security rules for Firestore, Storage, and Realtime Database are pushed:
- [firestore.rules](./firestore.rules)
- [storage.rules](./storage.rules)
- [database.rules.json](./database.rules.json)

To build the static files and deploy to Firebase Hosting:
```bash
npm run build
firebase deploy
```

---

## 📝 License
ConnectHub is open-source software released under the [MIT License](LICENSE).
