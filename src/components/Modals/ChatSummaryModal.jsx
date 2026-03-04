import { useState, useEffect } from 'react';
import { db } from '../../services/firebase';
import { collection, query, orderBy, getDocs, limitToLast } from 'firebase/firestore';
import { fetchSummary } from '../../services/aiService';

export default function ChatSummaryModal({ chatId, chatName, onClose }) {
    const [summary, setSummary] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [msgCount, setMsgCount] = useState(0);

    useEffect(() => {
        let cancelled = false;

        async function generateSummary() {
            try {
                // Fetch last 50 text messages from Firestore
                const q = query(
                    collection(db, 'chats', chatId, 'messages'),
                    orderBy('timestamp', 'asc'),
                    limitToLast(50)
                );
                const snap = await getDocs(q);

                const formatted = [];
                snap.forEach(doc => {
                    const d = doc.data();
                    if (d.type === 'text' && d.text) {
                        formatted.push({
                            senderName: d.senderName || 'Unknown',
                            text: d.text,
                        });
                    }
                });

                if (cancelled) return;
                setMsgCount(formatted.length);

                if (formatted.length === 0) {
                    setError('No text messages to summarize.');
                    setIsLoading(false);
                    return;
                }

                const result = await fetchSummary(formatted);
                if (cancelled) return;

                if (result) {
                    setSummary(result);
                } else {
                    setError('AI server is not running. Start the local Python server to use this feature.');
                }
            } catch (e) {
                if (!cancelled) setError('Failed to generate summary: ' + e.message);
            } finally {
                if (!cancelled) setIsLoading(false);
            }
        }

        generateSummary();
        return () => { cancelled = true; };
    }, [chatId]);

    return (
        <div
            className="modal-overlay"
            style={{ zIndex: 2500 }}
            onClick={(e) => e.target === e.currentTarget && onClose()}
        >
            <div
                className="modal"
                style={{
                    maxWidth: '480px',
                    width: '90%',
                    background: '#0f172a',
                    border: '1px solid rgba(99, 102, 241, 0.3)',
                    borderRadius: '16px',
                    padding: '1.5rem',
                    boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
                }}
            >
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '1.3rem' }}>📑</span>
                        <h3 style={{ margin: 0, color: 'white', fontSize: '1.1rem' }}>AI Chat Summary</h3>
                    </div>
                    <button
                        onClick={onClose}
                        style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '1.3rem', lineHeight: 1 }}
                    >
                        ×
                    </button>
                </div>

                {/* Chat name */}
                <div style={{ color: '#818cf8', fontSize: '0.8rem', marginBottom: '1rem', fontWeight: 500 }}>
                    {chatName} • {msgCount > 0 ? `${msgCount} messages analyzed` : 'Loading...'}
                </div>

                {/* Content */}
                {isLoading ? (
                    <div style={{ padding: '2rem 0', textAlign: 'center' }}>
                        <div style={{
                            width: '36px',
                            height: '36px',
                            border: '3px solid rgba(99, 102, 241, 0.2)',
                            borderTopColor: '#818cf8',
                            borderRadius: '50%',
                            animation: 'spin 0.8s linear infinite',
                            margin: '0 auto 1rem',
                        }} />
                        <p style={{ color: '#94a3b8', fontSize: '0.85rem', margin: 0 }}>
                            AI is reading the conversation...
                        </p>
                    </div>
                ) : error ? (
                    <div style={{
                        padding: '1.5rem',
                        background: 'rgba(239, 68, 68, 0.1)',
                        border: '1px solid rgba(239, 68, 68, 0.2)',
                        borderRadius: '8px',
                        color: '#fca5a5',
                        fontSize: '0.85rem',
                        lineHeight: 1.6,
                    }}>
                        {error}
                    </div>
                ) : (
                    <div style={{
                        padding: '1rem',
                        background: 'rgba(99, 102, 241, 0.08)',
                        border: '1px solid rgba(99, 102, 241, 0.15)',
                        borderRadius: '10px',
                        color: '#e2e8f0',
                        fontSize: '0.9rem',
                        lineHeight: 1.7,
                    }}>
                        {summary}
                    </div>
                )}

                {/* AI badge */}
                <div style={{
                    marginTop: '1rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    color: '#64748b',
                    fontSize: '0.7rem',
                }}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
                    </svg>
                    Powered by Local AI (Qwen 2.5)
                </div>
            </div>
        </div>
    );
}
