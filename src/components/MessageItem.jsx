import React, { useState, useRef, useEffect } from 'react';
import ReactDOM from 'react-dom';
import EmojiPicker from 'emoji-picker-react';
import { db } from '../services/firebase';
import { collection, addDoc, serverTimestamp, getDoc, doc } from 'firebase/firestore';
import { useUI } from '../context/UIContext';
import PollMessage from './PollMessage';

// Helper component for audio messages with duration display
function AudioPlayer({ src }) {
    const audioRef = useRef(null);
    const [duration, setDuration] = useState(null);
    const [currentTime, setCurrentTime] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);

    const formatTime = (seconds) => {
        if (!seconds || isNaN(seconds)) return "0:00";
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '0.5rem' }}>
            <button
                onClick={() => {
                    if (audioRef.current) {
                        if (isPlaying) {
                            audioRef.current.pause();
                        } else {
                            audioRef.current.play();
                        }
                    }
                }}
                style={{
                    background: 'var(--primary)',
                    border: 'none',
                    borderRadius: '50%',
                    width: '36px',
                    height: '36px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer'
                }}
            >
                {isPlaying ? (
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="white">
                        <rect x="6" y="4" width="4" height="16" />
                        <rect x="14" y="4" width="4" height="16" />
                    </svg>
                ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="white">
                        <polygon points="5,3 19,12 5,21" />
                    </svg>
                )}
            </button>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div style={{
                    height: '4px',
                    background: 'rgba(255,255,255,0.2)',
                    borderRadius: '2px',
                    overflow: 'hidden'
                }}>
                    <div style={{
                        height: '100%',
                        width: duration ? `${(currentTime / duration) * 100}%` : '0%',
                        background: 'var(--primary)',
                        transition: 'width 0.1s linear'
                    }} />
                </div>
                <span style={{ fontSize: '0.75rem', opacity: 0.7 }}>
                    {formatTime(currentTime)} / {formatTime(duration)}
                </span>
            </div>
            <audio
                ref={audioRef}
                src={src}
                onLoadedMetadata={(e) => setDuration(e.target.duration)}
                onTimeUpdate={(e) => setCurrentTime(e.target.currentTime)}
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                onEnded={() => { setIsPlaying(false); setCurrentTime(0); }}
                style={{ display: 'none' }}
            />
        </div>
    );
}

// Helper component for video messages with circular or rectangular UI
function VideoPlayer({ src, thumbnailSrc, duration, isCircular = false, startTime, endTime }) {
    const videoRef = useRef(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [isMuted, setIsMuted] = useState(true);
    const [isInView, setIsInView] = useState(true);

    // Intersection Observer to pause when out of view
    useEffect(() => {
        if (!videoRef.current) return;

        const observer = new IntersectionObserver(
            ([entry]) => {
                setIsInView(entry.isIntersecting);
                if (!entry.isIntersecting && videoRef.current) {
                    videoRef.current.pause();
                    setIsPlaying(false);
                }
            },
            { threshold: 0.5 }
        );

        observer.observe(videoRef.current);
        return () => observer.disconnect();
    }, []);

    const toggleMute = () => {
        if (videoRef.current) {
            const newMuted = !isMuted;
            setIsMuted(newMuted);
            videoRef.current.muted = newMuted;

            // Play if unmuting
            if (!newMuted && !isPlaying) {
                videoRef.current.play();
            }
        }
    };

    const formatTime = (seconds) => {
        if (!seconds || isNaN(seconds)) return "0:00";
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    return (
        <div style={{
            position: 'relative',
            width: isCircular ? '200px' : '100%',
            maxWidth: isCircular ? '200px' : '300px',
            height: isCircular ? '200px' : 'auto',
            aspectRatio: isCircular ? '1/1' : 'auto', // Aspect ratio mainly for circular
            marginTop: '0.5rem',
            borderRadius: isCircular ? '50%' : '12px',
            overflow: 'hidden',
            cursor: 'pointer',
            backgroundColor: 'black' // Background for rectangular videos
        }} onClick={toggleMute}>
            <video
                ref={videoRef}
                src={(startTime !== undefined && endTime !== undefined) ? `${src}#t=${startTime},${endTime}` : src}
                poster={thumbnailSrc}
                autoPlay={isCircular} // Only autoplay circular notes
                controls={!isCircular} // Show controls for normal videos
                loop={isCircular} // Loop circular notes
                muted={isCircular ? isMuted : false} // Auto-mute circular, normal video has sound
                playsInline
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                style={{
                    width: '100%',
                    height: '100%',
                    objectFit: isCircular ? 'cover' : 'contain', // Contain for normal videos to show full content
                    aspectRatio: isCircular ? '1/1' : 'auto'
                }}
            />

            {/* Mute/Unmute Overlay */}
            <div style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                background: 'rgba(0, 0, 0, 0.5)',
                borderRadius: '50%',
                width: '48px',
                height: '48px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                opacity: isMuted ? 1 : 0,
                transition: 'opacity 0.3s',
                pointerEvents: 'none'
            }}>
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="white">
                    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                    <line x1="23" y1="9" x2="17" y2="15" stroke="white" strokeWidth="2"></line>
                    <line x1="17" y1="9" x2="23" y2="15" stroke="white" strokeWidth="2"></line>
                </svg>
            </div>

        </div>
    );
}

function MessageItem({ msg, currentUser, chatInfo, chatId, initiateReply, initiateForward, addReaction, confirmDelete, initiateEdit, pinMessage, starMessage, highlightText }) {
    const isMe = msg.sender === currentUser.uid;
    const [showOriginalSender, setShowOriginalSender] = useState(false);
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const [emojiPickerPos, setEmojiPickerPos] = useState({ x: 100, y: 100 });
    const [isDraggingEmoji, setIsDraggingEmoji] = useState(false);
    const emojiDragOffset = useRef({ x: 0, y: 0 });
    const { showToast } = useUI();

    const saveToNotes = async (msg) => {
        if (!currentUser) return;
        try {
            const content = msg.text || (msg.type === 'image' ? `Image: ${msg.fileURL}` : msg.type === 'video' ? `Video: ${msg.fileURL}` : msg.type === 'file' ? `File: ${msg.fileName} - ${msg.fileURL}` : 'Media');

            // Refined Logic:
            // 1. Group Chat: "Group Name"
            // 2. Direct Chat: "Friend Name" (regardless of sender)
            // 3. Fallback: "Chat"

            let forwardedFrom = "Chat";

            // Use passed chatInfo only if it matches current chat (avoids stale data)
            // Or if chatInfo doesn't have ID yet (legacy), fallback to ID check/fetch
            const isChatInfoValid = chatInfo && chatInfo.id === chatId;
            let activeChatInfo = isChatInfoValid ? chatInfo : null;

            if (!activeChatInfo && chatId) {
                try {
                    const chatDoc = await getDoc(doc(db, "chats", chatId));
                    if (chatDoc.exists()) {
                        const data = chatDoc.data();
                        if (data.type === 'group') {
                            activeChatInfo = { name: data.groupName, type: 'group' };
                        } else {
                            const otherUid = data.members?.find(id => id !== currentUser.uid);
                            if (otherUid) {
                                const userDoc = await getDoc(doc(db, "users", otherUid));
                                if (userDoc.exists()) {
                                    activeChatInfo = { name: userDoc.data().name || userDoc.data().email || "User", type: 'direct' };
                                }
                            }
                        }
                    } else {
                        // Chat document not found for ID
                    }
                } catch (err) {
                    console.error("Error fetching fallback chat info:", err);
                }
            }

            if (activeChatInfo && (activeChatInfo.name || activeChatInfo.displayName)) {
                if (activeChatInfo.type === 'group') {
                    forwardedFrom = activeChatInfo.name || "Group";
                } else {
                    forwardedFrom = activeChatInfo.name || activeChatInfo.displayName || "Chat";
                }
            } else if (msg.sender === currentUser.uid) {
                forwardedFrom = "You";
            } else if (msg.senderName) {
                forwardedFrom = msg.senderName;
            }

            await addDoc(collection(db, "users", currentUser.uid, "notes"), {
                content: content,
                isCompleted: false,
                createdAt: serverTimestamp(),
                source: 'forwarded',
                originalMessageId: msg.id,
                forwardedFrom: forwardedFrom
            });
            showToast("Saved to Notes ✅");
        } catch (error) {
            console.error("Error saving to notes:", error);
            showToast("Failed to save to notes ❌");
        }
    };

    if (msg.type === 'system') {
        return <div className="message system"><span>{msg.text.replace(currentUser.displayName, "You")}</span></div>;
    }

    // Call Event Message (WhatsApp-style)
    if (msg.type === 'call_event') {
        const isVideoCall = msg.callType === 'video';
        const isMissed = msg.callStatus === 'missed' || msg.callStatus === 'declined';
        return (
            <div className="call-event-message">
                <div className="call-event-bubble">
                    <span className="call-event-icon" style={{ color: isMissed ? '#ef4444' : 'var(--primary)' }}>
                        {isVideoCall ? (
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="23 7 16 12 23 17 23 7"></polygon><rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect></svg>
                        ) : (
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>
                        )}
                    </span>
                    <span className="call-event-text">{msg.text}</span>
                    <span className="call-event-time">
                        {msg.timestamp?.seconds ? new Date(msg.timestamp.seconds * 1000).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : ''}
                    </span>
                </div>
            </div>
        );
    }

    const reactionCounts = {};
    if (msg.reactions) Object.values(msg.reactions).forEach(e => reactionCounts[e] = (reactionCounts[e] || 0) + 1);

    // Helper to highlight text and @mentions
    const renderText = (text) => {
        if (!text) return null;
        // Split by @mentions first, then by search highlight
        const parts = text.split(/(@@?[\w]+)/g);
        return parts.map((part, i) => {
            if (part.startsWith('@') && part.length > 1) {
                return <span key={i} className="mention-highlight">{part}</span>;
            }
            if (highlightText && part.toLowerCase().includes(highlightText.toLowerCase())) {
                const sub = part.split(new RegExp(`(${highlightText})`, 'gi'));
                return sub.map((s, j) =>
                    s.toLowerCase() === highlightText.toLowerCase()
                        ? <span key={`${i}-${j}`} className="highlight">{s}</span>
                        : s
                );
            }
            return part;
        });
    };

    return (
        <div className={`message ${isMe ? 'self' : ''}`} style={{ marginBottom: '10px', transition: 'background 0.3s' }} id={`msg-${msg.id}`}>
            {/* Hover Menu */}
            <div className="msg-options" style={{ alignItems: 'center' }}>
                <span className="option-btn reply-action" title="Reply" onClick={() => initiateReply(msg)}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 10 4 15 9 20"></polyline><path d="M20 4v7a4 4 0 0 1-4 4H4"></path></svg>
                </span>
                <span className="option-btn forward-action" title="Forward" onClick={() => initiateForward(msg)}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 10 20 15 15 20"></polyline><path d="M4 4v7a4 4 0 0 0 4 4h12"></path></svg>
                </span>
                <span className="option-btn notes-action" title="Save to Notes" onClick={() => saveToNotes(msg)}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                </span>
                <div className="separator"></div>
                <span
                    className="option-btn emoji-action"
                    title="Add Reaction"
                    onClick={(e) => {
                        e.stopPropagation();
                        setEmojiPickerPos({ x: Math.min(window.innerWidth - 320, e.clientX), y: Math.min(window.innerHeight - 420, e.clientY) });
                        setShowEmojiPicker(!showEmojiPicker);
                    }}
                >
                    😊+
                </span>
                {showEmojiPicker && ReactDOM.createPortal(
                    <>
                        {/* Draggable Emoji Picker */}
                        <div
                            style={{
                                position: 'fixed',
                                top: emojiPickerPos.y,
                                left: emojiPickerPos.x,
                                zIndex: 999999,
                                boxShadow: '0 10px 40px rgba(0,0,0,0.6)',
                                borderRadius: '12px',
                                overflow: 'hidden',
                                cursor: isDraggingEmoji ? 'grabbing' : 'default'
                            }}
                            onClick={(e) => e.stopPropagation()}
                        >
                            {/* Drag Handle */}
                            <div
                                style={{
                                    background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                                    padding: '8px 12px',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    cursor: 'grab',
                                    userSelect: 'none'
                                }}
                                onMouseDown={(e) => {
                                    setIsDraggingEmoji(true);
                                    emojiDragOffset.current = {
                                        x: e.clientX - emojiPickerPos.x,
                                        y: e.clientY - emojiPickerPos.y
                                    };
                                    const handleMouseMove = (ev) => {
                                        setEmojiPickerPos({
                                            x: Math.max(0, Math.min(window.innerWidth - 300, ev.clientX - emojiDragOffset.current.x)),
                                            y: Math.max(0, Math.min(window.innerHeight - 400, ev.clientY - emojiDragOffset.current.y))
                                        });
                                    };
                                    const handleMouseUp = () => {
                                        setIsDraggingEmoji(false);
                                        document.removeEventListener('mousemove', handleMouseMove);
                                        document.removeEventListener('mouseup', handleMouseUp);
                                    };
                                    document.addEventListener('mousemove', handleMouseMove);
                                    document.addEventListener('mouseup', handleMouseUp);
                                }}
                                onTouchStart={(e) => {
                                    const touch = e.touches[0];
                                    setIsDraggingEmoji(true);
                                    emojiDragOffset.current = {
                                        x: touch.clientX - emojiPickerPos.x,
                                        y: touch.clientY - emojiPickerPos.y
                                    };
                                    const handleTouchMove = (ev) => {
                                        const t = ev.touches[0];
                                        setEmojiPickerPos({
                                            x: Math.max(0, Math.min(window.innerWidth - 300, t.clientX - emojiDragOffset.current.x)),
                                            y: Math.max(0, Math.min(window.innerHeight - 400, t.clientY - emojiDragOffset.current.y))
                                        });
                                    };
                                    const handleTouchEnd = () => {
                                        setIsDraggingEmoji(false);
                                        document.removeEventListener('touchmove', handleTouchMove);
                                        document.removeEventListener('touchend', handleTouchEnd);
                                    };
                                    document.addEventListener('touchmove', handleTouchMove, { passive: true });
                                    document.addEventListener('touchend', handleTouchEnd);
                                }}
                            >
                                <span style={{ color: 'white', fontSize: '0.85rem', fontWeight: 500 }}>😃 React</span>
                                <button
                                    onClick={() => setShowEmojiPicker(false)}
                                    style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', fontSize: '1.2rem', lineHeight: 1 }}
                                >
                                    ×
                                </button>
                            </div>
                            <EmojiPicker
                                theme="dark"
                                onEmojiClick={(emojiObject) => {
                                    addReaction(msg.id, emojiObject.emoji);
                                    setShowEmojiPicker(false);
                                }}
                                searchDisabled
                                skinTonesDisabled
                                height={350}
                                width={300}
                                previewConfig={{ showPreview: false }}
                            />
                        </div>
                    </>,
                    document.body
                )}
                <div className="separator"></div>
                <span
                    className={`option-btn pin-action ${msg.isPinned ? 'pinned' : ''}`}
                    title={msg.isPinned ? "Unpin" : "Pin"}
                    onClick={() => msg.isPinned ? pinMessage(msg.id, false) : pinMessage(msg.id, true)}
                >
                    📌
                </span>
                <span
                    className={`option-btn star-action ${msg.isStarred ? 'starred' : ''}`}
                    title={msg.isStarred ? "Unstar" : "Star"}
                    onClick={() => starMessage(msg.id, !msg.isStarred)}
                    style={{ color: msg.isStarred ? '#fbbf24' : 'inherit' }}
                >
                    ⭐
                </span>
                {isMe && (
                    <>
                        <div className="separator"></div>
                        {msg.type === 'text' && !msg.isForwarded && (
                            <span className="option-btn edit-action" title="Edit" onClick={() => initiateEdit(msg)}>
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                            </span>
                        )}
                        <span className="option-btn delete-action" title="Delete" onClick={() => confirmDelete(msg.id)}>
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                        </span>
                    </>
                )}
            </div>

            {!isMe && chatInfo?.type === 'group' && <div className="sender-name">{msg.senderName}</div>}

            {msg.replyTo && (
                <div className="quoted-message" onClick={() => document.getElementById(`msg-${msg.replyTo.id}`)?.scrollIntoView({ behavior: 'smooth' })}>
                    <strong>{msg.replyTo.senderName}</strong>
                    <span>{msg.replyTo.text}</span>
                </div>
            )}

            {/* Forwarded Label */}
            {msg.isForwarded && (
                <div
                    onClick={() => setShowOriginalSender(!showOriginalSender)}
                    style={{
                        fontSize: '0.75rem',
                        color: '#94a3b8',
                        marginBottom: '4px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                    }}
                >
                    {msg.forwardCount >= 2 ? '↪↪' : '↪'}
                    <span style={{ fontStyle: 'italic' }}>
                        {msg.forwardCount >= 2 ? 'Forwarded many times' : 'Forwarded'}
                    </span>
                    {showOriginalSender && msg.originalSender && (
                        <span style={{
                            background: 'rgba(99, 102, 241, 0.2)',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            marginLeft: '4px',
                            fontSize: '0.7rem'
                        }}>
                            Originally from: {msg.originalSender}
                        </span>
                    )}
                </div>
            )}

            {/* Starred Indicator */}
            {msg.isStarred && (
                <div
                    onClick={(e) => {
                        e.stopPropagation();
                        starMessage(msg.id, false);
                    }}
                    title="Click to Unstar"
                    style={{
                        position: 'absolute',
                        top: '50%',
                        left: '-12px',
                        transform: 'translateY(-50%)',
                        background: '#fbbf24',
                        borderRadius: '50%',
                        width: '24px',
                        height: '24px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '0.85rem',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                        zIndex: 10,
                        border: '2px solid rgba(30, 41, 59, 1)',
                        cursor: 'pointer'
                    }}
                >
                    ⭐
                </div>
            )}

            {/* Content Types */}
            {msg.type === 'image' && <img src={msg.fileURL} alt="attachment" loading="lazy" onClick={() => window.open(msg.fileURL, '_blank')} />}
            {msg.type === 'audio' && <AudioPlayer src={msg.fileURL} />}
            {(msg.type === 'video' || msg.type === 'video_note') && (
                <VideoPlayer
                    src={msg.videoURL || msg.fileURL}
                    thumbnailSrc={msg.thumbnailURL}
                    duration={msg.duration}
                    isCircular={msg.type === 'video_note'}
                    startTime={msg.startTime}
                    endTime={msg.endTime}
                />
            )}
            {msg.type === 'text' && <div>{renderText(msg.text) || <span style={{ fontStyle: 'italic', opacity: 0.5 }}>(No content)</span>}</div>}
            {msg.type === 'poll' && <PollMessage msg={msg} chatId={chatId} />}
            {msg.type === 'file' && (
                <a href={msg.fileURL} target="_blank" className="file-attachment">
                    <div className="file-attachment-icon"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path><polyline points="13 2 13 9 20 9"></polyline></svg></div>
                    <div className="file-attachment-info"><span>{msg.fileName}</span> <small>Attachment</small></div>
                </a>
            )}

            {/* Link Preview Card - Shows when Cloud Function extracts URL metadata */}
            {msg.linkPreview && (
                <a
                    href={msg.linkPreview.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="link-preview-card"
                    style={{
                        display: 'block',
                        marginTop: '0.5rem',
                        background: 'rgba(0, 0, 0, 0.2)',
                        borderRadius: '8px',
                        overflow: 'hidden',
                        textDecoration: 'none',
                        color: 'inherit',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        transition: 'all 0.2s ease'
                    }}
                >
                    {/* Preview Image */}
                    {msg.linkPreview.image && (
                        <img
                            src={msg.linkPreview.image}
                            alt=""
                            loading="lazy"
                            style={{
                                width: '100%',
                                maxHeight: '150px',
                                objectFit: 'cover',
                                display: 'block'
                            }}
                            onError={(e) => e.target.style.display = 'none'}
                        />
                    )}
                    {/* Preview Text */}
                    <div style={{ padding: '0.75rem' }}>
                        <div style={{ fontSize: '0.7rem', color: 'var(--primary-light)', marginBottom: '4px', textTransform: 'uppercase' }}>
                            {msg.linkPreview.siteName}
                        </div>
                        <div style={{ fontWeight: 500, fontSize: '0.9rem', marginBottom: '4px', lineHeight: 1.3 }}>
                            {msg.linkPreview.title}
                        </div>
                        {msg.linkPreview.description && (
                            <div style={{ fontSize: '0.8rem', opacity: 0.7, lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                                {msg.linkPreview.description}
                            </div>
                        )}
                    </div>
                </a>
            )}

            {/* Reactions */}
            {Object.keys(reactionCounts).length > 0 && (
                <div className="reaction-container">
                    {Object.entries(reactionCounts).map(([emoji, count]) => {
                        const hasReacted = msg.reactions?.[currentUser.uid] === emoji;
                        return (
                            <span
                                key={emoji}
                                className={`reaction-bubble ${hasReacted ? 'my-reaction' : ''}`}
                                onClick={() => addReaction(msg.id, emoji)}
                                style={{ cursor: 'pointer' }}
                                title={hasReacted ? 'Click to remove your reaction' : 'Click to react'}
                            >
                                {emoji} {count > 1 ? count : ''}
                            </span>
                        );
                    })}
                </div>
            )}

            {/* Receipts */}
            <div className="receipt-area">
                <span className="timestamp">
                    {msg.timestamp?.seconds ? new Date(msg.timestamp.seconds * 1000).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : '...'}
                    {msg.edited && <span style={{ marginLeft: '4px', fontStyle: 'italic', opacity: 0.7 }}>(edited)</span>}
                </span>
                {isMe && (
                    msg.status === 'seen' ?
                        <div title="Read">
                            <svg className="receipt-ticks receipt-seen" xmlns="http://www.w3.org/2000/svg" width="16" height="15" viewBox="0 0 16 15" fill="none">
                                <path d="M15.01 3.316L8.408 11.75L5.593 8.883" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                <path d="M11.3 3.316L4.696 11.75L1.883 8.883" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                        </div>
                        :
                        <div title="Sent">
                            <svg className="receipt-ticks receipt-sent" xmlns="http://www.w3.org/2000/svg" width="16" height="15" viewBox="0 0 16 15" fill="none">
                                <path d="M11.3 3.316L4.696 11.75L1.883 8.883" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                        </div>
                )}
            </div>
        </div>
    );
}

export default React.memo(MessageItem, (prevProps, nextProps) => {
    return (
        prevProps.msg.id === nextProps.msg.id &&
        prevProps.msg.status === nextProps.msg.status &&
        prevProps.msg.text === nextProps.msg.text &&
        prevProps.msg.edited === nextProps.msg.edited &&
        JSON.stringify(prevProps.msg.reactions) === JSON.stringify(nextProps.msg.reactions) &&
        prevProps.msg.isPinned === nextProps.msg.isPinned &&
        prevProps.msg.isStarred === nextProps.msg.isStarred &&
        prevProps.highlightText === nextProps.highlightText &&
        JSON.stringify(prevProps.msg.pollData?.votes) === JSON.stringify(nextProps.msg.pollData?.votes)
    );
});
