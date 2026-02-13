import { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../context/AuthContext';
import NoteItem from './NoteItem';

export default function NotesSection() {
    const { currentUser } = useAuth();
    const [notes, setNotes] = useState([]);
    const [newNoteText, setNewNoteText] = useState("");
    const [isAdding, setIsAdding] = useState(false);

    useEffect(() => {
        if (!currentUser) return;

        // Query notes ordered by createdAt descending (Newest first)
        const q = query(
            collection(db, "users", currentUser.uid, "notes"),
            orderBy("createdAt", "desc")
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const notesData = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            // Local Sort: Active notes first, then Completed notes
            // Within each group, keep the original time-based sort (descending)
            const sortedNotes = notesData.sort((a, b) => {
                if (a.isCompleted === b.isCompleted) {
                    return 0; // Maintain Firestore order (time desc)
                }
                return a.isCompleted ? 1 : -1; // Completed goes to bottom
            });

            setNotes(sortedNotes);
        });

        return () => unsubscribe();
    }, [currentUser]);

    const handleAddNote = async (e) => {
        e.preventDefault();
        if (!newNoteText.trim() || !currentUser) return;

        setIsAdding(true);
        try {
            await addDoc(collection(db, "users", currentUser.uid, "notes"), {
                content: newNoteText.trim(),
                isCompleted: false,
                createdAt: serverTimestamp(),
                source: 'manual'
            });
            setNewNoteText("");
        } catch (error) {
            console.error("Error adding note:", error);
        } finally {
            setIsAdding(false);
        }
    };

    return (
        <div id="notes-section" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            {/* Add Note Input */}
            <form onSubmit={handleAddNote} style={{ padding: '10px', borderBottom: '1px solid var(--border-color)' }}>
                <div style={{ position: 'relative', display: 'flex', gap: '8px' }}>
                    <input
                        type="text"
                        value={newNoteText}
                        onChange={(e) => setNewNoteText(e.target.value)}
                        placeholder="Add a new note..."
                        style={{
                            width: '100%',
                            padding: '10px',
                            paddingRight: '40px',
                            borderRadius: '8px',
                            border: '1px solid var(--border-color)',
                            background: 'var(--input-bg)',
                            color: 'var(--app-text)',
                            outline: 'none'
                        }}
                    />
                    <button
                        type="submit"
                        disabled={!newNoteText.trim() || isAdding}
                        style={{
                            position: 'absolute',
                            right: '5px',
                            top: '50%',
                            transform: 'translateY(-50%)',
                            background: 'var(--primary)',
                            color: 'white',
                            border: 'none',
                            borderRadius: '6px',
                            width: '32px',
                            height: '32px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            opacity: (!newNoteText.trim() || isAdding) ? 0.5 : 1
                        }}
                    >
                        {isAdding ? (
                            <div className="spinner-small" style={{ width: '14px', height: '14px', border: '2px solid white', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
                        ) : (
                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="12" y1="5" x2="12" y2="19"></line>
                                <line x1="5" y1="12" x2="19" y2="12"></line>
                            </svg>
                        )}
                    </button>
                </div>
            </form>

            {/* Notes List */}
            <div className="notes-list" style={{ flex: 1, overflowY: 'auto', padding: '10px' }}>
                {notes.length === 0 ? (
                    <div className="empty-state" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', opacity: 0.6 }}>
                        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📝</div>
                        <p>No notes yet</p>
                        <p style={{ fontSize: '0.8rem', textAlign: 'center' }}>Add a note or forward messages here to keep track of them.</p>
                    </div>
                ) : (
                    <>
                        {notes.map(note => (
                            <NoteItem key={note.id} note={note} />
                        ))}
                    </>
                )}
            </div>
        </div>
    );
}
