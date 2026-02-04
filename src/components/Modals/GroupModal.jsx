import { useState, useEffect } from 'react';
import { db, storage } from '../../services/firebase';
import { collection, addDoc, serverTimestamp, query, where, getDocs, doc, getDoc, orderBy } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';

export default function GroupModal({ onClose }) {
    const { currentUser } = useAuth();
    const navigate = useNavigate();

    // UI State
    const [groupName, setGroupName] = useState("");
    const [groupImage, setGroupImage] = useState(null);
    const [imagePreview, setImagePreview] = useState(null);
    const [loading, setLoading] = useState(false);

    // Member Selection State
    const [friends, setFriends] = useState([]);
    const [selectedUsers, setSelectedUsers] = useState([]);
    const [searchTerm, setSearchTerm] = useState("");
    const [manualEmail, setManualEmail] = useState("");

    // 1. Load Suggested Friends (People you have private chats with)
    useEffect(() => {
        const fetchFriends = async () => {
            try {
                // Find private chats I'm in
                const q = query(
                    collection(db, "chats"),
                    where("members", "array-contains", currentUser.uid),
                    orderBy("lastUpdate", "desc")
                );

                const snapshot = await getDocs(q);
                const friendIds = new Set();

                snapshot.forEach(doc => {
                    const data = doc.data();
                    if (data.type === 'group') return;

                    const friendId = data.members.find(id => id !== currentUser.uid);
                    if (friendId) friendIds.add(friendId);
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

        fetchFriends();
    }, [currentUser]);

    const handleImageChange = (e) => {
        if (e.target.files[0]) {
            setGroupImage(e.target.files[0]);
            setImagePreview(URL.createObjectURL(e.target.files[0]));
        }
    };

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
            alert("You are automatically added.");
            return;
        }

        // Check if already selected
        if (selectedUsers.find(u => u.email === email)) {
            alert("User already selected.");
            return;
        }

        try {
            const q = query(collection(db, "users"), where("email", "==", email));
            const snap = await getDocs(q);

            if (snap.empty) {
                alert("User not found.");
                return;
            }

            const user = { id: snap.docs[0].id, ...snap.docs[0].data() };
            // Add to selection (and maybe to friends list visually if we want)
            setSelectedUsers([...selectedUsers, user]);
            setManualEmail("");

            // Hack: Validated user is added to selected, but might not be in 'friends' list
            // We can add them to 'friends' so they appear in the list as checked
            if (!friends.find(f => f.id === user.id)) {
                setFriends([user, ...friends]);
            }

        } catch (e) {
            console.error("Error finding user", e);
        }
    };

    const createGroup = async () => {
        if (!groupName.trim()) {
            alert("Please enter a group name");
            return;
        }
        if (selectedUsers.length === 0) {
            if (!confirm("Create group with only you?")) return;
        }

        setLoading(true);

        try {
            let photoURL = "";
            if (groupImage) {
                const imgRef = ref(storage, `group_pics/${Date.now()}_${groupImage.name}`);
                await uploadBytes(imgRef, groupImage);
                photoURL = await getDownloadURL(imgRef);
            }

            const finalMembers = [currentUser.uid, ...selectedUsers.map(u => u.id)];

            const docRef = await addDoc(collection(db, "chats"), {
                type: 'group',
                groupName: groupName,
                groupImage: photoURL,
                admin: [currentUser.uid],
                members: finalMembers,
                createdAt: serverTimestamp(),
                lastUpdate: serverTimestamp(),
                lastMessage: "Group created",
                unreadCounts: {}
            });

            // Optional: Send system message
            await addDoc(collection(db, "chats", docRef.id, "messages"), {
                text: `${currentUser.displayName || currentUser.email} created group "${groupName}"`,
                sender: currentUser.uid,
                senderName: "System",
                type: "system",
                timestamp: serverTimestamp(),
                status: "sent"
            });

            onClose();
            navigate(`/c/${docRef.id}`);
        } catch (e) {
            alert("Error creating group: " + e.message);
        } finally {
            setLoading(false);
        }
    };

    const filteredFriends = friends.filter(f =>
        (f.name?.toLowerCase() || "").includes(searchTerm.toLowerCase()) ||
        (f.email?.toLowerCase() || "").includes(searchTerm.toLowerCase())
    );

    return (
        <div className="modal-overlay">
            <div className="modal" style={{ maxWidth: '28rem', height: '85vh', display: 'flex', flexDirection: 'column' }}>
                <h3 style={{ color: 'var(--app-text)', marginBottom: '1rem', fontSize: '1.25rem', fontWeight: 600 }}>Create New Group</h3>

                {/* Top Section: Image + Name */}
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginBottom: '1.5rem', flexShrink: 0 }}>
                    <div
                        style={{ position: 'relative', width: '60px', height: '60px', cursor: 'pointer' }}
                        onClick={() => document.getElementById('groupImageInput').click()}
                    >
                        {imagePreview ? (
                            <img
                                src={imagePreview}
                                style={{ width: '60px', height: '60px', borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--primary)' }}
                            />
                        ) : (
                            <img
                                src="https://placehold.co/60x60/6366f1/ffffff?text=+"
                                style={{ width: '60px', height: '60px', borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--primary)' }}
                            />
                        )}

                        {!imagePreview && (
                            <div style={{ position: 'absolute', bottom: 0, right: 0, background: 'var(--primary)', borderRadius: '50%', width: '20px', height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', color: 'white' }}>
                                +
                            </div>
                        )}
                    </div>

                    <input
                        className="modal-input"
                        placeholder="Group Name"
                        value={groupName}
                        onChange={e => setGroupName(e.target.value)}
                        style={{ marginBottom: 0, flexGrow: 1 }}
                    />
                    <input
                        type="file"
                        id="groupImageInput"
                        accept="image/*"
                        style={{ display: 'none' }}
                        onChange={handleImageChange}
                    />
                </div>

                {/* Filter Input */}
                <div style={{ marginBottom: '0.5rem', flexShrink: 0 }}>
                    <input
                        className="modal-input"
                        placeholder="Filter recent friends..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        style={{ width: '100%', marginBottom: 0 }}
                    />
                </div>

                {/* Friends List */}
                <div style={{
                    flexGrow: 1,
                    overflowY: 'auto',
                    marginBottom: '0.5rem',
                    border: '1px solid var(--border-color)',
                    borderRadius: '8px',
                    padding: '0.5rem'
                }}>
                    {friends.length === 0 && (
                        <div style={{ textAlign: 'center', color: 'var(--app-text-muted)', padding: '1rem' }}>
                            Loading potential members or no friends found...
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
                <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '0.75rem', marginBottom: '1rem', flexShrink: 0 }}>
                    <p style={{ fontSize: '0.8rem', color: 'var(--app-text-muted)', marginBottom: '0.5rem' }}>Or add someone new by email:</p>
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

                {/* Footer Actions */}
                <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <div style={{ fontSize: '0.8rem', color: 'var(--primary-light)', textAlign: 'right' }}>
                        {selectedUsers.length} selected
                    </div>
                    <button onClick={createGroup} disabled={loading} className="modal-btn">
                        {loading ? "Creating..." : "Create Group"}
                    </button>
                    <button onClick={onClose} className="modal-btn secondary">Cancel</button>
                </div>
            </div>
        </div>
    );
}
