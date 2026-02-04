import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, query, where, orderBy, onSnapshot, doc, getDoc, updateDoc, arrayUnion } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../context/AuthContext';
import { useUI } from '../context/UIContext';

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
                        name: data.name || data.email || "User",
                        photo: data.photoURL
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
    const [chats, setChats] = useState([]);
    const navigate = useNavigate();
    const userCache = useRef({});

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
            const count = chat.unreadCounts?.[currentUser.uid] || 0;
            currentUnreadCounts[chat.id] = count;

            // Check if unread count increased
            const prevCount = prevUnreadCountsRef.current[chat.id] || 0;
            if (count > prevCount) {
                hasNewUnread = true;
                lastNewMessage = chat;
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

                // Archive Check
                if (data.archivedBy && data.archivedBy.includes(currentUser.uid)) {
                    return null;
                }

                if (data.type === 'group') {
                    chatName = data.groupName;
                    chatPic = data.groupImage;
                } else {
                    friendId = data.members.find(id => id !== currentUser.uid);
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
                                    chatName = userData.name || userData.email || "User";
                                    chatPic = userData.photoURL;
                                    userCache.current[friendId] = { name: chatName, photo: chatPic };
                                } else {
                                    chatName = "Unknown User";
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
                    displayName: chatName,
                    displayPic: chatPic,
                    friendId // Pass friendId for the indicator
                };
            });

            const resolvedChats = (await Promise.all(chatsProms)).filter(c => c !== null);
            setChats(resolvedChats);
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

    const filteredChats = chats.filter(chat =>
        chat.displayName.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div id="inbox">
            <div className="inbox-header" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '0.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                    <h2 className="inbox-title">
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
                        Your Conversations
                    </h2>
                </div>

                <div style={{ width: '100%', marginBottom: '1rem', marginTop: '0.5rem' }}>
                    <input
                        className="search-input-legacy"
                        type="text"
                        placeholder="Filter your inbox..."
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

                {/* PWA Install Button */}
                {showInstallButton && (
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

                {notificationPermission === 'default' && (
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
                {filteredChats.length === 0 && (
                    <div className="empty-state" style={{ display: 'block' }}>
                        <div style={{ fontSize: '3rem' }}>💭</div>
                        <p>No conversations found</p>
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
                                    {/* Real-time Online Indicator */}
                                    {chat.type !== 'group' && chat.friendId ? (
                                        <OnlineIndicator userId={chat.friendId} onProfileUpdate={handleProfileUpdate} />
                                    ) : chat.displayName === 'Me' ? (
                                        <span className="online-dot" style={{ marginRight: '5px' }}></span>
                                    ) : null}

                                    {chat.displayName}
                                </strong>
                                {chat.unreadCounts?.[currentUser.uid] > 0 && (
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
                                        {chat.unreadCounts[currentUser.uid]}
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

                        <div className="archive-btn" onClick={(e) => archiveChat(e, chat.id)} title="Archive Chat">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 8v13H3V8" /><rect x="1" y="3" width="22" height="5" /><line x1="10" y1="12" x2="14" y2="12" /></svg>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
