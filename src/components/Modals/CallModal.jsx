import { useEffect, useRef, useState } from 'react';
import { useCall } from '../../context/CallContext';

export default function CallModal() {
    const {
        callState,
        callType,
        remoteUser,
        localStream,
        remoteStream,
        isMuted,
        isCameraOff,
        answerCall,
        declineCall,
        endCall,
        toggleMute,
        toggleCamera,
        callDuration
    } = useCall();

    // Format duration as MM:SS
    const formatDuration = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    const localVideoRef = useRef(null);
    const remoteVideoRef = useRef(null);

    // Attach local stream to video element
    useEffect(() => {
        if (localVideoRef.current && localStream) {
            localVideoRef.current.srcObject = localStream;
            console.log('Local stream attached');
        }
    }, [localStream, callState]); // Re-run when callState changes to ensure element is mounted

    // Attach remote stream to video element
    useEffect(() => {
        if (remoteVideoRef.current && remoteStream) {
            remoteVideoRef.current.srcObject = remoteStream;
            console.log('Remote stream attached');
        }
    }, [remoteStream, callState]); // Re-run when callState changes to ensure element is mounted

    // Debug: Log when streams change
    useEffect(() => {
        console.log('Stream states:', {
            localStream: localStream ? 'active' : 'null',
            remoteStream: remoteStream ? 'active' : 'null',
            callState,
            localTracks: localStream?.getTracks().length,
            remoteTracks: remoteStream?.getTracks().length
        });
    }, [localStream, remoteStream, callState]);

    // Picture-in-Picture state
    const [isPiP, setIsPiP] = useState(false);

    // Toggle Picture-in-Picture
    const togglePiP = async () => {
        try {
            if (document.pictureInPictureElement) {
                await document.exitPictureInPicture();
                setIsPiP(false);
            } else if (remoteVideoRef.current && document.pictureInPictureEnabled) {
                // Check if video metadata is loaded (readyState >= 1)
                if (remoteVideoRef.current.readyState >= 1) {
                    await remoteVideoRef.current.requestPictureInPicture();
                    setIsPiP(true);
                } else {
                    console.log('Video not ready for PiP yet');
                }
            }
        } catch (e) {
            console.error('PiP error:', e);
        }
    };

    // Listen for PiP exit by user
    useEffect(() => {
        const handlePiPExit = () => setIsPiP(false);
        document.addEventListener('leavepictureinpicture', handlePiPExit);
        return () => document.removeEventListener('leavepictureinpicture', handlePiPExit);
    }, []);

    // Tab visibility warning for non-PWA users
    const [showVisibilityWarning, setShowVisibilityWarning] = useState(false);
    useEffect(() => {
        const handleVisibility = () => {
            if (document.hidden && callState === 'active') {
                // Check if running as PWA (standalone)
                const isPWA = window.matchMedia('(display-mode: standalone)').matches;
                if (!isPWA) {
                    setShowVisibilityWarning(true);
                    setTimeout(() => setShowVisibilityWarning(false), 5000);
                }
            }
        };
        document.addEventListener('visibilitychange', handleVisibility);
        return () => document.removeEventListener('visibilitychange', handleVisibility);
    }, [callState]);

    if (callState === 'idle') return null;

    return (
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            background: 'rgba(0, 0, 0, 0.9)',
            backdropFilter: 'blur(20px)',
            zIndex: 9999,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white'
        }}>
            {/* Incoming Call UI */}
            {callState === 'incoming' && (
                <div style={{ textAlign: 'center', animation: 'fadeIn 0.3s ease' }}>
                    {/* Caller Avatar with Pulse */}
                    <div style={{ position: 'relative', marginBottom: '2rem' }}>
                        <div style={{
                            position: 'absolute',
                            top: '50%',
                            left: '50%',
                            transform: 'translate(-50%, -50%)',
                            width: '150px',
                            height: '150px',
                            borderRadius: '50%',
                            background: 'rgba(34, 197, 94, 0.3)',
                            animation: 'pulse 1.5s ease-in-out infinite'
                        }} />
                        <img
                            src={remoteUser?.photo || `https://ui-avatars.com/api/?name=${encodeURIComponent(remoteUser?.name || 'User')}&background=6366f1&color=fff`}
                            alt={remoteUser?.name}
                            style={{
                                width: '120px',
                                height: '120px',
                                borderRadius: '50%',
                                objectFit: 'cover',
                                border: '4px solid rgba(255,255,255,0.2)',
                                position: 'relative',
                                zIndex: 1
                            }}
                        />
                    </div>

                    <h2 style={{ fontSize: '1.5rem', fontWeight: 600, marginBottom: '0.5rem' }}>
                        {remoteUser?.name || 'Unknown'}
                    </h2>
                    <p style={{ color: 'rgba(255,255,255,0.7)', marginBottom: '2rem' }}>
                        {callType === 'video' ? '📹 Incoming Video Call...' : '📞 Incoming Voice Call...'}
                    </p>

                    {/* Accept / Decline Buttons */}
                    <div style={{ display: 'flex', gap: '2rem', justifyContent: 'center' }}>
                        <button
                            onClick={declineCall}
                            style={{
                                width: '70px',
                                height: '70px',
                                borderRadius: '50%',
                                background: 'linear-gradient(135deg, #ef4444, #dc2626)',
                                border: 'none',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                boxShadow: '0 4px 20px rgba(239, 68, 68, 0.4)',
                                transition: 'transform 0.2s'
                            }}
                            onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.1)'}
                            onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7 2 2 0 0 1 1.72 2v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.42 19.42 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.63A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91" />
                                <line x1="23" y1="1" x2="1" y2="23" />
                            </svg>
                        </button>
                        <button
                            onClick={answerCall}
                            style={{
                                width: '70px',
                                height: '70px',
                                borderRadius: '50%',
                                background: 'linear-gradient(135deg, #22c55e, #16a34a)',
                                border: 'none',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                boxShadow: '0 4px 20px rgba(34, 197, 94, 0.4)',
                                transition: 'transform 0.2s'
                            }}
                            onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.1)'}
                            onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                            </svg>
                        </button>
                    </div>
                </div>
            )}

            {/* Outgoing Call UI */}
            {callState === 'outgoing' && (
                <div style={{ textAlign: 'center', animation: 'fadeIn 0.3s ease' }}>
                    {/* Video Preview (if video call) */}
                    {callType === 'video' && localStream && (
                        <video
                            ref={localVideoRef}
                            autoPlay
                            playsInline
                            muted
                            style={{
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                width: '100%',
                                height: '100%',
                                objectFit: 'cover',
                                opacity: 0.3
                            }}
                        />
                    )}

                    <div style={{ position: 'relative', zIndex: 1 }}>
                        <div style={{ position: 'relative', marginBottom: '2rem' }}>
                            <div style={{
                                position: 'absolute',
                                top: '50%',
                                left: '50%',
                                transform: 'translate(-50%, -50%)',
                                width: '150px',
                                height: '150px',
                                borderRadius: '50%',
                                background: 'rgba(99, 102, 241, 0.3)',
                                animation: 'pulse 1.5s ease-in-out infinite'
                            }} />
                            <img
                                src={remoteUser?.photo || `https://ui-avatars.com/api/?name=${encodeURIComponent(remoteUser?.name || 'User')}&background=6366f1&color=fff`}
                                alt={remoteUser?.name}
                                style={{
                                    width: '120px',
                                    height: '120px',
                                    borderRadius: '50%',
                                    objectFit: 'cover',
                                    border: '4px solid rgba(255,255,255,0.2)',
                                    position: 'relative',
                                    zIndex: 1
                                }}
                            />
                        </div>

                        <h2 style={{ fontSize: '1.5rem', fontWeight: 600, marginBottom: '0.5rem' }}>
                            {remoteUser?.name || 'Unknown'}
                        </h2>
                        <p style={{ color: 'rgba(255,255,255,0.7)', marginBottom: '2rem' }}>
                            {callType === 'video' ? '📹 Calling...' : '📞 Calling...'}
                        </p>

                        {/* Cancel Button */}
                        <button
                            onClick={endCall}
                            style={{
                                width: '70px',
                                height: '70px',
                                borderRadius: '50%',
                                background: 'linear-gradient(135deg, #ef4444, #dc2626)',
                                border: 'none',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                margin: '0 auto',
                                boxShadow: '0 4px 20px rgba(239, 68, 68, 0.4)'
                            }}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="18" y1="6" x2="6" y2="18" />
                                <line x1="6" y1="6" x2="18" y2="18" />
                            </svg>
                        </button>
                    </div>
                </div>
            )}

            {/* Active Call UI */}
            {callState === 'active' && (
                <div style={{ width: '100%', height: '100%', position: 'relative' }}>
                    {/* Call Duration Timer */}
                    <div style={{
                        position: 'absolute',
                        top: '20px',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        background: 'rgba(0,0,0,0.6)',
                        backdropFilter: 'blur(10px)',
                        padding: '8px 20px',
                        borderRadius: '20px',
                        zIndex: 10,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                    }}>
                        <span style={{ color: '#22c55e', fontSize: '10px' }}>●</span>
                        <span style={{ color: 'white', fontWeight: 500, fontFamily: 'monospace', fontSize: '1rem' }}>
                            {formatDuration(callDuration)}
                        </span>
                    </div>
                    {/* Remote Video (Full Screen) */}
                    {callType === 'video' ? (
                        <video
                            ref={remoteVideoRef}
                            autoPlay
                            playsInline
                            style={{
                                width: '100%',
                                height: '100%',
                                objectFit: 'cover',
                                background: '#000'
                            }}
                        />
                    ) : (
                        /* Audio Call - Show Avatar */
                        <div style={{
                            width: '100%',
                            height: '100%',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)'
                        }}>
                            <img
                                src={remoteUser?.photo || `https://ui-avatars.com/api/?name=${encodeURIComponent(remoteUser?.name || 'User')}&background=6366f1&color=fff`}
                                alt={remoteUser?.name}
                                style={{
                                    width: '150px',
                                    height: '150px',
                                    borderRadius: '50%',
                                    objectFit: 'cover',
                                    border: '4px solid rgba(255,255,255,0.2)',
                                    marginBottom: '1rem'
                                }}
                            />
                            <h2 style={{ fontSize: '1.5rem', fontWeight: 600 }}>{remoteUser?.name}</h2>
                            <p style={{ color: 'rgba(255,255,255,0.7)', marginTop: '0.5rem' }}>🔊 On Call</p>
                        </div>
                    )}

                    {/* Local Video (Picture-in-Picture) */}
                    {callType === 'video' && localStream && (
                        <video
                            ref={localVideoRef}
                            autoPlay
                            playsInline
                            muted
                            style={{
                                position: 'absolute',
                                top: '20px',
                                right: '20px',
                                width: '150px',
                                height: '200px',
                                objectFit: 'cover',
                                borderRadius: '12px',
                                border: '2px solid rgba(255,255,255,0.3)',
                                boxShadow: '0 4px 20px rgba(0,0,0,0.5)'
                            }}
                        />
                    )}

                    {/* Call Controls */}
                    <div style={{
                        position: 'absolute',
                        bottom: '40px',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        display: 'flex',
                        gap: '1.5rem',
                        padding: '1rem 2rem',
                        background: 'rgba(0,0,0,0.6)',
                        backdropFilter: 'blur(10px)',
                        borderRadius: '999px'
                    }}>
                        {/* Mute Toggle */}
                        <button
                            onClick={toggleMute}
                            style={{
                                width: '56px',
                                height: '56px',
                                borderRadius: '50%',
                                background: isMuted ? '#ef4444' : 'rgba(255,255,255,0.2)',
                                border: 'none',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                transition: 'background 0.2s'
                            }}
                            title={isMuted ? 'Unmute' : 'Mute'}
                        >
                            {isMuted ? (
                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <line x1="1" y1="1" x2="23" y2="23" />
                                    <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" />
                                    <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23" />
                                    <line x1="12" y1="19" x2="12" y2="23" />
                                    <line x1="8" y1="23" x2="16" y2="23" />
                                </svg>
                            ) : (
                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                                    <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                                    <line x1="12" y1="19" x2="12" y2="23" />
                                    <line x1="8" y1="23" x2="16" y2="23" />
                                </svg>
                            )}
                        </button>

                        {/* Camera Toggle (Video calls only) */}
                        {callType === 'video' && (
                            <button
                                onClick={toggleCamera}
                                style={{
                                    width: '56px',
                                    height: '56px',
                                    borderRadius: '50%',
                                    background: isCameraOff ? '#ef4444' : 'rgba(255,255,255,0.2)',
                                    border: 'none',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    transition: 'background 0.2s'
                                }}
                                title={isCameraOff ? 'Turn Camera On' : 'Turn Camera Off'}
                            >
                                {isCameraOff ? (
                                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M16.5 11.5L23 7v10l-6.5-5.5" />
                                        <line x1="1" y1="1" x2="23" y2="23" />
                                        <path d="M7.5 4h8a2 2 0 0 1 2 2v5.5M2 8.5V16a2 2 0 0 0 2 2h11" />
                                    </svg>
                                ) : (
                                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <polygon points="23 7 16 12 23 17 23 7" />
                                        <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
                                    </svg>
                                )}
                            </button>
                        )}

                        {/* Picture-in-Picture Toggle (Video calls only) */}
                        {callType === 'video' && document.pictureInPictureEnabled && (
                            <button
                                onClick={togglePiP}
                                style={{
                                    width: '56px',
                                    height: '56px',
                                    borderRadius: '50%',
                                    background: isPiP ? '#6366f1' : 'rgba(255,255,255,0.2)',
                                    border: 'none',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    transition: 'background 0.2s'
                                }}
                                title={isPiP ? 'Exit Picture-in-Picture' : 'Picture-in-Picture'}
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                                    <rect x="12" y="10" width="8" height="6" rx="1" />
                                </svg>
                            </button>
                        )}

                        {/* End Call */}
                        <button
                            onClick={endCall}
                            style={{
                                width: '56px',
                                height: '56px',
                                borderRadius: '50%',
                                background: 'linear-gradient(135deg, #ef4444, #dc2626)',
                                border: 'none',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                boxShadow: '0 4px 20px rgba(239, 68, 68, 0.4)'
                            }}
                            title="End Call"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7 2 2 0 0 1 1.72 2v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.42 19.42 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.63A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91" />
                                <line x1="23" y1="1" x2="1" y2="23" />
                            </svg>
                        </button>
                    </div>
                </div>
            )}

            {/* Tab Visibility Warning Toast */}
            {showVisibilityWarning && (
                <div style={{
                    position: 'fixed',
                    top: '20px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                    color: 'white',
                    padding: '12px 24px',
                    borderRadius: '12px',
                    boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
                    zIndex: 10000,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    animation: 'fadeIn 0.3s ease'
                }}>
                    <span style={{ fontSize: '1.2rem' }}>⚠️</span>
                    <span>Call may disconnect if tab is backgrounded. Install as app for best experience.</span>
                </div>
            )}

            {/* CSS Keyframes */}
            <style>{`
                @keyframes pulse {
                    0% { transform: translate(-50%, -50%) scale(1); opacity: 0.6; }
                    50% { transform: translate(-50%, -50%) scale(1.3); opacity: 0.3; }
                    100% { transform: translate(-50%, -50%) scale(1); opacity: 0.6; }
                }
                @keyframes fadeIn {
                    from { opacity: 0; transform: scale(0.95); }
                    to { opacity: 1; transform: scale(1); }
                }
            `}</style>
        </div>
    );
}
