import React from 'react';
import ReactDOM from 'react-dom';
import EmojiPicker from 'emoji-picker-react';
import SmartReplies from '../SmartReplies';
import MentionSuggestions from '../MentionSuggestions';

export default React.memo(function MessageInputArea({
    smartReplies, isLoadingReplies, handleSmartReplyClick,
    isRecording, voicePreviewUrl, editMsg,
    voiceDraft, formatDuration, deleteVoiceDraft, sendVoiceDraft,
    replyTo, cancelReply,
    dragOffset, isDraggingRef, recordingDuration, cancelRecording, stopRecording, handleDragStart,
    uploadProgress, cancelUpload, fileInputRef, handleFileUpload,
    setShowVideoRecorder, startRecording,
    setShowMediaCamera,
    scheduledMessages, setShowScheduledList,
    setEditingScheduledMsg, setIsScheduleModalOpen,
    setShowPollCreator,
    mentionState, groupMembers, insertMention, setMentionState, mentionIndex, setMentionIndex,
    showEmojiPicker, setShowEmojiPicker, emojiPickerPos, isDraggingEmoji, setIsDraggingEmoji,
    emojiDragOffset, setEmojiPickerPos, onEmojiClick,
    inputText, setInputText, handleInputChange, inputRef,
    isRephrasing, setIsRephrasing, fetchRephrase, showAlert, sendMessage
}) {
    return (
        <>
            {/* Smart Replies */}
            {(smartReplies.length > 0 || isLoadingReplies) && !isRecording && !voicePreviewUrl && !editMsg && (
                <SmartReplies
                    replies={smartReplies}
                    onSelect={handleSmartReplyClick}
                    isLoading={isLoadingReplies}
                />
            )}

            {/* Input Area - With Voice Logic */}
            <div id="input-area" style={{ position: 'relative', zIndex: 60 }}>
                {/* Voice Draft Preview (shown when returning to chat with saved recording) */}
                {voiceDraft && !isRecording && (
                    <div style={{ background: 'rgba(99, 102, 241, 0.1)', border: '1px solid rgba(99, 102, 241, 0.3)', borderRadius: '8px', padding: '12px', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                                <span style={{ color: '#6366f1', fontSize: '1.2rem' }}>🎤</span>
                                <span style={{ color: 'var(--app-text)', fontSize: '0.9rem', fontWeight: 500 }}>Saved Voice Message</span>
                                <span style={{ color: 'var(--app-text-muted)', fontSize: '0.85rem' }}>({formatDuration(voiceDraft.duration)})</span>
                            </div>
                            <audio src={voiceDraft.previewUrl} controls style={{ width: '100%', height: '32px', marginTop: '4px' }} />
                        </div>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <button
                                onClick={deleteVoiceDraft}
                                style={{ background: 'rgba(239, 68, 68, 0.2)', border: '1px solid #ef4444', color: '#ef4444', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 500 }}
                            >
                                🗑️ Delete
                            </button>
                            <button
                                onClick={sendVoiceDraft}
                                style={{ background: '#6366f1', border: 'none', color: 'white', padding: '6px 16px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 500 }}
                            >
                                📤 Send
                            </button>
                        </div>
                    </div>
                )}

                {replyTo && !isRecording && (
                    <div className="reply-preview-bar" style={{ display: 'flex' }}>
                        <div className="reply-content">
                            <strong>Replying to {replyTo.senderName}</strong>
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '300px', display: 'inline-block' }}>
                                {replyTo.text?.length > 80 ? replyTo.text.slice(0, 80) + '...' : replyTo.text}
                            </span>
                        </div>
                        <button
                            type="button"
                            className="icon-btn"
                            style={{
                                width: '32px',
                                height: '32px',
                                border: 'none',
                                background: 'transparent',
                                cursor: 'pointer',
                                padding: 0
                            }}
                            onClick={cancelReply}
                            title="Cancel Reply"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                        </button>
                    </div>
                )}

                {isRecording ? (
                    // WhatsApp Style Recording UI with Swipe to Cancel
                    <div
                        onMouseDown={handleDragStart}
                        onTouchStart={handleDragStart}
                        style={{
                            flexGrow: 1,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '0 0.5rem',
                            transform: `translateX(${dragOffset}px)`,
                            opacity: Math.max(0.3, 1 + dragOffset / 150),
                            transition: isDraggingRef.current ? 'none' : 'transform 0.2s ease-out, opacity 0.2s ease-out',
                            cursor: 'grab',
                            userSelect: 'none'
                        }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', color: '#ef4444' }}>
                            <div style={{
                                width: '10px', height: '10px', background: '#ef4444', borderRadius: '50%',
                                animation: 'pulse 1s infinite'
                            }}></div>
                            <span style={{ fontSize: '1.1rem', fontWeight: 500, color: 'var(--app-text)', minWidth: '45px' }}>
                                {formatDuration(recordingDuration)}
                            </span>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                            <div style={{ color: '#94a3b8', fontSize: '0.9rem', opacity: 0.7 }}>
                                &lt;&lt;&lt; Slide to cancel
                            </div>
                        </div>

                        <div style={{ display: 'flex', gap: '1rem' }}>
                            <button onClick={cancelRecording} className="icon-btn" style={{ border: 'none', background: 'transparent', color: '#ef4444' }} title="Cancel">
                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                            </button>
                            <button onClick={stopRecording} className="icon-btn" style={{ border: 'none', background: 'var(--primary)', color: 'white', width: '40px', height: '40px', borderRadius: '50%' }} title="Send (Stop)">
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
                            </button>
                        </div>
                    </div>
                ) : (
                    // Standard Input UI
                    <>
                        {uploadProgress && (
                            <div style={{ position: 'absolute', top: '-30px', left: '10px', background: 'rgba(99, 102, 241, 0.95)', color: 'white', padding: '6px 12px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 500, boxShadow: '0 2px 8px rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span>📤 {uploadProgress.loaded.toFixed(1)}/{uploadProgress.total.toFixed(1)}MB</span>
                                <button
                                    onClick={cancelUpload}
                                    style={{ background: 'rgba(239, 68, 68, 0.9)', border: 'none', borderRadius: '6px', padding: '2px 6px', color: 'white', cursor: 'pointer', fontSize: '0.7rem', fontWeight: 600 }}
                                    title="Cancel upload"
                                >
                                    ✕
                                </button>
                            </div>
                        )}
                        <button onClick={() => fileInputRef.current?.click()} className="icon-btn" title="Attach File" style={{ width: 'auto', height: 'auto', border: 'none', background: 'transparent', padding: 0 }}>
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path></svg>
                        </button>
                        <button onClick={() => setShowMediaCamera(true)} className="icon-btn" title="Open Camera" style={{ width: 'auto', height: 'auto', border: 'none', background: 'transparent', padding: 0 }}>
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path><circle cx="12" cy="13" r="4"></circle></svg>
                        </button>
                        <input type="file" ref={fileInputRef} onChange={handleFileUpload} style={{ display: 'none' }} />

                        {/* Scheduled Messages Toggle */}
                        {scheduledMessages.length > 0 && (
                            <button
                                onClick={() => setShowScheduledList(true)}
                                className="icon-btn"
                                title="View Scheduled Messages"
                                style={{
                                    width: 'auto', height: 'auto', border: 'none', background: 'transparent', padding: '0 4px',
                                    color: 'var(--primary)'
                                }}
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                                <span style={{ fontSize: '0.75rem', fontWeight: 600, marginLeft: '4px' }}>{scheduledMessages.length}</span>
                            </button>
                        )}

                        {/* Schedule Button */}
                        <button
                            onClick={() => {
                                setEditingScheduledMsg(null); // Clear edit mode
                                setIsScheduleModalOpen(true);
                            }}
                            className="icon-btn"
                            title="Schedule Message"
                            disabled={!inputText.trim()}
                            style={{
                                width: 'auto', height: 'auto', border: 'none', background: 'transparent', padding: 0,
                                opacity: inputText.trim() ? 1 : 0.5
                            }}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                        </button>

                        {/* Poll Button */}
                        <button
                            onClick={() => setShowPollCreator(true)}
                            className="icon-btn"
                            title="Create Poll"
                            style={{ width: 'auto', height: 'auto', border: 'none', background: 'transparent', padding: 0 }}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>
                        </button>

                        {/* Mention Suggestions */}
                        {mentionState && (
                            <MentionSuggestions
                                members={groupMembers}
                                query={mentionState.query}
                                onSelect={insertMention}
                                onClose={() => setMentionState(null)}
                                activeIndex={mentionIndex}
                            />
                        )}

                        <form onSubmit={sendMessage} style={{ flexGrow: 1, display: 'flex', gap: '0.75rem', alignItems: 'center', position: 'relative' }}>

                            {showEmojiPicker && ReactDOM.createPortal(
                                <>
                                    {/* Click outside overlay */}
                                    <div
                                        style={{
                                            position: 'fixed',
                                            top: 0,
                                            left: 0,
                                            width: '100vw',
                                            height: '100vh',
                                            zIndex: 999998
                                        }}
                                        onClick={() => setShowEmojiPicker(false)}
                                    />
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
                                            <span style={{ color: 'white', fontSize: '0.85rem', fontWeight: 500 }}>😃 Emojis</span>
                                            <button
                                                onClick={() => setShowEmojiPicker(false)}
                                                style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', fontSize: '1.2rem', lineHeight: 1 }}
                                            >
                                                ×
                                            </button>
                                        </div>
                                        <EmojiPicker
                                            theme="dark"
                                            onEmojiClick={onEmojiClick}
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

                            <button
                                type="button"
                                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                                className="icon-btn"
                                title="Add Emoji"
                                style={{ border: 'none', background: 'transparent', color: showEmojiPicker ? 'var(--primary)' : 'var(--gray)' }}
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M8 14s1.5 2 4 2 4-2 4-2"></path><line x1="9" y1="9" x2="9.01" y2="9"></line><line x1="15" y1="9" x2="15.01" y2="9"></line></svg>
                            </button>

                            <input
                                id="messageInput"
                                ref={inputRef}
                                value={inputText}
                                onChange={handleInputChange}
                                onKeyDown={(e) => {
                                    if (mentionState) {
                                        // Filter logic duplicated from component to decide navigation
                                        const filteredMembers = groupMembers.filter(m =>
                                            m.name?.toLowerCase().includes(mentionState.query.toLowerCase())
                                        );
                                        const showAI = "ai".includes(mentionState.query.toLowerCase()) || mentionState.query === "";
                                        const allSuggestions = [
                                            ...(showAI ? [{ uid: 'ai-assistant', name: 'AI', isAI: true }] : []),
                                            ...filteredMembers
                                        ].slice(0, 8);

                                        if (e.key === 'ArrowDown') {
                                            e.preventDefault();
                                            setMentionIndex(prev => (prev + 1) % allSuggestions.length);
                                        } else if (e.key === 'ArrowUp') {
                                            e.preventDefault();
                                            setMentionIndex(prev => (prev - 1 + allSuggestions.length) % allSuggestions.length);
                                        } else if (e.key === 'Enter' && allSuggestions.length > 0) {
                                            e.preventDefault();
                                            insertMention(allSuggestions[mentionIndex]);
                                        } else if (e.key === 'Escape') {
                                            setMentionState(null);
                                        }
                                    }
                                }}
                                placeholder="Type your message..."
                                autoComplete="off"
                            />

                            {!inputText.trim() ? (
                                <>
                                    <button
                                        type="button"
                                        onClick={() => setShowVideoRecorder(true)}
                                        className="icon-btn"
                                        style={{ border: 'none', background: 'transparent', color: 'var(--gray)', transition: 'all 0.2s', width: '40px', height: '40px' }}
                                        title="Record Video"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <polygon points="23 7 16 12 23 17 23 7"></polygon>
                                            <rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect>
                                        </svg>
                                    </button>
                                    <button type="button" onClick={startRecording} className="icon-btn" style={{ border: 'none', background: 'transparent', color: 'var(--gray)', transition: 'all 0.2s', width: '40px', height: '40px' }} title="Record Voice">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z M19 10v2a7 7 0 0 1-14 0v-2 M12 19v3 M8 22h8"></path>
                                        </svg>
                                    </button>
                                </>
                            ) : (
                                <>
                                    {/* AI Rephrase Button */}
                                    <button
                                        type="button"
                                        onClick={async () => {
                                            if (isRephrasing || !inputText.trim()) return;
                                            setIsRephrasing(true);
                                            try {
                                                const result = await fetchRephrase(inputText);
                                                if (result) {
                                                    setInputText(result);
                                                    if (inputRef.current) inputRef.current.focus();
                                                } else {
                                                    showAlert('AI server not available', 'error');
                                                }
                                            } catch {
                                                showAlert('Rephrase failed', 'error');
                                            } finally {
                                                setIsRephrasing(false);
                                            }
                                        }}
                                        className="icon-btn rephrase-btn"
                                        title="✨ AI Rephrase — Make it professional"
                                        style={{
                                            border: 'none',
                                            background: 'transparent',
                                            color: isRephrasing ? '#818cf8' : 'var(--gray)',
                                            transition: 'all 0.2s',
                                            animation: isRephrasing ? 'spin 1s linear infinite' : 'none',
                                        }}
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="m12 3-1.9 5.8a2 2 0 0 1-1.287 1.288L3 12l5.8 1.9a2 2 0 0 1 1.288 1.287L12 21l1.9-5.8a2 2 0 0 1 1.287-1.288L21 12l-5.8-1.9a2 2 0 0 1-1.288-1.287Z"></path>
                                        </svg>
                                    </button>
                                    <button type="submit" className="icon-btn" title="Send Message" style={{ border: 'none', background: 'transparent' }}>
                                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--primary)' }}><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
                                    </button>
                                </>
                            )}
                        </form>
                    </>
                )}
            </div>
        </>
    );
});

