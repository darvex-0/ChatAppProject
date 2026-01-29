# ConnectHub ChatApp - Project Flowchart

## System Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     CONNECTHUB CHAT APP                          │
│                                                                   │
│  Frontend (Web)              Backend (Cloud Functions)           │
│  ═══════════════              ════════════════════════           │
│                                                                   │
│  public/index.html       Firebase Cloud Functions               │
│  - Chat UI               - onUserStatusChanged()                │
│  - User Auth             - onMessageDeleted()                   │
│  - Message Display       - sendPushNotification()               │
│  - File Upload                                                   │
│                          Firebase Services                       │
│  public/firebase-       ┌──────────────────┐                   │
│  messaging-sw.js        │ Firestore        │                   │
│  - Push Notifications   │ - chats/*        │                   │
│  - Background Sync      │ - users/*        │                   │
│                         │ - messages/      │                   │
│                         └──────────────────┘                   │
│                         ┌──────────────────┐                   │
│                         │ Realtime DB      │                   │
│                         │ - status/*       │                   │
│                         └──────────────────┘                   │
│                         ┌──────────────────┐                   │
│                         │ Cloud Storage    │                   │
│                         │ - Files/Images   │                   │
│                         │ - Audio Messages │                   │
│                         └──────────────────┘                   │
│                         ┌──────────────────┐                   │
│                         │ FCM (Firebase    │                   │
│                         │ Cloud Messaging) │                   │
│                         │ - Push Notifs    │                   │
│                         └──────────────────┘                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## User Flow - Chat Application

```
START
  │
  ├─→ [User Opens App]
  │    │
  │    ├─→ [Firebase Auth Check]
  │    │    ├─ If Not Logged In → [Show Login/Signup]
  │    │    │    │
  │    │    │    ├─→ [User Authenticates]
  │    │    │    │    │
  │    │    │    │    └─→ [Create User Document in Firestore]
  │    │    │    │         - username, profile pic, fcmTokens
  │    │    │    │         - online status
  │    │    │    │
  │    │    │    └─→ [Register FCM Token] 
  │    │    │         (for push notifications)
  │    │    │
  │    │    └─ If Logged In → [Load User Data]
  │    │
  │    └─→ [Display Chat Interface]
  │         │
  │         ├─ Header (Logo, Icons, Profile)
  │         ├─ Search Bar
  │         ├─ Chat List (Inbox)
  │         └─ Empty State (if no chats)
  │
  ├─→ [User Actions]
  │    │
  │    ├─→ [Search Chats]
  │    │    │
  │    │    └─→ [Filter chat list by search term]
  │    │
  │    ├─→ [Select Chat/Create New Chat]
  │    │    │
  │    │    ├─ If Direct Chat:
  │    │    │  └─→ Create chat document with:
  │    │    │       - participants (2 users)
  │    │    │       - type: 'direct'
  │    │    │       - lastMessage
  │    │    │       - timestamp
  │    │    │
  │    │    └─ If Group Chat:
  │    │       └─→ Create chat document with:
  │    │            - members (array of user IDs)
  │    │            - type: 'group'
  │    │            - groupName, groupIcon
  │    │            - lastMessage, timestamp
  │    │
  │    ├─→ [Load Chat Messages]
  │    │    │
  │    │    └─→ [Listen to messages subcollection]
  │    │         - Display messages in real-time
  │    │         - Show sender info, timestamps
  │    │         - Show media (images, files, audio)
  │    │
  │    ├─→ [Send Message]
  │    │    │
  │    │    ├─ User types & clicks Send
  │    │    │   │
  │    │    │   └─→ [Check Message Type]
  │    │    │        │
  │    │    │        ├─ Type: TEXT
  │    │    │        │  └─→ Save to: chats/{chatId}/messages/
  │    │    │        │      - text content
  │    │    │        │      - sender ID & name
  │    │    │        │      - timestamp
  │    │    │        │      - type: 'text'
  │    │    │        │
  │    │    │        ├─ Type: IMAGE
  │    │    │        │  └─→ [Upload to Cloud Storage]
  │    │    │        │      - Get download URL
  │    │    │        │      - Save message with imageURL
  │    │    │        │
  │    │    │        ├─ Type: FILE
  │    │    │        │  └─→ [Upload to Cloud Storage]
  │    │    │        │      - Get download URL
  │    │    │        │      - Save message with fileURL
  │    │    │        │
  │    │    │        └─ Type: AUDIO
  │    │    │           └─→ [Upload to Cloud Storage]
  │    │    │               - Get download URL
  │    │    │               - Save message with audioURL
  │    │    │
  │    │    └─→ [Firestore Trigger: sendPushNotification]
  │    │         │
  │    │         ├─ Triggered on: New message created
  │    │         │
  │    │         ├─→ [Get Chat Details]
  │    │         │    - Get members list
  │    │         │    - Get chat type (direct/group)
  │    │         │
  │    │         ├─→ [Filter Recipients]
  │    │         │    - All members EXCEPT sender
  │    │         │
  │    │         ├─→ [Fetch FCM Tokens]
  │    │         │    - Get tokens from each recipient's user doc
  │    │         │
  │    │         ├─→ [Create Notification Content]
  │    │         │    │
  │    │         │    ├─ If Direct Chat:
  │    │         │    │  - Title: "{Sender Name}"
  │    │         │    │  - Body: "{Message Content}"
  │    │         │    │
  │    │         │    └─ If Group Chat:
  │    │         │       - Title: "{Group Name}"
  │    │         │       - Body: "{Sender Name}: {Message}"
  │    │         │
  │    │         ├─→ [Get Firebase Access Token]
  │    │         │
  │    │         └─→ [Send via FCM v1 API]
  │    │              - For each recipient's tokens
  │    │              - Include chatId & chat type
  │    │              - Log success/failure count
  │    │
  │    ├─→ [Delete Message]
  │    │    │
  │    │    ├─ User clicks delete on own message
  │    │    │   │
  │    │    │   └─→ [Delete from Firestore]
  │    │    │        │
  │    │    │        └─→ [Firestore Trigger: onMessageDeleted]
  │    │    │             │
  │    │    │             ├─ Check if message has file
  │    │    │             │
  │    │    │             └─ If yes → [Delete from Cloud Storage]
  │    │    │                - Extract file path from URL
  │    │    │                - Delete file, log results
  │    │
  │    ├─→ [Archive Chat]
  │    │    │
  │    │    └─→ [Move chat to archived collection]
  │    │         - Still accessible but hidden from main list
  │    │
  │    ├─→ [User Status Update]
  │    │    │
  │    │    ├─ Periodically update status in Realtime DB
  │    │    │   - /status/{uid} = { online: true, timestamp }
  │    │    │
  │    │    └─→ [Firestore Trigger: onUserStatusChanged]
  │    │         │
  │    │         ├─ When status written to Realtime DB
  │    │         │
  │    │         └─→ [Update Firestore user document]
  │    │              - online: true/false
  │    │              - last_seen: server timestamp
  │    │
  │    └─→ [Profile/Settings Actions]
  │         │
  │         ├─ Update profile picture
  │         ├─ Update username
  │         ├─ Manage FCM tokens
  │         └─ Logout
  │
  └─→ [Real-time Listeners]
       │
       ├─→ [Chat List Listener]
       │    - chats/ collection
       │    - Shows all user's chats
       │    - Updates unread counts
       │    - Shows last message preview
       │
       ├─→ [Messages Listener]
       │    - chats/{chatId}/messages/
       │    - Real-time message updates
       │    - Displays new messages instantly
       │
       ├─→ [User Status Listener]
       │    - Online/offline indicator
       │    - Last seen timestamp
       │
       └─→ [FCM Notification Listener]
            - Background message handler
            - Navigate to chat on click
            - Show system notifications
```

---

## Cloud Function Flows

### 1. **onUserStatusChanged** (Realtime DB Trigger)
```
Realtime DB: /status/{uid} → Value Written
    ↓
Check eventStatus.online
    ↓
    ├─ If online = true
    │  └→ Update Firestore users/{uid}: { online: true }
    │
    └─ If online = false
       └→ Update Firestore users/{uid}: { 
           online: false, 
           last_seen: serverTimestamp() 
        }
```

### 2. **onMessageDeleted** (Firestore Trigger)
```
Firestore: chats/{chatId}/messages/{messageId} → Document Deleted
    ↓
Extract deletedMessage data
    ↓
Check if deletedMessage has fileURL
    ↓
    ├─ If NO fileURL
    │  └→ Log "Text-only message" and exit
    │
    └─ If YES fileURL
       ↓
       Extract file path from URL
       ↓
       Decode URI component
       ↓
       Delete from Cloud Storage
       ↓
       Log success/error
```

### 3. **sendPushNotification** (Firestore Trigger)
```
Firestore: chats/{chatId}/messages/{messageId} → Document Created
    ↓
Extract message & chat data
    ↓
Get chat details from chats/{chatId}
    ↓
Get members list
    ↓
Filter recipients (exclude sender)
    ↓
    ├─ If NO recipients
    │  └→ Log and exit
    │
    └─ If YES recipients
       ↓
       Fetch FCM tokens in parallel
       └→ For each recipient user document
          - Get fcmTokens array
       ↓
       Check if tokens found
       ├─ If NO tokens → Log and exit
       │
       └─ If YES tokens
          ↓
          Get Firebase Access Token
          ↓
          Determine notification content:
          ├─ If Direct Chat: 
          │  - Title: Sender Name
          │  - Body: Message content
          │
          └─ If Group Chat:
             - Title: Group Name
             - Body: "Sender Name: Message"
          ↓
          Create FCM payload for each token:
          {
            message: {
              token,
              notification: { title, body },
              data: { chatId, type }
            }
          }
          ↓
          Send via FCM v1 API (parallel)
          ↓
          Track results:
          - Count successful
          - Count failed
          ↓
          Log summary
```

---

## Data Models

### Firestore Collections

#### `users/{uid}`
```json
{
  "username": "string",
  "email": "string",
  "profilePic": "string (Cloud Storage URL)",
  "online": "boolean",
  "last_seen": "timestamp",
  "fcmTokens": ["token1", "token2"],
  "createdAt": "timestamp"
}
```

#### `chats/{chatId}`
```json
{
  "type": "direct | group",
  "participants": ["uid1", "uid2"],              // For direct chats
  "members": ["uid1", "uid2", "uid3"],          // For group chats
  "groupName": "string",                         // Only for groups
  "groupIcon": "string (URL)",                   // Only for groups
  "lastMessage": "string",
  "lastMessageTime": "timestamp",
  "createdAt": "timestamp",
  "updatedAt": "timestamp"
}
```

#### `chats/{chatId}/messages/{messageId}`
```json
{
  "type": "text | image | file | audio",
  "sender": "uid",
  "senderName": "string",
  "text": "string",                               // For text
  "imageURL": "string (Cloud Storage)",       // For images
  "fileURL": "string (Cloud Storage)",        // For files
  "audioURL": "string (Cloud Storage)",       // For audio
  "timestamp": "timestamp",
  "edited": "boolean",
  "deletedBy": ["uid1", "uid2"]               // Soft delete tracking
}
```

### Realtime Database

#### `/status/{uid}`
```json
{
  "online": "boolean",
  "timestamp": "milliseconds"
}
```

---

## Frontend Interface Layout

```
┌─────────────────────────────────────────────────────────────┐
│  ConnectHub  🔔 🔍 👤                       [Profile Pic]   │
├─────────────────────────────────────────────────────────────┤
│ Search chats...                                              │
├─────────────────────────────────────────────────────────────┤
│                          │                                    │
│                          │                                    │
│   INBOX (Chats List)     │          CHAT VIEW                │
│   ═════════════════      │          ═════════               │
│                          │                                    │
│ [Chat 1] Alex            │  Alex  🟢  [Info] [More]         │
│   Last message           │  ─────────────────────────────    │
│   2:30 PM         [📌]   │                                    │
│                          │  Today                             │
│ [Chat 2] Project Team    │                                    │
│   Group chat notice      │  You: Hey everyone!               │
│   1:45 PM         [5]    │      10:30 AM                     │
│                          │                                    │
│ [Chat 3] Sarah ● ─────   │  Alex: Hi! How's it going?       │
│   You: Thanks!           │      10:32 AM                     │
│   11:20 AM               │                                    │
│                          │  You: All good, working on...    │
│ [+ New Chat]             │      10:33 AM   [✏️] [🗑️]        │
│                          │                                    │
│                          │  Sarah: Sent a photo 📷          │
│                          │      10:35 AM                     │
│                          │  [Image Preview]                  │
│                          │                                    │
│                          │  ─────────────────────────────    │
│                          │  [📎 Attachment] [🎤 Voice]       │
│                          │  [Type message...        ] [Send] │
│                          │                                    │
└─────────────────────────────────────────────────────────────┘
```

---

## Key Features

### 1. **Real-time Messaging**
- Direct one-on-one chats
- Group chats with multiple members
- Real-time message synchronization

### 2. **Media Support**
- Image uploads with preview
- File sharing
- Audio message recording

### 3. **Push Notifications**
- FCM integration
- Different formats for direct/group chats
- Background message handling

### 4. **User Presence**
- Online/offline status
- Last seen timestamp
- Automatic status updates

### 5. **Chat Management**
- Archive chats
- Search chats
- Unread message badges
- Message deletion with auto-cleanup

### 6. **Service Worker**
- Background message handling
- Offline support
- Cache management

---

## Deployment Flow

```
Local Development
    ↓
    ├─→ Code in: functions/ (Cloud Functions)
    │            public/ (Frontend)
    │
    ├─→ firebase.json configuration
    │
    └─→ [firebase deploy --only hosting]
        or [firebase deploy --only functions]
        or [firebase deploy] (all)
        ↓
    Firebase Hosting (Frontend)
    - Hosts public/index.html
    - Serves static files
    - Rewrites all routes to index.html (SPA)
    ↓
    Cloud Functions (Backend)
    - Deploy functions/index.js
    - Auto-scale as needed
    - Triggers on Firestore/DB events
```

---

## Security Considerations

1. **Firestore Security Rules** - Control read/write access by user
2. **Storage Rules** - Authenticate file uploads
3. **FCM Tokens** - Securely managed per user
4. **Cloud Functions** - Server-side validation & token refresh
5. **Service Worker** - Content Security Policy
