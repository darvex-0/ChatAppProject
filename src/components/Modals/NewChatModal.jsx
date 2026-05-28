import { useState, useEffect } from 'react';
import { db } from '../../services/firebase';
import { collection, query, where, getDocs, addDoc, serverTimestamp, updateDoc, doc, arrayRemove } from 'firebase/firestore';
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
                    const lowerTerm = searchTerm.toLowerCase();

                    // 1. Search by lowerCaseName (standard case-insensitive search)
                    const lowerNameQuery = query(
                        collection(db, "users"),
                        where("lowerCaseName", ">=", lowerTerm),
                        where("lowerCaseName", "<=", lowerTerm + '\uf8ff')
                    );

                    // 2. Search by Name (Exact Input) - legacy fallback
                    const nameQuery = query(
                        collection(db, "users"),
                        where("name", ">=", searchTerm),
                        where("name", "<=", searchTerm + '\uf8ff')
                    );

                    // 3. Search by Name (Capitalized) - legacy fallback
                    const capitalizedTerm = searchTerm.charAt(0).toUpperCase() + searchTerm.slice(1);
                    const capitalQuery = query(
                        collection(db, "users"),
                        where("name", ">=", capitalizedTerm),
                        where("name", "<=", capitalizedTerm + '\uf8ff')
                    );

                    // 4. Search by Email (Lowercase)
                    const emailQuery = query(
                        collection(db, "users"),
                        where("email", ">=", lowerTerm),
                        where("email", "<=", lowerTerm + '\uf8ff')
                    );

                    const [lowerNameSnapshot, nameSnapshot, capitalSnapshot, emailSnapshot] = await Promise.all([
                        getDocs(lowerNameQuery),
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

                    lowerNameSnapshot.forEach(addToMap);
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

    const [isStartingChat, setIsStartingChat] = useState(false);

    const startChat = async (userId) => {
        if (isStartingChat) return;
        setIsStartingChat(true);

        try {
            // Check for existing private chat between these two users
            // Query by member only, filter type in memory to avoid complex index requirements/failures
            const q = query(
                collection(db, "chats"),
                where("members", "array-contains", currentUser.uid)
            );

            const snapshot = await getDocs(q);
            let existingChatId = null;

            // Iterate to find a private chat with this specific user
            snapshot.docs.forEach(doc => {
                const data = doc.data();
                const isPrivate = data.type === 'private' || !data.type;
                if (isPrivate && data.members.includes(userId)) {
                    existingChatId = doc.id;
                }
            });

            if (existingChatId) {
                // Handle potential duplicates: Find ALL chats with this user
                // RELAXED CHECK: allow type === 'private' OR missing type (legacy compatibility)
                const allChatsWithUser = snapshot.docs.filter(doc => {
                    const data = doc.data();
                    const isPrivate = data.type === 'private' || !data.type;
                    return isPrivate && data.members.includes(userId);
                });

                // 1. Unarchive ALL of them to ensure visibility regardless of which one Sidebar picks
                const unarchivePromises = allChatsWithUser.map(async (docSnapshot) => {
                    try {
                        const data = docSnapshot.data();
                        if (data.archivedBy && data.archivedBy.includes(currentUser.uid)) {
                            console.log("Unarchiving chat:", docSnapshot.id);
                            await updateDoc(doc(db, "chats", docSnapshot.id), {
                                archivedBy: arrayRemove(currentUser.uid)
                            });
                            return true; // Was archived
                        }
                    } catch (err) {
                        console.error("Failed to unarchive chat:", docSnapshot.id, err);
                    }
                    return false;
                });

                const results = await Promise.all(unarchivePromises);
                if (results.some(r => r === true)) {
                    console.log("Automatically unarchived chats.");
                }

                // 2. Determine "Best" chat to navigate to (prioritize content)
                let bestChatId = existingChatId;
                const bestChat = allChatsWithUser.sort((a, b) => {
                    const dataA = a.data();
                    const dataB = b.data();
                    const hasContentA = dataA.lastMessage && dataA.lastMessage !== "Started a new chat";
                    const hasContentB = dataB.lastMessage && dataB.lastMessage !== "Started a new chat";

                    if (hasContentA && !hasContentB) return -1; // A comes first
                    if (!hasContentA && hasContentB) return 1; // B comes first
                    return b.data().lastUpdate?.seconds - a.data().lastUpdate?.seconds; // Newer first
                })[0];

                if (bestChat) {
                    bestChatId = bestChat.id;
                }

                // Chat exists, navigate to it
                onClose();
                navigate(`/c/${bestChatId}`);
                setIsStartingChat(false);
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
            console.error("Error starting chat:", e);
            alert("Error starting chat: " + e.message);
        } finally {
            setIsStartingChat(false);
        }
    };

    return (
        <div className="modal-overlay">
            <div className="modal">
                <h3 style={{ color: 'var(--app-text)', marginBottom: '1.25rem', fontSize: '1.25rem', fontWeight: 600 }}>New Chat</h3>

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
                        <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--app-text-muted)' }}>
                            <div className="spinner" style={{ width: '24px', height: '24px', border: '3px solid var(--border-color)', borderTopColor: 'var(--primary)', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 10px' }}></div>
                            Searching...
                        </div>
                    )}

                    {!loading && results.length === 0 && searchTerm && (
                        <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--gray)' }}>
                            No users found with that name.
                        </div>
                    )}

                    {!loading && !searchTerm && (
                        <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--app-text-muted)', fontStyle: 'italic', opacity: 0.7 }}>
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
                                background: 'transparent',
                                border: '1px solid var(--border-color)'
                            }}
                            onMouseEnter={e => {
                                e.currentTarget.style.background = 'var(--hover-bg, rgba(99, 102, 241, 0.1))'; // Ensure hover-bg is defined or keep fallback slightly visible
                                e.currentTarget.style.borderColor = 'var(--primary-light)';
                            }}
                            onMouseLeave={e => {
                                e.currentTarget.style.background = 'transparent';
                                e.currentTarget.style.borderColor = 'var(--border-color)';
                            }}
                        >
                            <img
                                src={user.photoURL || `https://ui-avatars.com/api/?name=${user.name}`}
                                style={{ width: '42px', height: '42px', borderRadius: '50%', marginRight: '1rem', objectFit: 'cover' }}
                            />
                            <div>
                                <div style={{ color: 'var(--app-text)', fontWeight: 600, fontSize: '0.95rem' }}>{user.name}</div>
                                <div style={{ color: 'var(--gray)', fontSize: '0.8rem' }}>{user.email}</div>
                            </div>
                            <div style={{ marginLeft: 'auto', opacity: 0.5 }}>
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>
                            </div>
                        </div>
                    ))}
                </div>

                <button onClick={onClose} className="modal-btn secondary">Cancel</button>
            </div>
        </div>
    );
}
