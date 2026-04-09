# ChatWindow Component Refactoring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Break down the massive 2,600-line `ChatWindow.jsx` into four focused child components without mutating existing state or logic.

**Architecture:** Pure props-down refactoring. All hooks, Firebase subscriptions, and business logic remain tightly coupled to `ChatWindow.jsx`. The child components (`ChatHeader`, `MessageList`, `MessageInputArea`, `ChatModals`) are exported as UI layout building blocks and receive all required state updates and callbacks via direct prop drilling. 

**Tech Stack:** React, Vite (React Fast Refresh), Firebase

---

### Task 1: Create Shared Modals Wrapper Component

**Files:**
- Create: `c:\Users\Rakesh\Vs code\ChatApp Project\src\components\chat\ChatModals.jsx`
- Modify: `c:\Users\Rakesh\Vs code\ChatApp Project\src\components\ChatWindow.jsx`

- [ ] **Step 1: Write the failing build verification or manual test**
Skip explicit testing since we haven't touched parent file yet.

- [ ] **Step 2: Write minimal implementation of ChatModals**
Extract all overlay modals (lines 2284-2607) into `ChatModals.jsx`. It will accept all required state dependencies as a destructured props block and return a Fragment containing the modals. Be sure to import `ReactDOM` and child modal components inside `ChatModals.jsx`. Note: delete imports from `ChatWindow.jsx` if they are only used in modals.

- [ ] **Step 3: Modify `ChatWindow.jsx` to render `<ChatModals {...props} />`**
Replace lines 2284-2607 in `ChatWindow.jsx` with `<ChatModals />` configured and bound with all required properties.

- [ ] **Step 4: Run test to verify it passes**
Run: `npm run build`
Expected: PASS (0 errors, dist files generated successfully)
Also, run: `npm run lint src/components/ChatWindow.jsx` (Fix missing imports/vars if any)

- [ ] **Step 5: Commit**
```bash
git add src/components/chat/ChatModals.jsx src/components/ChatWindow.jsx
git commit -m "refactor: extract ChatModals overlay components"
```

---

### Task 2: Create ChatHeader Component

**Files:**
- Create: `c:\Users\Rakesh\Vs code\ChatApp Project\src\components\chat\ChatHeader.jsx`
- Modify: `c:\Users\Rakesh\Vs code\ChatApp Project\src\components\ChatWindow.jsx`

- [ ] **Step 1: Write minimal implementation of ChatHeader**
Extract the header block, search bar block, and pinned messages banner block (lines 1619-1822) into `ChatHeader.jsx`. 

- [ ] **Step 2: Modify `ChatWindow.jsx` to render `<ChatHeader {...props} />`**
Replace the top JSX blocks with `<ChatHeader />` and wire the props.

- [ ] **Step 3: Run test to verify it passes**
Run: `npm run build`
Expected: PASS 

- [ ] **Step 4: Commit**
```bash
git add src/components/chat/ChatHeader.jsx src/components/ChatWindow.jsx
git commit -m "refactor: extract ChatHeader component"
```

---

### Task 3: Create MessageList Component

**Files:**
- Create: `c:\Users\Rakesh\Vs code\ChatApp Project\src\components\chat\MessageList.jsx`
- Modify: `c:\Users\Rakesh\Vs code\ChatApp Project\src\components\ChatWindow.jsx`

- [ ] **Step 1: Write minimal implementation of MessageList**
Extract the `react-virtuoso` block and the typing indicator block (lines 1824-1879) into `MessageList.jsx`. Be sure to import `Virtuoso` and `MessageItem`.

- [ ] **Step 2: Modify `ChatWindow.jsx` to render `<MessageList {...props} />`**
Replace the list block in the codebase with the component. Keep `virtuosoRef` defined in `ChatWindow.jsx` and pass it down as a prop so that search functionality remains intact.

- [ ] **Step 3: Run test to verify it passes**
Run: `npm run build`
Expected: PASS

- [ ] **Step 4: Commit**
```bash
git add src/components/chat/MessageList.jsx src/components/ChatWindow.jsx
git commit -m "refactor: extract MessageList component"
```

---

### Task 4: Create MessageInputArea Component

**Files:**
- Create: `c:\Users\Rakesh\Vs code\ChatApp Project\src\components\chat\MessageInputArea.jsx`
- Modify: `c:\Users\Rakesh\Vs code\ChatApp Project\src\components\ChatWindow.jsx`

- [ ] **Step 1: Write minimal implementation of MessageInputArea**
Extract the `SmartReplies` logic, voice draft UI, reply preview, recording UI, and main input form (+ emoji picker, mention suggestions) (lines 1881-2282). This requires carefully mapping several `useState` and ref hooks (e.g. `inputRef`, `fileInputRef`, etc.) as props. 

- [ ] **Step 2: Modify `ChatWindow.jsx` to render `<MessageInputArea {...props} />`**
Replace the input block with the `<MessageInputArea />` and heavily wire all handlers and context flags into its props. Remove unused UI imports from `ChatWindow.jsx`.

- [ ] **Step 3: Run test to verify it passes**
Run: `npm run build`
Expected: PASS

- [ ] **Step 4: Run manual verification**
Manually test the full application locally via `npm run dev`. Send messages, attachments, reactions, perform edits/deletes, check pinned states, and ensure UI remains unbroken on component decoupling.

- [ ] **Step 5: Commit**
```bash
git add src/components/chat/MessageInputArea.jsx src/components/ChatWindow.jsx
git commit -m "refactor: extract MessageInputArea and finish ChatWindow split"
```
