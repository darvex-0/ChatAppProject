# Project Changelog

## Version 2.19 - Notification Settings & Status Polish 🔔
**Date:** 3rd February 2026

**New Features:**
- **Notification Settings**: Control how you receive alerts
  - **Sound Effects**: Toggle "Ding" sound for new messages on/off
  - **Desktop Notifications**: Enable/Disable system-level notifications
  - **Message Preview**: Choose whether to show message content in notifications
  - **Persistence**: Settings saved to your device automatically

**Improvements:**
- **Profile Settings UI**:
  - **Restored Status Field**: Fixed missing "About / Status" input in Settings Modal
  - **UI/UX**: Added glassmorphism toggles for settings with smooth animations


## Version 2.18 - Starred Messages & UI Polish ⭐
**Date:** 3rd February 2026

**New Features:**
- **Starred Messages**: Save important messages for later reference
  - **Star/Unstar**: Star messages via hover menu or by long-pressing
  - **Visual Indicator**: Gold star badge on starred messages (left-middle position)
  - **Interactive Badge**: Click the star badge directly to unstar
  - **Starred Modal**: View all starred messages centrally (Header > ⭐ button)
  - **Jump to Message**: Click a starred message in the modal to navigate to it in chat
  - **Real-time Sync**: Star status syncs instantly across devices via Firestore

**Improvements:**
- **UI Polish**:
  - **Message Margins**: Added margins to message bubbles to prevent icon clipping
  - **Star Positioning**: Optimized star badge placement for better visibility
  - **Hover Effects**: Enhanced interactive states for star controls


## Version 2.17 - Full Emoji Reactions 😊
**Date:** 2nd February 2026

**New Features:**
- **Full Emoji Reactions**: Upgraded from 3 hardcoded emojis to full emoji picker
  - **Emoji Picker Button**: Click 😊+ in message hover menu to open picker
  - **300+ Emojis**: Access to all emoji categories
  - **Toggle Reactions**: Click same emoji again to remove reaction (WhatsApp-style)
  - **Clickable Reaction Bubbles**: Click reaction bubbles below messages to toggle
  - **Visual Feedback**: Your reactions highlighted in indigo with blue glow
  - **Hover Effects**: Bubbles scale on hover for better UX
  - **Smart Positioning**: Picker positioned to avoid overflow
  - **Click-Outside to Close**: Picker auto-closes when clicking elsewhere

**Technical Details:**
- Reused existing `emoji-picker-react` library
- Added `deleteField()` for reaction removal
- Implemented `my-reaction` CSS class for visual distinction
- Added toggle logic in `addReaction` function

---


## Version 2.16 - Pin Messages 📌
**Date:** 1st February 2026

**New Features:**
- **Pin Messages**: Pin important messages to the top of chat
  - **Pin Limit**: Maximum 5 messages can be pinned per chat
  - **Duration Picker**: Choose how long to pin (1 Hour, 12 Hours, 1 Day, 1 Week, No Limit)
  - **Auto-Expire**: Pins automatically disappear when duration expires
  - **WhatsApp-Style Banner**: Navigate between pinned messages with ⬆️⬇️ arrows
  - **Individual Unpin**: Unpin specific messages without affecting others
  - **Collapsible Banner**: Minimize the banner without unpinning (click to expand)

**Bug Fixes:**
- Fixed infinite modal loop when selecting "No Limit" option (falsy `0` value issue)

---

## Version 2.15 - Media Preview & Editing
**Date:** 31st January 2026

**New Features:**
- **Media Preview Modal**: Full-screen preview before sending images/videos
  - Preview images and videos before sending
  - Add captions to media
  - File size display
- **Image Cropping**: Crop and zoom images using `react-easy-crop`
- **Image Filters**: 10 preset filters (Bright, Contrast, Warm, Cool, Vivid, B&W, Sepia, Vintage, Fade)
  - Mobile-friendly 5-column grid with emoji icons
  - Real-time preview with CSS filters
  - Applied via canvas before upload
- **Video Trimmer**: Instagram/TikTok-style trim interface
  - Draggable start/end handles
  - Visual timeline with playhead
  - Time display (start, duration, end)
  - Touch-friendly for mobile

**Bug Fixes:**
- Fixed video trimmer end-handle drag issue (stale closure bug)

---

## Version 2.14 - User Profile Settings
**Date:** 31st January 2026

**New Features:**
- **Profile Settings Modal**: Enhanced settings with new capabilities
  - **Avatar Cropper**: Crop and zoom profile photos before uploading (using `react-easy-crop`)
  - **Display Name**: Update your name instantly without page reload
  - **Status Field**: Set a custom "About" message (e.g., "At work", "Sleeping")
  - **Instant Save**: Profile changes save without refreshing the page
- **Status Visibility**: View other users' status in ChatInfoModal for private chats
  - Shows 💭 bubble with status below user email
  - Displays "No status set" if user hasn't set a status

**Technical:**
- Added `react-easy-crop` dependency for image cropping
- Created `cropImage.js` utility for canvas-based image processing
- Removed `location.reload()` from settings save flow

---

## Version 2.13 - Forward Messages & Performance
**Date:** 30th January 2026

**New Features:**
- **Forward Messages**: Forward any message (text, image, audio, file) to other chats
  - Forward button (➡️) in message hover menu
  - Chat selector modal with search
  - "↪ Forwarded" label on forwarded messages
  - "↪↪ Forwarded many times" for multi-forwarded messages
  - Click label to see original sender
  - Forward chain tracking preserves original author

**Improvements:**
- **Voice Draft Expiration**: Auto-deletes drafts older than 24 hours
- **Image Lazy Loading**: Images load only when scrolled into view
- **Reply Preview Truncation**: Long replies truncated to 80 characters
- **Typing Indicator Debounce**: 90% fewer Firestore writes while typing
- **Chat Scroll Fix**: Messages appear at bottom without visible scroll animation

---

## Version 2.12 - Personalization & Emojis
**Date:** 29th January 2026

**New Features:**
- **Emoji Picker**: Dedicated button in chat input 😃.
- **Custom Chat Wallpaper**:
  - Set custom backgrounds (Color, Gradient, Image) per chat 🎨.
  - Accessible via 3-dot menu > Wallpaper.

---

## [2026-01-28] - Critical Bug Fixes & UX Improvements

### Added
- **Voice Draft Saving (WhatsApp-style)**: Voice recordings are now saved as drafts when switching chats
  - Auto-saves in-progress recordings when you switch to another chat
  - Shows saved draft with audio player when you return
  - Delete or Send options for saved drafts
  - Draft stored in localStorage (persists across sessions)
- **File Upload Limits**: 25MB maximum file size with clear validation errors
- **Upload Progress Indicator**: Real-time progress display showing "X.X/Y.YMB" format during uploads
  - Cancel button (✕) to abort uploads mid-transfer
  - Instant progress tracking (no delay)
- **Network Status Detection**: Automatic detection of online/offline status
- **Offline Upload Handling**: Prevents upload attempts when offline with user-friendly error messages
- **Swipe-to-Cancel Recording**: Mouse/touch drag gesture to cancel voice recordings (desktop/mobile)
- **Enhanced Error Handling**: Specific error messages for network failures, authentication issues, and upload cancellations

### Fixed
- **CRITICAL**: Voice recording state now clears when switching chats - prevents sending voice messages to wrong recipients
- **CRITICAL**: Voice draft auto-saves when switching chats instead of being lost
- Voice recording cancel bug: Preview modal no longer appears when explicitly cancelling
- Z-index issues: Dropdown menu and search bar now correctly appear above chat messages
- Recording timer now displays elapsed time in MM:SS format
- CustomAlert import missing in Layout component causing Reference errors
- Upload progress now shows immediately (removed dynamic import delay)
- Deprecated `apple-mobile-web-app-capable` meta tag replaced with `mobile-web-app-capable`

### Security
- File size validation prevents storage quota abuse
- Network-aware upload prevents failed attempts and wasted bandwidth

## [Previous Date] - Previous Features

## Version 2.11 - Progressive Web App (PWA)
**Date:** 28th January 2026

**New Features:**
- **PWA Support**: App is now installable on mobile and desktop devices.
  - **Web App Manifest**: Configured with ConnectHub branding and icons.
  - **Install Prompt**: "📱 Install App" button appears in Sidebar when available.
  - **Standalone Mode**: Opens like a native app without browser chrome when installed.
  - **Offline Caching**: Service worker caches app shell for offline access.
  - **iOS Support**: Optimized for "Add to Home Screen" on Safari.
- **Enhanced Icons**: Updated all app icons to use the ConnectHub logo with gradient background.

---

## Version 2.10 - Chat Search & Docs
**Date:** 27th January 2026

**New Features:**
- **Chat Search**: Added search functionality within chats.
  - **3-Dot Menu**: New header menu to access search.
  - **Highlighting**: Search terms are highlighted in messages.
  - **Navigation**: Next/Previous buttons to jump between matches.
- **Document Sharing**: Users can now share generic files (PDFs, Docs, Zips) in addition to images and audio.
- **UI Polish**:
  - Enhanced Login Screen with 3D animated background (Aurora theme).
  - Improved message styling for file attachments.

---

## Version 2.9 - Bug Fixes & Message Editing
**Date:** 27th January 2026

**Bug Fixes:**
- **GIF Animation Preserved**: Animated GIFs no longer lose animation - compression is now skipped for GIF files.
- **Empty Chat State**: When all messages are deleted, the chat displays "No messages yet" instead of showing stale data.
- **Message Editing**: Users can now edit their text messages with an "edited" indicator showing.
- **Chat Scroll Fix**: Chats now reliably scroll to the bottom when opened.

---

## Version 2.8 - UX Bug Fixes
**Date:** 27th January 2026

**Bug Fixes:**
- **Typing Indicator Timeout**: Fixed "stuck" typing indicator when users close browser abruptly. Now ignores typing status older than 30 seconds.
- **Profile Photo Sync**: Profile photos and names now update in real-time across the Sidebar when changed.
- **Voice Message Preview**: Voice recordings now show a preview modal with Send/Cancel confirmation before sending.
- **Audio Duration Display**: Custom AudioPlayer with progress bar, play/pause controls, and duration display (0:00 / 0:45 format).
- **Sidebar Sync (Message Deletion)**: Deleting the last message in a chat now properly updates the Sidebar preview.
- **Unread Count Reset**: Unread badge now clears correctly when messages are viewed.

---

## Version 2.7 - Performance: Code Splitting
**Date:** 27th January 2026

**Optimization:**
- **React.lazy()**: Login, Dashboard, and Layout components now load on-demand instead of all at once.
- **Suspense Fallback**: Shows a loading spinner while chunks download.
- **Vite Manual Chunks**: Firebase SDK (779KB), React (157KB), and Virtuoso (54KB) are now separate cached files.
- **Result**: Initial bundle reduced from **1.1MB → ~165KB** (85% smaller initial load!)
- **Fix**: Resolved an issue where "View Media" modal appeared behind the chat info modal (Z-Index stacking fix).
- **Fix**: Resolved "No media shared" error by creating a missing Firestore composite index for querying images by timestamp.

---

## Version 2.6 - Link Previews
**Date:** 27th January 2026

**New Feature:**
- **Link Previews**: Rich URL previews when sharing links in chat messages.
  - Cloud Function `extractLinkPreview` fetches Open Graph metadata (title, description, image) from URLs.
  - Uses `cheerio` library for server-side HTML parsing (lightweight jQuery-like selector library).
  - Frontend displays preview cards below messages with clickable links.

---

## Version 2.5 - Chat UI Polish & Fixes

## [Optimization] Phase 1: Core Performance & Offline Logic
**Date:** 2026-01-25

### 1. Offline Persistence ⚡
**Goal:** Enable seamless usage without an internet connection.
**Implementation:**
- Enabled `persistentLocalCache` in `src/services/firebase.js`.
- **Online Presence**: Fixed a mismatch between client-side data (`state: 'online'`) and Cloud Function expectation (`online: true`).
- **UI Polish**: Refined the chat interface to match the app's premium theme.
  - **Colors**: Message bubbles now use the app's primary gradient and translucent dark backgrounds instead of mismatched WhatsApp colors.
  - **Sizing**: Increased bubble size (padding/min-width) to address readability.
  - **Background**: Restored transparent background to allow the main app gradient to shine through.
- **UI Redesign**: Overhauled the chat interface to replicate WhatsApp's design (Alignment & Shape).
- **Crash Fix 2**: Resolved a second "Blank Screen" crash caused by a missing `loadMoreMessages` function in `ChatWindow.jsx`.
- **Crash Fix 1**: Resolved a "Blank Screen" crash caused by a missing audio reference in `ChatWindow.jsx`.
- **Deployment Fix**: Resolved a "Blank Screen" crash prior to that caused by missing imports in `Sidebar.jsx`.
- **Real-Time Updates**: Refactored `Sidebar.jsx` to use a dedicated listener for each user's online status. Checks both `online` and `state` fields for robustness.
- **Sound Effect Bug**: Fixed a race condition where the sound played on chat open. Now strictly clears message state on chat switch and tracks message IDs.
- **Deployment**: Added `database.rules.json` and updated `firebase.json` to ensure backend rules are deployed.
- **Real-Time Updates**: Refactored `Sidebar.jsx` to use a dedicated listener for each user's online status. Checks both `online` and `state` fields for robustness.
- **Sound Effect Bug**: Fixed a race condition where the sound played on chat open. Now strictly clears message state on chat switch and tracks message IDs.
- **Deployment**: Added `database.rules.json` and updated `firebase.json` to ensure backend rules are deployed.
- Configured `initializeFirestore` instead of the default `getFirestore`.
- **Result:**
    - Chats previously loaded are now instantly available offline.
    - New messages are queued and auto-synced upon reconnection.

### 2. Virtualized Chat Window (Performance) 🚀
**Goal:** Render thousands of messages efficiently without DOM lag.
**Implementation:**
- Installed `react-virtuoso`.
- Replaced standard `div` map loop with `<Virtuoso />` component in `ChatWindow.jsx`.
- **Logic:**
    - Only renders message nodes currently in the viewport (+ buffer).
    - `initialTopMostItemIndex={messages.length - 1}` ensures chat opens at the most recent message.
    - `followOutput="auto"` keeps the scroll at the bottom when new messages arrive.

### 3. Infinite Scroll Upgrade 🔄
**Goal:** Remove manual "Load More" button and improve UX.
**Implementation:**
- Used `startReached` prop from `react-virtuoso`.
- **Logic:**
    - Trigger `loadMoreMessages` automatically when user scrolls to the top.
    - Implemented a smooth logic to fetch older messages and prepend them without moving the scroll position relative to the user's view (handled natively by Virtuoso + state updates).

### 4. Components Refactoring 🧩
- **extracted `MessageItem.jsx`**:
    - Isolated message rendering logic (Reactions, Hover Menu, Audio Player) from `ChatWindow.jsx`.
    - Improves readability and performance (Memoization candidates).

## [Optimization] Phase 2: Media Optimization 📸
**Date:** 2026-01-25

### 1. Client-Side Image Compression
**Goal:** Reduce bandwidth usage and storage costs.
**Implementation:**
- Integrated `browser-image-compression`.
- **Logic:**
    - Detects if upload is an image.
    - Compresses file **before** upload to Firebase.
    - **Settings**: Max 1MB size, Max 1920px width/height.
- **Results:** 5MB photos are typically reduced to ~300KB without visible quality loss.

### 2. Sound Effects 🔔
**Goal:** Audio feedback for incoming messages.
**Implementation:**
- Added `useEffect` in `ChatWindow.jsx` to monitor `messages.length` changes.
- Plays a "pop" sound from a CDN when `lastMessage.sender !== currentUserId`.
- Includes "Initial Load" protection to prevent soundspam on chat open.

### 3. Media Gallery 🖼️
**Goal:** Quick access to all shared photos.
**Implementation:**
- Created `MediaGalleryModal` component.
- Queries Firestore for `messages` where `type == 'image'`, ordered by time.
- Displays results in a responsive grid.
- Accessible via "View Media" button in Chat Info.

### 4. Deployment 🚀
**Date:** 2026-01-25
- **Build**: Vite Production Build
- **Target**: Firebase Hosting
- **Live URL**: [https://chatapp-f20ea.web.app](https://chatapp-f20ea.web.app)

## [Optimization] Phase 3: Real-Time Features 🟢
**Date:** 2026-01-26

### 1. Online Presence
**Goal:** Show who is currently active.
**Implementation:**
- Connected **Firebase Realtime Database** (`.info/connected`).
- Status syncs to Firestore (`users/{uid}/online`).
- Handles tab closure via `beforeunload` to set status to offline instantly.
- `Sidebar.jsx` displays a green dot for online users.
