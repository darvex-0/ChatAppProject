import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCall } from '../../context/CallContext';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../services/firebase';
import { collection, query, where, getDocs, addDoc, serverTimestamp, deleteDoc, doc } from 'firebase/firestore';

// Helper to format time
function formatTime(timestamp) {
    if (!timestamp?.seconds) return '';
    const date = new Date(timestamp.seconds * 1000);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// Helper to get Date Key (Today, Yesterday, Date)
function getDateKey(timestamp) {
    if (!timestamp?.seconds) return 'Unknown';
    const date = new Date(timestamp.seconds * 1000);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const callDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());

    if (callDay.getTime() === today.getTime()) return 'Today';
    if (callDay.getTime() === yesterday.getTime()) return 'Yesterday';
    return date.toLocaleDateString([], { month: 'long', day: 'numeric' });
}

// Helper for duration
function formatDuration(seconds) {
    if (!seconds) return '';
    if (seconds < 60) return `${seconds}s`;
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}m ${s}s`;
}

// Helper for bytes
function formatBytes(bytes) {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function CallInfoModal() {
    const { currentUser } = useAuth();
    const { callUser, callInfoContact, setCallInfoContact, callHistory } = useCall();
    const navigate = useNavigate();
    const [loadingChat, setLoadingChat] = useState(false);

    const contact = callInfoContact;
    const allLogs = callHistory;

    // Memoize logs to avoid recalculation if context updates unrelated things
    const logs = useMemo(() => {
        if (!contact?.uid || !allLogs) return [];
        return allLogs.filter(log =>
            (log.callerId === contact.uid) || (log.receiverId === contact.uid)
        );
    }, [contact, allLogs]);

    // Group logs by Date
    const groupedLogs = useMemo(() => {
        const groups = {};
        logs.forEach(log => {
            const key = getDateKey(log.timestamp);
            if (!groups[key]) groups[key] = [];
            groups[key].push(log);
        });
        return groups;
    }, [logs]);

    if (!contact) return null;

    const onClose = () => setCallInfoContact(null);

    const handleMessage = async () => {
        if (contact.chatId) {
            onClose();
            navigate(`/c/${contact.chatId}`);
            return;
        }

        // Create new chat if not exists
        setLoadingChat(true);
        try {
            // Check again in Firestore just in case
            const q = query(
                collection(db, "chats"),
                where("members", "array-contains", currentUser.uid)
            );
            const snapshot = await getDocs(q);
            const existing = snapshot.docs.find(doc => {
                const data = doc.data();
                return data.type !== 'group' && data.members.includes(contact.uid);
            });

            if (existing) {
                onClose();
                navigate(`/c/${existing.id}`);
            } else {
                // Create
                const newChatRef = await addDoc(collection(db, "chats"), {
                    members: [currentUser.uid, contact.uid],
                    type: 'private',
                    createdAt: serverTimestamp(),
                    lastUpdate: serverTimestamp(),
                    lastMessage: "Started a new chat"
                });
                onClose();
                navigate(`/c/${newChatRef.id}`);
            }
        } catch (e) {
            console.error("Error creating chat", e);
            alert("Could not open chat");
        } finally {
            setLoadingChat(false);
        }
    };

    const handleCall = (type) => {
        // Close modal first? Or keep open? WhatsApp keeps it open.
        // But call overlay will appear.
        callUser(contact.uid, type);
    };

    const handleDeleteLog = async (logId) => {
        if (window.confirm('Delete this call log?')) {
            try {
                await deleteDoc(doc(db, 'callLogs', logId));
            } catch (error) {
                console.error('Error deleting call log:', error);
                alert('Failed to delete call log');
            }
        }
    };

    return (
        <div className="modal-overlay" onClick={onClose} style={{ zIndex: 9999 }}>
            <div className="modal" style={{ maxWidth: '450px', width: '100%', padding: '0', overflow: 'hidden' }} onClick={e => e.stopPropagation()}>

                {/* Header */}
                <div style={{ padding: '1rem', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--input-bg)' }}>
                    <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 600 }}>Call info</h3>
                    <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--app-text-muted)', cursor: 'pointer', padding: '4px' }}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                    </button>
                </div>

                <div style={{ overflowY: 'auto', maxHeight: '70vh', padding: '1.5rem 1rem' }}>

                    {/* Profile Section */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '2rem' }}>
                        {contact.photo ? (
                            <img src={contact.photo} alt="" style={{ width: '100px', height: '100px', borderRadius: '50%', objectFit: 'cover', marginBottom: '1rem', background: 'var(--input-bg)' }} />
                        ) : (
                            <div style={{ width: '100px', height: '100px', borderRadius: '50%', marginBottom: '1rem', background: 'var(--input-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2.5rem' }}>
                                👤
                            </div>
                        )}
                        <h2 style={{ margin: '0 0 0.5rem 0', fontSize: '1.4rem' }}>{contact.name || "Unknown"}</h2>
                        <p style={{ margin: 0, color: 'var(--app-text-muted)' }}>{contact.phone || contact.email || ""}</p>

                        {/* Actions */}
                        <div style={{ display: 'flex', gap: '1.5rem', marginTop: '1.5rem' }}>
                            <button onClick={handleMessage} disabled={loadingChat} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', background: 'transparent', border: 'none', cursor: 'pointer', gap: '8px', color: 'var(--primary)' }}>
                                <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'rgba(99, 102, 241, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
                                </div>
                                <span style={{ fontSize: '0.85rem', fontWeight: 500 }}>Message</span>
                            </button>
                            <button onClick={() => handleCall('video')} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', background: 'transparent', border: 'none', cursor: 'pointer', gap: '8px', color: 'var(--primary)' }}>
                                <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'rgba(99, 102, 241, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="23 7 16 12 23 17 23 7"></polygon><rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect></svg>
                                </div>
                                <span style={{ fontSize: '0.85rem', fontWeight: 500 }}>Video</span>
                            </button>
                            <button onClick={() => handleCall('audio')} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', background: 'transparent', border: 'none', cursor: 'pointer', gap: '8px', color: 'var(--primary)' }}>
                                <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'rgba(99, 102, 241, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>
                                </div>
                                <span style={{ fontSize: '0.85rem', fontWeight: 500 }}>Voice</span>
                            </button>
                        </div>
                    </div>

                    {/* History List */}
                    <div className="call-history-list">
                        {Object.entries(groupedLogs).map(([date, groupLogs]) => (
                            <div key={date} style={{ marginBottom: '1rem' }}>
                                <div style={{
                                    textTransform: 'uppercase',
                                    color: 'var(--app-text-muted)',
                                    fontSize: '0.75rem',
                                    fontWeight: 600,
                                    marginBottom: '0.5rem',
                                    paddingLeft: '0.5rem'
                                }}>
                                    {date}
                                </div>
                                <div style={{ background: 'var(--absolute-dark)', borderRadius: '12px', overflow: 'hidden' }}>
                                    {groupLogs.map((log, index) => {
                                        const isCaller = log.callerId === currentUser.uid;
                                        const isNotAnswered = log.status === 'missed' || log.status === 'declined' || log.duration === 0;

                                        const icon = isCaller ? '↗' : '↙';
                                        const callDir = isCaller ? 'Outgoing' : 'Incoming';
                                        const callTypeLabel = log.type === 'video' ? 'Video' : 'Voice';
                                        const callText = `${callDir} ${callTypeLabel} call`;

                                        return (
                                            <div key={log.id} style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'space-between',
                                                padding: '0.75rem 1rem',
                                                borderBottom: index < groupLogs.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none'
                                            }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                                    <div style={{ color: isNotAnswered ? '#ef4444' : '#22c55e', fontSize: '1.2rem', fontWeight: 'bold' }}>{icon}</div>
                                                    <div>
                                                        <div style={{ color: isNotAnswered ? '#ef4444' : 'var(--app-text)', fontWeight: 500, fontSize: '0.95rem' }}>
                                                            {callText}
                                                        </div>
                                                        <div style={{ color: isNotAnswered ? '#ef4444' : 'var(--app-text-muted)', fontSize: '0.8rem' }}>
                                                            {isNotAnswered ? `Not answered • ${formatTime(log.timestamp)}` : formatTime(log.timestamp)}
                                                        </div>
                                                    </div>
                                                </div>

                                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                    <div style={{ textAlign: 'right', fontSize: '0.85rem', color: 'var(--app-text-muted)' }}>
                                                        {log.duration > 0 ? (
                                                            <>
                                                                <div>{formatDuration(log.duration)}</div>
                                                                {log.dataUsage?.totalBytes > 0 && (
                                                                    <div style={{ fontSize: '0.75rem', opacity: 0.7 }}>{formatBytes(log.dataUsage.totalBytes)}</div>
                                                                )}
                                                            </>
                                                        ) : (
                                                            <span>{isNotAnswered ? 'Unanswered' : '0s'}</span>
                                                        )}
                                                    </div>
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); handleDeleteLog(log.id); }}
                                                        style={{
                                                            background: 'transparent',
                                                            border: 'none',
                                                            cursor: 'pointer',
                                                            padding: '4px',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            opacity: 0.6
                                                        }}
                                                        title="Delete call log"
                                                    >
                                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        ))}
                    </div>

                </div>
            </div>
        </div>
    );
}
