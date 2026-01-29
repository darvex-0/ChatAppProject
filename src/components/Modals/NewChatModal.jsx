import { useState, useEffect } from 'react';
import { db } from '../../services/firebase';
import { collection, query, where, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';

export default function NewChatModal({ onClose }) {
    const { currentUser } = useAuth();
    const navigate = useNavigate();
    const [searchTerm, setSearchTerm] = useState("");
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(false);

    // Debounced Search
    useEffect(() => {
        const delayDebounceFn = setTimeout(async () => {
            if (searchTerm.trim().length > 0) {
                setLoading(true);
                try {
                    // 1. Search by Name (Exact Input)
                    const nameQuery = query(
                        collection(db, "users"),
                        where("name", ">=", searchTerm),
                        where("name", "<=", searchTerm + '\uf8ff')
                    );

                    // 2. Search by Name (Capitalized) - Simple case-insensitive fix
                    const capitalizedTerm = searchTerm.charAt(0).toUpperCase() + searchTerm.slice(1);
                    const capitalQuery = query(
                        collection(db, "users"),
                        where("name", ">=", capitalizedTerm),
                        where("name", "<=", capitalizedTerm + '\uf8ff')
                    );

                    // 3. Search by Email
                    const emailQuery = query(
                        collection(db, "users"),
                        where("email", ">=", searchTerm),
                        where("email", "<=", searchTerm + '\uf8ff')
                    );

                    const [nameSnapshot, capitalSnapshot, emailSnapshot] = await Promise.all([
                        getDocs(nameQuery),
                        getDocs(capitalQuery),
                        getDocs(emailQuery)
                    ]);

                    const usersMap = new Map();

                    const addToMap = (doc) => {
                        if (doc.id !== currentUser.uid) {
                            usersMap.set(doc.id, { id: doc.id, ...doc.data() });
                        }
                    };

                    nameSnapshot.forEach(addToMap);
                    capitalSnapshot.forEach(addToMap);
                    emailSnapshot.forEach(addToMap);

                    setResults(Array.from(usersMap.values()));
                } catch (error) {
                    console.error("Error searching users:", error);
                } finally {
                    setLoading(false);
                }
            } else {
                setResults([]);
            }
        }, 500);

        return () => clearTimeout(delayDebounceFn);
    }, [searchTerm, currentUser]);

    const startChat = async (userId) => {
        try {
            // Check for existing private chat between these two users
            // Note: 'array-contains' only matches one value. 'in' matches one of many.
            // Firestore doesn't support 'contains-all' natively in a single query easily without composite keys.
            // WORKAROUND: Query for chats containing currentUser, then filter in memory (efficient enough for small-medium apps)

            const q = query(
                collection(db, "chats"),
                where("members", "array-contains", currentUser.uid),
                where("type", "==", "private")
            );

            const snapshot = await getDocs(q);
            let existingChatId = null;

            snapshot.forEach(doc => {
                const data = doc.data();
                if (data.members.includes(userId)) {
                    existingChatId = doc.id;
                }
            });

            if (existingChatId) {
                // Chat exists, navigate to it
                onClose();
                navigate(`/c/${existingChatId}`);
                return;
            }

            // Create new chat document if none exists
            const chatRef = await addDoc(collection(db, "chats"), {
                type: 'private',
                members: [currentUser.uid, userId],
                createdAt: serverTimestamp(),
                lastUpdate: serverTimestamp(),
                lastMessage: "Started a new chat"
            });

            onClose();
            navigate(`/c/${chatRef.id}`);
        } catch (e) {
            alert("Error starting chat: " + e.message);
        }
    };

    return (
        <div className="modal-overlay">
            <div className="modal">
                <h3 style={{ color: 'white', marginBottom: '1.25rem', fontSize: '1.25rem', fontWeight: 600 }}>New Chat</h3>

                <input
                    autoFocus
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    placeholder="Search users by name..."
                    className="modal-input"
                    style={{ marginBottom: '1.5rem' }}
                />

                <div className="user-results-list" style={{ minHeight: '150px', maxHeight: '300px', overflowY: 'auto', textAlign: 'left', marginBottom: '1rem' }}>

                    {loading && (
                        <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--gray)' }}>
                            <div className="spinner" style={{ width: '24px', height: '24px', border: '3px solid rgba(255,255,255,0.1)', borderTopColor: 'var(--primary)', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 10px' }}></div>
                            Searching...
                        </div>
                    )}

                    {!loading && results.length === 0 && searchTerm && (
                        <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--gray)' }}>
                            No users found with that name.
                        </div>
                    )}

                    {!loading && !searchTerm && (
                        <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--gray)', fontStyle: 'italic', opacity: 0.7 }}>
                            Type to find existing users
                        </div>
                    )}

                    {results.map(user => (
                        <div
                            key={user.id}
                            onClick={() => startChat(user.id)}
                            className="search-result-item"
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                padding: '0.75rem',
                                borderRadius: '12px',
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                marginBottom: '0.5rem',
                                background: 'rgba(255,255,255,0.03)',
                                border: '1px solid rgba(255,255,255,0.05)'
                            }}
                            onMouseEnter={e => {
                                e.currentTarget.style.background = 'rgba(99, 102, 241, 0.1)';
                                e.currentTarget.style.borderColor = 'rgba(99, 102, 241, 0.3)';
                            }}
                            onMouseLeave={e => {
                                e.currentTarget.style.background = 'rgba(255,255,255,0.03)';
                                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.05)';
                            }}
                        >
                            <img
                                src={user.photoURL || `https://ui-avatars.com/api/?name=${user.name}`}
                                style={{ width: '42px', height: '42px', borderRadius: '50%', marginRight: '1rem', objectFit: 'cover' }}
                            />
                            <div>
                                <div style={{ color: 'white', fontWeight: 600, fontSize: '0.95rem' }}>{user.name}</div>
                                <div style={{ color: 'var(--gray)', fontSize: '0.8rem' }}>{user.email}</div>
                            </div>
                            <div style={{ marginLeft: 'auto', opacity: 0.5 }}>
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>
                            </div>
                        </div>
                    ))}
                </div>

                <button onClick={onClose} className="modal-btn secondary">Cancel</button>
            </div>
        </div>
    );
}
