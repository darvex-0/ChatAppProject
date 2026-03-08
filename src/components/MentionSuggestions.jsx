import { useEffect, useRef, useState } from 'react';

export default function MentionSuggestions({ members, query, onSelect, onClose, activeIndex = 0 }) {
    const ref = useRef(null);

    // Filter members and add @AI as a special option
    const filteredMembers = members.filter(m =>
        m.name?.toLowerCase().includes(query.toLowerCase())
    );

    // Add AI as the first option if it matches query or if query is empty after @
    const showAI = "ai".includes(query.toLowerCase()) || query === "";

    const allSuggestions = [
        ...(showAI ? [{ uid: 'ai-assistant', name: 'AI', isAI: true }] : []),
        ...filteredMembers
    ].slice(0, 8);

    useEffect(() => {
        const handler = (e) => {
            if (ref.current && !ref.current.contains(e.target)) {
                onClose();
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [onClose]);

    if (allSuggestions.length === 0) return null;

    return (
        <div className="mention-dropdown glass-card" ref={ref}>
            <div className="mention-dropdown-header">
                <span>Mentions</span>
                <span className="mention-hint">↑↓ to navigate</span>
            </div>
            <div className="mention-list">
                {allSuggestions.map((item, i) => (
                    <button
                        key={item.uid}
                        className={`mention-item ${i === activeIndex ? 'active' : ''} ${item.isAI ? 'ai-item' : ''}`}
                        onClick={() => onSelect(item)}
                        type="button"
                    >
                        <div className="mention-avatar-container">
                            {item.isAI ? (
                                <div className="mention-avatar ai-avatar">
                                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm0 18a8 8 0 1 1 8-8 8 8 0 0 1-8 8z" />
                                        <path d="M12 6v6l4 2" />
                                    </svg>
                                </div>
                            ) : item.photo ? (
                                <img src={item.photo} className="mention-avatar" alt={item.name} />
                            ) : (
                                <div className="mention-avatar mention-avatar-placeholder">
                                    {(item.name || 'U')[0].toUpperCase()}
                                </div>
                            )}
                        </div>
                        <div className="mention-info">
                            <span className="mention-name">
                                {item.isAI ? 'AI Assistant' : item.name}
                            </span>
                            <span className="mention-handle">
                                @{item.isAI ? 'ai' : item.name?.toLowerCase().replace(/\s+/g, '')}
                            </span>
                        </div>
                        {item.isAI && <span className="ai-badge">Smart</span>}
                    </button>
                ))}
            </div>
        </div>
    );
}
