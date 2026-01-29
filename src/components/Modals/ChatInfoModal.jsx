import { useState, useEffect } from 'react';
import { db } from '../../services/firebase';
import { doc, getDoc, updateDoc, arrayRemove, arrayUnion, collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';

import AddMemberModal from './AddMemberModal';
import MediaGalleryModal from './MediaGalleryModal';

export default function ChatInfoModal({ chatId, onClose }) {
    const { currentUser } = useAuth();
    const navigate = useNavigate();
    const [chatData, setChatData] = useState(null);
    const [members, setMembers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showAddMember, setShowAddMember] = useState(false);
    const [showMedia, setShowMedia] = useState(false);

    useEffect(() => {
        if (!chatId) return;

        const fetchData = async () => {
            try {
                const chatDoc = await getDoc(doc(db, "chats", chatId));
                if (!chatDoc.exists()) return;

                const data = chatDoc.data();
                setChatData(data);

                if (data.type === 'group' && data.members) {
                    const memberData = [];
                    // Batch requests to avoid hitting browser limits (e.g. 10 at a time)
                    const chunkSize = 10;
                    for (let i = 0; i < data.members.length; i += chunkSize) {
                        const chunk = data.members.slice(i, i + chunkSize);
                        const chunkPromises = chunk.map(async (uid) => {
                            const userDoc = await getDoc(doc(db, "users", uid));
                            const isAdmin = data.admin?.includes(uid);
                            return userDoc.exists() ? { uid, ...userDoc.data(), isAdmin } : { uid, name: "Unknown", isAdmin };
                        });
                        const chunkResults = await Promise.all(chunkPromises);
                        memberData.push(...chunkResults);
                    }
                    // Sort: Admin first
                    memberData.sort((a, b) => (b.isAdmin === a.isAdmin) ? 0 : b.isAdmin ? 1 : -1);
                    setMembers(memberData);
                } else {
                    const otherUid = data.members?.find(uid => uid !== currentUser.uid);
                    if (otherUid) {
                        const userDoc = await getDoc(doc(db, "users", otherUid));
                        if (userDoc.exists()) {
                            setMembers([{ uid: otherUid, ...userDoc.data() }]);
                        }
                    }
                }
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [chatId, currentUser, showAddMember]); // Re-fetch when modal closes

    const leaveGroup = async () => {
        if (!confirm("Are you sure you want to leave this group?")) return;
        try {
            const chatRef = doc(db, "chats", chatId);
            const chatSnap = await getDoc(chatRef);

            if (chatSnap.exists()) {
                const data = chatSnap.data();
                const isAdmin = data.admin?.includes(currentUser.uid);
                const admins = data.admin || [];

                let updates = {
                    members: arrayRemove(currentUser.uid)
                };

                // If I am an admin
                if (isAdmin) {
                    updates.admin = arrayRemove(currentUser.uid);

                    // If I am the ONLY admin
                    if (admins.length === 1 && admins[0] === currentUser.uid) {
                        // Find the oldest member who is NOT me
                        // members array is likely ordered by join time if we never re-ordered it.
                        // However, we rely on the `members` array in Firestore.
                        const remainingMembers = data.members.filter(uid => uid !== currentUser.uid);

                        if (remainingMembers.length > 0) {
                            const newAdminUid = remainingMembers[0]; // First member becomes admin
                            updates.admin = [newAdminUid]; // Set new admin (replacing old array essentially, or we could minimize ops but this is cleaner logic: remove me, add him. arrayRemove + arrayUnion works)

                            // Better Firestore approach for atomic update:
                            // We can't easily do "set to [newAdmin]" if we use arrayRemove/Union in same update effectively without knowing full state. 
                            // But since we read the doc, we know the state.
                            // Let's use arrayRemove for me, arrayUnion for new admin.
                            updates.admin = arrayRemove(currentUser.uid); // Remove me
                            // Wait, we need to add the new guy too.
                            // Firestore update with multiple keys: 
                            // We can't do updates.admin = arrayRemove AND updates.admin = arrayUnion involved on same key easily in one obj key.
                            // Actually we can just write the new array.
                            const newAdminList = [newAdminUid];
                            updates.admin = newAdminList;

                            // Add System Message about transfer
                            await addDoc(collection(db, "chats", chatId, "messages"), {
                                text: `Admin left. Protocol initiated: Member ${newAdminUid.slice(0, 5)}... is now Admin.`, // ideally we'd get name but we might not have it loaded synchronously safe enough. 
                                // Actually we have 'members' state in component. Let's try to get name.
                                sender: "system",
                                timestamp: serverTimestamp(),
                                type: "system"
                            });

                            // Let's try to find name from local state if possible
                            const newAdminObj = members.find(m => m.uid === newAdminUid);
                            if (newAdminObj) {
                                await addDoc(collection(db, "chats", chatId, "messages"), {
                                    text: `Admin left. ${newAdminObj.name} is now the Group Admin.`,
                                    sender: "system",
                                    timestamp: serverTimestamp(),
                                    type: "system"
                                });
                            }
                        }
                    }
                }

                await updateDoc(chatRef, updates);
                onClose();
                navigate('/');
            }
        } catch (e) {
            alert("Error leaving group: " + e.message);
        }
    };

    const kickMember = async (uid, name) => {
        if (!confirm(`Are you sure you want to kick ${name}?`)) return;
        try {
            await updateDoc(doc(db, "chats", chatId), {
                members: arrayRemove(uid),
                admin: arrayRemove(uid)
            });
            setMembers(prev => prev.filter(m => m.uid !== uid));

            await addDoc(collection(db, "chats", chatId, "messages"), {
                text: `${currentUser.displayName || 'Admin'} removed ${name}`,
                sender: "system",
                timestamp: serverTimestamp(),
                type: "system"
            });
        } catch (e) {
            alert("Error kicking member: " + e.message);
        }
    };

    const promoteMember = async (uid, name) => {
        if (!confirm(`Make ${name} an Admin?`)) return;
        try {
            await updateDoc(doc(db, "chats", chatId), {
                admin: arrayUnion(uid)
            });

            // Update local state
            setMembers(prev => prev.map(m => m.uid === uid ? { ...m, isAdmin: true } : m));

            await addDoc(collection(db, "chats", chatId, "messages"), {
                text: `${currentUser.displayName || 'Admin'} promoted ${name} to Admin`,
                sender: "system",
                timestamp: serverTimestamp(),
                type: "system"
            });
        } catch (e) {
            alert("Error promoting member: " + e.message);
        }
    };

    if (loading) return null;
    if (!chatData) return null;

    const isGroup = chatData.type === 'group';
    const chatName = isGroup ? chatData.groupName : (members[0]?.name || members[0]?.email || "User");
    const chatPhoto = isGroup ? chatData.groupImage : members[0]?.photoURL;
    const subtitle = isGroup ? `${members.length} members` : (members[0]?.email || "");
    const amIAdmin = chatData.admin?.includes(currentUser.uid);

    return (
        <>
            <div className="modal-overlay">
                <div className="modal">

                    {/* Profile Image */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '1.5rem' }}>
                        {chatPhoto ? (
                            <img
                                src={chatPhoto}
                                alt=""
                                style={{ width: '96px', height: '96px', borderRadius: '50%', objectFit: 'cover', border: 'none', marginBottom: '1rem', background: '#6366f1' }}
                            />
                        ) : (
                            <div style={{ width: '96px', height: '96px', borderRadius: '50%', background: '#6366f1', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1rem', fontSize: '2.5rem', color: 'white', fontWeight: 500 }}>
                                {chatName.charAt(0).toUpperCase()}
                            </div>
                        )}
                        <h2 style={{ color: 'white', fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.25rem' }}>{chatName}</h2>
                        <p style={{ color: '#94a3b8', fontSize: '0.9rem' }}>{subtitle}</p>
                    </div>

                    {/* Members List */}
                    {isGroup && (
                        <div style={{ textAlign: 'left', marginBottom: '1.5rem' }}>
                            <h4 style={{ color: '#6366f1', fontSize: '0.9rem', marginBottom: '0.75rem', paddingBottom: '0.25rem', borderBottom: '1px solid #1e293b' }}>Members</h4>

                            <div style={{ maxHeight: '220px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                {members.map(member => (
                                    <div key={member.uid} className="member-item" style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 0' }}>
                                        <img src={member.photoURL || `https://ui-avatars.com/api/?name=${member.name}&background=random`} alt="" style={{ width: '36px', height: '36px', borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />

                                        <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                                            <div style={{ color: 'white', fontWeight: 500, display: 'flex', alignItems: 'center', fontSize: '0.9rem' }}>
                                                {member.name || "User"}
                                                {member.uid === currentUser.uid && <span style={{ color: '#94a3b8', marginLeft: '4px', fontWeight: 400 }}>(You)</span>}
                                                {member.isAdmin && <span style={{ color: '#fbbf24', fontSize: '0.7rem', border: '1px solid #fbbf24', padding: '0 4px', borderRadius: '4px', marginLeft: '6px', lineHeight: 1 }}>ADMIN</span>}
                                            </div>
                                            <div style={{ color: '#64748b', fontSize: '0.75rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{member.email}</div>
                                        </div>

                                        {/* Admin Actions */}
                                        {amIAdmin && member.uid !== currentUser.uid && (
                                            <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.5rem' }}>
                                                {!member.isAdmin && (
                                                    <button
                                                        onClick={() => promoteMember(member.uid, member.name)}
                                                        style={{ background: 'none', border: '1px solid #10b981', color: '#10b981', padding: '2px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.75rem' }}
                                                    >
                                                        Promote
                                                    </button>
                                                )}
                                                <button
                                                    onClick={() => kickMember(member.uid, member.name)}
                                                    style={{ background: 'none', border: '1px solid #ef4444', color: '#ef4444', padding: '2px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.75rem' }}
                                                >
                                                    Kick
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Action Buttons */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        {isGroup && (
                            <>
                                <button
                                    onClick={() => setShowAddMember(true)}
                                    style={{ width: '100%', padding: '0.875rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '8px', fontSize: '1rem', fontWeight: 600, cursor: 'pointer', boxShadow: '0 4px 6px -1px rgba(59, 130, 246, 0.5)' }}
                                >
                                    Add Member
                                </button>
                                <button
                                    onClick={leaveGroup}
                                    style={{ width: '100%', padding: '0.875rem', background: '#ef4444', color: 'white', border: 'none', borderRadius: '8px', fontSize: '1rem', fontWeight: 600, cursor: 'pointer', boxShadow: '0 4px 6px -1px rgba(239, 68, 68, 0.5)' }}
                                >
                                    Leave Group
                                </button>
                            </>
                        )}
                        <button
                            onClick={() => setShowMedia(true)}
                            style={{ width: '100%', padding: '0.875rem', background: '#10b981', color: 'white', border: 'none', borderRadius: '8px', fontSize: '1rem', fontWeight: 600, cursor: 'pointer', boxShadow: '0 4px 6px -1px rgba(16, 185, 129, 0.5)' }}
                        >
                            📷 View Media
                        </button>
                        <button
                            onClick={onClose}
                            style={{ width: '100%', padding: '0.875rem', background: '#0f172a', color: '#94a3b8', border: '1px solid #334155', borderRadius: '8px', fontSize: '1rem', fontWeight: 600, cursor: 'pointer' }}
                        >
                            Close
                        </button>
                    </div>

                </div>
            </div>

            {/* Nested Modals - Moved here to sit on TOP of the ChatInfoModal */}
            {showAddMember && (
                <AddMemberModal
                    chatId={chatId}
                    onClose={() => setShowAddMember(false)}
                />
            )}
            {showMedia && (
                <MediaGalleryModal
                    chatId={chatId}
                    onClose={() => setShowMedia(false)}
                />
            )}
        </>
    );
}
