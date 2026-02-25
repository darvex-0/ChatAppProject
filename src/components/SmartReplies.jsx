import React, { useState } from 'react';

const SKELETON_WIDTHS = ['80px', '100px', '70px'];

export default function SmartReplies({ replies, onSelect, isLoading }) {
    const [dismissing, setDismissing] = useState(false);

    if (!isLoading && (!replies || replies.length === 0)) return null;

    const handleClick = (reply) => {
        setDismissing(true);
        // Small delay for exit animation before sending
        setTimeout(() => {
            onSelect(reply);
            setDismissing(false);
        }, 200);
    };

    return (
        <div
            className="smart-replies-container"
            style={{
                display: 'flex',
                gap: '8px',
                padding: '8px 12px',
                overflowX: 'auto',
                WebkitOverflowScrolling: 'touch',
                scrollbarWidth: 'none',
                opacity: dismissing ? 0 : 1,
                transform: dismissing ? 'translateY(8px)' : 'translateY(0)',
                transition: 'opacity 0.2s ease, transform 0.2s ease',
            }}
        >
            {/* AI Label */}
            <span style={{
                display: 'flex',
                alignItems: 'center',
                fontSize: '0.7rem',
                color: '#818cf8',
                fontWeight: 600,
                whiteSpace: 'nowrap',
                gap: '4px',
                opacity: 0.9,
                letterSpacing: '0.02em',
                userSelect: 'none',
            }}>
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
                </svg>
                AI
            </span>

            {isLoading ? (
                // Loading skeletons
                SKELETON_WIDTHS.map((width, i) => (
                    <div
                        key={i}
                        className="smart-reply-skeleton"
                        style={{
                            width,
                            height: '32px',
                            borderRadius: '16px',
                            background: 'rgba(99, 102, 241, 0.1)',
                            border: '1px solid rgba(99, 102, 241, 0.15)',
                            animation: 'pulse 1.5s infinite',
                            animationDelay: `${i * 0.15}s`,
                            flexShrink: 0,
                        }}
                    />
                ))
            ) : (
                // Actual reply chips
                replies.map((reply, i) => (
                    <button
                        key={`${reply}-${i}`}
                        onClick={() => handleClick(reply)}
                        className="smart-reply-chip"
                        style={{
                            padding: '6px 14px',
                            borderRadius: '16px',
                            border: '1px solid rgba(99, 102, 241, 0.3)',
                            background: 'rgba(99, 102, 241, 0.08)',
                            color: '#c7d2fe',
                            fontSize: '0.82rem',
                            fontWeight: 500,
                            cursor: 'pointer',
                            whiteSpace: 'nowrap',
                            flexShrink: 0,
                            transition: 'all 0.2s ease',
                            outline: 'none',
                            animation: `smartReplyFadeIn 0.3s ease ${i * 0.08}s both`,
                        }}
                        onMouseEnter={(e) => {
                            e.target.style.background = 'rgba(99, 102, 241, 0.25)';
                            e.target.style.borderColor = 'rgba(99, 102, 241, 0.5)';
                            e.target.style.color = '#e0e7ff';
                            e.target.style.transform = 'translateY(-1px)';
                        }}
                        onMouseLeave={(e) => {
                            e.target.style.background = 'rgba(99, 102, 241, 0.08)';
                            e.target.style.borderColor = 'rgba(99, 102, 241, 0.3)';
                            e.target.style.color = '#c7d2fe';
                            e.target.style.transform = 'translateY(0)';
                        }}
                    >
                        {reply}
                    </button>
                ))
            )}
        </div>
    );
}
