import React from 'react';
import ChatInfoModal from '../Modals/ChatInfoModal';
import WallpaperModal from '../Modals/WallpaperModal';
import ForwardModal from '../Modals/ForwardModal';
import MediaPreviewModal from '../Modals/MediaPreviewModal';
import VideoRecorder from '../VideoRecorder';
import MediaCamera from '../MediaCamera';
import PollCreator from '../Modals/PollCreator';

export default React.memo(function ChatModals({
    chatId,
    showInfoModal, setShowInfoModal,
    showWallpaperModal, setShowWallpaperModal, handleUpdateWallpaper,
    deleteMsgId, setDeleteMsgId, performDelete,
    pendingPinMsg, setPendingPinMsg, pinMessage,
    showScheduledList, setShowScheduledList, scheduledMessages,
    startEditingScheduledMsg, deleteScheduledMessage,
    isScheduleModalOpen, setIsScheduleModalOpen, editingScheduledMsg,
    setEditingScheduledMsg, scheduledTime, setScheduledTime, handleScheduleMessage,
    voicePreviewUrl, cancelVoicePreview, confirmSendVoice,
    editMsg, editText, setEditText, cancelEdit, performEdit,
    forwardMsg, setForwardMsg, performForward,
    previewFile, setPreviewFile, handleMediaPreviewSend,
    showVideoRecorder, setShowVideoRecorder, sendVideoMessage,
    showMediaCamera, setShowMediaCamera, handleCameraCapture,
    showPollCreator, setShowPollCreator, sendPoll
}) {
    return (
        <>
            {showInfoModal && <ChatInfoModal chatId={chatId} onClose={() => setShowInfoModal(false)} />}

            <WallpaperModal
                isOpen={showWallpaperModal}
                onClose={() => setShowWallpaperModal(false)}
                onUpdateWallpaper={handleUpdateWallpaper}
            />

            {/* Delete Confirmation Overlay */}
            {
                deleteMsgId && (
                    <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.85)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(5px)' }}>
                        <div style={{ background: '#0f172a', padding: '2rem', borderRadius: '16px', border: '1px solid #ef4444', maxWidth: '300px', width: '90%', textAlign: 'center', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)' }}>
                            <div style={{ color: 'white', marginBottom: '1.5rem', fontSize: '1rem' }}>Are you sure you want to delete this message? This will be removed for everyone.</div>
                            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
                                <button
                                    onClick={() => setDeleteMsgId(null)}
                                    className="modal-btn secondary"
                                    style={{ marginTop: 0, width: 'auto', padding: '0.6rem 1.2rem' }}
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={performDelete}
                                    className="modal-btn danger"
                                    style={{ marginTop: 0, width: 'auto', padding: '0.6rem 1.2rem' }}
                                >
                                    Yes, Delete
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Pin Duration Picker Modal */}
            {
                pendingPinMsg && (
                    <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.85)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(5px)' }}>
                        <div style={{ background: '#0f172a', padding: '1.5rem', borderRadius: '16px', border: '1px solid var(--primary)', maxWidth: '320px', width: '90%', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)' }}>
                            <div style={{ color: 'white', marginBottom: '1rem', fontSize: '1.1rem', fontWeight: 600, textAlign: 'center' }}>📌 Pin Duration</div>
                            <div style={{ color: '#94a3b8', marginBottom: '1rem', fontSize: '0.85rem', textAlign: 'center' }}>How long should this message be pinned?</div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                {[
                                    { label: '1 Hour', ms: 60 * 60 * 1000 },
                                    { label: '12 Hours', ms: 12 * 60 * 60 * 1000 },
                                    { label: '1 Day', ms: 24 * 60 * 60 * 1000 },
                                    { label: '1 Week', ms: 7 * 24 * 60 * 60 * 1000 },
                                    { label: 'No Limit', ms: -1 } // Use -1 as marker for no expiry
                                ].map(opt => (
                                    <button
                                        key={opt.label}
                                        onClick={() => {
                                            // Pass null for no expiry, otherwise pass the duration
                                            pinMessage(pendingPinMsg, true, opt.ms === -1 ? 'forever' : opt.ms);
                                            setPendingPinMsg(null);
                                        }}
                                        style={{
                                            background: opt.ms === -1 ? 'rgba(99, 102, 241, 0.3)' : 'rgba(255,255,255,0.05)',
                                            border: '1px solid rgba(255,255,255,0.1)',
                                            borderRadius: '8px',
                                            padding: '12px',
                                            color: 'white',
                                            cursor: 'pointer',
                                            fontSize: '0.9rem',
                                            transition: 'all 0.2s'
                                        }}
                                        onMouseEnter={e => e.target.style.background = 'rgba(99, 102, 241, 0.3)'}
                                        onMouseLeave={e => e.target.style.background = opt.ms === -1 ? 'rgba(99, 102, 241, 0.3)' : 'rgba(255,255,255,0.05)'}
                                    >
                                        {opt.label}
                                    </button>
                                ))}
                            </div>
                            <button
                                onClick={() => setPendingPinMsg(null)}
                                style={{ marginTop: '1rem', width: '100%', background: 'transparent', border: '1px solid #64748b', borderRadius: '8px', padding: '10px', color: '#94a3b8', cursor: 'pointer', fontSize: '0.85rem' }}
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                )
            }

            {/* Scheduled Messages List Modal */}
            {
                showScheduledList && (
                    <div className="modal-overlay" style={{ zIndex: 100 }}>
                        <div className="modal" style={{ maxWidth: '500px', width: '90%', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
                            <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                                <h3 style={{ margin: 0 }}>Scheduled Messages</h3>
                                <button className="close-btn" onClick={() => setShowScheduledList(false)} style={{ background: 'transparent', border: 'none', color: 'var(--app-text)', fontSize: '1.5rem', cursor: 'pointer' }}>×</button>
                            </div>
                            <div className="modal-content" style={{ overflowY: 'auto' }}>
                                {scheduledMessages.length === 0 ? (
                                    <p style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No scheduled messages.</p>
                                ) : (
                                    scheduledMessages.map(msg => (
                                        <div key={msg.id} style={{
                                            padding: '12px',
                                            border: '1px solid var(--border-color)',
                                            borderRadius: '8px',
                                            marginBottom: '10px',
                                            background: 'var(--app-bg-secondary)'
                                        }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                                                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--primary)' }}>To: {msg.chatName}</span>
                                                <span style={{ fontSize: '0.8rem', color: 'var(--app-text-muted)' }}>
                                                    {msg.scheduledAt?.toDate().toLocaleString()}
                                                </span>
                                            </div>
                                            <p style={{ margin: 0, fontSize: '0.95rem', color: 'var(--app-text)' }}>{msg.text}</p>
                                            <div style={{ marginTop: '8px', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                                                <button
                                                    onClick={() => startEditingScheduledMsg(msg)}
                                                    style={{
                                                        padding: '4px 10px',
                                                        background: 'rgba(99, 102, 241, 0.1)',
                                                        color: 'var(--primary)',
                                                        border: '1px solid var(--primary)',
                                                        borderRadius: '4px',
                                                        fontSize: '0.8rem',
                                                        cursor: 'pointer'
                                                    }}
                                                >
                                                    Edit
                                                </button>
                                                <button
                                                    onClick={() => deleteScheduledMessage(msg.id)}
                                                    style={{
                                                        padding: '4px 10px',
                                                        background: 'rgba(239, 68, 68, 0.1)',
                                                        color: '#ef4444',
                                                        border: '1px solid #ef4444',
                                                        borderRadius: '4px',
                                                        fontSize: '0.8rem',
                                                        cursor: 'pointer'
                                                    }}
                                                >
                                                    Unschedule
                                                </button>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Schedule Modal */}
            {
                isScheduleModalOpen && (
                    <div className="modal-overlay" style={{ zIndex: 100 }}>
                        <div className="modal" style={{ maxWidth: '400px', width: '90%' }}>
                            <div className="modal-header">
                                <h3>{editingScheduledMsg ? "Edit Scheduled Message" : "Schedule Message"}</h3>
                                <button className="close-btn" onClick={() => setIsScheduleModalOpen(false)}>×</button>
                            </div>
                            <div className="modal-content">
                                <p style={{ marginBottom: '1rem', color: 'var(--app-text-muted)' }}>
                                    {editingScheduledMsg ? "Update your message details." : "Message will be sent automatically at the selected time."}
                                </p>

                                {/* If editing, allow editing text */}
                                {editingScheduledMsg && (
                                    <div style={{ marginBottom: '1rem' }}>
                                        <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--app-text)' }}>Message Content</label>
                                        <textarea
                                            className="modal-input"
                                            value={editingScheduledMsg.text}
                                            onChange={(e) => setEditingScheduledMsg({ ...editingScheduledMsg, text: e.target.value })}
                                            style={{ width: '100%', minHeight: '60px', resize: 'vertical' }} // Reuse modal-input class for consistency
                                        />
                                    </div>
                                )}

                                <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--app-text)' }}>Date & Time</label>
                                <input
                                    type="datetime-local"
                                    className="modal-input"
                                    value={scheduledTime}
                                    onChange={(e) => setScheduledTime(e.target.value)}
                                    style={{ width: '100%', marginBottom: '1.5rem' }}
                                />
                                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                                    <button className="modal-btn secondary" onClick={() => setIsScheduleModalOpen(false)}>Cancel</button>
                                    <button className="modal-btn" onClick={handleScheduleMessage} disabled={!scheduledTime}>
                                        {editingScheduledMsg ? "Update Message" : "Schedule Send"}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Voice Message Preview Modal */}
            {
                voicePreviewUrl && (
                    <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.85)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(5px)' }}>
                        <div style={{ background: '#0f172a', padding: '2rem', borderRadius: '16px', border: '1px solid var(--primary)', maxWidth: '350px', width: '90%', textAlign: 'center', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)' }}>
                            <div style={{ color: 'white', marginBottom: '1rem', fontSize: '1.1rem', fontWeight: 600 }}>🎤 Voice Message Preview</div>
                            <audio controls src={voicePreviewUrl} style={{ width: '100%', marginBottom: '1.5rem' }} />
                            <div style={{ color: '#94a3b8', marginBottom: '1.5rem', fontSize: '0.9rem' }}>Send this voice message?</div>
                            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
                                <button
                                    onClick={cancelVoicePreview}
                                    className="modal-btn secondary"
                                    style={{ marginTop: 0, width: 'auto', padding: '0.6rem 1.5rem' }}
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={confirmSendVoice}
                                    className="modal-btn"
                                    style={{ marginTop: 0, width: 'auto', padding: '0.6rem 1.5rem' }}
                                >
                                    Send
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Edit Message Modal */}
            {
                editMsg && (
                    <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.85)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(5px)' }}>
                        <div style={{ background: '#0f172a', padding: '2rem', borderRadius: '16px', border: '1px solid var(--primary)', maxWidth: '400px', width: '90%', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)' }}>
                            <div style={{ color: 'white', marginBottom: '1rem', fontSize: '1.1rem', fontWeight: 600 }}>✏️ Edit Message</div>
                            <textarea
                                value={editText}
                                onChange={(e) => setEditText(e.target.value)}
                                style={{
                                    width: '100%',
                                    minHeight: '100px',
                                    padding: '0.75rem',
                                    borderRadius: '8px',
                                    border: '1px solid rgba(255,255,255,0.1)',
                                    background: 'rgba(0,0,0,0.3)',
                                    color: 'white',
                                    fontSize: '0.95rem',
                                    marginBottom: '1rem',
                                    resize: 'vertical',
                                    outline: 'none'
                                }}
                                autoFocus
                            />
                            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                                <button
                                    onClick={cancelEdit}
                                    className="modal-btn secondary"
                                    style={{ marginTop: 0, width: 'auto', padding: '0.6rem 1.2rem' }}
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={performEdit}
                                    className="modal-btn"
                                    style={{ marginTop: 0, width: 'auto', padding: '0.6rem 1.2rem' }}
                                >
                                    Save
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Forward Modal */}
            {
                forwardMsg && (
                    <ForwardModal
                        message={forwardMsg}
                        currentChatId={chatId}
                        onClose={() => setForwardMsg(null)}
                        onForward={performForward}
                    />
                )
            }

            {/* Media Preview Modal */}
            {
                previewFile && (
                    <MediaPreviewModal
                        file={previewFile}
                        onSend={handleMediaPreviewSend}
                        onCancel={() => setPreviewFile(null)}
                    />
                )
            }

            {/* Video Recorder Modal */}
            {
                showVideoRecorder && (
                    <VideoRecorder
                        onClose={() => setShowVideoRecorder(false)}
                        onSend={sendVideoMessage}
                    />
                )
            }

            {/* In-App Media Camera */}
            {
                showMediaCamera && (
                    <MediaCamera
                        onClose={() => setShowMediaCamera(false)}
                        onCapture={handleCameraCapture}
                    />
                )
            }

            {/* Poll Creator Modal */}
            {showPollCreator && (
                <PollCreator
                    chatId={chatId}
                    onClose={() => setShowPollCreator(false)}
                    onSubmit={sendPoll}
                />
            )}
        </>
    );
});

