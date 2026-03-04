import { useState, useRef } from 'react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../../services/firebase';
import { useAuth } from '../../context/AuthContext';
import MediaPreviewModal from './MediaPreviewModal';

const GRADIENTS = [
    'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
    'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
    'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
    'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
    'linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)',
];

export default function CreateStoryModal({ onClose }) {
    const { currentUser } = useAuth();
    const [mode, setMode] = useState('text'); // 'text' | 'media'
    const [storyText, setStoryText] = useState('');
    const [selectedGradient, setSelectedGradient] = useState(GRADIENTS[0]);
    const [mediaFile, setMediaFile] = useState(null);
    const [mediaPreview, setMediaPreview] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const fileInputRef = useRef(null);

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (file.size > 25 * 1024 * 1024) {
            alert('File too large! Max 25MB.');
            return;
        }
        setMediaFile(file);
        setMediaPreview(URL.createObjectURL(file));
    };

    const handlePostTextStory = async () => {
        if (!storyText.trim()) {
            alert('Please type something for your story!');
            return;
        }

        setUploading(true);
        try {
            await addDoc(collection(db, 'stories'), {
                uid: currentUser.uid,
                userName: currentUser.displayName || currentUser.email?.split('@')[0] || 'User',
                userPhoto: currentUser.photoURL || null,
                type: 'text',
                text: storyText.trim(),
                bgGradient: selectedGradient,
                mediaURL: null,
                createdAt: serverTimestamp(),
                viewers: []
            });
            onClose();
        } catch (err) {
            console.error('Error posting story:', err);
            alert('Failed to post story. Please try again.');
        } finally {
            setUploading(false);
        }
    };

    const handlePostMediaStory = async (finalFile, caption, metadata) => {
        setUploading(true);
        try {
            const isVideo = finalFile.type.startsWith('video/');
            const storyType = isVideo ? 'video' : 'image';
            const storageRef = ref(storage, `stories/${currentUser.uid}/${Date.now()}_${finalFile.name}`);

            let mediaURL = null;
            await new Promise((resolve, reject) => {
                const task = uploadBytesResumable(storageRef, finalFile);
                task.on('state_changed',
                    snap => setUploadProgress(Math.round((snap.bytesTransferred / snap.totalBytes) * 100)),
                    reject,
                    async () => {
                        mediaURL = await getDownloadURL(task.snapshot.ref);
                        resolve();
                    }
                );
            });

            await addDoc(collection(db, 'stories'), {
                uid: currentUser.uid,
                userName: currentUser.displayName || currentUser.email?.split('@')[0] || 'User',
                userPhoto: currentUser.photoURL || null,
                type: storyType,
                text: caption ? caption.trim() : null,
                bgGradient: null,
                mediaURL: mediaURL,
                metadata: metadata || null,
                createdAt: serverTimestamp(),
                viewers: []
            });

            onClose();
        } catch (err) {
            console.error('Error posting media story:', err);
            alert('Failed to post story. Please try again.');
        } finally {
            setUploading(false);
            setUploadProgress(0);
        }
    };
    if (mode === 'media' && mediaFile) {
        return (
            <>
                <MediaPreviewModal
                    file={mediaFile}
                    onSend={handlePostMediaStory}
                    onCancel={() => { setMediaFile(null); setMediaPreview(null); }}
                />
                {/* Optional overlay to show upload progress over the MediaPreviewModal */}
                {uploading && (
                    <div style={{
                        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                        background: 'rgba(0,0,0,0.8)', zIndex: 9999,
                        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center'
                    }}>
                        <div style={{ width: '80%', maxWidth: '300px' }}>
                            <div style={{ height: '8px', background: 'var(--border-color)', borderRadius: '4px' }}>
                                <div style={{ height: '100%', width: `${uploadProgress}%`, background: 'var(--primary)', borderRadius: '4px', transition: 'width 0.3s' }} />
                            </div>
                            <p style={{ color: 'white', textAlign: 'center', marginTop: '1rem' }}>Uploading... {uploadProgress}%</p>
                        </div>
                    </div>
                )}
            </>
        );
    }

    return (
        <div className="modal-overlay" style={{ zIndex: 9999 }}>
            <div className="modal" style={{ maxWidth: '26rem', padding: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                    <h3 style={{ color: 'var(--app-text)', fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>
                        📸 Create Story
                    </h3>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--app-text-muted)', cursor: 'pointer', fontSize: '1.25rem' }}>✕</button>
                </div>

                {/* Mode Tabs */}
                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem', background: 'var(--input-bg)', borderRadius: '10px', padding: '0.25rem' }}>
                    {['text', 'media'].map(m => (
                        <button key={m} onClick={() => setMode(m)} style={{
                            flex: 1, padding: '0.5rem', borderRadius: '8px', border: 'none', cursor: 'pointer',
                            background: mode === m ? 'var(--primary)' : 'transparent',
                            color: mode === m ? 'white' : 'var(--app-text-muted)',
                            fontWeight: mode === m ? 600 : 400,
                            transition: 'all 0.2s', fontSize: '0.85rem'
                        }}>
                            {m === 'text' ? '✏️ Text' : '🖼️ Media'}
                        </button>
                    ))}
                </div>

                {mode === 'text' ? (
                    <>
                        {/* Text Preview */}
                        <div style={{
                            background: selectedGradient,
                            borderRadius: '12px',
                            height: '200px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            marginBottom: '1rem',
                            padding: '1rem'
                        }}>
                            <p style={{
                                color: 'white',
                                fontSize: '1.25rem',
                                fontWeight: 700,
                                textAlign: 'center',
                                textShadow: '0 1px 4px rgba(0,0,0,0.4)',
                                wordBreak: 'break-word',
                                margin: 0
                            }}>
                                {storyText || 'Your story text...'}
                            </p>
                        </div>

                        <textarea
                            value={storyText}
                            onChange={e => setStoryText(e.target.value)}
                            maxLength={200}
                            placeholder="What's on your mind?"
                            className="modal-input"
                            style={{
                                width: '100%', minHeight: '80px', resize: 'vertical',
                                marginBottom: '1rem', fontSize: '0.95rem'
                            }}
                        />

                        {/* Gradient Picker */}
                        <p style={{ fontSize: '0.8rem', color: 'var(--app-text-muted)', marginBottom: '0.5rem' }}>Choose background:</p>
                        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1.25rem' }}>
                            {GRADIENTS.map((g, i) => (
                                <div
                                    key={i}
                                    onClick={() => setSelectedGradient(g)}
                                    style={{
                                        width: '36px', height: '36px', borderRadius: '50%',
                                        background: g, cursor: 'pointer',
                                        border: selectedGradient === g ? '3px solid white' : '3px solid transparent',
                                        boxShadow: selectedGradient === g ? '0 0 0 2px var(--primary)' : 'none',
                                        transition: 'all 0.15s'
                                    }}
                                />
                            ))}
                        </div>
                    </>
                ) : (
                    <>
                        {/* Media file selection state */}
                        <div
                            onClick={() => fileInputRef.current?.click()}
                            style={{
                                height: '200px', border: '2px dashed var(--border-color)', borderRadius: '12px',
                                display: 'flex', flexDirection: 'column', alignItems: 'center',
                                justifyContent: 'center', cursor: 'pointer', marginBottom: '1rem',
                                background: 'var(--input-bg)', transition: 'border-color 0.2s'
                            }}
                            onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--primary)'}
                            onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border-color)'}
                        >
                            <span style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>📷</span>
                            <span style={{ color: 'var(--app-text-muted)', fontSize: '0.9rem' }}>Click to select photo or video</span>
                        </div>
                        <input type="file" ref={fileInputRef} accept="image/*,video/*" style={{ display: 'none' }} onChange={handleFileChange} />
                    </>
                )}

                <div style={{ display: 'flex', gap: '0.75rem' }}>
                    <button onClick={onClose} className="modal-btn secondary" style={{ flex: 1 }} disabled={uploading}>Cancel</button>
                    <button
                        onClick={mode === 'text' ? handlePostTextStory : () => fileInputRef.current?.click()}
                        className="modal-btn"
                        style={{ flex: 1 }}
                        disabled={uploading}
                    >
                        {mode === 'text' ? '🚀 Post Story' : '📷 Select Media'}
                    </button>
                </div>
            </div>
        </div>
    );
}
