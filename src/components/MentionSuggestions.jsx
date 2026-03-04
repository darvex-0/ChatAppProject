import { useEffect, useRef } from 'react';

/**
 * MentionSuggestions — shows a floating dropdown of members matching the current @query
 * Only shown in group chats when the user types @
 *
 * Props:
 *   members: [{ uid, name, photo }]
 *   query: string — text after '@'
 *   onSelect: (member) => void
 *   onClose: () => void
 */
export default function MentionSuggestions({ members, query, onSelect, onClose }) {
    const ref = useRef(null);

    const filtered = members.filter(m =>
        m.name?.toLowerCase().includes(query.toLowerCase())
    ).slice(0, 6); // max 6 suggestions

    // Close on click outside
    useEffect(() => {
        const handler = (e) => {
            if (ref.current && !ref.current.contains(e.target)) {
                onClose();
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [onClose]);

    if (filtered.length === 0) return null;

    return (
        <div className="mention-dropdown" ref={ref}>
            <div className="mention-dropdown-header">Mention</div>
            {filtered.map(member => (
                <button
                    key={member.uid}
                    className="mention-item"
                    onClick={() => onSelect(member)}
                    type="button"
                >
                    {member.photo ? (
                        <img src={member.photo} className="mention-avatar" alt={member.name} />
                    ) : (
                        <div className="mention-avatar mention-avatar-placeholder">
                            {(member.name || 'U')[0].toUpperCase()}
                        </div>
                    )}
                    <span className="mention-name">@{member.name}</span>
                </button>
            ))}
        </div>
    );
}
