import { useState, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { db, storage } from '../../services/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

export default function SettingsModal({ onClose }) {
    const { currentUser, logout } = useAuth();
    const [username, setUsername] = useState(currentUser?.displayName || "");
    const [saving, setSaving] = useState(false);
    const fileInputRef = useRef(null);

    // Photo Confirm State
    const [confirmPhoto, setConfirmPhoto] = useState(null); // { file, preview }
    const [uploadingPhoto, setUploadingPhoto] = useState(false);

    const handlePhotoChange = (e) => {
        if (e.target.files[0]) {
            const file = e.target.files[0];
            setConfirmPhoto({
                file: file,
                preview: URL.createObjectURL(file)
            });
            // Clear input so same file can be selected again if cancelled
            e.target.value = null;
        }
    };

    const cancelPhoto = () => {
        setConfirmPhoto(null);
    };

    const uploadPhoto = async () => {
        if (!confirmPhoto) return;
        setUploadingPhoto(true);

        try {
            const imgRef = ref(storage, `profile_pics/${currentUser.uid}`);
            await uploadBytes(imgRef, confirmPhoto.file);
            const newPhotoURL = await getDownloadURL(imgRef);

            await updateDoc(doc(db, "users", currentUser.uid), {
                photoURL: newPhotoURL
            });

            // Update local auth state if possible or reload
            // Since useAuth listens to onAuthStateChanged, we might need to reload or wait for propagation
            // Reload is safest for legacy parity visuals updating everywhere
            location.reload();
        } catch (e) {
            alert("Error uploading photo: " + e.message);
            setUploadingPhoto(false);
        }
    };

    const handleSaveUsername = async () => {
        if (!username.trim()) return;
        setSaving(true);
        try {
            await updateDoc(doc(db, "users", currentUser.uid), {
                name: username,
                displayName: username
            });
            location.reload();
        } catch (e) {
            alert("Error saving: " + e.message);
        } finally {
            setSaving(false);
        }
    };

    const confirmLogout = () => {
        if (confirm("Are you sure you want to logout?")) {
            logout();
        }
    };

    return (
        <>
            <div className="modal-overlay">
                <div className="modal">

                    <h3 style={{ color: 'white', marginBottom: '1.25rem', fontSize: '1.25rem', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
                        Settings
                    </h3>

                    {/* Profile Photo with Camera Icon */}
                    <div
                        style={{ position: 'relative', width: '80px', margin: '0 auto 1rem auto', cursor: 'pointer' }}
                        onClick={() => fileInputRef.current?.click()}
                    >
                        <img
                            src={currentUser?.photoURL || "https://ui-avatars.com/api/?name=User"}
                            alt="Profile"
                            style={{ width: '80px', height: '80px', borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--primary)' }}
                        />
                        <div style={{ position: 'absolute', bottom: 0, right: 0, background: 'var(--primary)', borderRadius: '50%', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid var(--dark)' }}>
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
                                <circle cx="12" cy="13" r="4"></circle>
                            </svg>
                        </div>
                    </div>
                    <input
                        type="file"
                        ref={fileInputRef}
                        accept="image/*"
                        style={{ display: 'none' }}
                        onChange={handlePhotoChange}
                    />

                    {/* Username Input */}
                    <input
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        placeholder="Enter new username"
                        maxLength={50}
                        className="modal-input"
                        style={{ width: '100%', padding: '0.75rem 1rem', background: 'rgba(30, 41, 59, 0.7)', color: 'white', border: '1px solid rgba(99, 102, 241, 0.3)', borderRadius: '8px', marginBottom: '1rem', fontSize: '0.875rem' }}
                    />

                    {/* Buttons */}
                    <button
                        onClick={handleSaveUsername}
                        disabled={saving}
                        className="modal-btn"
                        style={{ padding: '0.75rem 1.25rem', marginBottom: '0.75rem', background: 'linear-gradient(135deg, var(--primary), var(--primary-dark))', color: 'white', border: 'none', borderRadius: '8px', width: '100%', fontWeight: 600, cursor: 'pointer' }}
                    >
                        {saving ? "Saving..." : "Save Username"}
                    </button>

                    <button
                        onClick={confirmLogout}
                        className="modal-btn danger"
                        style={{ padding: '0.75rem 1.25rem', marginBottom: '0.75rem', background: 'linear-gradient(135deg, var(--danger), #dc2626)', color: 'white', border: 'none', borderRadius: '8px', width: '100%', fontWeight: 600, cursor: 'pointer' }}
                    >
                        Logout
                    </button>

                    <button
                        onClick={onClose}
                        className="modal-btn secondary"
                        style={{ padding: '0.75rem 1.25rem', background: 'transparent', color: 'var(--primary-light)', border: '1px solid rgba(99, 102, 241, 0.3)', borderRadius: '8px', width: '100%', fontWeight: 600, cursor: 'pointer' }}
                    >
                        Close
                    </button>
                </div>
            </div>

            {/* Confirmation Overlay for Photo */}
            {confirmPhoto && (
                <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.85)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(5px)' }}>
                    <div style={{ background: '#0f172a', padding: '2rem', borderRadius: '16px', border: '1px solid #6366f1', maxWidth: '300px', width: '90%', textAlign: 'center' }}>
                        <h3 style={{ color: 'white', marginBottom: '1rem', fontSize: '1.2rem' }}>Use this photo?</h3>
                        <img
                            src={confirmPhoto.preview}
                            style={{ width: '120px', height: '120px', borderRadius: '50%', objectFit: 'cover', margin: '0 auto 1.5rem auto', border: '4px solid #6366f1', display: 'block' }}
                        />
                        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
                            <button
                                onClick={cancelPhoto}
                                disabled={uploadingPhoto}
                                className="modal-btn secondary"
                                style={{ marginTop: 0, width: 'auto', padding: '0.5rem 1rem' }}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={uploadPhoto}
                                disabled={uploadingPhoto}
                                className="modal-btn"
                                style={{ marginTop: 0, width: 'auto', padding: '0.5rem 1rem' }}
                            >
                                {uploadingPhoto ? "Uploading..." : "Yes, Confirm"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
