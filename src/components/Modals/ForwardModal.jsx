import { useState, useEffect } from 'react';
import { db } from '../../services/firebase';
import { collection, query, where, getDocs, orderBy, limit, doc, getDoc } from 'firebase/firestore';
import { useAuth } from '../../context/AuthContext';

export default function ForwardModal({ message, currentChatId, onClose, onForward }) {
    const { currentUser } = useAuth();
    const [chats, setChats] = useState([]);
    const [searchTerm, setSearchTerm] = useState("");
    const [loading, setLoading] = useState(true);
    const [selectedChats, setSelectedChats] = useState([]);

    // Fetch user's chats
    useEffect(() => {
        const fetchChats = async () => {
            try {
                const q = query(
                    collection(db, "chats"),
                    where("members", "array-contains", currentUser.uid),
                    orderBy("lastUpdate", "desc"),
                    limit(50)
                );
                const snapshot = await getDocs(q);

                const processed = await Promise.all(snapshot.docs.map(async (docSnap) => {
                    if (docSnap.id === currentChatId) return null;

                    const data = docSnap.data();
                    let name = "Chat";
                    let photo = "";

                    // Determine if it's a group based on member count or type
                    const isGroup = data.type === 'group' || (data.members && data.members.length > 2) || data.groupName;

                    if (!isGroup) {
                        // Private chat - get other user's info
                        const otherUserId = data.members?.find(m => m !== currentUser.uid);
                        if (otherUserId) {
                            try {
                                const userSnap = await getDoc(doc(db, "users", otherUserId));
                                if (userSnap.exists()) {
                                    const uData = userSnap.data();
                                    name = uData.name || uData.displayName || "User";
                                    photo = uData.photoURL || "";
                                }
                            } catch (err) {
                                console.warn("Failed to fetch user:", otherUserId);
                                name = "User";
                            }
                        }
                    } else {
                        // Group chat
                        name = data.groupName || "Group";
                        photo = data.groupPhoto || "";
                    }

                    return {
                        id: docSnap.id,
                        name,
                        photo,
                        isGroup,
                        lastMessage: data.lastMessage || ""
                    };
                }));

                setChats(processed.filter(c => c !== null));
            } catch (e) {
                console.error("Error fetching chats:", e);
            } finally {
                setLoading(false);
            }
        };

        fetchChats();
    }, [currentUser, currentChatId]);

    // Filter chats by search
    const filteredChats = chats.filter(chat =>
        chat.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Toggle chat selection
    const toggleSelect = (chat) => {
        setSelectedChats(prev => {
            const exists = prev.find(c => c.id === chat.id);
            if (exists) {
                return prev.filter(c => c.id !== chat.id);
            } else {
                return [...prev, chat];
            }
        });
    };

    // Check if chat is selected
    const isSelected = (chatId) => selectedChats.some(c => c.id === chatId);

    // Forward to all selected chats
    const handleForward = () => {
        if (selectedChats.length === 0) return;
        selectedChats.forEach(chat => {
            onForward(chat.id, chat.name);
        });
    };

    // Get message preview text
    const getMessagePreview = () => {
        if (message.type === 'text') return message.text?.slice(0, 50) + (message.text?.length > 50 ? '...' : '');
        if (message.type === 'image') return '🖼️ Image';
        if (message.type === 'audio') return '🎤 Voice Message';
        if (message.type === 'file') return `📎 ${message.fileName || 'File'}`;
        return 'Message';
    };

    return (
        <div className="modal-overlay">
            <div className="modal" style={{ maxWidth: '420px', padding: 0, overflow: 'hidden' }}>
                {/* Header */}
                <div style={{
                    padding: '1rem 1.25rem',
                    borderBottom: '1px solid rgba(255,255,255,0.1)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '1rem'
                }}>
                    <button
                        onClick={onClose}
                        style={{
                            background: 'none',
                            border: 'none',
                            color: 'white',
                            cursor: 'pointer',
                            padding: '4px'
                        }}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <line x1="19" y1="12" x2="5" y2="12"></line>
                            <polyline points="12 19 5 12 12 5"></polyline>
                        </svg>
                    </button>
                    <div>
                        <h3 style={{ color: 'white', margin: 0, fontSize: '1.1rem', fontWeight: 600 }}>
                            Forward to...
                        </h3>
                        {selectedChats.length > 0 && (
                            <div style={{ fontSize: '0.75rem', color: 'var(--primary)', marginTop: '2px' }}>
                                {selectedChats.length} selected
                            </div>
                        )}
                    </div>
                </div>

                {/* Search */}
                <div style={{ padding: '0.75rem 1rem' }}>
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        background: 'rgba(255,255,255,0.05)',
                        borderRadius: '24px',
                        padding: '0.5rem 1rem',
                        gap: '0.5rem'
                    }}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2">
                            <circle cx="11" cy="11" r="8"></circle>
                            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                        </svg>
                        <input
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            placeholder="Search chats..."
                            style={{
                                flex: 1,
                                background: 'none',
                                border: 'none',
                                color: 'white',
                                fontSize: '0.9rem',
                                outline: 'none'
                            }}
                        />
                    </div>
                </div>

                {/* Selected Chips */}
                {selectedChats.length > 0 && (
                    <div style={{
                        padding: '0 1rem 0.75rem',
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: '0.5rem'
                    }}>
                        {selectedChats.map(chat => (
                            <div
                                key={chat.id}
                                onClick={() => toggleSelect(chat)}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    background: 'var(--primary)',
                                    padding: '4px 10px 4px 4px',
                                    borderRadius: '16px',
                                    cursor: 'pointer',
                                    fontSize: '0.8rem',
                                    color: 'white'
                                }}
                            >
                                <img
                                    src={chat.photo || `https://ui-avatars.com/api/?name=${encodeURIComponent(chat.name)}&background=4f46e5&color=fff&size=24`}
                                    alt=""
                                    style={{ width: '24px', height: '24px', borderRadius: '50%' }}
                                />
                                {chat.name.length > 12 ? chat.name.slice(0, 12) + '...' : chat.name}
                                <span style={{ marginLeft: '2px', opacity: 0.7 }}>×</span>
                            </div>
                        ))}
                    </div>
                )}

                {/* Chat List */}
                <div style={{
                    height: '300px',
                    overflowY: 'auto',
                    borderTop: '1px solid rgba(255,255,255,0.05)'
                }}>
                    {loading && (
                        <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--gray)' }}>
                            <div className="spinner" style={{
                                width: '24px', height: '24px',
                                border: '3px solid rgba(255,255,255,0.1)',
                                borderTopColor: 'var(--primary)',
                                borderRadius: '50%',
                                animation: 'spin 1s linear infinite',
                                margin: '0 auto 10px'
                            }}></div>
                            Loading...
                        </div>
                    )}

                    {!loading && filteredChats.length === 0 && (
                        <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--gray)' }}>
                            {searchTerm ? 'No chats found' : 'No chats available'}
                        </div>
                    )}

                    {filteredChats.map(chat => (
                        <div
                            key={chat.id}
                            onClick={() => toggleSelect(chat)}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                padding: '0.75rem 1rem',
                                cursor: 'pointer',
                                transition: 'background 0.15s',
                                background: isSelected(chat.id) ? 'rgba(99, 102, 241, 0.15)' : 'transparent'
                            }}
                            onMouseEnter={e => {
                                if (!isSelected(chat.id)) {
                                    e.currentTarget.style.background = 'rgba(255,255,255,0.03)';
                                }
                            }}
                            onMouseLeave={e => {
                                e.currentTarget.style.background = isSelected(chat.id) ? 'rgba(99, 102, 241, 0.15)' : 'transparent';
                            }}
                        >
                            {/* Checkbox */}
                            <div style={{
                                width: '20px',
                                height: '20px',
                                borderRadius: '50%',
                                border: isSelected(chat.id) ? 'none' : '2px solid rgba(255,255,255,0.3)',
                                background: isSelected(chat.id) ? 'var(--primary)' : 'transparent',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                marginRight: '0.75rem',
                                transition: 'all 0.15s'
                            }}>
                                {isSelected(chat.id) && (
                                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
                                        <polyline points="20 6 9 17 4 12"></polyline>
                                    </svg>
                                )}
                            </div>

                            {/* Avatar */}
                            <img
                                src={chat.photo || `https://ui-avatars.com/api/?name=${encodeURIComponent(chat.name)}&background=6366f1&color=fff`}
                                alt=""
                                style={{ width: '45px', height: '45px', borderRadius: '50%', marginRight: '0.75rem', objectFit: 'cover' }}
                            />

                            {/* Info */}
                            <div style={{ flex: 1, overflow: 'hidden' }}>
                                <div style={{ color: 'white', fontWeight: 500, fontSize: '0.95rem' }}>{chat.name}</div>
                                <div style={{
                                    color: 'var(--gray)',
                                    fontSize: '0.8rem',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap'
                                }}>
                                    {chat.isGroup ? '👥 Group' : chat.lastMessage || 'Chat'}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Footer with Forward Button */}
                <div style={{
                    padding: '1rem',
                    borderTop: '1px solid rgba(255,255,255,0.1)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem'
                }}>
                    {/* Message Preview */}
                    <div style={{
                        flex: 1,
                        background: 'rgba(255,255,255,0.05)',
                        borderRadius: '8px',
                        padding: '0.5rem 0.75rem',
                        fontSize: '0.8rem',
                        color: '#94a3b8',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                    }}>
                        {getMessagePreview()}
                    </div>

                    {/* Forward Button */}
                    <button
                        onClick={handleForward}
                        disabled={selectedChats.length === 0}
                        style={{
                            background: selectedChats.length > 0 ? 'var(--primary)' : 'rgba(255,255,255,0.1)',
                            border: 'none',
                            borderRadius: '50%',
                            width: '48px',
                            height: '48px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: selectedChats.length > 0 ? 'pointer' : 'not-allowed',
                            transition: 'all 0.2s',
                            opacity: selectedChats.length > 0 ? 1 : 0.5
                        }}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                            <line x1="22" y1="2" x2="11" y2="13"></line>
                            <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                        </svg>
                    </button>
                </div>
            </div>
        </div>
    );
}
