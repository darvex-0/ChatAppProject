// Import the v2 functions framework
const functions = require("firebase-functions/v2");

// Import the 'classic' admin SDK
const admin = require("firebase-admin");

// Import the logger
const logger = require("firebase-functions/logger");

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

// --- Function 2: onMessageDeleted (Unchanged) ---
exports.onMessageDeleted = functions.firestore.onDocumentDeleted("chats/{chatId}/messages/{messageId}", (event) => {
  const deletedMessage = event.data.data();
  if (!deletedMessage.fileURL) {
    logger.info("Message was text-only, no file to delete.");
    return;
  }
  const fileUrl = deletedMessage.fileURL;
  try {
    const filePath = fileUrl.split("/o/")[1].split("?alt=media")[0];
    const decodedFilePath = decodeURIComponent(filePath);
    const bucket = admin.storage().bucket();
    logger.info(`Deleting file from Storage: ${decodedFilePath}`);
    return bucket.file(decodedFilePath).delete();
  } catch (err) {
    logger.error("Failed to parse file URL or delete file.", err);
    return;
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