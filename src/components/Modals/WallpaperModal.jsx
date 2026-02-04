import { useState, useRef } from 'react';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../../services/firebase';
import imageCompression from 'browser-image-compression';

const PRESET_COLORS = [
    '#0f172a', // Default Dark
    '#1e293b', // Slate
    '#334155', // Light Slate
    '#171717', // Neutral
    '#3f3f46', // Zinc
    '#5b21b6', // Violet
    '#1e1b4b', // Indigo
    '#064e3b', // Emerald
    '#7f1d1d', // Red
    '#451a03', // Amber
];

const PRESET_GRADIENTS = [
    'linear-gradient(135deg, #0f172a 0%, #334155 100%)', // Default
    'linear-gradient(to right, #243949 0%, #517fa4 100%)', // Blue Steel
    'linear-gradient(to right, #434343 0%, black 100%)', // Midnight
    'linear-gradient(to right, #868f96 0%, #596164 100%)', // Grey
    'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', // Plum
    'linear-gradient(135deg, #134E5E 0%, #71B280 100%)', // Emerald
    'linear-gradient(135deg, #2b5876 0%, #4e4376 100%)', // Deep Space
    'linear-gradient(to right, #b92b27, #1565c0)', // Fire & Ice
];

export default function WallpaperModal({ isOpen, onClose, onUpdateWallpaper }) {
    const [uploading, setUploading] = useState(false);
    const fileInputRef = useRef(null);

    if (!isOpen) return null;

    const handleFileUpload = async (e) => {
        if (!e.target.files[0]) return;
        setUploading(true);

        try {
            const file = e.target.files[0];

            // Compress image
            const options = {
                maxSizeMB: 1,
                maxWidthOrHeight: 1920,
                useWebWorker: true
            };
            const compressedFile = await imageCompression(file, options);

            const fileRef = ref(storage, `wallpapers/${Date.now()}_${file.name}`);
            await uploadBytes(fileRef, compressedFile);
            const downloadURL = await getDownloadURL(fileRef);

            onUpdateWallpaper(`url(${downloadURL})`);
            onClose();
        } catch (error) {
            console.error("Error uploading wallpaper:", error);
            alert("Failed to upload wallpaper");
        } finally {
            setUploading(false);
        }
    };

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
            background: 'var(--modal-overlay)', zIndex: 3000,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            backdropFilter: 'blur(5px)'
        }}>
            <div style={{
                background: 'var(--modal-bg)', padding: '2rem', borderRadius: '16px',
                border: '1px solid var(--border-color)', maxWidth: '500px', width: '90%',
                boxShadow: 'var(--modal-shadow)',
                maxHeight: '80vh', overflowY: 'auto'
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                    <h2 style={{ color: 'var(--app-text)', fontSize: '1.25rem', fontWeight: 600, margin: 0 }}>🎨 Chat Wallpaper</h2>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '1.5rem' }}>&times;</button>
                </div>

                {/* Upload Section */}
                <div style={{ marginBottom: '2rem' }}>
                    <div style={{ color: '#94a3b8', fontSize: '0.85rem', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '1px' }}>Custom Image</div>
                    <input
                        type="file"
                        ref={fileInputRef}
                        style={{ display: 'none' }}
                        accept="image/*"
                        onChange={handleFileUpload}
                    />
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploading}
                        style={{
                            width: '100%', padding: '0.75rem',
                            background: 'var(--input-bg)',
                            border: '1px dashed var(--border-color)',
                            borderRadius: '8px', color: 'var(--app-text)', cursor: 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                            transition: 'all 0.2s'
                        }}
                    >
                        {uploading ? 'Uploading...' : (
                            <>
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                                Upload Photo
                            </>
                        )}
                    </button>
                </div>

                {/* Solid Colors */}
                <div style={{ marginBottom: '2rem' }}>
                    <div style={{ color: '#94a3b8', fontSize: '0.85rem', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '1px' }}>Solid Colors</div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '10px' }}>
                        {PRESET_COLORS.map(color => (
                            <div
                                key={color}
                                onClick={() => { onUpdateWallpaper(color); onClose(); }}
                                style={{
                                    height: '50px', borderRadius: '8px', background: color,
                                    cursor: 'pointer', border: '2px solid rgba(255,255,255,0.1)',
                                    transition: 'transform 0.1s'
                                }}
                                onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.05)'}
                                onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                            />
                        ))}
                    </div>
                </div>

                {/* Gradients */}
                <div style={{ marginBottom: '2rem' }}>
                    <div style={{ color: '#94a3b8', fontSize: '0.85rem', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '1px' }}>Gradients</div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
                        {PRESET_GRADIENTS.map((gradient, idx) => (
                            <div
                                key={idx}
                                onClick={() => { onUpdateWallpaper(gradient); onClose(); }}
                                style={{
                                    height: '60px', borderRadius: '8px', background: gradient,
                                    cursor: 'pointer', border: '2px solid rgba(255,255,255,0.1)',
                                    transition: 'transform 0.1s'
                                }}
                                onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.02)'}
                                onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                            />
                        ))}
                    </div>
                </div>

                {/* Reset Button */}
                <button
                    onClick={() => { onUpdateWallpaper(null); onClose(); }}
                    style={{
                        width: '100%', padding: '0.75rem',
                        background: 'rgba(239, 68, 68, 0.1)',
                        border: '1px solid rgba(239, 68, 68, 0.3)',
                        borderRadius: '8px', color: '#ef4444', cursor: 'pointer',
                        fontWeight: 500
                    }}
                >
                    Reset to Default
                </button>
            </div>
        </div>
    );
}
