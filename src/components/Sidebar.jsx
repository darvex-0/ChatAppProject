import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { collection, query, where, orderBy, onSnapshot, doc, getDoc, updateDoc, arrayUnion, arrayRemove, deleteDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../context/AuthContext';
import { useUI } from '../context/UIContext';
import { useCall } from '../context/CallContext';
import CallLogItem from './CallLogItem';
import NotesSection from './NotesSection';
import StoriesBar from './StoriesBar';

// Helper Component for Real-Time Online Status AND Profile Data
function OnlineIndicator({ userId, onProfileUpdate }) {
    const [isOnline, setIsOnline] = useState(false);

    useEffect(() => {
        if (!userId) return;
        const unsub = onSnapshot(doc(db, "users", userId), (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                // Check both fields to be robust
                setIsOnline(data.online === true || data.state === 'online');
                // Notify parent of profile updates
                if (onProfileUpdate) {
                    onProfileUpdate(userId, {
                        name: data.name || data.displayName || data.username || data.email?.split('@')[0] || "User",
                        photo: data.photoURL || data.profilePic || null
                    });
                }
            }
        });
        return () => unsub();
    }, [userId, onProfileUpdate]);

    if (!isOnline) return null;
    return <span className="online-dot" style={{ marginRight: '5px' }}></span>;
}

export default function Sidebar() {
    const { currentUser } = useAuth();
    const { searchQuery, setSearchQuery, notificationPermission, requestNotificationPermission, notificationSettings } = useUI();
    const { callHistory, callUser, setCallInfoContact } = useCall();
    const [chats, setChats] = useState([]);
    const navigate = useNavigate();
    const { chatId } = useParams(); // Get currently active chat
    const [activeTab, setActiveTab] = useState('chats'); // 'chats' | 'calls' | 'notes'
    const userCache = useRef({});

    // Helper: Supress unread count for the currently open chat
    const getUnreadCount = useCallback((chat) => {
        if (chat.id === chatId) return 0; // Don't show unread count if we are currently looking at it
        return chat.unreadCounts?.[currentUser.uid] || 0;
    }, [chatId, currentUser.uid]);

    // PWA Install Prompt State
    const [deferredPrompt, setDeferredPrompt] = useState(null);
    const [showInstallButton, setShowInstallButton] = useState(false);

    // Handler for real-time profile updates
    const handleProfileUpdate = useCallback((userId, profileData) => {
        setChats(prevChats => prevChats.map(chat => {
            if (chat.friendId === userId) {
                return {
                    ...chat,
                    displayName: profileData.name,
                    displayPic: profileData.photo
                };
            }
            return chat;
        }));
    }, []);

    // Notification Logic (Sound & Desktop)
    const prevUnreadCountsRef = useRef({});
    const isFirstLoadRef = useRef(true);
    const audioRef = useRef(new Audio("https://upload.wikimedia.org/wikipedia/commons/3/34/Sound_Effect_-_Pop_01.ogg")); // Reliable "Pop" sound

    useEffect(() => {
        if (!chats.length) return;

        const currentUnreadCounts = {};
        let hasNewUnread = false;
        let lastNewMessage = null;

        chats.forEach(chat => {
            const count = getUnreadCount(chat);
            currentUnreadCounts[chat.id] = count;

            // Check if unread count increased
            const prevCount = prevUnreadCountsRef.current[chat.id] || 0;
            if (count > prevCount) {
                // Only trigger notification if NOT archived and NOT currently active
                if (!chat.isArchived) {
                    hasNewUnread = true;
                    lastNewMessage = chat;
                }
            }
        });

        // Skip notification on first load
        if (isFirstLoadRef.current) {
            prevUnreadCountsRef.current = currentUnreadCounts;
            isFirstLoadRef.current = false;
            return;
        }

        // Trigger Notification if new unread
        if (hasNewUnread) {
            // 1. Play Sound
            if (notificationSettings?.sound) {
                audioRef.current.currentTime = 0;
                audioRef.current.play().catch(e => console.error("Error playing sound:", e));
            }

            // 2. Desktop Notification
            if (notificationSettings?.desktop && notificationPermission === 'granted') {
                const title = `New message from ${lastNewMessage.displayName}`;
                const options = {
                    body: notificationSettings?.preview ? (lastNewMessage.lastMessage || "Sent a photo") : "New message received",
                    icon: '/icon-192.png', // Ensure this exists public folder
                    badge: '/icon-192.png'
                };
                new Notification(title, options);
            }
        }

        // Update ref
        prevUnreadCountsRef.current = currentUnreadCounts;

    }, [chats, currentUser.uid, notificationPermission, notificationSettings]);

    // PWA Install Prompt Listener
    useEffect(() => {
        const handler = (e) => {
            e.preventDefault();
            setDeferredPrompt(e);
            setShowInstallButton(true);
        };

        window.addEventListener('beforeinstallprompt', handler);

        // Hide button if already installed
        window.addEventListener('appinstalled', () => {
            setShowInstallButton(false);
            setDeferredPrompt(null);
        });

        return () => {
            window.removeEventListener('beforeinstallprompt', handler);
        };
    }, []);

    const handleInstallClick = async () => {
        if (!deferredPrompt) return;

        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;

        if (outcome === 'accepted') {
            setShowInstallButton(false);
        }

        setDeferredPrompt(null);
    };

    // Archive / Unarchive Logic
    const [showArchived, setShowArchived] = useState(false);

    useEffect(() => {
        if (!currentUser) return;

        const q = query(
            collection(db, "chats"),
            where("members", "array-contains", currentUser.uid),
            orderBy("lastUpdate", "desc")
        );

        const unsubscribe = onSnapshot(q, async (snapshot) => {
            const chatsProms = snapshot.docs.map(async (docSnapshot) => {
                const data = docSnapshot.data();
                let chatName = "Chat";
                let chatPic = "";
                let friendId = null;

                // Archive Status Check (Don't filter here, just tag)
                const isArchived = data.archivedBy && data.archivedBy.includes(currentUser.uid);

                const isGroup = data.type === 'group' || !!data.groupName || (data.members && data.members.length > 2);
                if (isGroup) {
                    chatName = data.groupName || "Group";
                    chatPic = data.groupImage;
                } else {
                    friendId = data.members?.find(id => id !== currentUser.uid) || null;
                    if (friendId) {
                        try {
                            if (userCache.current[friendId]) {
                                const cached = userCache.current[friendId];
                                chatName = cached.name;
                                chatPic = cached.photo;
                            } else {
                                const userRef = doc(db, "users", friendId);
                                const userSnap = await getDoc(userRef);
                                if (userSnap.exists()) {
                                    const userData = userSnap.data();
                                    chatName = userData.name || userData.displayName || userData.username || userData.email?.split('@')[0] || "User";
                                    chatPic = userData.photoURL || userData.profilePic || null;
                                    userCache.current[friendId] = { name: chatName, photo: chatPic };
                                } else {
                                    chatName = "User";
                                }
                            }
                        } catch (e) {
                            chatName = "User";
                        }
                    } else {
                        chatName = "Me";
                    }
                }

                return {
                    id: docSnapshot.id,
                    ...data,
                    type: isGroup ? 'group' : (data.type || 'direct'),
                    displayName: chatName,
                    displayPic: chatPic,
                    friendId,
                    isArchived // Pass archive status
                };
            });

            const resolvedChatsList = (await Promise.all(chatsProms)).filter(c => c !== null);

            // Smart Deduplication Logic
            const chatsByFriend = new Map();
            const groupChats = [];

            resolvedChatsList.forEach(chat => {
                if (chat.type === 'group') {
                    groupChats.push(chat);
                } else if (chat.friendId) {
                    if (!chatsByFriend.has(chat.friendId)) {
                        chatsByFriend.set(chat.friendId, chat);
                    } else {
                        const existing = chatsByFriend.get(chat.friendId);

                        // Check for actual content (not "Started a new chat")
                        const hasContent = (c) => c.lastMessage && c.lastMessage !== "Started a new chat";
                        const currentHasContent = hasContent(chat);
                        const existingHasContent = hasContent(existing);

                        if (currentHasContent && !existingHasContent) {
                            // Current has content, existing doesn't -> Replace
                            chatsByFriend.set(chat.friendId, chat);
                        } else if (currentHasContent === existingHasContent) {
                            // Both have content OR both are empty -> Keep newer
                            const timeCurrent = chat.lastUpdate?.seconds || 0;
                            const timeExisting = existing.lastUpdate?.seconds || 0;
                            if (timeCurrent > timeExisting) {
                                chatsByFriend.set(chat.friendId, chat);
                            }
                        }
                        // Else: Existing has content, current doesn't -> Keep existing (do nothing)
                    }
                } else {
                    // Fallback for self/unknown
                    groupChats.push(chat);
                }
            });

            // Combine and sort by time
            const uniqueChats = [...groupChats, ...chatsByFriend.values()].sort((a, b) => {
                // Fix for jumping: If lastUpdate is null (pending write), treat as NOW
                const timeA = a.lastUpdate ? a.lastUpdate.seconds : Date.now() / 1000;
                const timeB = b.lastUpdate ? b.lastUpdate.seconds : Date.now() / 1000;
                return timeB - timeA;
            });

            setChats(uniqueChats);
        });

        return () => unsubscribe();
    }, [currentUser]);

    const archiveChat = async (e, chatId) => {
        e.stopPropagation();
        try {
            await updateDoc(doc(db, "chats", chatId), {
                archivedBy: arrayUnion(currentUser.uid)
            });
        } catch (e) {
            console.error("Error archiving", e);
        }
    };

    const unarchiveChat = async (e, chatId) => {
        e.stopPropagation();
        try {
            await updateDoc(doc(db, "chats", chatId), {
                archivedBy: arrayRemove(currentUser.uid)
            });
        } catch (e) {
            console.error("Error unarchiving", e);
        }
    };

    const filteredChats = chats.filter(chat => {
        const matchesSearch = (chat.displayName || 'Chat').toLowerCase().includes(searchQuery.toLowerCase());
        const matchesArchiveStatus = showArchived ? chat.isArchived : !chat.isArchived;
        return matchesSearch && matchesArchiveStatus;
    });

    // Filter call history by search
    const filteredCallHistory = callHistory.filter(log => {
        if (!searchQuery) return true;
        const isCaller = log.callerId === currentUser.uid;
        const name = isCaller ? log.receiverName : log.callerName;
        return name?.toLowerCase().includes(searchQuery.toLowerCase());
    });

    const handleCallLogClick = (log) => {
        const isCaller = log.callerId === currentUser.uid;
        const friendId = isCaller ? log.receiverId : log.callerId;
        const friendName = isCaller ? log.receiverName : log.callerName;
        const friendPhoto = isCaller ? log.receiverPhoto : log.callerPhoto;

        // Find existing chat to pass chatId (avoid fetch if possible)
        const chat = chats.find(c => c.type !== 'group' && c.members && c.members.includes(friendId));

        setCallInfoContact({
            uid: friendId,
            name: friendName,
            photo: friendPhoto,
            chatId: chat?.id
        });
    };

    const handleDeleteCallLog = async (logId) => {
        try {
            await deleteDoc(doc(db, "callLogs", logId));
        } catch (error) {
            console.error("Error deleting call log:", error);
            alert("Failed to delete call log");
        }
    };

    return (
        <div id="inbox">
            <div className="inbox-header" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '0.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                    <h2 className="inbox-title">
                        {showArchived ? (
                            <>
                                <span
                                    onClick={() => setShowArchived(false)}
                                    style={{ cursor: 'pointer', marginRight: '0.5rem', display: 'inline-flex', alignItems: 'center' }}
                                    title="Back to Inbox"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
                                </span>
                                Archived Chats
                            </>
                        ) : activeTab === 'calls' ? (
                            <>
                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>
                                Call History
                            </>
                        ) : activeTab === 'notes' ? (
                            <>
                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                                My Notes
                            </>
                        ) : (
                            <>
                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
                                Your Conversations
                            </>
                        )}
                    </h2>

                    {!showArchived && activeTab === 'chats' && (
                        <button
                            onClick={() => setShowArchived(true)}
                            style={{ background: 'transparent', border: 'none', color: 'var(--app-text-muted)', cursor: 'pointer', padding: '0.2rem', position: 'relative' }}
                            title="View Archived Chats"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="21 8 21 21 3 21 3 8"></polyline><rect x="1" y="3" width="22" height="5"></rect><line x1="10" y1="12" x2="14" y2="12"></line></svg>
                            {chats.filter(c => c.isArchived).reduce((acc, c) => acc + getUnreadCount(c), 0) > 0 && (
                                <span style={{
                                    position: 'absolute',
                                    top: '-5px',
                                    right: '-5px',
                                    background: 'var(--danger)',
                                    color: 'white',
                                    fontSize: '0.6rem',
                                    width: '16px',
                                    height: '16px',
                                    borderRadius: '50%',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontWeight: 'bold'
                                }}>
                                    {chats.filter(c => c.isArchived).reduce((acc, c) => acc + getUnreadCount(c), 0)}
                                </span>
                            )}
                        </button>
                    )}
                </div>

                {/* Tab Switcher */}
                {!showArchived && (
                    <div className="sidebar-tabs">
                        <button
                            className={`sidebar-tab ${activeTab === 'chats' ? 'active' : ''}`}
                            onClick={() => setActiveTab('chats')}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
                            Chats
                        </button>
                        <button
                            className={`sidebar-tab ${activeTab === 'calls' ? 'active' : ''}`}
                            onClick={() => setActiveTab('calls')}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>
                            Calls
                        </button>
                        <button
                            className={`sidebar-tab ${activeTab === 'notes' ? 'active' : ''}`}
                            onClick={() => setActiveTab('notes')}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                            Notes
                        </button>
                    </div>
                )}

                <div style={{ width: '100%', marginBottom: '0.5rem' }}>
                    <input
                        className="search-input-legacy"
                        type="text"
                        placeholder={showArchived ? "Search archived chats..." : activeTab === 'calls' ? "Search call history..." : activeTab === 'notes' ? "Search notes..." : "Filter your inbox..."}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        style={{
                            width: '100%',
                            padding: '0.6rem 1rem',
                            borderRadius: '8px',
                            border: '1px solid var(--border-color)',
                            background: 'var(--input-bg)',
                            color: 'var(--app-text)',
                            fontSize: '0.9rem',
                            outline: 'none',
                            transition: 'all 0.2s'
                        }}
                        onFocus={(e) => e.target.style.borderColor = 'var(--primary)'}
                        onBlur={(e) => e.target.style.borderColor = 'var(--border-color)'}
                    />
                </div>

                {/* Stories Bar - only on chats tab, not in archive view */}
                {!showArchived && activeTab === 'chats' && (
                    <StoriesBar
                        friendIds={chats.filter(c => !c.isArchived && c.friendId).map(c => c.friendId)}
                    />
                )}

                {/* PWA Install Button & Other Alerts */}
                {!showArchived && activeTab === 'chats' && showInstallButton && (
                    <div
                        onClick={handleInstallClick}
                        style={{
                            width: '100%',
                            background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.1), rgba(139, 92, 246, 0.1))',
                            border: '1px solid rgba(99, 102, 241, 0.3)',
                            color: '#818cf8',
                            padding: '0.6rem',
                            borderRadius: '8px',
                            fontSize: '0.8rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '0.5rem',
                            transition: 'all 0.2s'
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.background = 'linear-gradient(135deg, rgba(99, 102, 241, 0.2), rgba(139, 92, 246, 0.2))';
                            e.currentTarget.style.transform = 'scale(1.02)';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'linear-gradient(135deg, rgba(99, 102, 241, 0.1), rgba(139, 92, 246, 0.1))';
                            e.currentTarget.style.transform = 'scale(1)';
                        }}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="7.5 4.21 12 6.81 16.5 4.21"></polyline><polyline points="7.5 19.79 7.5 14.6 3 12"></polyline><polyline points="21 12 16.5 14.6 16.5 19.79"></polyline><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>
                        📱 Install App
                    </div>
                )}

                {!showArchived && activeTab === 'chats' && notificationPermission === 'default' && (
                    <div
                        onClick={() => requestNotificationPermission()}
                        style={{
                            width: '100%',
                            background: 'rgba(16, 185, 129, 0.1)',
                            border: '1px solid rgba(16, 185, 129, 0.3)',
                            color: '#34d399',
                            padding: '0.5rem',
                            borderRadius: '8px',
                            fontSize: '0.75rem',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem'
                        }}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>
                        Enable Notifications
                    </div>
                )}
            </div>

            <div id="chatList">
                {/* CALLS TAB */}
                {activeTab === 'calls' && !showArchived ? (
                    <>
                        {filteredCallHistory.length === 0 ? (
                            <div className="empty-state" style={{ display: 'block' }}>
                                <div style={{ fontSize: '3rem' }}>📞</div>
                                <p>{searchQuery ? 'No calls match your search' : 'No call history yet'}</p>
                                <p style={{ fontSize: '0.8rem', color: 'var(--app-text-muted)' }}>Your calls will appear here</p>
                            </div>
                        ) : (
                            filteredCallHistory.map(log => (
                                <CallLogItem
                                    key={log.id}
                                    log={log}
                                    onClick={() => handleCallLogClick(log)}
                                    onDelete={handleDeleteCallLog}
                                />
                            ))
                        )}
                    </>
                ) : activeTab === 'notes' ? (
                    /* NOTES TAB */
                    <NotesSection />
                ) : (
                    /* CHATS TAB */
                    <>
                        {filteredChats.length === 0 && (
                            <div className="empty-state" style={{ display: 'block' }}>
                                <div style={{ fontSize: '3rem' }}>
                                    {showArchived ? '🗃️' : '💭'}
                                </div>
                                <p>{showArchived ? "No archived chats" : "No conversations found"}</p>
                                {searchQuery && <p style={{ fontSize: '0.8rem' }}>Try a different search</p>}
                            </div>
                        )}
                        {filteredChats.map(chat => (
                            <div
                                key={chat.id}
                                onClick={() => navigate(`/c/${chat.id}`)}
                                className="chat-item"
                            >
                                {chat.displayPic ? (
                                    <img src={chat.displayPic} alt="" className="profile-pic" />
                                ) : (
                                    <div className="profile-pic" style={{ background: 'var(--input-bg)', color: 'var(--app-text)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.25rem' }}>
                                        {chat.type === 'group' ? '👥' : '👤'}
                                    </div>
                                )}

                                <div className="chat-item-details">
                                    <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                                        <strong>
                                            {chat.type !== 'group' && chat.friendId ? (
                                                <OnlineIndicator userId={chat.friendId} onProfileUpdate={handleProfileUpdate} />
                                            ) : chat.displayName === 'Me' ? (
                                                <span className="online-dot" style={{ marginRight: '5px' }}></span>
                                            ) : null}
                                            {chat.displayName}
                                        </strong>
                                        {getUnreadCount(chat) > 0 && (
                                            <span style={{
                                                background: 'var(--danger)',
                                                color: 'white',
                                                borderRadius: '50%',
                                                width: '20px',
                                                height: '20px',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                fontSize: '0.75rem',
                                                fontWeight: 'bold',
                                                marginLeft: 'auto'
                                            }}>
                                                {getUnreadCount(chat)}
                                            </span>
                                        )}
                                    </div>
                                    <small style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                        {chat.lastMessage || "No messages yet"}
                                        <span className="time-badge">
                                            {chat.lastUpdate?.seconds ? new Date(chat.lastUpdate.seconds * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                                        </span>
                                    </small>
                                </div>

                                {showArchived ? (
                                    <div className="archive-btn" onClick={(e) => unarchiveChat(e, chat.id)} title="Unarchive Chat" style={{ color: 'var(--primary)' }}>
                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                                    </div>
                                ) : (
                                    <div className="archive-btn" onClick={(e) => archiveChat(e, chat.id)} title="Archive Chat">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 8v13H3V8" /><rect x="1" y="3" width="22" height="5" /><line x1="10" y1="12" x2="14" y2="12" /></svg>
                                    </div>
                                )}
                            </div>
                        ))}
                    </>
                )}
            </div>
        </div>
    );
}
