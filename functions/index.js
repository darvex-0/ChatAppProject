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

// --- Function 5: onCallCreated (Background Wake-Up for Calls) ---
// Sends FCM data message to receiver when a call is initiated
// This wakes up the Service Worker even if the app is force-closed
exports.onCallCreated = functions.firestore.onDocumentCreated("calls/{callId}", async (event) => {
  const callData = event.data.data();
  const callId = event.params.callId;

  if (!callData || callData.status !== 'offering') {
    return;
  }

  const receiverId = callData.receiverId;
  const callerName = callData.callerName || 'Someone';
  const callerPhoto = callData.callerPhoto || '';
  const callType = callData.type || 'audio';

  logger.info(`Call created: ${callerName} -> ${receiverId} (${callType})`);

  // Get receiver's FCM tokens
  try {
    const receiverDoc = await admin.firestore().collection("users").doc(receiverId).get();
    if (!receiverDoc.exists) {
      logger.warn(`Receiver ${receiverId} not found`);
      return;
    }

    const receiverData = receiverDoc.data();
    const tokens = receiverData.fcmTokens || [];

    if (tokens.length === 0) {
      logger.info("No FCM tokens for receiver");
      return;
    }

    // Get access token for FCM v1 API
    const projectId = process.env.GCLOUD_PROJECT;
    if (!projectId) {
      logger.error("GCLOUD_PROJECT env var not set.");
      return;
    }

    const tokenObj = await admin.credential.applicationDefault().getAccessToken();
    const accessToken = tokenObj.access_token;
    const FCM_V1_ENDPOINT = `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`;

    // Send DATA-ONLY message (no 'notification' key!)
    // This ensures the Service Worker's onBackgroundMessage always fires
    const sendPromises = tokens.map(token => {
      const payload = {
        message: {
          token: token,
          data: {
            type: 'INCOMING_CALL',
            callId: callId,
            callerName: callerName,
            callerPhoto: callerPhoto,
            callType: callType
          },
          // Android: high priority to wake device
          android: {
            priority: 'high',
            ttl: '30s'
          },
          // Web: high urgency
          webpush: {
            headers: {
              Urgency: 'high',
              TTL: '30'
            }
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

    const responses = await Promise.all(sendPromises);
    let successCount = 0;
    for (const res of responses) {
      if (res.ok) successCount++;
    }
    logger.info(`Call FCM sent: ${successCount}/${tokens.length} successful`);

  } catch (error) {
    logger.error("Error sending call FCM:", error);
  }
});

// --- Function 7: generateSmartReplies (AI Smart Replies) ---
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { GoogleGenerativeAI, SchemaType } = require("@google/generative-ai");
const { defineSecret } = require("firebase-functions/params");

const geminiApiKey = defineSecret("GEMINI_API_KEY");

exports.generateSmartReplies = onCall(
  { secrets: [geminiApiKey], timeoutSeconds: 30, maxInstances: 10 },
  async (request) => {
    // 1. Auth check
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "User must be logged in.");
    }

    const { messageText, chatContext } = request.data;

    // 2. Input validation
    if (!messageText || typeof messageText !== "string" || messageText.trim().length === 0) {
      throw new HttpsError("invalid-argument", "messageText is required.");
    }

    // 3. Truncate to avoid excessive token usage
    const truncatedText = messageText.slice(0, 300);
    const truncatedContext = (chatContext || [])
      .slice(-3)
      .map(m => `${m.sender}: ${(m.text || "").slice(0, 100)}`)
      .join("\n");

    try {
      const genAI = new GoogleGenerativeAI(geminiApiKey.value());
      const model = genAI.getGenerativeModel({
        model: "gemini-2.5-flash-lite",
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0.8,
          maxOutputTokens: 256,
        },
        systemInstruction: `You are a chat reply suggestion assistant. Given a received message and optional conversation context, respond ONLY with a JSON object in this exact format: {"replies": ["reply1", "reply2", "reply3"]}. Rules: generate exactly 3 short reply suggestions (2-8 words each). Vary the tone: one agreeable, one asking a question, one casual. Never repeat the original message. Return ONLY the JSON object, nothing else.`,
      });

      let prompt = `Last received message: "${truncatedText}"`;
      if (truncatedContext) {
        prompt = `Recent conversation:\n${truncatedContext}\n\n${prompt}`;
      }

      const result = await model.generateContent(prompt);
      const responseText = result.response.text();
      logger.info("Gemini raw response:", responseText);

      // Robust JSON extraction
      let parsed;
      // Step 1: Strip markdown code blocks if Gemini added them
      let cleanText = responseText.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();

      try {
        parsed = JSON.parse(cleanText);
      } catch (parseErr) {
        // Step 2: Extract JSON object from within preamble text
        const jsonMatch = cleanText.match(/\{[\s\S]*"replies"\s*:\s*\[[\s\S]*\]\s*\}/);
        if (jsonMatch) {
          try {
            parsed = JSON.parse(jsonMatch[0]);
          } catch (e2) {
            logger.warn("Second parse failed:", jsonMatch[0]);
            return { replies: ["Sounds good!", "Tell me more", "Got it 👍"] };
          }
        } else {
          logger.warn("Could not extract JSON from response:", responseText);
          return { replies: ["Sounds good!", "Tell me more", "Got it 👍"] };
        }
      }

      // Validate shape
      if (!parsed.replies || !Array.isArray(parsed.replies) || parsed.replies.length < 3) {
        logger.warn("Unexpected Gemini response shape:", parsed);
        return { replies: ["Sounds good!", "Tell me more", "Got it 👍"] };
      }

      return { replies: parsed.replies.slice(0, 3) };

    } catch (error) {
      logger.error("Smart Replies Error:", error.message || error);
      if (error.response) {
        logger.error("Gemini Error Response:", JSON.stringify(error.response));
      }
      // Return sensible fallbacks instead of crashing
      return { replies: ["Sounds good!", "Tell me more", "Got it 👍"] };
    }
  }
);

// --- Function 6: checkScheduledMessages (Cron Job) ---
// Checks for pending scheduled messages every minute
const { onSchedule } = require("firebase-functions/v2/scheduler");

exports.checkScheduledMessages = onSchedule("every 1 minutes", async (event) => {
  const now = admin.firestore.Timestamp.now();
  const db = admin.firestore();

  // Query across all users' scheduled_messages subcollections
  const querySnapshot = await db.collectionGroup("scheduled_messages")
    .where("status", "==", "pending")
    .where("scheduledAt", "<=", now)
    .get();

  if (querySnapshot.empty) {
    // console.log("No pending scheduled messages.");
    return;
  }

  const promises = querySnapshot.docs.map(async (docSnapshot) => {
    const msgData = docSnapshot.data();
    const { chatId, text, sender, senderName, type } = msgData;

    try {
      // 1. Add to actual chat messages
      const newMessage = {
        text: text,
        sender: sender,
        senderName: senderName,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        type: type || 'text',
        status: 'sent',
        isScheduledWrapper: true // Flag to identify auto-sent messages if needed
      };

      await db.collection("chats").doc(chatId).collection("messages").add(newMessage);

      // 2. Update Chat Metadata (Last Message)
      await db.collection("chats").doc(chatId).update({
        lastMessage: text,
        lastUpdate: admin.firestore.FieldValue.serverTimestamp()
        // Note: uncementing unread counts might be complex without a specific target, 
        // but typically handled by client or separate trigger. 
        // For now, simpler is better.
      });

      // 3. Delete the scheduled message doc
      await docSnapshot.ref.delete();

      logger.info(`Processed scheduled message ${docSnapshot.id} for chat ${chatId}`);

    } catch (error) {
      logger.error(`Failed to process scheduled message ${docSnapshot.id}:`, error);
    }
  });

  await Promise.all(promises);
});