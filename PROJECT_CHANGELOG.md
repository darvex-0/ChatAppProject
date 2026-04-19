


# Project Changelog


## Version 3.3 - WebGL Stability & Mobile Optimization 🛡️📱
**Date:** 19th April 2026

**Bug Fixes:**
- **WebGL Crash Prevention**: Wrapped the `EarthGlobe` component in a dedicated `ErrorBoundary` on the Login page. 
- **ErrorBoundary Fallback Bug**: Fixed an internal logic bug in `ErrorBoundary.jsx` where a `fallback={null}` instruction to suppress a failure was evaluated as falsy and incorrectly bypassed, forcing a visible crash screen. It now properly fades out if WebGL context is lost.

**Performance & Optimization:**
- **iPhone Geometry & VRAM Optimization**: Slashed 3D rendering polygon counts and particle budgets to prevent iOS WebGL Out-Of-Memory (OOM) crashes:
  - Reduced the `EarthGlobe` grid segments from 128x128 to 32x32/64x64.
  - Slashed `Stars` particle count from 10,000 to 3,000.
  - Slashed `Sparkles` particle count from 500 to 200.
  - Halved background DataStream trail animations from 25 to 10.
- **iPhone High-DPI Fix**: Clamped the Device Pixel Ratio (`dpr`) to 2 in the 3D globe renderer. This dramatically reduces memory consumption on Retina displays (iPhones/iPads), preventing browser-level GPU crashes while maintaining high visual quality.
- **GPU Hint**: Added `high-performance` power preference to the WebGL context to ensure smoother 3D animations on compatible mobile hardware.

---

## Version 3.2 - Architecture & Reactivity Optimization ⚡
**Date:** 9th April 2026

**Architectural Refactoring:**
- **ChatWindow Component Splitting**: Deconstructed the massive 2,600-line monolithic `ChatWindow.jsx` into four focused sub-components (`ChatHeader.jsx`, `MessageList.jsx`, `MessageInputArea.jsx`, `ChatModals.jsx`). This radically improves IDE performance, maintainability, and code readability without mutating existing features.

**Performance & Load Times:**
- **Initial Load Time Reduced**: Used React Code Splitting to optimize chunk loading. The heavy `EarthGlobe` 3D component is now strictly lazy-loaded via `React.lazy` and `Suspense`, dropping the initial Login asset chunk from >900 KB down to ~9 KB, resulting in instant rendering on slower internet connections.
- **60FPS Chat Typing**: Eliminated downstream rendering lag when typing messages. Pushed strict component tree skipping using `React.memo` across all chat child-components. Paired this with exhaustive `useCallback` mapping for state-modifying functions passed via props from the parent router. Typing currently bypasses the main React render cycle for the 200+ message list.

**Bug Fixes:**
- **Unread Badge & Double Notifications**: Resolved an issue where receiving a message while actively inside a chat caused the sidebar unread badge to briefly flicker '1' and trigger a duplicate notification sound. The Sidebar now checks the active route parameters to dynamically suppress aggregate counters and push notifications for the currently focused chat.
- **Legacy Mention Resolution**: Clicking an `@mention` in older messages (before full UID mapping was active) sometimes searched the entire global database fuzzily by name. Context-aware scoped searching has been added; it now prioritizes exact handle-matching specifically among the active `chatId` members before falling back. Also patched a race condition in `UserProfileModal` so Mutual Groups consistently render for string-matched profiles.

---

## Version 3.1 - Poll Fixes, User Profiles & Mention Navigation 🔧👤
**Date:** 8th March 2026

**New Features:**
- **User Profile Modal (WhatsApp-style)**: Clicking any `@mention` now opens a full user profile card featuring:
  - Gradient cover with smooth dark-blend fade
  - Expandable profile avatar (click to zoom)
  - Name, @handle, online status, About/Bio section
  - Email, join date, and mutual groups
  - **Message button** — opens existing DM or creates a new one and navigates directly

**Bug Fixes & Improvements:**
- **Poll Voting Fixed**: Resolved a critical Firestore corruption bug where voting would convert the `options` array into a map object, breaking the poll UI. Now uses full-array replacement strategy.
- **Poll UI Redesign**: Options with images now display in YouTube-style horizontal layout (image left, text/bar right) instead of stacking vertically.
- **Poll Percentage Visibility**: Increased contrast and font weight on vote percentages for better readability.
- **Mention UID Resolution**: Mentions now store a `mentionMap` (handle → uid) in the Firestore message so clicking a mention always finds the correct user profile — even for names with spaces (e.g., `@LaonShark` correctly resolves to `Laon Shark`). Legacy messages use a normalised name-search fallback.
- **Message Button Navigation**: Fixed navigate URL to use the correct `/c/:chatId` route.

**Technical Details:**
- `PollMessage.jsx`: Votes written as full array replacement; corrupted object-type options automatically reconstructed.
- `ChatWindow.jsx`: `mentionMapRef` tracks `handle → uid` per session and saves to Firestore on send.
- `MessageItem.jsx`: Mention spans resolve uid from `msg.mentionMap` before opening `UserProfileModal`.
- `UserProfileModal.jsx`: Priority lookup by uid (fast), falls back to normalised client-side name scan for legacy messages.

---

## Version 3.0 - Pro Polls & @AI Mentions 🚀✨
**Date:** 5th March 2026

**New Features:**
- **Advanced Polls 2.0**: Premium polling experience with media support.
  - **Image Options**: Attach images to poll options for visual selection.
  - **Anonymous Mode**: Secure, private voting for sensitive topics.
  - **Expirations**: Add real-time countdown timers to polls.
  - **Multi-Select**: Support for multiple choice voting.
- **Pro Mentions & @AI Integration**:
  - **Advanced Suggestions**: New dropdown with avatars and keyboard navigation support.
  - **@AI Command**: Tagging "@AI" triggers an intelligent, proactive response from the AI Assistant.
  - **High-Impact Rendering**: Mentions are now highlighted with premium glows and special classes.
- **Glass-morphism UI Overhaul**: Updated the input bar and modals with a modern, translucent aesthetic for a premium feel.

**Technical Details:**
- Integrated AI triggers directly into the message pipeline in `ChatWindow.jsx`.
- Enhanced `PollMessage.jsx` with reactive progress bars and image lazy-loading.
- Robust keyboard event handling for the mention system.

---

## Version 2.30 - Stories, Polls, & Media Cropping 📸📊
**Date:** 4th March 2026

**New Features:**
- **Status Updates / Stories**: WhatsApp-style 24h ephemeral stories.
  - View friends' stories in a scrollable top bar.
  - Create text stories with beautiful gradients or upload images/videos.
  - Full-screen story viewer with auto-advancing progress bars and pause on hold.
  - Integrated rich media editing (crop, filter, trim, caption) directly into story uploads.
  - Owners can see who viewed their stories and delete them at any time.
- **Improved Media Cropping**: Swapped basic crop tool for `react-image-crop`, allowing freeform, draggable resizing of images before uploading to chats, stories, or profile pictures.
- **Robust AI Fallback System**: Smart Replies now have 3 layers of reliability:
    1.  **Local AI (Ollama)**: Default for cost-free privacy.
    2.  **Google Gemini (Cloud)**: Auto-fallback if the local server is off.
    3.  **Static Engine**: Final pattern-matching insurance for offline use.
- **Polls in Chats** (Preview): Infrastructure laid for creating and voting on polls (in progress).
- **User Mentions** (Preview): Infrastructure laid for @mentioning users in group chats (in progress).

**Technical Details:**
- `CreateStoryModal.jsx` and `StoryViewer.jsx` handle story creation and playback.
- `MediaPreviewModal.jsx` and `SettingsModal.jsx` refactored to use `react-image-crop` for accurate dimension scaling.
- Updated Firestore security rules to allow viewers to log their views anonymously but securely.

---

## Version 2.29 - Local AI Engine (Ollama + FastAPI) 🧠
**Date:** 2nd March 2026

**New Features:**
- **Local AI Smart Replies**: Replaced Gemini Cloud Function with a local Ollama-powered backend.
  - **Zero Cost**: AI runs on your GPU (RTX 3050) via `qwen2.5:3b` — no API keys or cloud bills.
  - **Privacy**: Chat data never leaves your machine.
- **AI Message Rephrase (✨)**: New sparkle button next to send — rephrases messy/slang drafts into professional, polished messages.
- **AI Chat Summarizer (📑)**: "Summarize Chat" button in Chat Info modal — generates a 2-3 sentence AI summary of the last 50 messages.
- **FastAPI Backend**: Dedicated Python server with 3 endpoints (`/api/smart-reply`, `/api/rephrase`, `/api/summarize`).
- **Fault-Tolerant UI**: AI features gracefully degrade when the local server isn't running.

**Technical:**
- `ConnectHubBackend/server.py` — FastAPI server with CORS + Ollama integration
- `src/services/localAI.js` — API helper module with error handling
- `src/components/Modals/ChatSummaryModal.jsx` — Self-fetching summary modal

---

## Version 2.28 - AI Smart Replies (Gemini) 🤖
**Date:** 25th February 2026

**New Features & Fixes:**
- **Reliable Smart Replies**: Fully restored AI-generated smart replies using the Gemini API.
  - **Gemini 2.5 Flash Lite**: Switched to the efficient, non-thinking `gemini-2.5-flash-lite` model for instant, reliable JSON responses.
  - **Robust Parsing**: Improved JSON extraction logic handles markdown blocks and preamble text gracefully.
  - **Cold Start Resilience**: Increased Cloud Function timeouts to ensure completion.
  - **Security**: Secured API keys using Firebase Secret Manager.

---
## Version 2.27 - Media Camera & Video Notes 📸
**Date:** 15th February 2026

**New Features:**
- **In-App Media Camera**: Capture photos and videos directly within the app without leaving the chat.
  - **Dual Mode**: Tap to take a photo, hold to record a video.
  - **Camera Switching**: Toggle between front and back cameras.
  - **Flash Support**: Toggle flash on supported devices.
- **Instant Video Notes**: Send quick, circular video messages (similar to WhatsApp/Telegram).
  - **Dedicated Button**: Use the camcorder icon next to the mic for instant video notes.
  - **Circular UI**: Distinguishes quick notes from standard video attachments.
- **Media Editing Tools**:
  - **Image Cropping**: Crop/Rotate images before sending.
  - **Video Trimming**: Trim the start/end of videos with a precision slider.
  - **Filters**: Apply filters to images (e.g., B&W, Vivid, Warm) before sending.

**Bug Fixes:**
- Fixed camera stream cleanup issue (camera staying on after capture).
- Fixed auto-crop tool zooming in by default.
- Resolved preview modal trigger issues for camera captures.

---

## Version 2.26 - Instant Video Messages 📹
**Date:** 14th February 2026

**New Features:**
- **Instant Video Bubbles**: Send short, circular video messages directly from the chat input.
  - **Quick Recording**: one-tap access to record up to 60 seconds of video.
  - **Cross-Platform**: Works on Chrome, Edge, Firefox, and Safari (iOS/macOS).
  - **Muted Autoplay**: Videos play silently in the chat feed; tap to unmute.
  - **Clean UI**: Minimalist circular design for seamless integration.
  - **Smart Storage**: Videos are compressed and optimized for fast sharing.

---

## Version 2.25 - Personal Notes & Forwarding 📝
**Date:** 11th February 2026

**New Features:**
- **Personal Notes Tab**: Dedicated space for personal notes and tasks.
  - **Create & Manage**: Add, check off (complete), and delete notes.
  - **Sorting**: Active notes stay on top; completed notes move to the bottom.
- **Forward to Notes**: Save important messages directly from chats.
  - **"Save to Notes" Action**: New option in the message hover menu.
  - **Source Context**: Saved messages show "Forwarded from [Chat Name]" (e.g., "Forwarded from Alice") for easy reference.
  - **Toast Notifications**: clear feedback when a note is saved.

**Refinements:**
- **Smart Forwarding Source**: Logic identifying the chat name (Group or User) as the source, even if the sender was "You".
- **Robustness**: Improved handling of chat context switching to ensure accurate source attribution.

---

## Version 2.24 - Enhanced Call History Management 🗑️
**Date:** 10th February 2026

**New Features:**
- **Delete Call Logs**: Remove unwanted call logs from your history
  - **Trash Icon Button**: Delete button appears next to each call log in the sidebar
  - **Call Info Modal**: Delete individual calls from the detailed call history view
  - **Confirmation Dialog**: Prevents accidental deletions with confirmation prompt
  - **Instant Update**: Deleted logs disappear immediately via real-time sync
  - **Database Removal**: Permanently removes call logs from Firestore
- **"Not Answered" Status**: Clearer feedback for missed and declined calls
  - **Visual Indicator**: Missed/declined calls show "Not answered" in red
  - **Smart Detection**: Automatically detects unanswered calls (zero duration or declined status)
  - **Consistent Display**: Shows in both sidebar call logs and Call Info modal
  - **Time Display**: Shows "Not answered • [Time]" for easy reference

**Technical:**
- Updated Firestore security rules to allow participants to delete their own call logs
- Enhanced call log UI with delete button (red trash icon)
- Improved status detection logic to include zero-duration calls as unanswered

---

## Version 2.23 - Call History & Details 📞
**Date:** 10th February 2026

**New Features:**
- **Persistent Call History**: Keep track of all your calls!
  - **New "Calls" Tab**: Dedicated tab in the sidebar to view call logs separately from chats.
  - **Detailed Logs**: View incoming, outgoing, and missed calls with status icons (↙️/↗️).
  - **Smart Timestamps**: Relative times ("Today", "Yesterday") for easy reading.
  - **Data Usage Tracking**: View estimated data consumption for each call (e.g., "1.2 MB").
  - **One-Tap Callback**: Quickly call back directly from the history list.
- **Chat Call Events**:
  - **System Messages**: "📞 Voice Call" or "📹 Video Call" bubbles appear in the chat stream when a call ends.
  - **Status & Duration**: See at a glance if a call was missed or how long it lasted.

**Technical:**
- **Firestore**: Implemented `callLogs` collection with composite indexes for efficient querying.
- **Optimized**: Stale call sessions are now automatically cleared to prevent "User Busy" errors.

---

## Version 2.22 - PWA Video/Audio Calling 📹🔊
**Date:** 9th February 2026

**New Features:**
- **1-on-1 Video & Audio Calling**: Full WebRTC peer-to-peer calling system
  - **Video Calls**: Real-time video with local PiP preview
  - **Audio Calls**: Voice-only calls with avatar display
  - **Call Controls**: Mute, camera toggle, end call buttons
  - **Incoming Call UI**: Caller info, ringtone, Accept/Decline buttons
  - **Outgoing Call UI**: Animated calling state with cancel option

- **PWA Superpowers**:
  - **Wake Lock**: Screen stays awake during active calls
  - **Picture-in-Picture**: Continue video while using other apps (PiP button)
  - **Tab Visibility Warning**: Warns browser users when backgrounding tab
  - **Service Worker Notifications**: System-level incoming call notifications
    - Answer/Decline buttons on notification
    - Vibration pattern for phone alerts
    - Auto-closes when call ends

- **WebRTC Features**:
  - **STUN Servers**: Google's public STUN for NAT traversal
  - **Ghost Ring Fix**: Auto-cleanup on tab close/reload
  - **Collision-Safe IDs**: Alphabetically sorted call IDs prevent duplicates
  - **Call Timeout**: Auto-ends unanswered calls after 30 seconds (marks as missed)
  - **Call Duration Timer**: Real-time MM:SS timer during active calls
  - **TURN Server**: Integrated Metered.ca TURN for reliable cross-network calls (WiFi ↔ 4G)
  - **Background Wake-Up**: FCM data messages wake device when app is force-closed
    - Incoming calls trigger system notifications even when app is killed
    - High-priority push ensures device wakes from sleep
    - Answer/Decline actions work directly from notification

**Technical Details:**
- `CallContext.jsx`: WebRTC logic, Wake Lock, SW messaging
- `CallModal.jsx`: UI, PiP toggle, visibility warning
- `firebase-messaging-sw.js`: Call notification handlers
- `firestore.rules`: Calls collection with proper permissions

**Bug Fixes:**
- Fixed permission error when checking for existing calls
- Fixed Wake Lock error when page not visible
- Fixed PiP error when video metadata not loaded
- Fixed video not displaying (stream attachment timing)

---

## Version 2.21 - Archive & Polish 🗂️
**Date:** 7th February 2026

**New Features:**
- **Archived Chats**: Keep your sidebar clutter-free!
  - **Archive/Unarchive**: Swipe or use the menu to archive chats.
  - **Archived Folder**: Access all archived chats via the folder icon in the sidebar header.
  - **Muted Notifications**: Archived chats are validly muted (no sound/popups), but still show unread badges.
  - **Smart Unarchive**: Starting a new chat with an archived user automatically restores the conversation.

**Improvements & Fixes:**
- **Instant Timestamps ⚡**: Messages now show the current time immediately upon sending (Optimistic UI), eliminating the "..." delay.
- **Stable Sidebar Sorting**: Fixed an issue where chats would jump to the bottom of the list momentarily when sending a new message.
- **Smart Deduplication**: Logic to automatically merge and clean up duplicate chat entries in the sidebar.
- **Notification Logic**: Enhanced rules to ensure notifications only play for active, unmuted chats.

---

## Version 2.20 - Light Mode & Visual Polish 🎨
**Date:** 4th February 2026

**New Features:**
- **Light Mode UI Polish**:
  - **Contrast Enhancements**: Fixed invisible text issues in sidebar and chat items for light mode.
  - **Input Area**: Updated chat input bar to match light theme (removed hardcoded dark gray).
  - **Refined Palette**: Adjusted light mode backgrounds to reduce glare and improve separation.
  - **Themes Menu**: Renamed "Dark Mode" to "Themes" in settings to better reflect customization options.

- **Message Scheduling**:
  - **Schedule Button**: New clock icon in the chat input area to schedule messages.
  - **Timezone Support**: Ensures messages are sent at the correct time regardless of your timezone.
  - **Management**: View, un-schedule, or delete pending messages via the new "Scheduled" list.
  - **Edit & Reschedule**: Update the text or time of pending messages directly from the list without deleting.
  - **Auto-Send**: Backend system automatically delivers messages when due, even if you're offline.

**Fixes:**
- **Invisible Text**: Resolved hardcoded white text in `index.css` that persisted in light mode.
- **Scheduled Messages Modal**: Moved the close button to the top-right corner using proper spacing for better usability.
- **Read Receipts**: Verified "WhatsApp-style" ticks (✓ for sent, ✓✓ for read).
  - **Theming**: Ticks are **White** in both Light and Dark modes (optimized for contrast).



**Technical Improvements:**
- **CSS Variables**: Refactored entire codebase to use semantic CSS variables
- **Modal Styling**: Unified modal styles with consistent shadows and glassmorphism support across themes


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
