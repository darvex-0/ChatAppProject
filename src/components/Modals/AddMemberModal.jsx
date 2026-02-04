import { useState, useEffect } from 'react';
import { db } from '../../services/firebase';
import { collection, query, where, getDocs, doc, getDoc, updateDoc, arrayUnion, addDoc, serverTimestamp, orderBy } from 'firebase/firestore';
import { useAuth } from '../../context/AuthContext';

export default function AddMemberModal({ onClose, chatId }) {
    const { currentUser } = useAuth();

    // Member Selection State
    const [friends, setFriends] = useState([]);
    const [selectedUsers, setSelectedUsers] = useState([]);
    const [searchTerm, setSearchTerm] = useState("");
    const [manualEmail, setManualEmail] = useState("");
    const [loading, setLoading] = useState(false);
    const [currentMembers, setCurrentMembers] = useState([]);

    // 1. Load Suggested Friends AND Current Members
    useEffect(() => {
        const fetchData = async () => {
            try {
                // Get current chat members so we don't show them in the list
                const chatDoc = await getDoc(doc(db, "chats", chatId));
                const currentMemberIds = chatDoc.exists() ? chatDoc.data().members : [];
                setCurrentMembers(currentMemberIds);

                // Find private chats I'm in (Potential Friends)
                const q = query(
                    collection(db, "chats"),
                    where("members", "array-contains", currentUser.uid),
                    orderBy("lastUpdate", "desc")
                );

                const snapshot = await getDocs(q);
                const friendIds = new Set();

                snapshot.forEach(doc => {
                    const data = doc.data();
                    // Filter out groups manually if needed, or rely on finding the 'other' member
                    // Legacy chats might not have 'type', so we check if it looks like a private chat
                    if (data.type === 'group') return;

                    const friendId = data.members.find(id => id !== currentUser.uid);
                    // Only add if NOT already in the group
                    if (friendId && !currentMemberIds.includes(friendId)) {
                        friendIds.add(friendId);
                    }
                });

                if (friendIds.size === 0) return;

                // Fetch details for these users (Parallel)
                const userPromises = Array.from(friendIds).map(uid => getDoc(doc(db, "users", uid)));
                const userSnaps = await Promise.all(userPromises);

                const friendsData = userSnaps
                    .filter(snap => snap.exists())
                    .map(snap => ({ id: snap.id, ...snap.data() }));
                setFriends(friendsData);
            } catch (err) {
                console.error("Error loading friends:", err);
            }
        };

        fetchData();
    }, [currentUser, chatId]);

    const toggleUserSelection = (user) => {
        if (selectedUsers.find(u => u.id === user.id)) {
            setSelectedUsers(selectedUsers.filter(u => u.id !== user.id));
        } else {
            setSelectedUsers([...selectedUsers, user]);
        }
    };

    const addManualEmail = async () => {
        if (!manualEmail.trim()) return;
        const email = manualEmail.trim().toLowerCase();

        if (email === currentUser.email) {
            alert("You are already in the group.");
            return;
        }

        // Check if already selected
        if (selectedUsers.find(u => u.email === email)) {
            alert("User already selected.");
            return;
        }

        try {
            // Check if user exists
            const q = query(collection(db, "users"), where("email", "==", email));
            const snap = await getDocs(q);

            if (snap.empty) {
                alert("User not found.");
                return;
            }

            const user = { id: snap.docs[0].id, ...snap.docs[0].data() };

            // Check if already in group
            if (currentMembers.includes(user.id)) {
                alert("User is already in this group!");
                return;
            }

            // Add to selection
            setSelectedUsers([...selectedUsers, user]);
            setManualEmail("");

            if (!friends.find(f => f.id === user.id)) {
                setFriends([user, ...friends]);
            }

        } catch (e) {
            console.error("Error finding user", e);
        }
    };

    const addSelectedMembers = async () => {
        if (selectedUsers.length === 0) return;
        setLoading(true);

        try {
            const newMemberIds = selectedUsers.map(u => u.id);
            const newMemberNames = selectedUsers.map(u => u.name || "User").join(", ");

            // 1. Update Chat Document
            await updateDoc(doc(db, "chats", chatId), {
                members: arrayUnion(...newMemberIds)
            });

            // 2. Add System Message
            await addDoc(collection(db, "chats", chatId, "messages"), {
                text: `${currentUser.displayName || 'Admin'} added ${newMemberNames}`,
                sender: "system",
                senderName: "System",
                type: "system",
                timestamp: serverTimestamp(),
                status: "sent"
            });

            onClose(); // Close modal on success
            // Force refresh might be needed if parent doesn't auto-update, but Firestore listener should handle it
        } catch (e) {
            alert("Error adding members: " + e.message);
        } finally {
            setLoading(false);
        }
    };

    const filteredFriends = friends.filter(f =>
        (f.name?.toLowerCase() || "").includes(searchTerm.toLowerCase()) ||
        (f.email?.toLowerCase() || "").includes(searchTerm.toLowerCase())
    );

    return (
        <div className="modal-overlay" style={{ zIndex: 2000 }}>
            <div className="modal" style={{ maxWidth: '26rem', height: '70vh', display: 'flex', flexDirection: 'column' }}>
                <h3 style={{ color: 'var(--app-text)', marginBottom: '1rem', fontSize: '1.25rem', fontWeight: 600 }}>Add People</h3>

                {/* Filter Input */}
                <input
                    className="modal-input"
                    placeholder="Search your friends..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    style={{ flexShrink: 0 }}
                />

                {/* Friends List */}
                <div style={{
                    flexGrow: 1,
                    overflowY: 'auto',
                    marginBottom: '1rem',
                    border: '1px solid var(--border-color)',
                    borderRadius: '8px',
                    padding: '0.5rem'
                }}>
                    {friends.length === 0 && (
                        <div style={{ textAlign: 'center', color: 'var(--app-text-muted)', padding: '1rem' }}>
                            Loading friends or everyone is already in the group...
                        </div>
                    )}

                    {filteredFriends.map(user => {
                        const isSelected = selectedUsers.some(u => u.id === user.id);
                        return (
                            <div
                                key={user.id}
                                onClick={() => toggleUserSelection(user)}
                                className={`friend-item ${isSelected ? 'selected' : ''}`}
                                style={{
                                    display: 'flex', alignItems: 'center', padding: '0.75rem',
                                    borderBottom: '1px solid var(--border-color)',
                                    cursor: 'pointer', borderRadius: '6px',
                                    background: isSelected ? 'rgba(99, 102, 241, 0.15)' : 'transparent',
                                    border: isSelected ? '1px solid var(--primary)' : '1px solid transparent'
                                }}
                            >
                                <img
                                    src={user.photoURL || `https://ui-avatars.com/api/?name=${user.name}`}
                                    style={{ width: '40px', height: '40px', borderRadius: '50%', marginRight: '10px', objectFit: 'cover' }}
                                />
                                <div style={{ flexGrow: 1 }}>
                                    <h4 style={{ fontSize: '0.9rem', margin: 0, color: 'var(--app-text)' }}>{user.name || "Unknown"}</h4>
                                    <small style={{ fontSize: '0.75rem', color: 'var(--app-text-muted)' }}>{user.email}</small>
                                </div>
                                <div style={{
                                    width: '20px', height: '20px', borderRadius: '50%',
                                    border: isSelected ? '2px solid var(--primary)' : '2px solid var(--app-text-muted)',
                                    background: isSelected ? 'var(--primary)' : 'transparent',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    color: 'white', fontSize: '12px'
                                }}>
                                    {isSelected && '✓'}
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Manual Add Section */}
                <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1rem', marginBottom: '1rem', flexShrink: 0 }}>
                    <p style={{ fontSize: '0.8rem', color: 'var(--app-text-muted)', marginBottom: '0.5rem' }}>Or add a new person by email:</p>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <input
                            className="modal-input"
                            placeholder="user@email.com"
                            value={manualEmail}
                            onChange={e => setManualEmail(e.target.value)}
                            style={{ marginBottom: 0, fontSize: '0.9rem', flexGrow: 1 }}
                        />
                        <button
                            className="modal-btn secondary"
                            onClick={addManualEmail}
                            style={{ width: 'auto', padding: '0 1rem', marginBottom: 0 }}
                        >
                            Add
                        </button>
                    </div>
                </div>

                <button
                    onClick={addSelectedMembers}
                    disabled={loading || selectedUsers.length === 0}
                    className="modal-btn"
                >
                    {loading ? "Adding..." : `Add Selected (${selectedUsers.length})`}
                </button>
                <button onClick={onClose} className="modal-btn secondary">Cancel</button>
            </div>
        </div>
    );
}
