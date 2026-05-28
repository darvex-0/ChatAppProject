import { useState, useEffect, useRef, useCallback } from 'react';
import { doc, updateDoc, arrayUnion, deleteDoc, getDoc } from 'firebase/firestore';
import { ref, deleteObject } from 'firebase/storage';
import { db, storage } from '../../services/firebase';
import { useAuth } from '../../context/AuthContext';
import { useUI } from '../../context/UIContext';

const STORY_DURATION_MS = 5000; // 5 seconds per story

export default function StoryViewer({ uid, stories, onClose }) {
    const { currentUser } = useAuth();
    const [currentIndex, setCurrentIndex] = useState(0);
    const [paused, setPaused] = useState(false);
    const [progress, setProgress] = useState(0);
    const timerRef = useRef(null);
    const startTimeRef = useRef(null);
    const elapsedRef = useRef(0);
    const touchStartRef = useRef(null);
    const { showToast } = useUI();
    const [showViewers, setShowViewers] = useState(false);
    const [viewerDetails, setViewerDetails] = useState([]);
    const [isDeleting, setIsDeleting] = useState(false);

    const currentStory = stories[currentIndex];

    const goNext = useCallback(() => {
        if (currentIndex < stories.length - 1) {
            setCurrentIndex(prev => prev + 1);
            setProgress(0);
            elapsedRef.current = 0;
        } else {
            onClose();
        }
    }, [currentIndex, stories.length, onClose]);

    const goPrev = useCallback(() => {
        if (currentIndex > 0) {
            setCurrentIndex(prev => prev - 1);
            setProgress(0);
            elapsedRef.current = 0;
        }
    }, [currentIndex]);

    // Mark story as viewed
    useEffect(() => {
        if (!currentStory) return;
        const storyRef = doc(db, 'stories', currentStory.id);

        // Track both the array (for list length) and a map (for timestamps)
        const updateData = {
            viewers: arrayUnion(currentUser.uid),
            [`viewersInfo.${currentUser.uid}`]: new Date().toISOString()
        };
        updateDoc(storyRef, updateData).catch(() => { }); // non-critical
    }, [currentStory, currentUser.uid]);

    // Auto-advance timer with pause support
    useEffect(() => {
        if (paused || showViewers) {
            clearInterval(timerRef.current);
            return;
        }

        startTimeRef.current = Date.now() - elapsedRef.current;

        timerRef.current = setInterval(() => {
            const elapsed = Date.now() - startTimeRef.current;
            const pct = Math.min((elapsed / STORY_DURATION_MS) * 100, 100);
            setProgress(pct);
            elapsedRef.current = elapsed;

            if (elapsed >= STORY_DURATION_MS) {
                clearInterval(timerRef.current);
                goNext();
            }
        }, 50);

        return () => clearInterval(timerRef.current);
    }, [paused, currentIndex, goNext]);

    // Keyboard navigation
    useEffect(() => {
        const handler = (e) => {
            if (e.key === 'ArrowRight') goNext();
            if (e.key === 'ArrowLeft') goPrev();
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [goNext, goPrev, onClose]);

    if (!currentStory) {
        onClose();
        return null;
    }

    // Fetch viewers for own story
    useEffect(() => {
        if (!currentStory || uid !== currentUser.uid || !showViewers) return;

        const fetchViewers = async () => {
            // Filter out the story author's own ID from the viewers list
            const viewerIds = (currentStory.viewers || []).filter(vUid => vUid !== currentUser.uid);
            if (viewerIds.length === 0) {
                setViewerDetails([]);
                return;
            }
            try {
                const promises = viewerIds.map(async (vUid) => {
                    const snap = await getDoc(doc(db, 'users', vUid));
                    return snap.exists() ? { uid: vUid, ...snap.data() } : null;
                });
                const results = await Promise.all(promises);
                setViewerDetails(results.filter(Boolean));
            } catch (e) { console.error('Error fetching viewers', e); }
        };
        fetchViewers();
    }, [currentStory, uid, currentUser.uid, showViewers]);

    const handleDelete = async () => {
        if (!window.confirm("Delete this story?")) return;
        setIsDeleting(true);
        setPaused(true);
        try {
            if (currentStory.type !== 'text' && currentStory.mediaURL) {
                const fileRef = ref(storage, currentStory.mediaURL);
                await deleteObject(fileRef).catch(e => console.warn('Could not delete storage file', e));
            }
            await deleteDoc(doc(db, 'stories', currentStory.id));
            showToast("Story deleted");

            // If it's the last story, close. Otherwise go to next.
            if (stories.length === 1) {
                onClose();
            } else {
                goNext();
            }
        } catch (e) {
            console.error('Error deleting story', e);
            showToast("Failed to delete story");
            setPaused(false);
        } finally {
            setIsDeleting(false);
        }
    };

    const getTimeAgo = (ts) => {
        if (!ts) return '';
        const secs = Math.floor((Date.now() - (ts.toMillis ? ts.toMillis() : new Date(ts).getTime())) / 1000);
        if (secs < 60) return `${secs}s ago`;
        if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
        return `${Math.floor(secs / 3600)}h ago`;
    };

    const handleTouchStart = (e) => {
        touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        setPaused(true);
    };

    const handleTouchEnd = (e) => {
        setPaused(false);
        if (!touchStartRef.current) return;
        const dx = e.changedTouches[0].clientX - touchStartRef.current.x;
        const dy = e.changedTouches[0].clientY - touchStartRef.current.y;

        if (Math.abs(dy) > 60) { onClose(); return; }
        if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return; // tap in the middle = no nav
    };

    return (
        <div
            className="story-viewer-overlay"
            onMouseDown={() => setPaused(true)}
            onMouseUp={() => setPaused(false)}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
        >
            {/* Background */}
            <div className="story-viewer-bg" style={{
                background: currentStory.type === 'text'
                    ? currentStory.bgGradient
                    : '#000'
            }}>
                {/* Media content */}
                {currentStory.type === 'image' && (
                    <img src={currentStory.mediaURL} className="story-media" alt="story" />
                )}
                {currentStory.type === 'video' && (
                    <video
                        src={currentStory.mediaURL}
                        className="story-media"
                        autoPlay
                        muted={false}
                        loop={false}
                        playsInline
                    />
                )}
                {currentStory.type === 'text' ? (
                    <div className="story-text-content">
                        <p>{currentStory.text}</p>
                    </div>
                ) : currentStory.text ? (
                    <div className="story-media-caption">
                        <p>{currentStory.text}</p>
                    </div>
                ) : null}
            </div>

            {/* Progress bars */}
            <div className="story-progress-bars">
                {stories.map((_, i) => (
                    <div key={i} className="story-progress-track">
                        <div
                            className="story-progress-fill"
                            style={{
                                width: i < currentIndex ? '100%'
                                    : i === currentIndex ? `${progress}%`
                                        : '0%'
                            }}
                        />
                    </div>
                ))}
            </div>

            {/* Header */}
            <div className="story-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    {currentStory.userPhoto ? (
                        <img src={currentStory.userPhoto} className="story-header-avatar" alt="" />
                    ) : (
                        <div className="story-header-avatar story-avatar-placeholder">
                            {(currentStory.userName || 'U')[0]}
                        </div>
                    )}
                    <div>
                        <p className="story-header-name">{currentStory.userName}</p>
                        <p className="story-header-time">{getTimeAgo(currentStory.createdAt)}</p>
                    </div>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    {uid === currentUser.uid && (
                        <button
                            className="story-close-btn"
                            style={{ background: 'rgba(239, 68, 68, 0.6)' }}
                            onClick={(e) => { e.stopPropagation(); handleDelete(); }}
                            disabled={isDeleting}
                            title="Delete Story"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                        </button>
                    )}
                    <button className="story-close-btn" onClick={(e) => { e.stopPropagation(); onClose(); }}>✕</button>
                </div>
            </div>

            {/* Left / Right nav zones */}
            <div
                className="story-nav-left"
                onClick={(e) => { e.stopPropagation(); goPrev(); }}
            />
            <div
                className="story-nav-right"
                onClick={(e) => { e.stopPropagation(); goNext(); }}
            />

            {/* View count (own stories) */}
            {uid === currentUser.uid && (
                <div
                    className="story-viewer-count"
                    onClick={(e) => { e.stopPropagation(); setShowViewers(true); }}
                    style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem', bottom: showViewers ? '50%' : '1.5rem', transition: 'bottom 0.3s', zIndex: 100 }}
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                    {(() => {
                        const count = Array.isArray(currentStory.viewers)
                            ? currentStory.viewers.filter(v => v !== currentUser.uid).length
                            : 0;
                        return `${count} ${count === 1 ? 'view' : 'views'}`;
                    })()}
                </div>
            )}

            {/* Viewers List Panel */}
            {
                showViewers && (
                    <div
                        style={{
                            position: 'absolute',
                            bottom: 0, left: 0, right: 0,
                            height: '50%',
                            background: 'rgba(15, 23, 42, 0.95)',
                            borderTopLeftRadius: '20px', borderTopRightRadius: '20px',
                            padding: '1rem',
                            zIndex: 200,
                            display: 'flex', flexDirection: 'column',
                            backdropFilter: 'blur(10px)',
                            borderTop: '1px solid rgba(255,255,255,0.1)',
                            animation: 'slideUp 0.3s ease'
                        }}
                        onClick={(e) => e.stopPropagation()}
                        onTouchStart={(e) => e.stopPropagation()}
                        onMouseDown={(e) => e.stopPropagation()}
                    >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                            <h3 style={{ color: 'white', fontSize: '1.1rem', margin: 0 }}>Viewers</h3>
                            <button
                                onClick={() => setShowViewers(false)}
                                style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '0.5rem' }}
                            >
                                ✕
                            </button>
                        </div>
                        <div style={{ flex: 1, overflowY: 'auto' }}>
                            {viewerDetails.length === 0 ? (
                                <p style={{ color: '#94a3b8', textAlign: 'center', marginTop: '2rem' }}>Loading viewers...</p>
                            ) : (
                                viewerDetails.map(vd => {
                                    const viewTime = currentStory.viewersInfo?.[vd.uid];
                                    let timeString = '';
                                    if (viewTime) {
                                        const d = new Date(viewTime);
                                        timeString = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
                                    }
                                    return (
                                        <div key={vd.uid} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                                {vd.photoURL || vd.photo ? (
                                                    <img src={vd.photoURL || vd.photo} alt={vd.name} style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover' }} />
                                                ) : (
                                                    <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'linear-gradient(135deg, var(--primary), var(--primary-dark))', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 'bold' }}>
                                                        {(vd.name || vd.displayName || vd.username || vd.email?.split('@')[0] || 'U')[0].toUpperCase()}
                                                    </div>
                                                )}
                                                <span style={{ color: 'white', fontWeight: 500 }}>{vd.name || vd.displayName || vd.username || vd.email?.split('@')[0] || 'User'}</span>
                                            </div>
                                            {timeString && <span style={{ color: '#94a3b8', fontSize: '0.8rem' }}>{timeString}</span>}
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>
                )
            }
        </div >
    );
}
