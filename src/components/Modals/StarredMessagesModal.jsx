import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../../services/firebase';
import { collection, query, orderBy, onSnapshot, deleteDoc, doc } from 'firebase/firestore';
import { useAuth } from '../../context/AuthContext';

export default function StarredMessagesModal({ onClose }) {
    const { currentUser } = useAuth();
    const navigate = useNavigate();
    const [starredMessages, setStarredMessages] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!currentUser) return;

        const starredRef = collection(db, "users", currentUser.uid, "starredMessages");
        const q = query(starredRef, orderBy("starredAt", "desc"));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const messages = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setStarredMessages(messages);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [currentUser]);

    const unstarMessage = async (messageId) => {
        try {
            await deleteDoc(doc(db, "users", currentUser.uid, "starredMessages", messageId));
        } catch (e) {
            console.error("Error unstarring:", e);
        }
    };

    const navigateToMessage = (msg) => {
        onClose();
        navigate(`/c/${msg.chatId}`, { state: { highlightMessageId: msg.messageId } });
    };

    const formatDate = (timestamp) => {
        if (!timestamp) return '';
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: date.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined
        });
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div
                className="modal"
                onClick={e => e.stopPropagation()}
                style={{
                    maxWidth: '450px',
                    maxHeight: '80vh',
                    display: 'flex',
                    flexDirection: 'column'
                }}
            >
                {/* Header */}
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: '1rem',
                    paddingBottom: '0.75rem',
                    borderBottom: '1px solid rgba(255,255,255,0.1)'
                }}>
                    <h3 style={{
                        color: 'white',
                        fontSize: '1.25rem',
                        fontWeight: 600,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem'
                    }}>
                        ⭐ Starred Messages
                    </h3>
                    <button
                        onClick={onClose}
                        style={{
                            background: 'transparent',
                            border: 'none',
                            color: '#94a3b8',
                            fontSize: '1.5rem',
                            cursor: 'pointer',
                            padding: '0.25rem'
                        }}
                    >
                        ×
                    </button>
                </div>

                {/* Content */}
                <div style={{
                    flex: 1,
                    overflowY: 'auto',
                    marginRight: '-0.5rem',
                    paddingRight: '0.5rem'
                }}>
                    {loading ? (
                        <div style={{
                            textAlign: 'center',
                            padding: '2rem',
                            color: '#94a3b8'
                        }}>
                            Loading...
                        </div>
                    ) : starredMessages.length === 0 ? (
                        <div style={{
                            textAlign: 'center',
                            padding: '3rem 1rem',
                            color: '#94a3b8'
                        }}>
                            <div style={{ fontSize: '3rem', marginBottom: '1rem', opacity: 0.5 }}>☆</div>
                            <div style={{ fontSize: '0.9rem' }}>No starred messages yet</div>
                            <div style={{ fontSize: '0.75rem', marginTop: '0.5rem', opacity: 0.7 }}>
                                Star important messages to find them easily
                            </div>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            {starredMessages.map(msg => (
                                <div
                                    key={msg.id}
                                    onClick={() => navigateToMessage(msg)}
                                    style={{
                                        background: 'rgba(255,255,255,0.05)',
                                        borderRadius: '12px',
                                        padding: '0.875rem',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s ease',
                                        border: '1px solid rgba(255,255,255,0.05)'
                                    }}
                                    onMouseEnter={e => {
                                        e.currentTarget.style.background = 'rgba(99, 102, 241, 0.2)';
                                        e.currentTarget.style.borderColor = 'rgba(99, 102, 241, 0.4)';
                                    }}
                                    onMouseLeave={e => {
                                        e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
                                        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.05)';
                                    }}
                                >
                                    <div style={{
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'flex-start',
                                        marginBottom: '0.375rem'
                                    }}>
                                        <div style={{
                                            fontSize: '0.75rem',
                                            color: '#a78bfa',
                                            fontWeight: 500
                                        }}>
                                            {msg.chatName}
                                        </div>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                unstarMessage(msg.id);
                                            }}
                                            style={{
                                                background: 'transparent',
                                                border: 'none',
                                                color: '#94a3b8',
                                                opacity: 0.7,
                                                fontSize: '1rem',
                                                cursor: 'pointer',
                                                padding: '4px',
                                                lineHeight: 0,
                                                borderRadius: '50%',
                                                transition: 'all 0.2s'
                                            }}
                                            onMouseEnter={e => {
                                                e.currentTarget.style.color = '#ef4444';
                                                e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)';
                                                e.currentTarget.style.opacity = 1;
                                            }}
                                            onMouseLeave={e => {
                                                e.currentTarget.style.color = '#94a3b8';
                                                e.currentTarget.style.background = 'transparent';
                                                e.currentTarget.style.opacity = 0.7;
                                            }}
                                            title="Remove from starred"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                                        </button>
                                    </div>
                                    <div style={{
                                        fontSize: '0.875rem',
                                        color: '#e2e8f0',
                                        lineHeight: 1.4,
                                        marginBottom: '0.375rem',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        whiteSpace: 'nowrap'
                                    }}>
                                        {msg.text}
                                    </div>
                                    <div style={{
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        fontSize: '0.7rem',
                                        color: '#64748b'
                                    }}>
                                        <span>{msg.senderName}</span>
                                        <span>{formatDate(msg.starredAt)}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
