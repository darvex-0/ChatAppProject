import { useEffect, useState, useRef, useCallback } from 'react';
import ReactDOM from 'react-dom';
import { useParams, useNavigate } from 'react-router-dom';
import { db, storage } from '../services/firebase';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, doc, updateDoc, getDoc, setDoc, deleteDoc, deleteField, increment, limitToLast } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, uploadBytesResumable } from 'firebase/storage';
import { useAuth } from '../context/AuthContext';
import { useUI } from '../context/UIContext';
import ChatInfoModal from './Modals/ChatInfoModal';
import WallpaperModal from './Modals/WallpaperModal';
import ForwardModal from './Modals/ForwardModal';
import MediaPreviewModal from './Modals/MediaPreviewModal';
import MessageItem from './MessageItem';
import { Virtuoso } from 'react-virtuoso';
import imageCompression from 'browser-image-compression';
import EmojiPicker from 'emoji-picker-react';

export default function ChatWindow() {
    const { chatId } = useParams();
    const { currentUser } = useAuth();
    const { showAlert } = useUI();
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

    const typingTimeoutRef = useRef(null);
    const inputRef = useRef(null);
    const fileInputRef = useRef(null);

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
        // We don't reset isRecording here because we might want to let it continue or handle it specifically
        // But usually, you shouldn't carry a recording to another chat without intent.
        // For now, let's leave recording as is, but reset UI specific to the previous chat context.
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
                let type = data.type;
                let uid = null;

                if (type === 'group') {
                    name = data.groupName;
                    photo = data.groupImage;
                } else {
                    uid = data.members?.find(uid => uid !== currentUser.uid);
                    if (uid) {
                        const userDoc = await getDoc(doc(db, "users", uid));
                        if (userDoc.exists()) {
                            const userData = userDoc.data();
                            name = userData.name || userData.email || "User";
                            photo = userData.photoURL;
                        }
                    }
                }
                setChatInfo({ name, photo, type, uid, members: data.members });
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
            setMessages(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
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

    // Load More Function
    const loadMoreMessages = () => {
        // Only load if we have enough messages to suspect there are more
        if (messages.length >= messageLimit && !isLoadingMore) {
            setIsLoadingMore(true);
            // Artificial delay to show spinner if needed, and to prevent spamming
            setTimeout(() => {
                setMessageLimit(prev => prev + 50);
                setIsLoadingMore(false);
            }, 500);
        }
    };

    // Read Receipt Logic: Mark messages as 'seen' when I view the chat
    useEffect(() => {
        if (!chatId || messages.length === 0) return;

        const markAsSeen = async () => {
            // Only mark messages that are NOT from me and are NOT already 'seen'
            const unreadMessages = messages.filter(
                msg => msg.sender !== currentUser.uid && msg.status !== 'seen'
            );

            // Batch update all unread messages
            for (const msg of unreadMessages) {
                try {
                    await updateDoc(doc(db, "chats", chatId, "messages", msg.id), {
                        status: 'seen'
                    });
                } catch (e) {
                    console.error("Error marking message as seen:", e);
                }
            }

            // Fix: Also reset the unread count in the chat document if we found unread messages
            if (unreadMessages.length > 0) {
                try {
                    await updateDoc(doc(db, "chats", chatId), {
                        [`unreadCounts.${currentUser.uid}`]: 0
                    });
                } catch (e) {
                    console.error("Error resetting unread count:", e);
                }
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

    // --- Other Actions ---
    const handleInputChange = (e) => {
        setInputText(e.target.value);
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

    const initiateReply = (msg) => {
        setReplyTo({ id: msg.id, text: msg.text || (msg.type === 'image' ? 'Image' : 'Voice Message'), senderName: msg.senderName });
        inputRef.current?.focus();
    };

    const cancelReply = () => {
        setReplyTo(null);
    };

    const addReaction = async (msgId, emoji) => {
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
    };

    // Trigger Delete Confirmation
    const confirmDelete = (msgId) => {
        setDeleteMsgId(msgId);
    };

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
    const initiateEdit = (msg) => {
        if (msg.type !== 'text') {
            showAlert("Only text messages can be edited");
            return;
        }
        setEditMsg(msg);
        setEditText(msg.text || "");
    };

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
    const initiateForward = (msg) => {
        setForwardMsg(msg);
    };

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
            if (replyTo) {
                msgData.replyTo = replyTo;
                setReplyTo(null);
            }
            await addDoc(collection(db, "chats", chatId, "messages"), msgData);

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
    const uploadFile = async (file, caption = "") => {
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
                                status: 'sent'
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
    const handleMediaPreviewSend = async (file, caption) => {
        setPreviewFile(null);
        await uploadFile(file, caption);
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

            {/* Header */}
            <div style={{ zIndex: 50, background: 'var(--header-bg)', padding: '0.75rem 1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', backdropFilter: 'blur(10px)', flexShrink: 0, position: 'relative' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <button onClick={() => navigate('/')} className="back-btn" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', marginRight: '0.5rem', padding: '0.25rem 0.5rem', background: 'rgba(99, 102, 241, 0.1)', border: '1px solid rgba(99, 102, 241, 0.3)', borderRadius: '6px', color: 'var(--primary-light)', cursor: 'pointer', fontSize: '0.75rem' }}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg> Back
                    </button>
                    <div onClick={() => setShowInfoModal(true)} className="chat-header-clickable" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer', padding: '0.25rem 0.5rem', borderRadius: '8px', transition: 'background 0.2s' }}>
                        {chatInfo?.photo ? (
                            <img src={chatInfo.photo} alt="" className="header-profile-pic" style={{ width: '36px', height: '36px', borderRadius: '50%', objectFit: 'cover' }} />
                        ) : (
                            <div className="header-profile-pic" style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'rgba(99, 102, 241, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem' }}>
                                {chatInfo?.type === 'group' ? '👥' : '👤'}
                            </div>
                        )}
                        <span style={{ color: 'var(--app-text)', fontWeight: 500 }}>{chatInfo?.name || "Chat"}</span>
                    </div>
                </div>

                {/* 3-Dot Menu */}
                <div className="header-menu-container" style={{ position: 'relative' }}>
                    <button
                        onClick={() => setIsMenuOpen(!isMenuOpen)}
                        className="icon-btn"
                        style={{ width: '32px', height: '32px', border: 'none', background: 'transparent' }}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="1"></circle><circle cx="12" cy="5" r="1"></circle><circle cx="12" cy="19" r="1"></circle></svg>
                    </button>

                    {isMenuOpen && (
                        <div className="dropdown-menu">
                            <div className="dropdown-item" onClick={() => { setIsSearchOpen(true); setIsMenuOpen(false); setTimeout(() => searchInputRef.current?.focus(), 100); }}>
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                                Search
                            </div>
                            <div className="dropdown-item" onClick={() => { setShowWallpaperModal(true); setIsMenuOpen(false); }}>
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                                Wallpaper
                            </div>
                            <div className="dropdown-item" onClick={() => { setShowInfoModal(true); setIsMenuOpen(false); }}>
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
                                Chat Info
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Search Bar */}
            {isSearchOpen && (
                <div className="search-bar-container">
                    <div style={{ color: 'var(--gray)' }}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                    </div>
                    <input
                        ref={searchInputRef}
                        className="search-input"
                        placeholder="Search..."
                        value={searchQuery}
                        onChange={(e) => performSearch(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') nextResult();
                            if (e.key === 'Escape') closeSearch();
                        }}
                    />
                    <div className="search-actions">
                        {searchResults.length > 0 && <span style={{ fontSize: '0.8rem', color: 'var(--gray)', marginRight: '0.5rem' }}>{currentResultIndex + 1} of {searchResults.length}</span>}
                        <button onClick={prevResult} className="icon-btn" style={{ width: '28px', height: '28px', background: 'transparent', border: 'none' }} title="Previous">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="18 15 12 9 6 15"></polyline></svg>
                        </button>
                        <button onClick={nextResult} className="icon-btn" style={{ width: '28px', height: '28px', background: 'transparent', border: 'none' }} title="Next">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9"></polyline></svg>
                        </button>
                        <button onClick={closeSearch} className="icon-btn" style={{ width: '28px', height: '28px', background: 'transparent', border: 'none' }} title="Close">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                        </button>
                    </div>
                </div>
            )}

            {/* Pinned Messages Banner - WhatsApp Style */}
            {(() => {
                const now = Date.now();
                const pinnedMessages = messages.filter(m => m.isPinned && (!m.pinExpiresAt || (m.pinExpiresAt.toMillis ? m.pinExpiresAt.toMillis() : new Date(m.pinExpiresAt).getTime()) > now));
                if (pinnedMessages.length === 0) return null;
                if (!showPinnedBar) {
                    // Collapsed state - just show a small indicator
                    return (
                        <div
                            onClick={() => setShowPinnedBar(true)}
                            style={{
                                background: 'rgba(99, 102, 241, 0.2)',
                                padding: '6px 12px',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                fontSize: '0.8rem',
                                color: 'var(--primary)'
                            }}
                        >
                            📌 {pinnedMessages.length} pinned
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9"></polyline></svg>
                        </div>
                    );
                }
                // Ensure currentPinIndex is valid
                const safeIndex = currentPinIndex >= pinnedMessages.length ? 0 : currentPinIndex;
                const currentPin = pinnedMessages[safeIndex];
                return (
                    <div style={{
                        background: 'var(--input-bg)',
                        borderBottom: '1px solid var(--border-color)',
                        padding: '10px 12px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px'
                    }}>
                        {/* Navigation Arrows (if multiple pins) */}
                        {pinnedMessages.length > 1 && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                <button
                                    onClick={() => setCurrentPinIndex(prev => prev <= 0 ? pinnedMessages.length - 1 : prev - 1)}
                                    style={{ background: 'transparent', border: 'none', color: 'var(--primary)', cursor: 'pointer', padding: '2px' }}
                                    title="Previous pin"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="18 15 12 9 6 15"></polyline></svg>
                                </button>
                                <button
                                    onClick={() => setCurrentPinIndex(prev => prev >= pinnedMessages.length - 1 ? 0 : prev + 1)}
                                    style={{ background: 'transparent', border: 'none', color: 'var(--primary)', cursor: 'pointer', padding: '2px' }}
                                    title="Next pin"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9"></polyline></svg>
                                </button>
                            </div>
                        )}
                        <span style={{ fontSize: '1rem' }}>📌</span>
                        <div style={{ flex: 1, overflow: 'hidden' }}>
                            <div style={{ fontSize: '0.7rem', color: 'var(--primary)', fontWeight: 600, marginBottom: '2px' }}>
                                {pinnedMessages.length > 1 ? `${safeIndex + 1} of ${pinnedMessages.length} Pinned` : 'Pinned Message'}
                            </div>
                            <div
                                style={{
                                    fontSize: '0.85rem',
                                    color: 'var(--app-text)',
                                    whiteSpace: 'nowrap',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    cursor: 'pointer'
                                }}
                                onClick={() => {
                                    const idx = messages.findIndex(m => m.id === currentPin.id);
                                    if (idx !== -1) virtuosoRef.current?.scrollToIndex({ index: idx, behavior: 'smooth', align: 'center' });
                                }}
                            >
                                {currentPin.text || (currentPin.type === 'image' ? '🖼️ Image' : '🎤 Voice Message')}
                            </div>
                        </div>
                        {/* Unpin this message */}
                        <button
                            onClick={() => {
                                pinMessage(currentPin.id, false);
                                if (safeIndex >= pinnedMessages.length - 1 && safeIndex > 0) {
                                    setCurrentPinIndex(safeIndex - 1);
                                }
                            }}
                            style={{ background: 'rgba(239, 68, 68, 0.2)', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '6px', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem' }}
                            title="Unpin this message"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                            Unpin
                        </button>
                        {/* Collapse banner */}
                        <button
                            onClick={() => setShowPinnedBar(false)}
                            style={{ background: 'transparent', border: 'none', color: 'var(--gray)', cursor: 'pointer', padding: '4px' }}
                            title="Collapse"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="18 15 12 9 6 15"></polyline></svg>
                        </button>
                    </div>
                );
            })()}

            {/* Messages - Virtualized */}
            <div
                id="chat-box"
                style={{
                    flexGrow: 1,
                    padding: '0 1rem',
                    background: wallpaper || 'transparent',
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    backgroundRepeat: 'no-repeat',
                    backgroundAttachment: 'local',
                    position: 'relative',
                    minHeight: 0,
                    WebkitOverflowScrolling: 'touch'
                }}
            >
                {wallpaper && <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', background: 'var(--modal-overlay)', pointerEvents: 'none', zIndex: 0 }} />}
                <Virtuoso
                    key={chatId}
                    ref={virtuosoRef}
                    style={{
                        height: '100%',
                        zIndex: 1,
                        opacity: isMessagesReady ? 1 : 0,
                        transition: 'opacity 0.15s ease-in'
                    }}
                    data={messages}
                    initialTopMostItemIndex={messages.length - 1}
                    startReached={loadMoreMessages}
                    followOutput="auto"
                    alignToBottom
                    overscan={200}
                    itemContent={(index, msg) => (
                        <MessageItem
                            key={msg.id}
                            msg={{ ...msg, isStarred: starredIds.has(msg.id) }}
                            currentUser={currentUser}
                            chatInfo={chatInfo}
                            initiateReply={initiateReply}
                            initiateForward={initiateForward}
                            addReaction={addReaction}
                            confirmDelete={confirmDelete}
                            initiateEdit={initiateEdit}
                            pinMessage={pinMessage}
                            starMessage={starMessage}
                            highlightText={isSearchOpen ? searchQuery : null}
                        />
                    )}
                    components={{
                        Header: () => isLoadingMore ? <div style={{ textAlign: 'center', padding: '10px', fontSize: '0.8rem', color: '#aaa' }}>Loading older messages...</div> : null
                    }}
                />
            </div>

            <div id="typingIndicator">{typingUser && <span>{typingUser}</span>}</div>

            {/* Input Area - With Voice Logic */}
            <div id="input-area" style={{ position: 'relative', zIndex: 60 }}>
                {/* Voice Draft Preview (shown when returning to chat with saved recording) */}
                {voiceDraft && !isRecording && (
                    <div style={{ background: 'rgba(99, 102, 241, 0.1)', border: '1px solid rgba(99, 102, 241, 0.3)', borderRadius: '8px', padding: '12px', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                                <span style={{ color: '#6366f1', fontSize: '1.2rem' }}>🎤</span>
                                <span style={{ color: 'var(--app-text)', fontSize: '0.9rem', fontWeight: 500 }}>Saved Voice Message</span>
                                <span style={{ color: 'var(--app-text-muted)', fontSize: '0.85rem' }}>({formatDuration(voiceDraft.duration)})</span>
                            </div>
                            <audio src={voiceDraft.previewUrl} controls style={{ width: '100%', height: '32px', marginTop: '4px' }} />
                        </div>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <button
                                onClick={deleteVoiceDraft}
                                style={{ background: 'rgba(239, 68, 68, 0.2)', border: '1px solid #ef4444', color: '#ef4444', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 500 }}
                            >
                                🗑️ Delete
                            </button>
                            <button
                                onClick={sendVoiceDraft}
                                style={{ background: '#6366f1', border: 'none', color: 'white', padding: '6px 16px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 500 }}
                            >
                                📤 Send
                            </button>
                        </div>
                    </div>
                )}

                {replyTo && !isRecording && (
                    <div className="reply-preview-bar" style={{ display: 'flex' }}>
                        <div className="reply-content">
                            <strong>Replying to {replyTo.senderName}</strong>
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '300px', display: 'inline-block' }}>
                                {replyTo.text?.length > 80 ? replyTo.text.slice(0, 80) + '...' : replyTo.text}
                            </span>
                        </div>
                        <button
                            type="button"
                            className="icon-btn"
                            style={{
                                width: '32px',
                                height: '32px',
                                border: 'none',
                                background: 'transparent',
                                cursor: 'pointer',
                                padding: 0
                            }}
                            onClick={cancelReply}
                            title="Cancel Reply"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                        </button>
                    </div>
                )}

                {isRecording ? (
                    // WhatsApp Style Recording UI with Swipe to Cancel
                    <div
                        onMouseDown={handleDragStart}
                        onTouchStart={handleDragStart}
                        style={{
                            flexGrow: 1,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '0 0.5rem',
                            transform: `translateX(${dragOffset}px)`,
                            opacity: Math.max(0.3, 1 + dragOffset / 150),
                            transition: isDraggingRef.current ? 'none' : 'transform 0.2s ease-out, opacity 0.2s ease-out',
                            cursor: 'grab',
                            userSelect: 'none'
                        }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', color: '#ef4444' }}>
                            <div style={{
                                width: '10px', height: '10px', background: '#ef4444', borderRadius: '50%',
                                animation: 'pulse 1s infinite'
                            }}></div>
                            <span style={{ fontSize: '1.1rem', fontWeight: 500, color: 'var(--app-text)', minWidth: '45px' }}>
                                {formatDuration(recordingDuration)}
                            </span>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                            <div style={{ color: '#94a3b8', fontSize: '0.9rem', opacity: 0.7 }}>
                                &lt;&lt;&lt; Slide to cancel
                            </div>
                        </div>

                        <div style={{ display: 'flex', gap: '1rem' }}>
                            <button onClick={cancelRecording} className="icon-btn" style={{ border: 'none', background: 'transparent', color: '#ef4444' }} title="Cancel">
                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                            </button>
                            <button onClick={stopRecording} className="icon-btn" style={{ border: 'none', background: 'var(--primary)', color: 'white', width: '40px', height: '40px', borderRadius: '50%' }} title="Send (Stop)">
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
                            </button>
                        </div>
                    </div>
                ) : (
                    // Standard Input UI
                    <>
                        {uploadProgress && (
                            <div style={{ position: 'absolute', top: '-30px', left: '10px', background: 'rgba(99, 102, 241, 0.95)', color: 'white', padding: '6px 12px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 500, boxShadow: '0 2px 8px rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span>📤 {uploadProgress.loaded.toFixed(1)}/{uploadProgress.total.toFixed(1)}MB</span>
                                <button
                                    onClick={cancelUpload}
                                    style={{ background: 'rgba(239, 68, 68, 0.9)', border: 'none', borderRadius: '6px', padding: '2px 6px', color: 'white', cursor: 'pointer', fontSize: '0.7rem', fontWeight: 600 }}
                                    title="Cancel upload"
                                >
                                    ✕
                                </button>
                            </div>
                        )}
                        <button onClick={() => fileInputRef.current?.click()} className="icon-btn" title="Attach File" style={{ width: 'auto', height: 'auto', border: 'none', background: 'transparent', padding: 0 }}>
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path></svg>
                        </button>
                        <input type="file" ref={fileInputRef} onChange={handleFileUpload} style={{ display: 'none' }} />

                        <form onSubmit={sendMessage} style={{ flexGrow: 1, display: 'flex', gap: '0.75rem', alignItems: 'center', position: 'relative' }}>
                            {showEmojiPicker && ReactDOM.createPortal(
                                <>
                                    {/* Click outside overlay */}
                                    <div
                                        style={{
                                            position: 'fixed',
                                            top: 0,
                                            left: 0,
                                            width: '100vw',
                                            height: '100vh',
                                            zIndex: 999998
                                        }}
                                        onClick={() => setShowEmojiPicker(false)}
                                    />
                                    {/* Draggable Emoji Picker */}
                                    <div
                                        style={{
                                            position: 'fixed',
                                            top: emojiPickerPos.y,
                                            left: emojiPickerPos.x,
                                            zIndex: 999999,
                                            boxShadow: '0 10px 40px rgba(0,0,0,0.6)',
                                            borderRadius: '12px',
                                            overflow: 'hidden',
                                            cursor: isDraggingEmoji ? 'grabbing' : 'default'
                                        }}
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        {/* Drag Handle */}
                                        <div
                                            style={{
                                                background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                                                padding: '8px 12px',
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                alignItems: 'center',
                                                cursor: 'grab',
                                                userSelect: 'none'
                                            }}
                                            onMouseDown={(e) => {
                                                setIsDraggingEmoji(true);
                                                emojiDragOffset.current = {
                                                    x: e.clientX - emojiPickerPos.x,
                                                    y: e.clientY - emojiPickerPos.y
                                                };
                                                const handleMouseMove = (ev) => {
                                                    setEmojiPickerPos({
                                                        x: Math.max(0, Math.min(window.innerWidth - 300, ev.clientX - emojiDragOffset.current.x)),
                                                        y: Math.max(0, Math.min(window.innerHeight - 400, ev.clientY - emojiDragOffset.current.y))
                                                    });
                                                };
                                                const handleMouseUp = () => {
                                                    setIsDraggingEmoji(false);
                                                    document.removeEventListener('mousemove', handleMouseMove);
                                                    document.removeEventListener('mouseup', handleMouseUp);
                                                };
                                                document.addEventListener('mousemove', handleMouseMove);
                                                document.addEventListener('mouseup', handleMouseUp);
                                            }}
                                            onTouchStart={(e) => {
                                                const touch = e.touches[0];
                                                setIsDraggingEmoji(true);
                                                emojiDragOffset.current = {
                                                    x: touch.clientX - emojiPickerPos.x,
                                                    y: touch.clientY - emojiPickerPos.y
                                                };
                                                const handleTouchMove = (ev) => {
                                                    const t = ev.touches[0];
                                                    setEmojiPickerPos({
                                                        x: Math.max(0, Math.min(window.innerWidth - 300, t.clientX - emojiDragOffset.current.x)),
                                                        y: Math.max(0, Math.min(window.innerHeight - 400, t.clientY - emojiDragOffset.current.y))
                                                    });
                                                };
                                                const handleTouchEnd = () => {
                                                    setIsDraggingEmoji(false);
                                                    document.removeEventListener('touchmove', handleTouchMove);
                                                    document.removeEventListener('touchend', handleTouchEnd);
                                                };
                                                document.addEventListener('touchmove', handleTouchMove, { passive: true });
                                                document.addEventListener('touchend', handleTouchEnd);
                                            }}
                                        >
                                            <span style={{ color: 'white', fontSize: '0.85rem', fontWeight: 500 }}>😃 Emojis</span>
                                            <button
                                                onClick={() => setShowEmojiPicker(false)}
                                                style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', fontSize: '1.2rem', lineHeight: 1 }}
                                            >
                                                ×
                                            </button>
                                        </div>
                                        <EmojiPicker
                                            theme="dark"
                                            onEmojiClick={onEmojiClick}
                                            searchDisabled
                                            skinTonesDisabled
                                            height={350}
                                            width={300}
                                            previewConfig={{ showPreview: false }}
                                        />
                                    </div>
                                </>,
                                document.body
                            )}

                            <button
                                type="button"
                                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                                className="icon-btn"
                                title="Add Emoji"
                                style={{ border: 'none', background: 'transparent', color: showEmojiPicker ? 'var(--primary)' : 'var(--gray)' }}
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M8 14s1.5 2 4 2 4-2 4-2"></path><line x1="9" y1="9" x2="9.01" y2="9"></line><line x1="15" y1="9" x2="15.01" y2="9"></line></svg>
                            </button>

                            <input
                                id="messageInput"
                                ref={inputRef}
                                value={inputText}
                                onChange={handleInputChange}
                                placeholder="Type your message..."
                                autoComplete="off"
                            />

                            {!inputText.trim() ? (
                                <button type="button" onClick={startRecording} className="icon-btn" style={{ border: 'none', background: 'transparent', color: 'var(--gray)', transition: 'all 0.2s', width: '40px', height: '40px' }} title="Record Voice">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z M19 10v2a7 7 0 0 1-14 0v-2 M12 19v3 M8 22h8"></path>
                                    </svg>
                                </button>
                            ) : (
                                <button type="submit" className="icon-btn" title="Send Message" style={{ border: 'none', background: 'transparent' }}>
                                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--primary)' }}><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
                                </button>
                            )}
                        </form>
                    </>
                )}
            </div>

            {showInfoModal && <ChatInfoModal chatId={chatId} onClose={() => setShowInfoModal(false)} />}

            <WallpaperModal
                isOpen={showWallpaperModal}
                onClose={() => setShowWallpaperModal(false)}
                onUpdateWallpaper={handleUpdateWallpaper}
            />

            {/* Delete Confirmation Overlay */}
            {deleteMsgId && (
                <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.85)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(5px)' }}>
                    <div style={{ background: '#0f172a', padding: '2rem', borderRadius: '16px', border: '1px solid #ef4444', maxWidth: '300px', width: '90%', textAlign: 'center', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)' }}>
                        <div style={{ color: 'white', marginBottom: '1.5rem', fontSize: '1rem' }}>Are you sure you want to delete this message? This will be removed for everyone.</div>
                        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
                            <button
                                onClick={() => setDeleteMsgId(null)}
                                className="modal-btn secondary"
                                style={{ marginTop: 0, width: 'auto', padding: '0.6rem 1.2rem' }}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={performDelete}
                                className="modal-btn danger"
                                style={{ marginTop: 0, width: 'auto', padding: '0.6rem 1.2rem' }}
                            >
                                Yes, Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Pin Duration Picker Modal */}
            {pendingPinMsg && (
                <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.85)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(5px)' }}>
                    <div style={{ background: '#0f172a', padding: '1.5rem', borderRadius: '16px', border: '1px solid var(--primary)', maxWidth: '320px', width: '90%', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)' }}>
                        <div style={{ color: 'white', marginBottom: '1rem', fontSize: '1.1rem', fontWeight: 600, textAlign: 'center' }}>📌 Pin Duration</div>
                        <div style={{ color: '#94a3b8', marginBottom: '1rem', fontSize: '0.85rem', textAlign: 'center' }}>How long should this message be pinned?</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {[
                                { label: '1 Hour', ms: 60 * 60 * 1000 },
                                { label: '12 Hours', ms: 12 * 60 * 60 * 1000 },
                                { label: '1 Day', ms: 24 * 60 * 60 * 1000 },
                                { label: '1 Week', ms: 7 * 24 * 60 * 60 * 1000 },
                                { label: 'No Limit', ms: -1 } // Use -1 as marker for no expiry
                            ].map(opt => (
                                <button
                                    key={opt.label}
                                    onClick={() => {
                                        // Pass null for no expiry, otherwise pass the duration
                                        pinMessage(pendingPinMsg, true, opt.ms === -1 ? 'forever' : opt.ms);
                                        setPendingPinMsg(null);
                                    }}
                                    style={{
                                        background: opt.ms === -1 ? 'rgba(99, 102, 241, 0.3)' : 'rgba(255,255,255,0.05)',
                                        border: '1px solid rgba(255,255,255,0.1)',
                                        borderRadius: '8px',
                                        padding: '12px',
                                        color: 'white',
                                        cursor: 'pointer',
                                        fontSize: '0.9rem',
                                        transition: 'all 0.2s'
                                    }}
                                    onMouseEnter={e => e.target.style.background = 'rgba(99, 102, 241, 0.3)'}
                                    onMouseLeave={e => e.target.style.background = opt.ms === -1 ? 'rgba(99, 102, 241, 0.3)' : 'rgba(255,255,255,0.05)'}
                                >
                                    {opt.label}
                                </button>
                            ))}
                        </div>
                        <button
                            onClick={() => setPendingPinMsg(null)}
                            style={{ marginTop: '1rem', width: '100%', background: 'transparent', border: '1px solid #64748b', borderRadius: '8px', padding: '10px', color: '#94a3b8', cursor: 'pointer', fontSize: '0.85rem' }}
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            )}

            {/* Voice Message Preview Modal */}
            {voicePreviewUrl && (
                <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.85)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(5px)' }}>
                    <div style={{ background: '#0f172a', padding: '2rem', borderRadius: '16px', border: '1px solid var(--primary)', maxWidth: '350px', width: '90%', textAlign: 'center', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)' }}>
                        <div style={{ color: 'white', marginBottom: '1rem', fontSize: '1.1rem', fontWeight: 600 }}>🎤 Voice Message Preview</div>
                        <audio controls src={voicePreviewUrl} style={{ width: '100%', marginBottom: '1.5rem' }} />
                        <div style={{ color: '#94a3b8', marginBottom: '1.5rem', fontSize: '0.9rem' }}>Send this voice message?</div>
                        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
                            <button
                                onClick={cancelVoicePreview}
                                className="modal-btn secondary"
                                style={{ marginTop: 0, width: 'auto', padding: '0.6rem 1.5rem' }}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={confirmSendVoice}
                                className="modal-btn"
                                style={{ marginTop: 0, width: 'auto', padding: '0.6rem 1.5rem' }}
                            >
                                Send
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Message Modal */}
            {editMsg && (
                <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.85)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(5px)' }}>
                    <div style={{ background: '#0f172a', padding: '2rem', borderRadius: '16px', border: '1px solid var(--primary)', maxWidth: '400px', width: '90%', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)' }}>
                        <div style={{ color: 'white', marginBottom: '1rem', fontSize: '1.1rem', fontWeight: 600 }}>✏️ Edit Message</div>
                        <textarea
                            value={editText}
                            onChange={(e) => setEditText(e.target.value)}
                            style={{
                                width: '100%',
                                minHeight: '100px',
                                padding: '0.75rem',
                                borderRadius: '8px',
                                border: '1px solid rgba(255,255,255,0.1)',
                                background: 'rgba(0,0,0,0.3)',
                                color: 'white',
                                fontSize: '0.95rem',
                                marginBottom: '1rem',
                                resize: 'vertical',
                                outline: 'none'
                            }}
                            autoFocus
                        />
                        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                            <button
                                onClick={cancelEdit}
                                className="modal-btn secondary"
                                style={{ marginTop: 0, width: 'auto', padding: '0.6rem 1.2rem' }}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={performEdit}
                                className="modal-btn"
                                style={{ marginTop: 0, width: 'auto', padding: '0.6rem 1.2rem' }}
                            >
                                Save
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Forward Modal */}
            {forwardMsg && (
                <ForwardModal
                    message={forwardMsg}
                    currentChatId={chatId}
                    onClose={() => setForwardMsg(null)}
                    onForward={performForward}
                />
            )}

            {/* Media Preview Modal */}
            {previewFile && (
                <MediaPreviewModal
                    file={previewFile}
                    onSend={handleMediaPreviewSend}
                    onCancel={() => setPreviewFile(null)}
                />
            )}

        </div>
    );
}
