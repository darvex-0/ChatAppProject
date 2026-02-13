import { useState } from 'react';
import { doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../context/AuthContext';

export default function NoteItem({ note }) {
    const { currentUser } = useAuth();
    const [isDeleting, setIsDeleting] = useState(false);

    const toggleCompletion = async () => {
        if (!currentUser) return;
        try {
            const noteRef = doc(db, "users", currentUser.uid, "notes", note.id);
            await updateDoc(noteRef, {
                isCompleted: !note.isCompleted
            });
        } catch (error) {
            console.error("Error toggling note:", error);
        }
    };

    const deleteNote = async (e) => {
        e.stopPropagation();
        if (!currentUser || isDeleting) return;

        setIsDeleting(true);
        try {
            const noteRef = doc(db, "users", currentUser.uid, "notes", note.id);
            await deleteDoc(noteRef);
        } catch (error) {
            console.error("Error deleting note:", error);
            setIsDeleting(false);
        }
    };

    return (
        <div
            className={`note-item ${note.isCompleted ? 'completed' : ''}`}
            style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '10px',
                background: 'var(--input-bg)',
                marginBottom: '8px',
                borderRadius: '8px',
                transition: 'all 0.2s',
                opacity: note.isCompleted ? 0.7 : 1
            }}
        >
            <div
                onClick={toggleCompletion}
                style={{
                    width: '20px',
                    height: '20px',
                    borderRadius: '50%',
                    border: '2px solid var(--primary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    background: note.isCompleted ? 'var(--primary)' : 'transparent',
                    flexShrink: 0
                }}
            >
                {note.isCompleted && (
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                )}
            </div>

            <div style={{ flex: 1, overflow: 'hidden' }}>
                <p style={{
                    margin: 0,
                    textDecoration: note.isCompleted ? 'line-through' : 'none',
                    color: note.isCompleted ? 'var(--app-text-muted)' : 'var(--app-text)',
                    fontSize: '0.95rem',
                    wordBreak: 'break-word'
                }}>
                    {note.content}
                </p>
                {note.createdAt && (
                    <small style={{ fontSize: '0.7rem', color: 'var(--app-text-muted)', display: 'block', marginTop: '2px' }}>
                        {new Date(note.createdAt.seconds * 1000).toLocaleDateString()}
                        {note.source === 'forwarded' && (
                            <span> • Forwarded from {note.forwardedFrom || "Chat"}</span>
                        )}
                    </small>
                )}
            </div>

            <button
                onClick={deleteNote}
                disabled={isDeleting}
                className="delete-note-btn"
                style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--app-text-muted)',
                    cursor: 'pointer',
                    padding: '4px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    opacity: 0.7,
                    transition: 'opacity 0.2s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.opacity = 1}
                onMouseLeave={(e) => e.currentTarget.style.opacity = 0.7}
                title="Delete Note"
            >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6"></polyline>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                </svg>
            </button>
        </div>
    );
}
