import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function NotificationToast({ message, data, onClose }) {
    useEffect(() => {
        const timer = setTimeout(onClose, 4000); // Auto close after 4s
        return () => clearTimeout(timer);
    }, [onClose]);

    const navigate = useNavigate();

    const handleClick = () => {
        if (data?.chatId) {
            navigate(`/c/${data.chatId}`);
            onClose();
        }
    };

    return (
        <div
            onClick={handleClick}
            style={{
                position: 'fixed',
                top: '1rem',
                left: '50%',
                transform: 'translateX(-50%)',
                background: 'var(--modal-bg)',
                color: 'var(--app-text)',
                padding: '0.75rem 1rem',
                borderRadius: '8px',
                boxShadow: 'var(--modal-shadow)',
                zIndex: 9999,
                display: 'flex',
                alignItems: 'center',
                gap: '1rem',
                cursor: 'pointer',
                border: '1px solid var(--border-color)',
                minWidth: '300px',
                animation: 'slideDown 0.3s ease-out'
            }}
        >
            <div style={{ fontSize: '1.25rem' }}>💬</div>
            <div style={{ flexGrow: 1 }}>
                <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{data?.title || 'New Message'}</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--app-text-muted)' }}>{data?.body || message}</div>
            </div>
            <button
                onClick={(e) => { e.stopPropagation(); onClose(); }}
                style={{ background: 'none', border: 'none', color: '#64748b', fontSize: '1.25rem', cursor: 'pointer' }}
            >
                &times;
            </button>
            <style>
                {`@keyframes slideDown { from { transform: translate(-50%, -100%); opacity: 0; } to { transform: translate(-50%, 0); opacity: 1; } }`}
            </style>
        </div>
    );
}
