import { useEffect, useState, useRef, useCallback } from 'react';
import ReactDOM from 'react-dom';
import { useParams, useNavigate } from 'react-router-dom';
import { db, storage, cloudFunctions } from '../services/firebase';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, doc, updateDoc, getDoc, setDoc, deleteDoc, deleteField, increment, limitToLast, Timestamp, writeBatch } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, uploadBytesResumable } from 'firebase/storage';
import { httpsCallable } from 'firebase/functions';
import { fetchSmartReplies, fetchRephrase } from '../services/aiService';
import ChatModals from './chat/ChatModals';
import ChatHeader from './chat/ChatHeader';
import MessageList from './chat/MessageList';
import MessageInputArea from './chat/MessageInputArea';
import MentionSuggestions from './MentionSuggestions';
import { useAuth } from '../context/AuthContext';
import { useUI } from '../context/UIContext';
import { useCall } from '../context/CallContext';
import MessageItem from './MessageItem';
import SmartReplies from './SmartReplies';
import { Virtuoso } from 'react-virtuoso';
import imageCompression from 'browser-image-compression';
import EmojiPicker from 'emoji-picker-react';

export default function ChatWindow() {
    const { chatId } = useParams();
    const { currentUser } = useAuth();
    const { showAlert } = useUI();
    const { callUser } = useCall();
    const navigate = useNavigate();
    const [messages, setMessages] = useState([]);
    const [inputText, setInputText] = useState("");
    const [chatInfo, setChatInfo] = useState(null);
    const [showInfoModal, setShowInfoModal] = useState(false);
    const [typingUser, setTypingUser] = useState("");
    const [messageLimit, setMessageLimit] = useState(50);
    const [isLoadingMore, setIsLoadingMore] = useState(false);

    // Voice Preview State
    const [pendingAudio, setPendingAudio] = useState(null);
    const [voicePreviewUrl, setVoicePreviewUrl] = useState(null);

    // Voice Draft State (for chat switching)
    const [voiceDraft, setVoiceDraft] = useState(null); // { audioBlob, previewUrl, duration }

    // Virtuoso
    const virtuosoRef = useRef(null);

    // Reply State
    const [replyTo, setReplyTo] = useState(null);

    // Audio Recording State
    const [isRecording, setIsRecording] = useState(false);
    const isRecordingRef = useRef(false); // Ref for cleanup access
    const mediaRecorderRef = useRef(null);
    const audioChunksRef = useRef([]);
    const [recordingDuration, setRecordingDuration] = useState(0);
    const recordingDurationRef = useRef(0); // Ref for cleanup access

    // Delete Confirmation State
    const [deleteMsgId, setDeleteMsgId] = useState(null);

    // Edit Message State
    const [editMsg, setEditMsg] = useState(null);
    const [editText, setEditText] = useState("");

    // Forward Message State
    const [forwardMsg, setForwardMsg] = useState(null);

    // Starred Messages State
    const [starredIds, setStarredIds] = useState(new Set());

    // Pinned Messages State
    const [showPinnedBar, setShowPinnedBar] = useState(true);
    const [currentPinIndex, setCurrentPinIndex] = useState(0);
    const [pendingPinMsg, setPendingPinMsg] = useState(null); // Message awaiting duration selection
    const MAX_PINS = 5;

    // Wallpaper State
    const [wallpaper, setWallpaper] = useState(null);
    const [showWallpaperModal, setShowWallpaperModal] = useState(false);

    // Emoji Picker State
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const [emojiPickerPos, setEmojiPickerPos] = useState({ x: window.innerWidth / 2 - 150, y: window.innerHeight - 450 });
    const [isDraggingEmoji, setIsDraggingEmoji] = useState(false);
    const emojiDragOffset = useRef({ x: 0, y: 0 });

    // Network & Upload State
    const [isOnline, setIsOnline] = useState(navigator.onLine);
    const [uploadProgress, setUploadProgress] = useState(null); // {loaded: 5.5, total: 10}
    const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB
    const uploadTaskRef = useRef(null); // Track active upload for cancellation

    // Media Preview State
    const [previewFile, setPreviewFile] = useState(null);

    // Video Recorder State
    const [showVideoRecorder, setShowVideoRecorder] = useState(false);
    const [showMediaCamera, setShowMediaCamera] = useState(false);

    // Smart Replies State
    const [smartReplies, setSmartReplies] = useState([]);
    const [isLoadingReplies, setIsLoadingReplies] = useState(false);
    const smartReplyDebounceRef = useRef(null);
    const smartReplyRequestIdRef = useRef(0); // Stale response protection

    // AI Rephrase State
    const [isRephrasing, setIsRephrasing] = useState(false);

    // Poll State
    const [showPollCreator, setShowPollCreator] = useState(false);

    // Game Lobby State
    const [showGameLobby, setShowGameLobby] = useState(false);

    // Mention State
    const [mentionState, setMentionState] = useState(null); // { query: string } | null
    const [groupMembers, setGroupMembers] = useState([]); // [{ uid, name, photo }]
    const [mentionIndex, setMentionIndex] = useState(0); // For keyboard navigation
    const mentionMapRef = useRef({}); // Tracks { [handle]: uid } for profile lookup

    const typingTimeoutRef = useRef(null);
    const inputRef = useRef(null);
    const fileInputRef = useRef(null);

    // Handle starting a call
    const handleStartCall = async (type) => {
        if (!chatInfo?.uid) {
            showAlert("Cannot start call: User not found");
            return;
        }
        const result = await callUser(chatInfo.uid, type);
        if (!result.success) {
            showAlert(result.error || "Failed to start call");
        }
    };

    // Network Status Listener
    useEffect(() => {
        const handleOnline = () => setIsOnline(true);
        const handleOffline = () => setIsOnline(false);

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    // Reset state when changing chats
    useEffect(() => {
        setReplyTo(null);
        setEditMsg(null);
        setEditText("");
        setForwardMsg(null);
        setShowEmojiPicker(false);
        setInputText("");
        setDeleteMsgId(null);
        setChatInfo(null); // Clear chat info to prevent stale data
        setGroupMembers([]); // Clear group members to prevent stale game lobby data
        setSmartReplies([]); // Clear smart replies
        setIsLoadingReplies(false);
        if (smartReplyDebounceRef.current) clearTimeout(smartReplyDebounceRef.current);
        smartReplyRequestIdRef.current += 1; // Invalidate in-flight requests
        // ...
    }, [chatId]);

    // Fetch chat info
    useEffect(() => {
        if (!chatId) return;
        const fetchChatInfo = async () => {
            const chatDoc = await getDoc(doc(db, "chats", chatId));
            if (chatDoc.exists()) {
                const data = chatDoc.data();
                let name = "Chat";
                let photo = "";
                const isGroup = data.type === 'group' || !!data.groupName || (data.members && data.members.length > 2);
                let type = isGroup ? 'group' : (data.type || 'direct');
                let uid = null;

                if (type === 'group') {
                    name = data.groupName || "Group";
                    photo = data.groupImage;
                } else {
                    uid = data.members?.find(uid => uid !== currentUser.uid);
                    if (uid) {
                        const userDoc = await getDoc(doc(db, "users", uid));
                        if (userDoc.exists()) {
                            const userData = userDoc.data();
                            name = userData.name || userData.displayName || userData.username || userData.email?.split('@')[0] || "User";
                            photo = userData.photoURL || userData.profilePic || null;
                        }
                    }
                }
                setChatInfo({ id: chatId, name, photo, type, uid, members: data.members });
            }
        };
        fetchChatInfo();

        // Reset my unread count
        const resetUnread = async () => {
            await updateDoc(doc(db, "chats", chatId), {
                [`unreadCounts.${currentUser.uid}`]: 0
            });
        };
        resetUnread();
    }, [chatId, currentUser]);

    // Load Wallpaper Preference
    useEffect(() => {
        if (!chatId || !currentUser) return;
        const loadWallpaper = async () => {
            try {
                const docRef = doc(db, "users", currentUser.uid, "chatSettings", chatId);
                const docSnap = await getDoc(docRef);
                if (docSnap.exists() && docSnap.data().wallpaper) {
                    setWallpaper(docSnap.data().wallpaper);
                } else {
                    setWallpaper(null);
                }
            } catch (error) {
                console.error("Error loading wallpaper:", error);
            }
        };
        loadWallpaper();
    }, [chatId, currentUser]);

    const handleUpdateWallpaper = async (newWallpaper) => {
        if (!chatId || !currentUser) return;
        setWallpaper(newWallpaper);
        try {
            const docRef = doc(db, "users", currentUser.uid, "chatSettings", chatId);
            await setDoc(docRef, { wallpaper: newWallpaper }, { merge: true });
        } catch (error) {
            console.error("Error saving wallpaper:", error);
            showAlert("Failed to save wallpaper");
        }
    };

    // Emoji Selection
    const onEmojiClick = (emojiObject) => {
        setInputText(prev => prev + emojiObject.emoji);
        // Don't close picker to allow multiple emojis
    };

    // Refs for Sound Logic
    const notificationSound = useRef(new Audio('https://upload.wikimedia.org/wikipedia/commons/3/34/Sound_Effect_-_Pop_01.ogg'));
    const lastMessageIdRef = useRef(null);
    const isInitialLoad = useRef(true);
    const previousChatIdRef = useRef(chatId);

    // Load voice draft for this chat from localStorage (with 24-hour expiration)
    useEffect(() => {
        // Small delay to ensure chat reset is complete
        const timer = setTimeout(() => {
            const loadVoiceDraft = () => {
                try {
                    const draftsJson = localStorage.getItem('voiceDrafts');
                    if (draftsJson) {
                        const drafts = JSON.parse(draftsJson);
                        let updated = false;
                        const now = Date.now();
                        const EXPIRATION_MS = 24 * 60 * 60 * 1000; // 24 hours

                        // Clean up expired drafts
                        Object.keys(drafts).forEach(key => {
                            if (drafts[key].timestamp && (now - drafts[key].timestamp) > EXPIRATION_MS) {
                                delete drafts[key];
                                updated = true;
                            }
                        });

                        // Save cleaned drafts if any were removed
                        if (updated) {
                            localStorage.setItem('voiceDrafts', JSON.stringify(drafts));
                        }

                        const draft = drafts[chatId];
                        if (draft) {
                            // Reconstruct blob from base64
                            fetch(draft.dataUrl)
                                .then(res => res.blob())
                                .then(blob => {
                                    setVoiceDraft({
                                        audioBlob: blob,
                                        previewUrl: draft.dataUrl,
                                        duration: draft.duration
                                    });
                                });
                        } else {
                            setVoiceDraft(null);
                        }
                    } else {
                        setVoiceDraft(null);
                    }
                } catch (e) {
                    console.error('Error loading voice draft:', e);
                }
            };
            loadVoiceDraft();
        }, 100);

        return () => clearTimeout(timer);
    }, [chatId]);

    // Reset pagination and refs when chat changes
    useEffect(() => {
        setMessages([]); // Clear old messages to prevent sound race condition
        setMessageLimit(50);
        setIsLoadingMore(false);
        isInitialLoad.current = true;
        lastMessageIdRef.current = null;
        hasScrolledToBottom.current = false; // Reset scroll flag

        // CRITICAL: Save recording as draft when switching chats
        if (isRecordingRef.current && mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
            // Capture values BEFORE any async operations
            const saveToChatId = previousChatIdRef.current;
            const duration = recordingDurationRef.current;
            const recorder = mediaRecorderRef.current;

            // Override onstop to save draft with final audio data
            recorder.onstop = () => {
                if (audioChunksRef.current.length > 0) {
                    const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                    const reader = new FileReader();

                    reader.onloadend = () => {
                        try {
                            const draftsJson = localStorage.getItem('voiceDrafts') || '{}';
                            const drafts = JSON.parse(draftsJson);
                            drafts[saveToChatId] = {
                                dataUrl: reader.result,
                                duration: duration,
                                timestamp: Date.now()
                            };
                            localStorage.setItem('voiceDrafts', JSON.stringify(drafts));
                        } catch (e) {
                            console.error('Error saving voice draft:', e);
                        }
                    };
                    reader.readAsDataURL(audioBlob);
                }
                // Stop all audio tracks
                recorder.stream?.getTracks().forEach(track => track.stop());
            };

            // Stop recording - this will trigger onstop after data is flushed
            try {
                recorder.stop();
            } catch (e) {
                console.error('Error stopping recorder:', e);
            }

            // Reset recording state immediately
            setIsRecording(false);
            isRecordingRef.current = false;
            setRecordingDuration(0);
            recordingDurationRef.current = 0;
            isCancelledRef.current = true;
        }

        // Update previous chat ID for next switch
        previousChatIdRef.current = chatId;
    }, [chatId]);

    // hasScrolledToBottom ref for future use
    const hasScrolledToBottom = useRef(false);

    // Hide chat until positioned at bottom (prevents visible scroll)
    const [isMessagesReady, setIsMessagesReady] = useState(false);
    useEffect(() => {
        // Reset ready state when chat changes
        setIsMessagesReady(false);
        // Small delay to let Virtuoso position itself, then show
        const timer = setTimeout(() => {
            if (messages.length > 0) {
                setIsMessagesReady(true);
            }
        }, 50);
        return () => clearTimeout(timer);
    }, [chatId]);

    // Also show when messages first load
    useEffect(() => {
        if (messages.length > 0 && !isMessagesReady) {
            const timer = setTimeout(() => setIsMessagesReady(true), 50);
            return () => clearTimeout(timer);
        }
    }, [messages.length, isMessagesReady]);

    // Messages listener
    useEffect(() => {
        if (!chatId) return;
        const q = query(
            collection(db, "chats", chatId, "messages"),
            orderBy("timestamp", "asc"),
            limitToLast(messageLimit)
        );
        const unsubscribe = onSnapshot(q, (snapshot) => {
            setMessages(snapshot.docs.map(doc => {
                const data = doc.data();
                return {
                    id: doc.id,
                    ...data,
                    // Fix for "..." timestamp on immediate send: use current time if serverTimestamp is pending
                    timestamp: data.timestamp || Timestamp.now()
                };
            }));
        });
        return () => unsubscribe();
    }, [chatId, messageLimit]);

    // Typing Indicator Listener (with 30s timeout validation)
    useEffect(() => {
        if (!chatId || !currentUser) return;

        const typingRef = collection(db, "chats", chatId, "typing");
        const unsubscribe = onSnapshot(typingRef, (snapshot) => {
            const now = Date.now();
            const THIRTY_SECONDS = 30 * 1000;

            const typingNames = [];
            snapshot.docs.forEach(docSnap => {
                const data = docSnap.data();
                // Skip self
                if (docSnap.id === currentUser.uid) return;
                // Skip if not typing
                if (!data.typing) return;
                // Skip if stale (> 30 seconds old)
                if (data.timestamp?.toMillis && (now - data.timestamp.toMillis()) > THIRTY_SECONDS) return;

                typingNames.push(data.name || "Someone");
            });

            if (typingNames.length > 0) {
                setTypingUser(`${typingNames.join(", ")} is typing...`);
            } else {
                setTypingUser("");
            }
        });

        return () => unsubscribe();
    }, [chatId, currentUser]);

    // Play sound on new message
    useEffect(() => {
        if (messages.length > 0) {
            const lastMsg = messages[messages.length - 1];

            // 1. Initial Load: Just sync state, don't play sound
            if (isInitialLoad.current) {
                isInitialLoad.current = false;
                lastMessageIdRef.current = lastMsg.id;
                return;
            }

            // 2. New Message appended at the bottom
            if (lastMsg.id !== lastMessageIdRef.current) {
                // Only play if I didn't send it
                if (lastMsg.sender !== currentUser.uid) {
                    notificationSound.current.play().catch(e => console.log("Audio play blocked", e));
                }
                lastMessageIdRef.current = lastMsg.id;
            }
        }
    }, [messages, currentUser.uid]);

    // --- Smart Replies Logic (Local Ollama AI) ---
    useEffect(() => {
        if (!messages.length || !currentUser) return;

        const lastMsg = messages[messages.length - 1];

        // Only show suggestions for incoming text messages when input is empty
        if (
            lastMsg.sender === currentUser.uid ||
            lastMsg.type !== 'text' ||
            !lastMsg.text ||
            lastMsg.type === 'system' ||
            lastMsg.type === 'call_event' ||
            inputText.trim().length > 0
        ) {
            setSmartReplies([]);
            setIsLoadingReplies(false);
            return;
        }

        // Debounce: 1500ms to handle message barrages
        if (smartReplyDebounceRef.current) clearTimeout(smartReplyDebounceRef.current);

        smartReplyRequestIdRef.current += 1;
        const thisRequestId = smartReplyRequestIdRef.current;

        setIsLoadingReplies(true);
        setSmartReplies([]);

        smartReplyDebounceRef.current = setTimeout(async () => {
            try {
                const chatContext = messages
                    .filter(m => m.type === 'text' && m.text)
                    .slice(-4, -1)
                    .map(m => ({
                        sender: m.sender === currentUser.uid ? 'You' : (m.senderName || 'User'),
                        text: m.text
                    }));

                const replies = await fetchSmartReplies(lastMsg.text, chatContext);

                if (thisRequestId !== smartReplyRequestIdRef.current) return;

                if (replies && Array.isArray(replies)) {
                    setSmartReplies(replies);
                }
            } catch (error) {
                console.error('Smart Replies Error:', error);
            } finally {
                if (thisRequestId === smartReplyRequestIdRef.current) {
                    setIsLoadingReplies(false);
                }
            }
        }, 1500);

        return () => {
            if (smartReplyDebounceRef.current) clearTimeout(smartReplyDebounceRef.current);
        };
    }, [messages, currentUser, inputText]);

    // Handle smart reply chip click
    const handleSmartReplyClick = async (replyText) => {
        setSmartReplies([]);
        setIsLoadingReplies(false);

        try {
            const msgData = {
                text: replyText,
                sender: currentUser.uid,
                senderName: currentUser.displayName || "User",
                timestamp: serverTimestamp(),
                type: "text",
                status: "sent"
            };
            if (replyTo) {
                msgData.replyTo = replyTo;
                setReplyTo(null);
            }
            await addDoc(collection(db, "chats", chatId, "messages"), msgData);

            const updates = { lastMessage: replyText, lastUpdate: serverTimestamp() };
            if (chatInfo?.members) {
                chatInfo.members.forEach(memberId => {
                    if (memberId !== currentUser.uid) {
                        updates[`unreadCounts.${memberId}`] = increment(1);
                    }
                });
            }
            await updateDoc(doc(db, "chats", chatId), updates);
        } catch (err) {
            console.error('Smart Reply send error:', err);
        }
    };

    // Load More Function
    const loadMoreMessages = useCallback(() => {
        // Only load if we have enough messages to suspect there are more
        if (messages.length >= messageLimit && !isLoadingMore) {
            setIsLoadingMore(true);
            // Artificial delay to show spinner if needed, and to prevent spamming
            setTimeout(() => {
                setMessageLimit(prev => prev + 50);
                setIsLoadingMore(false);
            }, 500);
        }
    }, [messages.length, messageLimit, isLoadingMore]);

    // Read Receipt Logic: Mark messages as 'seen' when I view the chat
    useEffect(() => {
        if (!chatId || messages.length === 0) return;

        const markAsSeen = async () => {
            // Only mark messages that are NOT from me and are NOT already 'seen'
            const unreadMessages = messages.filter(
                msg => msg.sender !== currentUser.uid && msg.status !== 'seen'
            );

            if (unreadMessages.length === 0) return;

            // Batch update implementation for speed and atomicity
            const batch = writeBatch(db);

            unreadMessages.forEach(msg => {
                const msgRef = doc(db, "chats", chatId, "messages", msg.id);
                batch.update(msgRef, { status: 'seen' });
            });

            // Also reset unread count
            const chatRef = doc(db, "chats", chatId);
            batch.update(chatRef, { [`unreadCounts.${currentUser.uid}`]: 0 });

            try {
                await batch.commit();
            } catch (e) {
                console.error("Error batch marking seen:", e);
            }
        };

        markAsSeen();
    }, [chatId, messages, currentUser.uid]);

    // Recording Timer State (recordingDuration already declared above with ref)
    const recordingIntervalRef = useRef(null);
    const isCancelledRef = useRef(null);

    // Swipe to Cancel State
    const [dragOffset, setDragOffset] = useState(0);
    const isDraggingRef = useRef(false);
    const startXRef = useRef(0);

    // Timer Logic
    useEffect(() => {
        if (isRecording) {
            setRecordingDuration(0);
            isCancelledRef.current = false; // Reset cancel flag
            recordingIntervalRef.current = setInterval(() => {
                setRecordingDuration(prev => prev + 1);
            }, 1000);
        } else {
            if (recordingIntervalRef.current) clearInterval(recordingIntervalRef.current);
            setRecordingDuration(0);
            setDragOffset(0); // Reset drag offset
        }
        return () => {
            if (recordingIntervalRef.current) clearInterval(recordingIntervalRef.current);
        };
    }, [isRecording]);

    const formatDuration = (sec) => {
        const m = Math.floor(sec / 60);
        const s = sec % 60;
        return `${m}:${s.toString().padStart(2, '0')}`;
    };

    // Drag handlers for swipe-to-cancel
    const handleDragStart = (e) => {
        isDraggingRef.current = true;
        startXRef.current = e.clientX || e.touches?.[0]?.clientX || 0;
    };

    const handleDragMove = (e) => {
        if (!isDraggingRef.current) return;
        const currentX = e.clientX || e.touches?.[0]?.clientX || 0;
        const deltaX = currentX - startXRef.current;

        // Only allow left drag (negative deltaX)
        if (deltaX < 0) {
            setDragOffset(deltaX);

            // Cancel if dragged more than 150px to the left
            if (deltaX < -150) {
                handleDragEnd();
                cancelRecording();
            }
        }
    };

    const handleDragEnd = () => {
        isDraggingRef.current = false;
        setDragOffset(0);
    };

    // Add global mouse/touch listeners for drag
    useEffect(() => {
        if (isRecording) {
            const handleMove = (e) => handleDragMove(e);
            const handleEnd = () => handleDragEnd();

            document.addEventListener('mousemove', handleMove);
            document.addEventListener('mouseup', handleEnd);
            document.addEventListener('touchmove', handleMove);
            document.addEventListener('touchend', handleEnd);

            return () => {
                document.removeEventListener('mousemove', handleMove);
                document.removeEventListener('mouseup', handleEnd);
                document.removeEventListener('touchmove', handleMove);
                document.removeEventListener('touchend', handleEnd);
            };
        }
    }, [isRecording]);

    // --- Voice Recording Logic ---
    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorderRef.current = new MediaRecorder(stream);
            audioChunksRef.current = [];

            mediaRecorderRef.current.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    audioChunksRef.current.push(event.data);
                }
            };

            mediaRecorderRef.current.onstop = async () => {
                // Only show preview if not explicitly cancelled
                if (!isCancelledRef.current) {
                    const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                    setPendingAudio(audioBlob);
                    setVoicePreviewUrl(URL.createObjectURL(audioBlob));
                }
                stream.getTracks().forEach(track => track.stop()); // Stop mic
            };

            mediaRecorderRef.current.start();
            setIsRecording(true);
            isRecordingRef.current = true; // Sync ref
        } catch (err) {
            console.error("Mic Error:", err);
            showAlert("Could not access microphone.");
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            isCancelledRef.current = false; // Normal stop, not cancelled
            mediaRecorderRef.current.stop();
            setIsRecording(false);
            isRecordingRef.current = false; // Sync ref
        }
    };

    const cancelRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            isCancelledRef.current = true; // Mark as cancelled
            mediaRecorderRef.current.stop();
            setIsRecording(false);
            isRecordingRef.current = false; // Sync ref
            setRecordingDuration(0);
            recordingDurationRef.current = 0; // Sync ref
        }
        setIsRecording(false);
        isRecordingRef.current = false;
    };

    const sendVoiceMessage = async (audioBlob) => {
        try {
            const fileName = `voice_${Date.now()}.webm`;
            const fileRef = ref(storage, `audio/${chatId}/${fileName}`);
            await uploadBytes(fileRef, audioBlob);
            const downloadURL = await getDownloadURL(fileRef);

            const msgData = {
                sender: currentUser.uid,
                senderName: currentUser.displayName || "User",
                timestamp: serverTimestamp(),
                type: 'audio',
                fileURL: downloadURL,
                fileName,
                status: 'sent'
            };
            await addDoc(collection(db, "chats", chatId, "messages"), msgData);

            const updates = { lastMessage: "🎤 Voice Message", lastUpdate: serverTimestamp() };
            if (chatInfo?.members) {
                chatInfo.members.forEach(memberId => {
                    if (memberId !== currentUser.uid) {
                        updates[`unreadCounts.${memberId}`] = increment(1);
                    }
                });
            }
            await updateDoc(doc(db, "chats", chatId), updates);
        } catch (e) {
            console.error("Error sending voice:", e);
            showAlert("Failed to send voice message");
        }
    };

    const sendVideoMessage = async ({ videoURL, thumbnailURL, duration }) => {
        try {
            const msgData = {
                sender: currentUser.uid,
                senderName: currentUser.displayName || "User",
                timestamp: serverTimestamp(),
                type: 'video_note',
                videoURL,
                thumbnailURL,
                duration,
                status: 'sent'
            };
            await addDoc(collection(db, "chats", chatId, "messages"), msgData);

            const updates = { lastMessage: "📹 Video Message", lastUpdate: serverTimestamp() };
            if (chatInfo?.members) {
                chatInfo.members.forEach(memberId => {
                    if (memberId !== currentUser.uid) {
                        updates[`unreadCounts.${memberId}`] = increment(1);
                    }
                });
            }
            await updateDoc(doc(db, "chats", chatId), updates);
        } catch (e) {
            console.error("Error sending video:", e);
            showAlert("Failed to send video message");
        }
    };

    // Camera Capture Handler -> Opens Preview Modal
    const handleCameraCapture = (file) => {
        setShowMediaCamera(false);
        setPreviewFile(file);
    };

    // Fetch group members for @mentions
    useEffect(() => {
        if (!chatInfo || chatInfo.type !== 'group' || !chatInfo.members) return;

        const fetchMembers = async () => {
            try {
                const memberIds = chatInfo.members.filter(uid => uid !== currentUser.uid);
                const promises = memberIds.map(uid =>
                    getDoc(doc(db, 'users', uid)).then(snap => snap.exists() ? { uid, name: snap.data().name || snap.data().displayName || snap.data().username || snap.data().email?.split('@')[0] || 'User', photo: snap.data().photoURL || snap.data().profilePic || null } : null)
                );
                const members = (await Promise.all(promises)).filter(Boolean);
                setGroupMembers(members);
            } catch (e) {
                console.error('Error fetching group members for mentions:', e);
            }
        };
        fetchMembers();
    }, [chatInfo, currentUser.uid]);

    // Insert @mention into input
    const insertMention = (member) => {
        const cursorPos = inputRef.current?.selectionStart ?? inputText.length;
        const textUpToCursor = inputText.slice(0, cursorPos);
        const textAfterCursor = inputText.slice(cursorPos);

        const mentionName = member.isAI ? 'AI' : member.name.replace(/\s+/g, '');
        // Replace the @query with @Name
        const newText = textUpToCursor.replace(/@([a-zA-Z0-9_ ]*)$/, `@${mentionName} `) + textAfterCursor;
        setInputText(newText);
        setMentionState(null);
        setMentionIndex(0);

        // Track handle → uid so we can look up the profile later
        if (!member.isAI && member.uid) {
            mentionMapRef.current = { ...mentionMapRef.current, [mentionName]: member.uid };
        }

        // Restore focus
        setTimeout(() => inputRef.current?.focus(), 10);
    };

    // Send Poll
    const sendPoll = async (pollData) => {
        try {
            const msgData = {
                sender: currentUser.uid,
                senderName: currentUser.displayName || 'User',
                timestamp: serverTimestamp(),
                type: 'poll',
                status: 'sent',
                pollData
            };
            await addDoc(collection(db, 'chats', chatId, 'messages'), msgData);
            const updates = { lastMessage: '📊 Poll: ' + pollData.question, lastUpdate: serverTimestamp() };
            if (chatInfo?.members) {
                chatInfo.members.forEach(memberId => {
                    if (memberId !== currentUser.uid) updates[`unreadCounts.${memberId}`] = increment(1);
                });
            }
            await updateDoc(doc(db, 'chats', chatId), updates);
        } catch (e) {
            console.error('Error sending poll:', e);
            showAlert('Failed to send poll.');
        }
    };

    // --- Other Actions ---
    const handleInputChange = (e) => {
        const value = e.target.value;
        setInputText(value);

        // --- @Mention Detection ---
        if (chatInfo?.type === 'group' || chatInfo?.type === 'direct') {
            const cursorPos = e.target.selectionStart;
            const textUpToCursor = value.slice(0, cursorPos);
            const atMatch = textUpToCursor.match(/@([a-zA-Z0-9_ ]*)$/);
            if (atMatch) {
                setMentionState({ query: atMatch[1] });
                setMentionIndex(0); // Reset index on new search
            } else {
                setMentionState(null);
            }
        }

        if (chatId) {
            // Debounce typing indicator writes to reduce Firestore costs
            if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

            // Only write "typing: true" once, then wait before writing again
            if (e.target.value.length > 0) {
                // Set typing true (debounced - only writes after 300ms of typing)
                typingTimeoutRef.current = setTimeout(() => {
                    setDoc(doc(db, "chats", chatId, "typing", currentUser.uid), {
                        typing: true,
                        name: currentUser.displayName || 'Someone',
                        timestamp: serverTimestamp()
                    }, { merge: true });

                    // Schedule stop-typing after 2 seconds of inactivity
                    typingTimeoutRef.current = setTimeout(() => {
                        setDoc(doc(db, "chats", chatId, "typing", currentUser.uid), {
                            typing: false,
                            name: currentUser.displayName || 'Someone',
                            timestamp: serverTimestamp()
                        }, { merge: true });
                    }, 2000);
                }, 300);
            } else {
                // Immediately mark as not typing when input is cleared
                setDoc(doc(db, "chats", chatId, "typing", currentUser.uid), {
                    typing: false,
                    name: currentUser.displayName || 'Someone',
                    timestamp: serverTimestamp()
                }, { merge: true });
            }
        }
    };

    // Voice Preview Handlers
    const confirmSendVoice = () => {
        if (pendingAudio) {
            sendVoiceMessage(pendingAudio);
        }
        setPendingAudio(null);
        setVoicePreviewUrl(null);
    };

    const cancelVoicePreview = () => {
        setPendingAudio(null);
        if (voicePreviewUrl) {
            URL.revokeObjectURL(voicePreviewUrl);
        }
        setVoicePreviewUrl(null);
    };

    // Voice Draft Handlers
    const deleteVoiceDraft = () => {
        try {
            const draftsJson = localStorage.getItem('voiceDrafts') || '{}';
            const drafts = JSON.parse(draftsJson);
            delete drafts[chatId];
            localStorage.setItem('voiceDrafts', JSON.stringify(drafts));

            if (voiceDraft?.previewUrl) {
                URL.revokeObjectURL(voiceDraft.previewUrl);
            }
            setVoiceDraft(null);
        } catch (e) {
            console.error('Error deleting voice draft:', e);
        }
    };

    const sendVoiceDraft = () => {
        if (voiceDraft?.audioBlob) {
            sendVoiceMessage(voiceDraft.audioBlob);
            deleteVoiceDraft();
        }
    };

    const initiateReply = useCallback((msg) => {
        setReplyTo({ id: msg.id, text: msg.text || (msg.type === 'image' ? 'Image' : msg.type === 'video' ? 'Video' : 'Voice Message'), senderName: msg.senderName });
        inputRef.current?.focus();
    }, []);

    const cancelReply = () => {
        setReplyTo(null);
    };

    const addReaction = useCallback(async (msgId, emoji) => {
        try {
            const msgRef = doc(db, "chats", chatId, "messages", msgId);

            // Find the message to check existing reaction
            const msg = messages.find(m => m.id === msgId);
            const currentReaction = msg?.reactions?.[currentUser.uid];

            // Toggle: if same emoji clicked again, remove reaction; otherwise set new reaction
            if (currentReaction === emoji) {
                await updateDoc(msgRef, { [`reactions.${currentUser.uid}`]: deleteField() });
            } else {
                await updateDoc(msgRef, { [`reactions.${currentUser.uid}`]: emoji });
            }
        } catch (e) {
            console.error(e);
        }
    }, [chatId, messages, currentUser.uid]);

    // Trigger Delete Confirmation
    const confirmDelete = useCallback((msgId) => {
        setDeleteMsgId(msgId);
    }, []);

    // Perform Actual Delete
    const performDelete = async () => {
        if (!deleteMsgId) return;
        try {
            await deleteDoc(doc(db, "chats", chatId, "messages", deleteMsgId));
            setDeleteMsgId(null);
        } catch (e) {
            console.error(e);
            showAlert("Failed to delete message");
        }
    };

    // Initiate Edit
    const initiateEdit = useCallback((msg) => {
        if (msg.type !== 'text') {
            showAlert("Only text messages can be edited");
            return;
        }
        setEditMsg(msg);
        setEditText(msg.text || "");
    }, [showAlert]);

    // Perform Actual Edit
    const performEdit = async () => {
        if (!editMsg || !editText.trim()) return;
        try {
            await updateDoc(doc(db, "chats", chatId, "messages", editMsg.id), {
                text: editText.trim(),
                edited: true,
                editedAt: serverTimestamp()
            });
            setEditMsg(null);
            setEditText("");
        } catch (e) {
            console.error(e);
            showAlert("Failed to edit message");
        }
    };

    const cancelEdit = () => {
        setEditMsg(null);
        setEditText("");
    };

    // Pin/Unpin Message
    const pinMessage = async (msgId, shouldPin, durationMs = null) => {
        // If pinning without duration, show the duration picker modal
        if (shouldPin && durationMs === null) {
            // Check pin limit first
            const currentPins = messages.filter(m => m.isPinned && (!m.pinExpiresAt || (m.pinExpiresAt.toMillis ? m.pinExpiresAt.toMillis() : new Date(m.pinExpiresAt).getTime()) > Date.now()));
            if (currentPins.length >= MAX_PINS) {
                showAlert(`Maximum ${MAX_PINS} messages can be pinned`);
                return;
            }
            setPendingPinMsg(msgId);
            return;
        }

        // Calculate expiry time
        let pinExpiresAt = null;
        if (shouldPin && durationMs && durationMs !== 'forever') {
            pinExpiresAt = new Date(Date.now() + durationMs);
        }

        // Optimistic update - update local state immediately
        setMessages(prev => prev.map(m =>
            m.id === msgId
                ? { ...m, isPinned: shouldPin, pinnedBy: shouldPin ? currentUser.uid : null, pinExpiresAt: pinExpiresAt }
                : m
        ));

        try {
            const msgRef = doc(db, "chats", chatId, "messages", msgId);
            if (shouldPin) {
                await updateDoc(msgRef, {
                    isPinned: true,
                    pinnedAt: serverTimestamp(),
                    pinnedBy: currentUser.uid,
                    pinExpiresAt: pinExpiresAt
                });
            } else {
                await updateDoc(msgRef, {
                    isPinned: false,
                    pinnedAt: null,
                    pinnedBy: null,
                    pinExpiresAt: null
                });
            }
        } catch (e) {
            console.error(e);
            // Revert optimistic update on error
            setMessages(prev => prev.map(m =>
                m.id === msgId
                    ? { ...m, isPinned: !shouldPin, pinnedBy: !shouldPin ? currentUser.uid : null }
                    : m
            ));
            showAlert("Failed to pin message");
        }
    };

    // Initiate pin with duration picker
    const initiatePinWithDuration = (msgId) => {
        const currentPins = messages.filter(m => m.isPinned && (!m.pinExpiresAt || (m.pinExpiresAt.toMillis ? m.pinExpiresAt.toMillis() : new Date(m.pinExpiresAt).getTime()) > Date.now()));
        if (currentPins.length >= MAX_PINS) {
            showAlert(`Maximum ${MAX_PINS} messages can be pinned`);
            return;
        }
        setPendingPinMsg(msgId);
    };

    // Star/Unstar Message
    const starMessage = async (msgId, shouldStar) => {
        try {
            const userStarRef = doc(db, "users", currentUser.uid, "starredMessages", msgId);
            if (shouldStar) {
                // Get message data to store in user's subcollection
                const msg = messages.find(m => m.id === msgId);
                if (!msg) return;

                const starData = {
                    messageId: msg.id,
                    chatId: chatId,
                    chatName: chatInfo?.name || "Chat",
                    text: msg.text || (msg.type === 'image' ? 'Image' : 'File'),
                    senderName: msg.senderName,
                    starredAt: serverTimestamp(),
                    timestamp: msg.timestamp // Original timestamp
                };
                await setDoc(userStarRef, starData);
            } else {
                await deleteDoc(userStarRef);
            }
        } catch (e) {
            console.error("Error starring message:", e);
            showAlert("Failed to update star status");
        }
    };

    // Listen to User's Starred Messages
    useEffect(() => {
        if (!currentUser) return;
        const q = query(collection(db, "users", currentUser.uid, "starredMessages"));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const ids = new Set(snapshot.docs.map(doc => doc.id));
            setStarredIds(ids);
        });
        return () => unsubscribe();
    }, [currentUser]);


    // Initiate Forward
    const initiateForward = useCallback((msg) => {
        setForwardMsg(msg);
    }, []);

    // Track forward count for multi-forward
    const forwardCountRef = useRef(0);

    // Perform Forward to target chat
    const performForward = async (targetChatId, targetChatName) => {
        if (!forwardMsg || !targetChatId) return;

        forwardCountRef.current += 1;
        const currentForwardCount = forwardCountRef.current;

        try {
            // Prepare forwarded message data
            const forwardedMsgData = {
                sender: currentUser.uid,
                senderName: currentUser.displayName || "User",
                timestamp: serverTimestamp(),
                type: forwardMsg.type,
                isForwarded: true,
                forwardCount: (forwardMsg.forwardCount || 0) + 1,
                originalSender: forwardMsg.originalSender || forwardMsg.senderName,
                originalSenderId: forwardMsg.originalSenderId || forwardMsg.sender,
                status: 'sent'
            };

            // Copy content based on type
            if (forwardMsg.type === 'text') {
                forwardedMsgData.text = forwardMsg.text;
            } else if (forwardMsg.type === 'image' || forwardMsg.type === 'audio' || forwardMsg.type === 'file') {
                forwardedMsgData.fileURL = forwardMsg.fileURL;
                forwardedMsgData.fileName = forwardMsg.fileName;
            }

            // Add message to target chat
            await addDoc(collection(db, "chats", targetChatId, "messages"), forwardedMsgData);

            // Update target chat metadata
            const lastMsgPreview = forwardMsg.type === 'text'
                ? forwardMsg.text?.slice(0, 30) + '...'
                : forwardMsg.type === 'image' ? '🖼️ Image'
                    : forwardMsg.type === 'audio' ? '🎤 Voice'
                        : '📎 File';

            const targetChatRef = doc(db, "chats", targetChatId);
            const targetChatDoc = await getDoc(targetChatRef);
            if (targetChatDoc.exists()) {
                const updates = {
                    lastMessage: `↪ ${lastMsgPreview}`,
                    lastUpdate: serverTimestamp()
                };
                const targetMembers = targetChatDoc.data().members || [];
                targetMembers.forEach(memberId => {
                    if (memberId !== currentUser.uid) {
                        updates[`unreadCounts.${memberId}`] = increment(1);
                    }
                });
                await updateDoc(targetChatRef, updates);
            }

            // Show alert after small delay to allow multiple forwards to batch
            setTimeout(() => {
                if (forwardCountRef.current === currentForwardCount) {
                    setForwardMsg(null);
                    const count = forwardCountRef.current;
                    forwardCountRef.current = 0;
                    showAlert(count > 1 ? `Message forwarded to ${count} chats` : `Message forwarded to ${targetChatName}`);
                }
            }, 100);
        } catch (e) {
            console.error("Error forwarding message:", e);
            showAlert("Failed to forward message");
        }
    };

    const sendMessage = async (e) => {
        e.preventDefault();
        if (!inputText.trim()) return;

        const text = inputText;
        const isAIMention = text.toLowerCase().includes('@ai');

        setInputText("");
        setDoc(doc(db, "chats", chatId, "typing", currentUser.uid), { typing: false }, { merge: true });

        try {
            const msgData = {
                text: text,
                sender: currentUser.uid,
                senderName: currentUser.displayName || "User",
                timestamp: serverTimestamp(),
                type: "text",
                status: "sent"
            };
            // Save handle → uid map so the receiver can look up profiles
            if (Object.keys(mentionMapRef.current).length > 0) {
                msgData.mentionMap = { ...mentionMapRef.current };
                mentionMapRef.current = {}; // Reset after sending
            }
            if (replyTo) {
                msgData.replyTo = replyTo;
                setReplyTo(null);
            }
            const sentMsgRef = await addDoc(collection(db, "chats", chatId, "messages"), msgData);

            // Update last message & Increment unread counts
            const updates = { lastMessage: text, lastUpdate: serverTimestamp() };
            if (chatInfo?.members) {
                chatInfo.members.forEach(memberId => {
                    if (memberId !== currentUser.uid) {
                        updates[`unreadCounts.${memberId}`] = increment(1);
                    }
                });
            }
            await updateDoc(doc(db, "chats", chatId), updates);

            // Trigger AI if @AI was mentioned
            if (isAIMention) {
                // We simulate a small delay for "AI is typing"
                setTimeout(async () => {
                    try {
                        // Use the existing fetchSmartReplies logic or similar
                        // For a better experience, we can provide the full text as context
                        const replies = await fetchSmartReplies(text, []);
                        if (replies && replies.length > 0) {
                            // Send the first AI reply as a new message
                            await addDoc(collection(db, "chats", chatId, "messages"), {
                                text: replies[0],
                                sender: "ai-assistant",
                                senderName: "AI Assistant",
                                timestamp: serverTimestamp(),
                                type: "text",
                                status: "sent",
                                replyTo: { id: sentMsgRef.id, text, senderName: currentUser.displayName || "User" }
                            });
                        }
                    } catch (err) {
                        console.error("AI Mention processing failed:", err);
                    }
                }, 1000);
            }
        } catch (err) { console.error(err); }
    };

    const handleFileUpload = async (e) => {
        if (!e.target.files[0]) return;
        let file = e.target.files[0];

        // 1. File Size Validation (25MB max)
        if (file.size > MAX_FILE_SIZE) {
            const fileSizeMB = (file.size / 1024 / 1024).toFixed(1);
            showAlert(`File too large! Maximum size is 25MB. Your file: ${fileSizeMB}MB`);
            e.target.value = '';
            return;
        }

        // 2. Network Status Check
        if (!isOnline) {
            showAlert("No internet connection. Please check your network and try again.");
            e.target.value = '';
            return;
        }

        // 3. Show preview for images and videos
        const isImage = file.type.startsWith('image/');
        const isVideo = file.type.startsWith('video/');

        if (isImage || isVideo) {
            setPreviewFile(file);
            e.target.value = '';
            return;
        }

        // For other files, upload directly
        await uploadFile(file);
        e.target.value = '';
    };

    // Actual file upload logic (called after preview confirmation)
    const uploadFile = async (file, caption = "", metadata = {}) => {
        // Image Compression Logic (skip GIFs to preserve animation)
        const isGif = file.type === 'image/gif';
        if (file.type.startsWith('image/') && !isGif) {
            try {
                const options = {
                    maxSizeMB: 1,
                    maxWidthOrHeight: 1920,
                    useWebWorker: true
                };
                const compressedFile = await imageCompression(file, options);
                file = new File([compressedFile], file.name, { type: file.type });
                console.log(`Compressed: ${(compressedFile.size / 1024 / 1024).toFixed(2)} MB`);
            } catch (error) {
                console.error("Compression error:", error);
            }
        }

        try {
            const fileRef = ref(storage, `uploads/${chatId}/${Date.now()}_${file.name}`);

            // Use uploadBytesResumable for progress tracking
            const uploadTask = uploadBytesResumable(fileRef, file);
            uploadTaskRef.current = uploadTask; // Store for cancellation

            return new Promise((resolve, reject) => {
                uploadTask.on('state_changed',
                    (snapshot) => {
                        const loaded = snapshot.bytesTransferred / 1024 / 1024;
                        const total = snapshot.totalBytes / 1024 / 1024;
                        setUploadProgress({ loaded, total });
                    },
                    (error) => {
                        setUploadProgress(null);
                        uploadTaskRef.current = null;
                        if (error.code === 'storage/canceled') {
                            showAlert("Upload cancelled");
                        } else if (error.code === 'storage/network-request-failed') {
                            showAlert("Network error. Please check your connection and try again.");
                        } else {
                            showAlert(`Upload failed: ${error.message}`);
                        }
                        reject(error);
                    },
                    async () => {
                        try {
                            const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
                            const isImage = file.type.startsWith('image/');
                            const isVideo = file.type.startsWith('video/');
                            const msgData = {
                                sender: currentUser.uid,
                                senderName: currentUser.displayName || "User",
                                timestamp: serverTimestamp(),
                                type: isImage ? 'image' : isVideo ? 'video' : 'file',
                                fileURL: downloadURL,
                                fileName: file.name,
                                status: 'sent',
                                ...metadata // Spread trim/crop metadata
                            };
                            // Add caption if provided
                            if (caption && caption.trim()) {
                                msgData.caption = caption.trim();
                            }
                            await addDoc(collection(db, "chats", chatId, "messages"), msgData);

                            const lastMsgText = isImage ? '📷 Image' : isVideo ? '🎬 Video' : '📄 File';
                            const updates = { lastMessage: lastMsgText, lastUpdate: serverTimestamp() };
                            if (chatInfo?.members) {
                                chatInfo.members.forEach(memberId => {
                                    if (memberId !== currentUser.uid) {
                                        updates[`unreadCounts.${memberId}`] = increment(1);
                                    }
                                });
                            }
                            await updateDoc(doc(db, "chats", chatId), updates);
                            setUploadProgress(null);
                            uploadTaskRef.current = null;
                            resolve();
                        } catch (err) {
                            console.error(err);
                            showAlert("Failed to send file");
                            setUploadProgress(null);
                            uploadTaskRef.current = null;
                            reject(err);
                        }
                    }
                );
            });
        } catch (err) {
            console.error(err);
            showAlert("Error starting upload");
            setUploadProgress(null);
            uploadTaskRef.current = null;
        }
    };

    // Handle media preview send
    const handleMediaPreviewSend = async (file, caption, metadata) => {
        setPreviewFile(null);
        await uploadFile(file, caption, metadata);
    };

    // Cancel Upload Function
    const cancelUpload = () => {
        if (uploadTaskRef.current) {
            uploadTaskRef.current.cancel();
            uploadTaskRef.current = null;
            setUploadProgress(null);
        }
    };

    // Search & Menu State
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [isSearchOpen, setIsSearchOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [searchResults, setSearchResults] = useState([]);
    const [currentResultIndex, setCurrentResultIndex] = useState(0);

    const searchInputRef = useRef(null);

    // --- Message Scheduling State ---
    const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
    const [scheduledTime, setScheduledTime] = useState("");
    const [showScheduledList, setShowScheduledList] = useState(false);
    const [scheduledMessages, setScheduledMessages] = useState([]);
    const [editingScheduledMsg, setEditingScheduledMsg] = useState(null); // ID of message being edited

    // Load Scheduled Messages
    useEffect(() => {
        if (!currentUser) return;
        const q = query(collection(db, "users", currentUser.uid, "scheduled_messages"), orderBy("scheduledAt", "asc"));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const msgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setScheduledMessages(msgs);
        });
        return () => unsubscribe();
    }, [currentUser]);

    const handleScheduleMessage = async (e) => {
        e.preventDefault();
        if (!inputText.trim() && !editingScheduledMsg) return; // Allow if editing and text is in state (handled below)
        // Actually, current logic: new ones need inputText, edited ones need editingScheduledMsg.text

        if (!scheduledTime) return;

        const scheduledDate = new Date(scheduledTime);
        if (scheduledDate <= new Date()) {
            showAlert("Please select a future time.");
            return;
        }

        try {
            if (editingScheduledMsg) {
                // Update existing message
                await updateDoc(doc(db, "users", currentUser.uid, "scheduled_messages", editingScheduledMsg.id), {
                    text: editingScheduledMsg.text,
                    scheduledAt: Timestamp.fromDate(scheduledDate)
                });
                showAlert("Message updated.");
            } else {
                if (!inputText.trim()) return;
                // Create new message
                await addDoc(collection(db, "users", currentUser.uid, "scheduled_messages"), {
                    text: inputText,
                    chatId: chatId,
                    chatName: chatInfo?.name || "Chat",
                    scheduledAt: Timestamp.fromDate(scheduledDate),
                    createdAt: serverTimestamp(),
                    status: 'pending',
                    type: 'text',
                    sender: currentUser.uid,
                    senderName: currentUser.displayName || "User"
                });
                setInputText("");
                showAlert(`Message scheduled for ${scheduledDate.toLocaleString()}`);
            }

            setScheduledTime("");
            setEditingScheduledMsg(null);
            setIsScheduleModalOpen(false);
        } catch (error) {
            console.error("Error scheduling message:", error);
            showAlert("Failed to schedule message.");
        }
    };

    // Helper to start editing
    const startEditingScheduledMsg = (msg) => {
        setEditingScheduledMsg(msg);
        // Pre-fill time
        if (msg.scheduledAt) {
            const date = msg.scheduledAt.toDate();
            // Adjust to local ISO string for input
            const localIso = new Date(date.getTime() - (date.getTimezoneOffset() * 60000)).toISOString().slice(0, 16);
            setScheduledTime(localIso);
        }
        setIsScheduleModalOpen(true);
        setShowScheduledList(false);
    };

    const deleteScheduledMessage = async (msgId) => {
        try {
            await deleteDoc(doc(db, "users", currentUser.uid, "scheduled_messages", msgId));
            showAlert("Scheduled message canceled.");
        } catch (error) {
            console.error("Error preventing scheduled message:", error);
        }
    };

    // Search Logic
    const performSearch = (text) => {
        setSearchQuery(text);
        if (!text.trim()) {
            setSearchResults([]);
            setCurrentResultIndex(0);
            return;
        }

        // Find matches in messages
        const results = messages.reduce((acc, msg, index) => {
            if (msg.type === 'text' && msg.text && msg.text.toLowerCase().includes(text.toLowerCase())) {
                acc.push({ id: msg.id, index: index });
            }
            return acc;
        }, []);

        setSearchResults(results);
        // If results, scroll to the last one (most recent)
        if (results.length > 0) {
            const lastIdx = results.length - 1;
            setCurrentResultIndex(lastIdx);
            scrollToMessage(results[lastIdx].index);
        } else {
            setCurrentResultIndex(0);
        }
    };

    const scrollToMessage = (index) => {
        virtuosoRef.current?.scrollToIndex({
            index: index,
            behavior: 'smooth',
            align: 'center'
        });
    };

    const nextResult = () => {
        if (searchResults.length === 0) return;
        const newIndex = currentResultIndex + 1 >= searchResults.length ? 0 : currentResultIndex + 1;
        setCurrentResultIndex(newIndex);
        scrollToMessage(searchResults[newIndex].index);
    };

    const prevResult = () => {
        if (searchResults.length === 0) return;
        const newIndex = currentResultIndex - 1 < 0 ? searchResults.length - 1 : currentResultIndex - 1;
        setCurrentResultIndex(newIndex);
        scrollToMessage(searchResults[newIndex].index);
    };

    const closeSearch = () => {
        setIsSearchOpen(false);
        setSearchQuery("");
        setSearchResults([]);
        setCurrentResultIndex(0);
    };

    // Close menu when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (isMenuOpen && !event.target.closest('.header-menu-container')) {
                setIsMenuOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isMenuOpen]);

    if (!chatId) return null;

    return (
        <div className="flex flex-col h-full w-full overflow-hidden">

            <ChatHeader 
                chatInfo={chatInfo}
                handleStartCall={handleStartCall}
                isMenuOpen={isMenuOpen} setIsMenuOpen={setIsMenuOpen}
                setShowInfoModal={setShowInfoModal}
                setShowWallpaperModal={setShowWallpaperModal}
                isSearchOpen={isSearchOpen} setIsSearchOpen={setIsSearchOpen}
                searchInputRef={searchInputRef}
                searchQuery={searchQuery} performSearch={performSearch} nextResult={nextResult} prevResult={prevResult} closeSearch={closeSearch} searchResults={searchResults} currentResultIndex={currentResultIndex}
                messages={messages}
                showPinnedBar={showPinnedBar} setShowPinnedBar={setShowPinnedBar}
                currentPinIndex={currentPinIndex} setCurrentPinIndex={setCurrentPinIndex}
                pinMessage={pinMessage}
                virtuosoRef={virtuosoRef}
            />

            <MessageList 
                chatId={chatId}
                messages={messages}
                starredIds={starredIds}
                currentUser={currentUser}
                chatInfo={chatInfo}
                wallpaper={wallpaper}
                isMessagesReady={isMessagesReady}
                loadMoreMessages={loadMoreMessages}
                isLoadingMore={isLoadingMore}
                virtuosoRef={virtuosoRef}
                isSearchOpen={isSearchOpen}
                searchQuery={searchQuery}
                initiateReply={initiateReply}
                initiateForward={initiateForward}
                addReaction={addReaction}
                confirmDelete={confirmDelete}
                initiateEdit={initiateEdit}
                pinMessage={pinMessage}
                starMessage={starMessage}
                typingUser={typingUser}
            />

            <MessageInputArea
                smartReplies={smartReplies} isLoadingReplies={isLoadingReplies} handleSmartReplyClick={handleSmartReplyClick}
                isRecording={isRecording} voicePreviewUrl={voicePreviewUrl} editMsg={editMsg}
                voiceDraft={voiceDraft} formatDuration={formatDuration} deleteVoiceDraft={deleteVoiceDraft} sendVoiceDraft={sendVoiceDraft}
                replyTo={replyTo} cancelReply={cancelReply}
                dragOffset={dragOffset} isDraggingRef={isDraggingRef} recordingDuration={recordingDuration} cancelRecording={cancelRecording} stopRecording={stopRecording} handleDragStart={handleDragStart}
                uploadProgress={uploadProgress} cancelUpload={cancelUpload} fileInputRef={fileInputRef} handleFileUpload={handleFileUpload}
                setShowVideoRecorder={setShowVideoRecorder} startRecording={startRecording}
                setShowMediaCamera={setShowMediaCamera}
                scheduledMessages={scheduledMessages} setShowScheduledList={setShowScheduledList}
                setEditingScheduledMsg={setEditingScheduledMsg} setIsScheduleModalOpen={setIsScheduleModalOpen}
                setShowPollCreator={setShowPollCreator}
                setShowGameLobby={setShowGameLobby}
                mentionState={mentionState} groupMembers={groupMembers} insertMention={insertMention} setMentionState={setMentionState} mentionIndex={mentionIndex} setMentionIndex={setMentionIndex}
                showEmojiPicker={showEmojiPicker} setShowEmojiPicker={setShowEmojiPicker} emojiPickerPos={emojiPickerPos} isDraggingEmoji={isDraggingEmoji} setIsDraggingEmoji={setIsDraggingEmoji}
                emojiDragOffset={emojiDragOffset} setEmojiPickerPos={setEmojiPickerPos} onEmojiClick={onEmojiClick}
                inputText={inputText} setInputText={setInputText} handleInputChange={handleInputChange} inputRef={inputRef}
                isRephrasing={isRephrasing} setIsRephrasing={setIsRephrasing} fetchRephrase={fetchRephrase} showAlert={showAlert} sendMessage={sendMessage}
            />

            <ChatModals
                chatId={chatId}
                chatInfo={chatInfo}
                currentUser={currentUser}
                showInfoModal={showInfoModal} setShowInfoModal={setShowInfoModal}
                showWallpaperModal={showWallpaperModal} setShowWallpaperModal={setShowWallpaperModal} handleUpdateWallpaper={handleUpdateWallpaper}
                deleteMsgId={deleteMsgId} setDeleteMsgId={setDeleteMsgId} performDelete={performDelete}
                pendingPinMsg={pendingPinMsg} setPendingPinMsg={setPendingPinMsg} pinMessage={pinMessage}
                showScheduledList={showScheduledList} setShowScheduledList={setShowScheduledList} scheduledMessages={scheduledMessages}
                startEditingScheduledMsg={startEditingScheduledMsg} deleteScheduledMessage={deleteScheduledMessage}
                isScheduleModalOpen={isScheduleModalOpen} setIsScheduleModalOpen={setIsScheduleModalOpen} editingScheduledMsg={editingScheduledMsg}
                setEditingScheduledMsg={setEditingScheduledMsg} scheduledTime={scheduledTime} setScheduledTime={setScheduledTime} handleScheduleMessage={handleScheduleMessage}
                voicePreviewUrl={voicePreviewUrl} cancelVoicePreview={cancelVoicePreview} confirmSendVoice={confirmSendVoice}
                editMsg={editMsg} editText={editText} setEditText={setEditText} cancelEdit={cancelEdit} performEdit={performEdit}
                forwardMsg={forwardMsg} setForwardMsg={setForwardMsg} performForward={performForward}
                previewFile={previewFile} setPreviewFile={setPreviewFile} handleMediaPreviewSend={handleMediaPreviewSend}
                showVideoRecorder={showVideoRecorder} setShowVideoRecorder={setShowVideoRecorder} sendVideoMessage={sendVideoMessage}
                showMediaCamera={showMediaCamera} setShowMediaCamera={setShowMediaCamera} handleCameraCapture={handleCameraCapture}
                showPollCreator={showPollCreator} setShowPollCreator={setShowPollCreator} sendPoll={sendPoll}
                showGameLobby={showGameLobby} setShowGameLobby={setShowGameLobby} groupMembers={groupMembers}
            />
        </div >
    );
}
