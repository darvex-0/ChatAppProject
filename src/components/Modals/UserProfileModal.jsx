import { useState, useEffect } from 'react';
import { db } from '../../services/firebase';
import { doc, getDoc, collection, query, where, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';

export default function UserProfileModal({ userId, username, onClose }) {
    const { currentUser } = useAuth();
    const navigate = useNavigate();
    const [userData, setUserData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [coverExpanded, setCoverExpanded] = useState(false);
    const [mutualGroups, setMutualGroups] = useState([]);

    useEffect(() => {
        const fetchUser = async () => {
            setLoading(true);
            try {
                // 1. If we have a direct uid — use it immediately (fastest & most reliable)
                if (userId) {
                    const userSnap = await getDoc(doc(db, 'users', userId));
                    if (userSnap.exists()) {
                        setUserData({ uid: userId, ...userSnap.data() });
                    } else {
                        setUserData(null);
                    }
                } else if (username) {
                    // 2. No uid — try to match by normalized name (handles space-stripped handles)
                    const normalizedHandle = username.toLowerCase().replace(/\s+/g, '');

                    // First try exact name match
                    const exactQ = query(collection(db, 'users'), where('name', '==', username));
                    const exactSnap = await getDocs(exactQ);

                    if (!exactSnap.empty) {
                        const d = exactSnap.docs[0];
                        setUserData({ uid: d.id, ...d.data() });
                    } else {
                        // Fallback: fetch up to 100 users and normalize-match client-side
                        // (This is only needed for legacy messages without mentionMap)
                        const allSnap = await getDocs(collection(db, 'users'));
                        let found = null;
                        allSnap.forEach(d => {
                            const name = d.data().name || '';
                            if (name.toLowerCase().replace(/\s+/g, '') === normalizedHandle) {
                                found = { uid: d.id, ...d.data() };
                            }
                        });
                        setUserData(found);
                    }
                } else {
                    setUserData(null);
                    setLoading(false);
                    return;
                }

                // Fetch mutual groups (using userId if available, else re-derive from userData)
                const targetUid = userId || (userData?.uid);
                if (targetUid) {
                    const chatsQuery = query(
                        collection(db, 'chats'),
                        where('type', '==', 'group'),
                        where('members', 'array-contains', currentUser.uid)
                    );
                    const chatsSnap = await getDocs(chatsQuery);
                    const mutual = [];
                    chatsSnap.forEach(chatDoc => {
                        const data = chatDoc.data();
                        if (data.members?.includes(targetUid)) {
                            mutual.push({ id: chatDoc.id, ...data });
                        }
                    });
                    setMutualGroups(mutual);
                }
            } catch (e) {
                console.error('Error fetching user profile:', e);
            } finally {
                setLoading(false);
            }
        };

        fetchUser();
    }, [userId, username, currentUser.uid]);

    const handleMessageUser = async () => {
        if (!userData?.uid) return;
        try {
            // Check if a DM already exists
            const q = query(
                collection(db, 'chats'),
                where('type', '==', 'dm'),
                where('members', 'array-contains', currentUser.uid)
            );
            const snap = await getDocs(q);
            let existingChatId = null;
            snap.forEach(chatDoc => {
                const data = chatDoc.data();
                if (data.members?.includes(userData.uid)) {
                    existingChatId = chatDoc.id;
                }
            });

            let chatId;
            if (existingChatId) {
                chatId = existingChatId;
            } else {
                // Create new DM
                const newChat = await addDoc(collection(db, 'chats'), {
                    type: 'dm',
                    members: [currentUser.uid, userData.uid],
                    createdAt: serverTimestamp(),
                    lastMessage: '',
                    lastMessageTime: serverTimestamp()
                });
                chatId = newChat.id;
            }

            onClose();
            // Route is defined as /c/:chatId in App.jsx
            navigate(`/c/${chatId}`);
        } catch (e) {
            console.error('Error navigating to DM:', e);
        }
    };

    const joinedDate = userData?.createdAt
        ? new Date(userData.createdAt?.toDate ? userData.createdAt.toDate() : userData.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
        : null;

    const isMe = userData?.uid === currentUser.uid;

    return (
        <div className="upm-backdrop" onClick={onClose}>
            <div className="upm-modal" onClick={e => e.stopPropagation()}>
                {/* Close Button */}
                <button className="upm-close" onClick={onClose}>✕</button>

                {loading ? (
                    <div className="upm-loading">
                        <div className="upm-spinner" />
                        <span>Loading profile…</span>
                    </div>
                ) : !userData ? (
                    <div className="upm-not-found">
                        <span style={{ fontSize: '3rem' }}>👻</span>
                        <p>User not found</p>
                        <span style={{ fontSize: '0.85rem', opacity: 0.6 }}>This account may no longer exist</span>
                    </div>
                ) : (
                    <>
                        {/* Cover / Avatar Section */}
                        <div className="upm-cover">
                            <div className="upm-cover-bg" />
                            {/* Soft fade from cover gradient into dark modal body */}
                            <div style={{
                                position: 'absolute',
                                bottom: 0,
                                left: 0,
                                right: 0,
                                height: '60px',
                                background: 'linear-gradient(to bottom, transparent, var(--bg-secondary, #1e293b))',
                                zIndex: 1
                            }} />
                            <div
                                className={`upm-avatar-wrap ${coverExpanded ? 'expanded' : ''}`}
                                onClick={() => setCoverExpanded(v => !v)}
                                title="Click to expand"
                            >
                                <img
                                    src={userData.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(userData.name || 'U')}&background=6366f1&color=fff&size=128`}
                                    alt={userData.name}
                                    className="upm-avatar"
                                />
                            </div>
                        </div>

                        {/* Info */}
                        <div className="upm-info">
                            <h2 className="upm-name">{userData.name || 'Unknown User'}</h2>
                            <p className="upm-handle">@{(userData.name || 'user').replace(/\s+/g, '').toLowerCase()}</p>

                            {userData.status && (
                                <div className="upm-online-badge">
                                    <span className={`upm-dot ${userData.status === 'online' ? 'online' : 'offline'}`} />
                                    <span>{userData.status === 'online' ? 'Online' : 'Last seen recently'}</span>
                                </div>
                            )}

                            {userData.about && (
                                <div className="upm-about">
                                    <span className="upm-section-label">About</span>
                                    <p>{userData.about}</p>
                                </div>
                            )}

                            {userData.bio && !userData.about && (
                                <div className="upm-about">
                                    <span className="upm-section-label">Bio</span>
                                    <p>{userData.bio}</p>
                                </div>
                            )}

                            <div className="upm-meta-row">
                                {userData.email && (
                                    <div className="upm-meta-item">
                                        <span className="upm-meta-icon">✉️</span>
                                        <span>{userData.email}</span>
                                    </div>
                                )}
                                {joinedDate && (
                                    <div className="upm-meta-item">
                                        <span className="upm-meta-icon">📅</span>
                                        <span>Joined {joinedDate}</span>
                                    </div>
                                )}
                                {userData.phone && (
                                    <div className="upm-meta-item">
                                        <span className="upm-meta-icon">📞</span>
                                        <span>{userData.phone}</span>
                                    </div>
                                )}
                            </div>

                            {/* Mutual Groups */}
                            {mutualGroups.length > 0 && (
                                <div className="upm-groups">
                                    <span className="upm-section-label">{mutualGroups.length} Group{mutualGroups.length > 1 ? 's' : ''} in Common</span>
                                    <div className="upm-groups-list">
                                        {mutualGroups.slice(0, 3).map(g => (
                                            <div key={g.id} className="upm-group-chip">
                                                <img
                                                    src={g.groupImage || `https://ui-avatars.com/api/?name=${encodeURIComponent(g.name || 'G')}&background=8b5cf6&color=fff`}
                                                    alt={g.name}
                                                />
                                                <span>{g.name}</span>
                                            </div>
                                        ))}
                                        {mutualGroups.length > 3 && (
                                            <span className="upm-more-groups">+{mutualGroups.length - 3} more</span>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Actions */}
                            <div className="upm-actions">
                                {!isMe && (
                                    <button className="upm-btn-primary" onClick={handleMessageUser}>
                                        💬 Message
                                    </button>
                                )}
                                {isMe && (
                                    <p className="upm-self-note">This is your profile</p>
                                )}
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
