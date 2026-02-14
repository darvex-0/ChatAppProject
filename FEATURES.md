# ConnectHub - Feature List

## 🔐 Authentication & Security
- **Secure Login**: Email & Password authentication powered by Firebase Auth.
- **Google Sign-In**: Quick and secure login using Google Accounts.
- **Persistent Sessions**: Stay logged in across sessions with robust state management.
- **Protected Routes**: Secure navigation ensuring only authenticated users access the app.

## 💬 Core Messaging
- **Real-time Messaging**: Instant message delivery with optimistic UI updates.
- **User Search**: Find and start chats with any user by name or email.
- **Group Chats**: Create groups, add/remove members, and manage group admins.
- **Message Deletion**: Delete messages for everyone (Recall) or just for yourself.
- **Rich Text Support**: Send text, emojis, and links with auto-generated previews.
- **Emoji Picker**: Integrated emoji picker with 300+ emojis and categories.
- **Reactions**: React to messages with any emoji; toggle to remove.
- **Replies**: Reply to specific messages with context.
- **Forwarding**: Forward messages to other chats or to your Personal Notes.
- **Pin Messages**: Pin up to 5 important messages per chat with auto-expiry options (1h, 12h, 1d, 1w).
- **Starred Messages**: Bookmark important messages for quick access later.
- **Message Editing**: Edit sent text messages with "edited" status indication.
- **Read Receipts**: WhatsApp-style checkmarks (✓ sent, ✓✓ delivered/read).
- **Status Indicators**: Real-time "Online" status and "Typing..." indicators.
- **Personal Notes**: Dedicated self-chat for persistent notes and tasks.

## 📹 Voice & Video Calling
- **1-on-1 Calling**: High-quality voice and video calls using WebRTC.
- **Cross-Platform**: Works seamlessly across desktop and mobile.
- **Picture-in-Picture (PiP)**: Keep video calls active while multitasking in other apps.
- **Background Wake-Up**: Receive call notifications even when the app is force-closed (PWA).
- **Call History**: Dedicated tab for call logs with status (missed/incoming/outgoing), duration, and data usage.
- **Call Back**: One-tap callback from history or chat.
- **Ringers & Vibrations**: Custom ringtones and native vibration patterns.

## 📸 Media & Sharing
- **Rich Media Support**: Send images, videos, audio, and generic files (PDF, DOC, ZIP).
- **Media Preview**: Full-screen preview before sending.
- **Image Editing**: 
  - **Crop & Zoom**: Built-in cropper for photos.
  - **Filters**: Apply preset filters (Vivid, B&W, Sepia, etc.) before sending.
- **Video Trimmer**: Trim video clips before sharing.
- **Voice Messages**: Record voice notes with waveform, pause/resume, and swipe-to-cancel.
- **Drafts**: Voice message drafts auto-save if you switch chats.
- **Media Gallery**: View all shared photos and videos in a grid view.
- **Compression**: Client-side image compression to save data and storage.

## 🎨 User Experience & Customization
- **Theme Support**: Light and Dark modes with automatic detection.
- **Chat Wallpapers**: Custom backgrounds for individual chats (Colors, Gradients, Images).
- **Progressive Web App (PWA)**:
  - **Installable**: Add to Home Screen on iOS and Android.
  - **Offline Capable**: App loads instantly without internet.
  - **Standalone**: Runs like a native app without browser bars.
- **Sound Effects**: "Pop" sound for incoming messages (toggleable).
- **Notifications**: System-level push notifications with quick actions.
- **Search**: 
  - **Global Search**: Find contacts and chats.
  - **In-Chat Search**: Search within a conversation with term highlighting.

## ⚙️ Settings & Profile
- **Profile Management**: Update display name, status ("About"), and profile photo.
- **Avatar Cropper**: Crop profile pictures perfectly.
- **Privacy**: Settings to control Last Seen and Read Receipts (implied/backend).
- **Archive**: Archive chats to keep the main list clean; folders for easy access.
- **Notification Settings**: Granular control over sounds and alerts.
- **Storage Management**: View data usage for calls.

## 🚀 Technical & Performance
- **Offline Persistence**: Chats and messages are cached locally for offline access.
- **Virtualization**: Efficient rendering of unlimited message history using `react-virtuoso`.
- **Lazy Loading**: Components and media load on-demand for fast startup.
- **Code Splitting**: Optimized bundle size for quick initial load.
- **Secure Backend**: Powered by Firebase (Auth, Firestore, Storage, Cloud Functions).
- **Security Rules**: Robust Firestore rules ensuring data privacy and access control.
