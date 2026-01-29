import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db, storage } from '../services/firebase';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, doc, updateDoc, getDoc, setDoc, deleteDoc, increment, limitToLast } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, uploadBytesResumable } from 'firebase/storage';
import { useAuth } from '../context/AuthContext';
import { useUI } from '../context/UIContext';
import ChatInfoModal from './Modals/ChatInfoModal';
import MessageItem from './MessageItem';
import { Virtuoso } from 'react-virtuoso';
import imageCompression from 'browser-image-compression';

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
    const mediaRecorderRef = useRef(null);
    const audioChunksRef = useRef([]);

    // Delete Confirmation State
    const [deleteMsgId, setDeleteMsgId] = useState(null);

    // Edit Message State
    const [editMsg, setEditMsg] = useState(null);
    const [editText, setEditText] = useState("");

    // Network & Upload State
    const [isOnline, setIsOnline] = useState(navigator.onLine);
    const [uploadProgress, setUploadProgress] = useState(null); // {loaded: 5.5, total: 10}
    const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB
    const uploadTaskRef = useRef(null); // Track active upload for cancellation

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

    // Refs for Sound Logic
    const notificationSound = useRef(new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3'));
    const lastMessageIdRef = useRef(null);
    const isInitialLoad = useRef(true);
    const previousChatIdRef = useRef(chatId);

    // Load voice draft for this chat from localStorage
    useEffect(() => {
        const loadVoiceDraft = () => {
            try {
                const draftsJson = localStorage.getItem('voiceDrafts');
                if (draftsJson) {
                    const drafts = JSON.parse(draftsJson);
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
                }
            } catch (e) {
                console.error('Error loading voice draft:', e);
            }
        };
        loadVoiceDraft();
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
        if (isRecording && mediaRecorderRef.current && audioChunksRef.current.length > 0) {
            // Save current recording as draft
            const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
            const reader = new FileReader();
            reader.onloadend = () => {
                try {
                    const draftsJson = localStorage.getItem('voiceDrafts') || '{}';
                    const drafts = JSON.parse(draftsJson);

                    drafts[previousChatIdRef.current] = {
                        dataUrl: reader.result,
                        duration: recordingDuration,
                        timestamp: Date.now()
                    };
                    localStorage.setItem('voiceDrafts', JSON.stringify(drafts));
                } catch (e) {
                    console.error('Error saving voice draft:', e);
                }
            };
            reader.readAsDataURL(audioBlob);

            // Stop recording
            mediaRecorderRef.current.stop();
            mediaRecorderRef.current.stream?.getTracks().forEach(track => track.stop());
            setIsRecording(false);
            setRecordingDuration(0);
            isCancelledRef.current = true;
        }

        // Update previous chat ID for next switch
        previousChatIdRef.current = chatId;
    }, [chatId]);

    // Force scroll to bottom after initial messages load
    const hasScrolledToBottom = useRef(false);
    useEffect(() => {
        if (messages.length > 0 && !hasScrolledToBottom.current && virtuosoRef.current) {
            // Small delay to ensure Virtuoso has rendered
            const timer = setTimeout(() => {
                virtuosoRef.current?.scrollToIndex({
                    index: messages.length - 1,
                    behavior: 'auto',
                    align: 'end'
                });
                hasScrolledToBottom.current = true;
            }, 100);
            return () => clearTimeout(timer);
        }
    }, [messages.length]);

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

    // Recording Timer State
    const [recordingDuration, setRecordingDuration] = useState(0);
    const recordingIntervalRef = useRef(null);
    const isCancelledRef = useRef(false);

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
        }
    };

    const cancelRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            isCancelledRef.current = true; // Mark as cancelled
            mediaRecorderRef.current.stop();
            setIsRecording(false);
            setRecordingDuration(0);
        }
        setIsRecording(false);
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
            setDoc(doc(db, "chats", chatId, "typing", currentUser.uid), {
                typing: e.target.value.length > 0,
                name: currentUser.displayName || 'Someone',
                timestamp: serverTimestamp()
            }, { merge: true });

            if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
            typingTimeoutRef.current = setTimeout(() => {
                setDoc(doc(db, "chats", chatId, "typing", currentUser.uid), {
                    typing: false,
                    name: currentUser.displayName || 'Someone',
                    timestamp: serverTimestamp()
                }, { merge: true });
            }, 1000);
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
            await updateDoc(msgRef, { [`reactions.${currentUser.uid}`]: emoji });
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
                    e.target.value = '';
                },
                async () => {
                    try {
                        const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
                        const msgData = {
                            sender: currentUser.uid,
                            senderName: currentUser.displayName || "User",
                            timestamp: serverTimestamp(),
                            type: file.type.startsWith('image/') ? 'image' : 'file',
                            fileURL: downloadURL,
                            fileName: file.name,
                            status: 'sent'
                        };
                        await addDoc(collection(db, "chats", chatId, "messages"), msgData);

                        const updates = { lastMessage: file.type.startsWith('image/') ? '📷 Image' : '📄 File', lastUpdate: serverTimestamp() };
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
                        e.target.value = '';
                    } catch (err) {
                        console.error(err);
                        showAlert("Failed to send file");
                        setUploadProgress(null);
                        uploadTaskRef.current = null;
                        e.target.value = '';
                    }
                }
            );
        } catch (e) {
            console.error(e);
            showAlert("Error starting upload");
            setUploadProgress(null);
            uploadTaskRef.current = null;
            e.target.value = '';
        }
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
            <div style={{ zIndex: 50, background: 'rgba(15, 23, 42, 0.8)', padding: '0.75rem 1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.1)', backdropFilter: 'blur(10px)', flexShrink: 0, position: 'relative' }}>
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
                        <span style={{ color: 'white', fontWeight: 500 }}>{chatInfo?.name || "Chat"}</span>
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

            {/* Messages - Virtualized */}
            <div id="chat-box" style={{ flexGrow: 1, padding: '0 1rem' }}>
                <Virtuoso
                    key={chatId}
                    ref={virtuosoRef}
                    style={{ height: '100%' }}
                    data={messages}
                    initialTopMostItemIndex={Math.max(0, messages.length - 1)}
                    startReached={loadMoreMessages}
                    followOutput="auto"
                    alignToBottom
                    itemContent={(index, msg) => (
                        <MessageItem
                            key={msg.id}
                            msg={msg}
                            currentUser={currentUser}
                            chatInfo={chatInfo}
                            initiateReply={initiateReply}
                            addReaction={addReaction}
                            confirmDelete={confirmDelete}
                            initiateEdit={initiateEdit}
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
            <div id="input-area" style={{ position: 'relative' }}>
                {/* Voice Draft Preview (shown when returning to chat with saved recording) */}
                {voiceDraft && !isRecording && (
                    <div style={{ background: 'rgba(99, 102, 241, 0.1)', border: '1px solid rgba(99, 102, 241, 0.3)', borderRadius: '8px', padding: '12px', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                                <span style={{ color: '#6366f1', fontSize: '1.2rem' }}>🎤</span>
                                <span style={{ color: 'white', fontSize: '0.9rem', fontWeight: 500 }}>Saved Voice Message</span>
                                <span style={{ color: '#94a3b8', fontSize: '0.85rem' }}>({formatDuration(voiceDraft.duration)})</span>
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
                        <div className="reply-content"><strong>Replying to {replyTo.senderName}</strong><span>{replyTo.text}</span></div>
                        <div className="icon-btn" style={{ width: '24px', height: '24px' }} onClick={cancelReply}>
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                        </div>
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
                            <span style={{ fontSize: '1.1rem', fontWeight: 500, color: 'white', minWidth: '45px' }}>
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

                        <form onSubmit={sendMessage} style={{ flexGrow: 1, display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
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

        </div>
    );
}
