import { useState, useEffect } from 'react';
import { db } from '../../services/firebase';
import { collection, query, where, orderBy, getDocs } from 'firebase/firestore';

export default function MediaGalleryModal({ chatId, onClose }) {
    const [images, setImages] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchImages = async () => {
            try {
                const q = query(
                    collection(db, "chats", chatId, "messages"),
                    where("type", "==", "image"),
                    orderBy("timestamp", "desc")
                );
                const snapshot = await getDocs(q);
                setImages(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
            } catch (error) {
                console.error("Error fetching media:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchImages();
    }, [chatId]);

    return (
        <div className="modal-overlay">
            <div className="modal" style={{ maxWidth: '600px', width: '90%', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <h2 style={{ color: 'var(--app-text)', fontSize: '1.2rem', margin: 0 }}>Media Gallery</h2>
                    <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '1.5rem' }}>&times;</button>
                </div>

                <div style={{ flexGrow: 1, overflowY: 'auto' }}>
                    {loading ? (
                        <div style={{ textAlign: 'center', color: 'var(--app-text-muted)', padding: '2rem' }}>Loading images...</div>
                    ) : images.length === 0 ? (
                        <div style={{ textAlign: 'center', color: 'var(--app-text-muted)', padding: '2rem' }}>No media shared in this chat.</div>
                    ) : (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem' }}>
                            {images.map(img => (
                                <div
                                    key={img.id}
                                    onClick={() => window.open(img.fileURL, '_blank')}
                                    style={{ aspectRatio: '1/1', cursor: 'pointer', overflow: 'hidden', borderRadius: '4px', position: 'relative', background: 'var(--input-bg)' }}
                                >
                                    <img
                                        src={img.fileURL}
                                        alt="shared media"
                                        style={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 0.2s' }}
                                        onMouseOver={(e) => e.target.style.transform = 'scale(1.1)'}
                                        onMouseOut={(e) => e.target.style.transform = 'scale(1)'}
                                    />
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <button
                    onClick={onClose}
                    style={{ marginTop: '1rem', width: '100%', padding: '0.75rem', background: 'var(--input-bg)', color: 'var(--app-text-muted)', border: '1px solid var(--border-color)', borderRadius: '8px', cursor: 'pointer' }}
                >
                    Close
                </button>
            </div>
        </div>
    );
}
