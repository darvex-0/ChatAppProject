// Import the v2 functions framework
const functions = require("firebase-functions/v2");

// Import the 'classic' admin SDK
const admin = require("firebase-admin");

// Import the logger
const logger = require("firebase-functions/logger");

// Import cheerio for HTML parsing (link previews)
const cheerio = require("cheerio");

// Initialize the app ONCE
admin.initializeApp();

// --- Function 1: onUserStatusChanged (Unchanged) ---
exports.onUserStatusChanged = functions.database.onValueWritten("/status/{uid}", async (event) => {
  const uid = event.params.uid;
  const eventStatus = event.data.after.val();
  const userFirestoreRef = admin.firestore().collection("users").doc(uid);

  if (!eventStatus || !eventStatus.online) {
    return userFirestoreRef.update({
      online: false,
      last_seen: admin.firestore.FieldValue.serverTimestamp(),
    });
  }
  return userFirestoreRef.update({ online: true });
});

// --- Function 2: onMessageDeleted (Enhanced: Syncs Sidebar) ---
exports.onMessageDeleted = functions.firestore.onDocumentDeleted("chats/{chatId}/messages/{messageId}", async (event) => {
  const chatId = event.params.chatId;
  const deletedMessage = event.data.data();

  // 1. Delete associated file from Storage (if exists)
  if (deletedMessage && deletedMessage.fileURL) {
    try {
      const fileUrl = deletedMessage.fileURL;
      const filePath = fileUrl.split("/o/")[1].split("?alt=media")[0];
      const decodedFilePath = decodeURIComponent(filePath);
      const bucket = admin.storage().bucket();
      logger.info(`Deleting file from Storage: ${decodedFilePath}`);
      await bucket.file(decodedFilePath).delete();
    } catch (err) {
      logger.error("Failed to parse file URL or delete file.", err);
    }
  }

  // 2. Update the Sidebar: Find the NEW last message and sync it
  try {
    const messagesRef = admin.firestore()
      .collection("chats")
      .doc(chatId)
      .collection("messages");

    const lastMessageSnapshot = await messagesRef
      .orderBy("timestamp", "desc")
      .limit(1)
      .get();

    const chatRef = admin.firestore().collection("chats").doc(chatId);

    if (lastMessageSnapshot.empty) {
      // No messages left in the chat
      await chatRef.update({
        lastMessage: "No messages yet",
        lastUpdate: admin.firestore.FieldValue.serverTimestamp()
      });
      logger.info(`Chat ${chatId} is now empty, cleared lastMessage.`);
    } else {
      // Found the new last message
      const lastMsg = lastMessageSnapshot.docs[0].data();
      let preview = "";

      switch (lastMsg.type) {
        case 'image': preview = "📷 Image"; break;
        case 'audio': preview = "🎤 Voice Message"; break;
        case 'file': preview = `📄 ${lastMsg.fileName || 'File'}`; break;
        default: preview = lastMsg.text || "Message";
      }

      await chatRef.update({
        lastMessage: preview,
        lastUpdate: lastMsg.timestamp || admin.firestore.FieldValue.serverTimestamp()
      });
      logger.info(`Synced lastMessage for chat ${chatId}: "${preview}"`);
    }
  } catch (err) {
    logger.error(`Error syncing lastMessage for chat ${chatId}:`, err);
  }
});

// --- Function 4: extractLinkPreview ---
// Extracts Open Graph metadata from URLs in text messages
exports.extractLinkPreview = functions.firestore.onDocumentCreated("chats/{chatId}/messages/{messageId}", async (event) => {
  const message = event.data.data();
  const chatId = event.params.chatId;
  const messageId = event.params.messageId;

  // Only process text messages
  if (!message || message.type !== 'text' || !message.text) {
    return;
  }

  // Already has a link preview (avoid reprocessing)
  if (message.linkPreview) {
    return;
  }

  // URL regex pattern
  const urlRegex = /(https?:\/\/[^\s]+)/gi;
  const urls = message.text.match(urlRegex);

  if (!urls || urls.length === 0) {
    return;
  }

  // Take the first URL only
  const targetUrl = urls[0];
  logger.info(`Extracting link preview for: ${targetUrl}`);

  try {
    // Fetch the URL with a timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(targetUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; LinkPreviewBot/1.0)'
      }
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      logger.warn(`Failed to fetch URL: ${response.status}`);
      return;
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    // Extract Open Graph metadata
    const linkPreview = {
      url: targetUrl,
      title: $('meta[property="og:title"]').attr('content') ||
        $('meta[name="twitter:title"]').attr('content') ||
        $('title').text() ||
        targetUrl,
      description: $('meta[property="og:description"]').attr('content') ||
        $('meta[name="twitter:description"]').attr('content') ||
        $('meta[name="description"]').attr('content') ||
        '',
      image: $('meta[property="og:image"]').attr('content') ||
        $('meta[name="twitter:image"]').attr('content') ||
        '',
      siteName: $('meta[property="og:site_name"]').attr('content') ||
        new URL(targetUrl).hostname
    };

    // Only update if we got at least a title
    if (linkPreview.title) {
      await admin.firestore()
        .collection("chats")
        .doc(chatId)
        .collection("messages")
        .doc(messageId)
        .update({ linkPreview });

      logger.info(`Link preview saved for message ${messageId}`);
    }

  } catch (err) {
    if (err.name === 'AbortError') {
      logger.warn(`Timeout fetching URL: ${targetUrl}`);
    } else {
      logger.error(`Error extracting link preview:`, err);
    }
  }
});

// --- Function 3: sendPushNotification (UPGRADED for Groups) ---
exports.sendPushNotification = functions.firestore.onDocumentCreated("chats/{chatId}/messages/{messageId}", async (event) => {
  const message = event.data.data();
  const chatId = event.params.chatId;

  if (!message) {
    logger.info("No message data found.");
    return;
  }

  const projectId = process.env.GCLOUD_PROJECT;
  if (!projectId) {
    logger.error("GCLOUD_PROJECT env var not set.");
    return;
  }

  const senderId = message.sender;
  const senderName = message.senderName || "Someone";

  // 1. Get Chat Details
  const chatRef = admin.firestore().collection("chats").doc(chatId);
  const chatDoc = await chatRef.get();

  if (!chatDoc.exists) {
    logger.error(`Chat ${chatId} does not exist.`);
    return;
  }

  const chatData = chatDoc.data();
  const members = chatData.members || [];

  // 2. Filter recipients: Everyone in 'members' EXCEPT the sender
  const recipientIds = members.filter(uid => uid !== senderId);

  if (recipientIds.length === 0) {
    logger.info("No recipients found (chat might be empty or just self).");
    return;
  }

  // 3. Determine Notification Content based on Chat Type
  let title = "";
  let body = "";

  // Determine Body text based on message type
  let bodyContent = "";
  switch (message.type) {
    case 'image': bodyContent = "📷 Sent a photo"; break;
    case 'audio': bodyContent = "🎵 Sent a voice message"; break;
    case 'file': bodyContent = "📄 Sent a file"; break;
    default: bodyContent = message.text || "Sent a message";
  }

  if (chatData.type === 'group') {
    // Group Style: "Group Name" -> "Alex: Hello"
    title = chatData.groupName || "Group Chat";
    body = `${senderName}: ${bodyContent}`;
  } else {
    // Direct Style: "Alex" -> "Hello"
    title = senderName;
    body = bodyContent;
  }

  // 4. Fetch Tokens for ALL recipients in parallel
  const tokens = [];
  const tokenFetchPromises = recipientIds.map(async (uid) => {
    try {
      const userDoc = await admin.firestore().collection("users").doc(uid).get();
      if (userDoc.exists) {
        const userData = userDoc.data();
        if (userData.fcmTokens && Array.isArray(userData.fcmTokens)) {
          tokens.push(...userData.fcmTokens);
        }
      }
    } catch (e) {
      logger.error(`Error fetching user ${uid}:`, e);
    }
  });

  await Promise.all(tokenFetchPromises);

  if (tokens.length === 0) {
    logger.info("No valid FCM tokens found for any recipients.");
    return;
  }

  // 5. Get Access Token
  let accessToken;
  try {
    const tokenObj = await admin.credential.applicationDefault().getAccessToken();
    accessToken = tokenObj.access_token;
  } catch (err) {
    logger.error("Error getting access token:", err);
    return;
  }

  // 6. Send Notifications via FCM v1 API
  const FCM_V1_ENDPOINT = `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`;

  const sendPromises = tokens.map(token => {
    const payload = {
      message: {
        token: token,
        notification: {
          title: title,
          body: body,
        },
        data: {
          chatId: chatId,
          type: chatData.type || 'direct' // Useful for frontend click handling
        }
      }
    };

    return fetch(FCM_V1_ENDPOINT, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });
  });

  try {
    const responses = await Promise.all(sendPromises);

    // Check results
    let successCount = 0;
    let failCount = 0;

    for (const res of responses) {
      if (res.ok) successCount++;
      else failCount++;
    }

    logger.info(`Notifications sent: ${successCount} successful, ${failCount} failed.`);

  } catch (error) {
    logger.error("Error sending batch notifications:", error);
  }
});