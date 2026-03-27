import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default React.memo(function ChatHeader({
    chatInfo,
    handleStartCall,
    isMenuOpen, setIsMenuOpen,
    setShowInfoModal,
    setShowWallpaperModal,
    isSearchOpen, setIsSearchOpen,
    searchInputRef,
    searchQuery, performSearch, nextResult, prevResult, closeSearch, searchResults, currentResultIndex,
    messages,
    showPinnedBar, setShowPinnedBar,
    currentPinIndex, setCurrentPinIndex,
    pinMessage,
    virtuosoRef
}) {
    const navigate = useNavigate();

    // Close menu when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (isMenuOpen && !event.target.closest('.header-menu-container')) {
                setIsMenuOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isMenuOpen]);

    return (
        <>
            {/* Header */}
            <div style={{ zIndex: 50, background: 'var(--header-bg)', padding: '0.75rem 1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', backdropFilter: 'blur(10px)', flexShrink: 0, position: 'relative' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <button onClick={() => navigate('/')} className="back-btn" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', marginRight: '0.5rem', padding: '0.25rem 0.5rem', background: 'rgba(99, 102, 241, 0.1)', border: '1px solid rgba(99, 102, 241, 0.3)', borderRadius: '6px', color: 'var(--primary-light)', cursor: 'pointer', fontSize: '0.75rem' }}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg> Back
                    </button>
                    <div onClick={() => setShowInfoModal(true)} className="chat-header-clickable" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer', padding: '0.25rem 0.5rem', borderRadius: '8px', transition: 'background 0.2s' }}>
                        {chatInfo?.photo ? (
                            <img src={chatInfo.photo} alt="" className="header-profile-pic" style={{ width: '36px', height: '36px', borderRadius: '50%', objectFit: 'cover' }} />
                        ) : (
                            <div className="header-profile-pic" style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'rgba(99, 102, 241, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem' }}>
                                {chatInfo?.type === 'group' ? '👥' : '👤'}
                            </div>
                        )}
                        <span style={{ color: 'var(--app-text)', fontWeight: 500 }}>{chatInfo?.name || "Chat"}</span>
                    </div>
                </div>

                {/* Call Buttons - Only show for 1-on-1 chats */}
                {chatInfo?.type !== 'group' && chatInfo?.uid && (
                    <div style={{ display: 'flex', gap: '0.5rem', marginRight: '0.5rem' }}>
                        <button
                            onClick={() => handleStartCall('audio')}
                            className="icon-btn"
                            title="Voice Call"
                            style={{ width: '36px', height: '36px', border: 'none', background: 'rgba(34, 197, 94, 0.1)', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>
                        </button>
                        <button
                            onClick={() => handleStartCall('video')}
                            className="icon-btn"
                            title="Video Call"
                            style={{ width: '36px', height: '36px', border: 'none', background: 'rgba(99, 102, 241, 0.1)', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="23 7 16 12 23 17 23 7"></polygon><rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect></svg>
                        </button>
                    </div>
                )}

                {/* 3-Dot Menu */}
                <div className="header-menu-container" style={{ position: 'relative' }}>
                    <button
                        onClick={() => setIsMenuOpen(!isMenuOpen)}
                        className="icon-btn"
                        style={{ width: '32px', height: '32px', border: 'none', background: 'transparent' }}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="1"></circle><circle cx="12" cy="5" r="1"></circle><circle cx="12" cy="19" r="1"></circle></svg>
                    </button>

                    {isMenuOpen && (
                        <div className="dropdown-menu">
                            <div className="dropdown-item" onClick={() => { setIsSearchOpen(true); setIsMenuOpen(false); setTimeout(() => searchInputRef.current?.focus(), 100); }}>
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                                Search
                            </div>
                            <div className="dropdown-item" onClick={() => { setShowWallpaperModal(true); setIsMenuOpen(false); }}>
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                                Wallpaper
                            </div>
                            <div className="dropdown-item" onClick={() => { setShowInfoModal(true); setIsMenuOpen(false); }}>
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
                                Chat Info
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Search Bar */}
            {isSearchOpen && (
                <div className="search-bar-container">
                    <div style={{ color: 'var(--gray)' }}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                    </div>
                    <input
                        ref={searchInputRef}
                        className="search-input"
                        placeholder="Search..."
                        value={searchQuery}
                        onChange={(e) => performSearch(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') nextResult();
                            if (e.key === 'Escape') closeSearch();
                        }}
                    />
                    <div className="search-actions">
                        {searchResults.length > 0 && <span style={{ fontSize: '0.8rem', color: 'var(--gray)', marginRight: '0.5rem' }}>{currentResultIndex + 1} of {searchResults.length}</span>}
                        <button onClick={prevResult} className="icon-btn" style={{ width: '28px', height: '28px', background: 'transparent', border: 'none' }} title="Previous">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="18 15 12 9 6 15"></polyline></svg>
                        </button>
                        <button onClick={nextResult} className="icon-btn" style={{ width: '28px', height: '28px', background: 'transparent', border: 'none' }} title="Next">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9"></polyline></svg>
                        </button>
                        <button onClick={closeSearch} className="icon-btn" style={{ width: '28px', height: '28px', background: 'transparent', border: 'none' }} title="Close">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                        </button>
                    </div>
                </div>
            )}

            {/* Pinned Messages Banner - WhatsApp Style */}
            {(() => {
                const now = Date.now();
                const pinnedMessages = messages.filter(m => m.isPinned && (!m.pinExpiresAt || (m.pinExpiresAt.toMillis ? m.pinExpiresAt.toMillis() : new Date(m.pinExpiresAt).getTime()) > now));
                if (pinnedMessages.length === 0) return null;
                if (!showPinnedBar) {
                    // Collapsed state - just show a small indicator
                    return (
                        <div
                            onClick={() => setShowPinnedBar(true)}
                            style={{
                                background: 'rgba(99, 102, 241, 0.2)',
                                padding: '6px 12px',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                fontSize: '0.8rem',
                                color: 'var(--primary)'
                            }}
                        >
                            📌 {pinnedMessages.length} pinned
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9"></polyline></svg>
                        </div>
                    );
                }
                // Ensure currentPinIndex is valid
                const safeIndex = currentPinIndex >= pinnedMessages.length ? 0 : currentPinIndex;
                const currentPin = pinnedMessages[safeIndex];
                return (
                    <div style={{
                        background: 'var(--input-bg)',
                        borderBottom: '1px solid var(--border-color)',
                        padding: '10px 12px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px'
                    }}>
                        {/* Navigation Arrows (if multiple pins) */}
                        {pinnedMessages.length > 1 && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                <button
                                    onClick={() => setCurrentPinIndex(prev => prev <= 0 ? pinnedMessages.length - 1 : prev - 1)}
                                    style={{ background: 'transparent', border: 'none', color: 'var(--primary)', cursor: 'pointer', padding: '2px' }}
                                    title="Previous pin"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="18 15 12 9 6 15"></polyline></svg>
                                </button>
                                <button
                                    onClick={() => setCurrentPinIndex(prev => prev >= pinnedMessages.length - 1 ? 0 : prev + 1)}
                                    style={{ background: 'transparent', border: 'none', color: 'var(--primary)', cursor: 'pointer', padding: '2px' }}
                                    title="Next pin"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9"></polyline></svg>
                                </button>
                            </div>
                        )}
                        <span style={{ fontSize: '1rem' }}>📌</span>
                        <div style={{ flex: 1, overflow: 'hidden' }}>
                            <div style={{ fontSize: '0.7rem', color: 'var(--primary)', fontWeight: 600, marginBottom: '2px' }}>
                                {pinnedMessages.length > 1 ? `${safeIndex + 1} of ${pinnedMessages.length} Pinned` : 'Pinned Message'}
                            </div>
                            <div
                                style={{
                                    fontSize: '0.85rem',
                                    color: 'var(--app-text)',
                                    whiteSpace: 'nowrap',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    cursor: 'pointer'
                                }}
                                onClick={() => {
                                    const idx = messages.findIndex(m => m.id === currentPin.id);
                                    if (idx !== -1) virtuosoRef.current?.scrollToIndex({ index: idx, behavior: 'smooth', align: 'center' });
                                }}
                            >
                                {currentPin.text || (currentPin.type === 'image' ? '🖼️ Image' : '🎤 Voice Message')}
                            </div>
                        </div>
                        {/* Unpin this message */}
                        <button
                            onClick={() => {
                                pinMessage(currentPin.id, false);
                                if (safeIndex >= pinnedMessages.length - 1 && safeIndex > 0) {
                                    setCurrentPinIndex(safeIndex - 1);
                                }
                            }}
                            style={{ background: 'rgba(239, 68, 68, 0.2)', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '6px', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem' }}
                            title="Unpin this message"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                            Unpin
                        </button>
                        {/* Collapse banner */}
                        <button
                            onClick={() => setShowPinnedBar(false)}
                            style={{ background: 'transparent', border: 'none', color: 'var(--gray)', cursor: 'pointer', padding: '4px' }}
                            title="Collapse"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="18 15 12 9 6 15"></polyline></svg>
                        </button>
                    </div>
                );
            })()}
        </>
    );
});

