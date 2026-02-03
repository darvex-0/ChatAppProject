import { useState, useRef, useCallback, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useUI } from '../../context/UIContext';
import { db, storage } from '../../services/firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { updateProfile } from 'firebase/auth';
import Cropper from 'react-easy-crop';
import getCroppedImg from '../../utils/cropImage';

export default function SettingsModal({ onClose }) {
    const { currentUser, logout } = useAuth();
    const { notificationSettings, updateNotificationSettings } = useUI();
    const [username, setUsername] = useState(currentUser?.displayName || "");
    const [status, setStatus] = useState("");
    const [saving, setSaving] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);
    const fileInputRef = useRef(null);

    // Cropper State
    const [imageSrc, setImageSrc] = useState(null);
    const [crop, setCrop] = useState({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(1);
    const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
    const [uploadingPhoto, setUploadingPhoto] = useState(false);

    // Fetch user data from Firestore on mount
    useEffect(() => {
        const fetchUserData = async () => {
            if (!currentUser) return;
            try {
                const userDoc = await getDoc(doc(db, "users", currentUser.uid));
                if (userDoc.exists()) {
                    const data = userDoc.data();
                    setStatus(data.status || "");
                    // Also update username from Firestore if different
                    if (data.name) {
                        setUsername(data.name);
                    }
                }
            } catch (e) {
                console.error("Error fetching user data:", e);
            }
        };
        fetchUserData();
    }, [currentUser]);

    const handlePhotoChange = (e) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            const reader = new FileReader();
            reader.onload = () => {
                setImageSrc(reader.result);
            };
            reader.readAsDataURL(file);
            e.target.value = null;
        }
    };

    const onCropComplete = useCallback((croppedArea, croppedAreaPixels) => {
        setCroppedAreaPixels(croppedAreaPixels);
    }, []);

    const cancelCrop = () => {
        setImageSrc(null);
        setCrop({ x: 0, y: 0 });
        setZoom(1);
        setCroppedAreaPixels(null);
    };

    const uploadCroppedPhoto = async () => {
        if (!imageSrc || !croppedAreaPixels) return;
        setUploadingPhoto(true);

        try {
            const croppedBlob = await getCroppedImg(imageSrc, croppedAreaPixels);
            const imgRef = ref(storage, `profile_pics/${currentUser.uid}`);
            await uploadBytes(imgRef, croppedBlob);
            const newPhotoURL = await getDownloadURL(imgRef);

            // Update Firestore
            await updateDoc(doc(db, "users", currentUser.uid), {
                photoURL: newPhotoURL
            });

            // Update Firebase Auth profile
            await updateProfile(currentUser, {
                photoURL: newPhotoURL
            });

            // Reset cropper state
            cancelCrop();
            setSaveSuccess(true);
            setTimeout(() => setSaveSuccess(false), 2000);
        } catch (e) {
            alert("Error uploading photo: " + e.message);
        } finally {
            setUploadingPhoto(false);
        }
    };

    const handleSaveProfile = async () => {
        if (!username.trim()) return;
        setSaving(true);
        try {
            await updateDoc(doc(db, "users", currentUser.uid), {
                name: username,
                displayName: username,
                status: status,
                lowerCaseName: username.toLowerCase()
            });

            // Update Firebase Auth display name
            await updateProfile(currentUser, {
                displayName: username
            });

            setSaveSuccess(true);
            setTimeout(() => setSaveSuccess(false), 2000);
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
                <div className="modal" style={{ maxWidth: '400px' }}>

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
                    <label style={{ color: '#94a3b8', fontSize: '0.8rem', marginBottom: '4px', display: 'block' }}>Display Name</label>
                    <input
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        placeholder="Enter your name"
                        maxLength={50}
                        className="modal-input"
                        style={{ width: '100%', padding: '0.75rem 1rem', background: 'rgba(30, 41, 59, 0.7)', color: 'white', border: '1px solid rgba(99, 102, 241, 0.3)', borderRadius: '8px', marginBottom: '1rem', fontSize: '0.875rem' }}
                    />

                    {/* Status Input */}
                    <label style={{ color: '#94a3b8', fontSize: '0.8rem', marginBottom: '4px', display: 'block' }}>About / Status</label>
                    <input
                        value={status}
                        onChange={(e) => setStatus(e.target.value)}
                        placeholder="What's on your mind?"
                        maxLength={100}
                        className="modal-input"
                        style={{ width: '100%', padding: '0.75rem 1rem', background: 'rgba(30, 41, 59, 0.7)', color: 'white', border: '1px solid rgba(99, 102, 241, 0.3)', borderRadius: '8px', marginBottom: '1rem', fontSize: '0.875rem' }}
                    />

                    {/* Notification Settings Section */}
                    <div style={{ marginBottom: '1.5rem', marginTop: '1.5rem', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '1rem' }}>
                        <h4 style={{ color: '#cbd5e1', fontSize: '0.9rem', marginBottom: '1rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span style={{ fontSize: '1.1rem' }}>🔔</span> Notification Settings
                        </h4>

                        {/* Toggle Option: Sound */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                            <span style={{ color: 'white', fontSize: '0.9rem' }}>Sound Effects</span>
                            <div
                                onClick={() => updateNotificationSettings('sound', !notificationSettings.sound)}
                                style={{
                                    width: '44px', height: '24px',
                                    background: notificationSettings.sound ? '#10b981' : 'rgba(255,255,255,0.2)',
                                    borderRadius: '99px',
                                    position: 'relative',
                                    cursor: 'pointer',
                                    transition: 'background 0.3s ease'
                                }}
                            >
                                <div style={{
                                    width: '18px', height: '18px',
                                    background: 'white',
                                    borderRadius: '50%',
                                    position: 'absolute',
                                    top: '3px',
                                    left: notificationSettings.sound ? '23px' : '3px',
                                    transition: 'left 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
                                }} />
                            </div>
                        </div>

                        {/* Toggle Option: Desktop Notifications */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                            <span style={{ color: 'white', fontSize: '0.9rem' }}>Desktop Notifications</span>
                            <div
                                onClick={() => updateNotificationSettings('desktop', !notificationSettings.desktop)}
                                style={{
                                    width: '44px', height: '24px',
                                    background: notificationSettings.desktop ? '#10b981' : 'rgba(255,255,255,0.2)',
                                    borderRadius: '99px',
                                    position: 'relative',
                                    cursor: 'pointer',
                                    transition: 'background 0.3s ease'
                                }}
                            >
                                <div style={{
                                    width: '18px', height: '18px',
                                    background: 'white',
                                    borderRadius: '50%',
                                    position: 'absolute',
                                    top: '3px',
                                    left: notificationSettings.desktop ? '23px' : '3px',
                                    transition: 'left 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
                                }} />
                            </div>
                        </div>

                        {/* Toggle Option: Message Preview */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ color: 'white', fontSize: '0.9rem' }}>Message Preview</span>
                            <div
                                onClick={() => updateNotificationSettings('preview', !notificationSettings.preview)}
                                style={{
                                    width: '44px', height: '24px',
                                    background: notificationSettings.preview ? '#10b981' : 'rgba(255,255,255,0.2)',
                                    borderRadius: '99px',
                                    position: 'relative',
                                    cursor: 'pointer',
                                    transition: 'background 0.3s ease'
                                }}
                            >
                                <div style={{
                                    width: '18px', height: '18px',
                                    background: 'white',
                                    borderRadius: '50%',
                                    position: 'absolute',
                                    top: '3px',
                                    left: notificationSettings.preview ? '23px' : '3px',
                                    transition: 'left 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
                                }} />
                            </div>
                        </div>
                    </div>

                    {/* Buttons */}
                    <button
                        onClick={handleSaveProfile}
                        disabled={saving}
                        className="modal-btn"
                        style={{ padding: '0.75rem 1.25rem', marginBottom: '0.75rem', background: saveSuccess ? 'linear-gradient(135deg, #10b981, #059669)' : 'linear-gradient(135deg, var(--primary), var(--primary-dark))', color: 'white', border: 'none', borderRadius: '8px', width: '100%', fontWeight: 600, cursor: 'pointer', transition: 'background 0.3s' }}
                    >
                        {saving ? "Saving..." : saveSuccess ? "✓ Saved!" : "Save Profile"}
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

            {/* Cropper Overlay */}
            {imageSrc && (
                <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.95)', zIndex: 1100, display: 'flex', flexDirection: 'column' }}>
                    {/* Cropper Area */}
                    <div style={{ position: 'relative', flexGrow: 1 }}>
                        <Cropper
                            image={imageSrc}
                            crop={crop}
                            zoom={zoom}
                            aspect={1}
                            cropShape="round"
                            showGrid={false}
                            onCropChange={setCrop}
                            onZoomChange={setZoom}
                            onCropComplete={onCropComplete}
                        />
                    </div>

                    {/* Zoom Slider */}
                    <div style={{ padding: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1rem' }}>
                        <span style={{ color: '#94a3b8', fontSize: '0.8rem' }}>Zoom</span>
                        <input
                            type="range"
                            min={1}
                            max={3}
                            step={0.1}
                            value={zoom}
                            onChange={(e) => setZoom(Number(e.target.value))}
                            style={{ width: '150px', accentColor: 'var(--primary)' }}
                        />
                    </div>

                    {/* Action Buttons */}
                    <div style={{ padding: '1rem', display: 'flex', justifyContent: 'center', gap: '1rem' }}>
                        <button
                            onClick={cancelCrop}
                            disabled={uploadingPhoto}
                            style={{ padding: '0.75rem 1.5rem', background: '#334155', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 600, cursor: 'pointer' }}
                        >
                            Cancel
                        </button>
                        <button
                            onClick={uploadCroppedPhoto}
                            disabled={uploadingPhoto}
                            style={{ padding: '0.75rem 1.5rem', background: 'var(--primary)', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 600, cursor: 'pointer' }}
                        >
                            {uploadingPhoto ? "Uploading..." : "Apply"}
                        </button>
                    </div>
                </div>
            )}
        </>
    );
}
