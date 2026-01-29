import { useState, useRef } from 'react';

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

export default function MessageItem({ msg, currentUser, chatInfo, initiateReply, addReaction, confirmDelete, initiateEdit, highlightText }) {
    const isMe = msg.sender === currentUser.uid;

    if (msg.type === 'system') {
        return <div className="message system"><span>{msg.text.replace(currentUser.displayName, "You")}</span></div>;
    }

    const reactionCounts = {};
    if (msg.reactions) Object.values(msg.reactions).forEach(e => reactionCounts[e] = (reactionCounts[e] || 0) + 1);

    // Helper to highlight text
    const renderText = (text) => {
        if (!highlightText || !text) return text;
        const parts = text.split(new RegExp(`(${highlightText})`, 'gi'));
        return parts.map((part, i) =>
            part.toLowerCase() === highlightText.toLowerCase()
                ? <span key={i} className="highlight">{part}</span>
                : part
        );
    };

    return (
        <div className={`message ${isMe ? 'self' : ''}`} style={{ marginBottom: '10px', transition: 'background 0.3s' }} id={`msg-${msg.id}`}>
            {/* Hover Menu */}
            <div className="msg-options" style={{ alignItems: 'center' }}>
                <span className="option-btn reply-action" title="Reply" onClick={() => initiateReply(msg)}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 10 4 15 9 20"></polyline><path d="M20 4v7a4 4 0 0 1-4 4H4"></path></svg>
                </span>
                <div className="separator"></div>
                <span className="option-btn emoji-action" onClick={() => addReaction(msg.id, '❤️')}>❤️</span>
                <span className="option-btn emoji-action" onClick={() => addReaction(msg.id, '😂')}>😂</span>
                <span className="option-btn emoji-action" onClick={() => addReaction(msg.id, '👍')}>👍</span>
                {isMe && (
                    <>
                        <div className="separator"></div>
                        {msg.type === 'text' && (
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

            {/* Content Types */}
            {msg.type === 'image' && <img src={msg.fileURL} alt="attachment" onClick={() => window.open(msg.fileURL, '_blank')} />}
            {msg.type === 'audio' && <AudioPlayer src={msg.fileURL} />}
            {msg.type === 'text' && <div>{renderText(msg.text) || <span style={{ fontStyle: 'italic', opacity: 0.5 }}>(No content)</span>}</div>}
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
            {Object.keys(reactionCounts).length > 0 && <div className="reaction-container">{Object.entries(reactionCounts).map(([e, c]) => <span key={e} className="reaction-bubble">{e} {c > 1 ? c : ''}</span>)}</div>}

            {/* Receipts */}
            <div className="receipt-area">
                <span className="timestamp">
                    {msg.timestamp?.seconds ? new Date(msg.timestamp.seconds * 1000).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : '...'}
                    {msg.edited && <span style={{ marginLeft: '4px', fontStyle: 'italic', opacity: 0.7 }}>(edited)</span>}
                </span>
                {isMe && (
                    msg.status === 'seen' ?
                        <svg className="receipt-ticks receipt-seen" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline><path d="M16 11.08V12a6 6 0 1 1-3.53-5.65"></path><polyline points="16 4 10 10.01 8 8.01"></polyline></svg>
                        :
                        <svg className="receipt-ticks receipt-sent" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
                )}
            </div>
        </div>
    );
}
