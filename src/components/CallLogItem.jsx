import { useAuth } from '../context/AuthContext';
import { useCall } from '../context/CallContext';

// Smart timestamp: Today, Yesterday, or date
function formatCallTime(timestamp) {
    if (!timestamp?.seconds) return '';
    const date = new Date(timestamp.seconds * 1000);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const callDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());

    const time = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    if (callDay.getTime() === today.getTime()) return `Today, ${time}`;
    if (callDay.getTime() === yesterday.getTime()) return `Yesterday, ${time}`;
    return `${date.toLocaleDateString([], { day: 'numeric', month: 'short' })}, ${time}`;
}

// Format bytes to human-readable
function formatBytes(bytes) {
    if (!bytes || bytes === 0) return '0 B';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Format duration
function formatDuration(seconds) {
    if (!seconds || seconds === 0) return '';
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function CallLogItem({ log, onClick, onDelete }) {
    const { currentUser } = useAuth();
    const { callUser } = useCall();

    const isCaller = log.callerId === currentUser.uid;
    const otherName = isCaller ? log.receiverName : log.callerName;
    const otherPhoto = isCaller ? log.receiverPhoto : log.callerPhoto;
    const otherUid = isCaller ? log.receiverId : log.callerId;

    // Determine status icon and color
    let statusIcon, statusColor;
    if (log.status === 'missed') {
        statusIcon = '↙'; // Incoming missed
        statusColor = '#ef4444';
    } else if (log.status === 'declined') {
        statusIcon = '↙';
        statusColor = '#ef4444';
    } else if (isCaller) {
        statusIcon = '↗'; // Outgoing
        statusColor = '#22c55e';
    } else {
        statusIcon = '↙'; // Incoming answered
        statusColor = '#22c55e';
    }

    const callTypeIcon = log.type === 'video' ? (
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="23 7 16 12 23 17 23 7"></polygon><rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect></svg>
    ) : (
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>
    );

    const handleCallback = (e) => {
        e.stopPropagation();
        callUser(otherUid, log.type);
    };

    const handleDelete = (e) => {
        e.stopPropagation();
        if (window.confirm(`Delete this call log with ${otherName}?`)) {
            onDelete?.(log.id);
        }
    };

    const totalData = log.dataUsage?.totalBytes || 0;

    return (
        <div className="call-log-item" onClick={onClick}>
            {/* Avatar */}
            {otherPhoto ? (
                <img src={otherPhoto} alt="" className="profile-pic" />
            ) : (
                <div className="profile-pic" style={{ background: 'var(--input-bg)', color: 'var(--app-text)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.25rem' }}>
                    👤
                </div>
            )}

            {/* Details */}
            <div className="call-log-details">
                <div className="call-log-name-row">
                    <strong style={{ color: log.status === 'missed' ? '#ef4444' : 'var(--app-text)' }}>
                        {otherName || 'Unknown'}
                    </strong>
                </div>
                <div className="call-log-info">
                    <span style={{ color: statusColor, fontWeight: 'bold', fontSize: '1rem', marginRight: '4px' }}>{statusIcon}</span>
                    <span className="call-log-type-icon">{callTypeIcon}</span>
                    <span className="call-log-time" style={{ color: (log.status === 'missed' || log.status === 'declined' || log.duration === 0) ? '#ef4444' : 'inherit' }}>
                        {(log.status === 'missed' || log.status === 'declined' || log.duration === 0)
                            ? `Not answered • ${formatCallTime(log.timestamp)}`
                            : formatCallTime(log.timestamp)
                        }
                    </span>
                </div>
                {/* Duration and Data Usage */}
                {(log.duration > 0 || totalData > 0) && (
                    <div className="call-log-meta">
                        {log.duration > 0 && <span>⏱ {formatDuration(log.duration)}</span>}
                        {totalData > 0 && <span>📊 {formatBytes(totalData)}</span>}
                    </div>
                )}
            </div>

            {/* Action Buttons */}
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                {/* Delete Button */}
                <div className="call-log-action" onClick={handleDelete} title="Delete call log" style={{ opacity: 0.6 }}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                </div>
                {/* Callback Button */}
                <div className="call-log-action" onClick={handleCallback} title={`Call ${otherName}`}>
                    {log.type === 'video' ? (
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="23 7 16 12 23 17 23 7"></polygon><rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect></svg>
                    ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>
                    )}
                </div>
            </div>
        </div>
    );
}
