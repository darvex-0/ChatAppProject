import { useState, useRef, useEffect } from 'react';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../services/firebase';

// Utility: Generate thumbnail from video blob
const generateThumbnail = (videoBlob) => {
    return new Promise((resolve, reject) => {
        const video = document.createElement('video');
        video.preload = 'metadata';
        video.muted = true;
        video.playsInline = true;

        video.onloadedmetadata = () => {
            video.currentTime = Math.min(1, video.duration); // Seek to 1s or end
        };

        video.onseeked = () => {
            const canvas = document.createElement('canvas');
            canvas.width = 200; // Small thumbnail
            canvas.height = 200;
            const ctx = canvas.getContext('2d');

            // Draw center-cropped square
            const size = Math.min(video.videoWidth, video.videoHeight);
            const x = (video.videoWidth - size) / 2;
            const y = (video.videoHeight - size) / 2;
            ctx.drawImage(video, x, y, size, size, 0, 0, 200, 200);

            canvas.toBlob((blob) => {
                URL.revokeObjectURL(video.src);
                resolve(blob);
            }, 'image/jpeg', 0.7);
        };

        video.onerror = () => {
            URL.revokeObjectURL(video.src);
            reject(new Error('Failed to load video for thumbnail'));
        };

        video.src = URL.createObjectURL(videoBlob);
    });
};

// Select best supported MIME type
const getSupportedMimeType = () => {
    const types = [
        'video/webm;codecs=vp9',
        'video/webm;codecs=vp8',
        'video/webm',
        'video/mp4'
    ];

    for (const type of types) {
        if (MediaRecorder.isTypeSupported(type)) {
            return type;
        }
    }
    return ''; // Let browser choose default
};

export default function VideoRecorder({ onClose, onSend }) {
    const [permission, setPermission] = useState(null); // null | 'granted' | 'denied'
    const [isRecording, setIsRecording] = useState(false);
    const [recordingTime, setRecordingTime] = useState(0);
    const [recordedVideo, setRecordedVideo] = useState(null); // { blob, url }
    const [isSending, setIsSending] = useState(false);
    const [cameraFacing, setCameraFacing] = useState('user'); // 'user' (front) or 'environment' (back)

    const videoRef = useRef(null);
    const mediaRecorderRef = useRef(null);
    const streamRef = useRef(null);
    const chunksRef = useRef([]);
    const timerRef = useRef(null);

    const MAX_DURATION = 60; // 60 seconds

    // Request camera access
    useEffect(() => {
        const requestCamera = async () => {
            try {
                const constraints = {
                    video: {
                        facingMode: cameraFacing,
                        width: { ideal: 720 },
                        height: { ideal: 720 }
                    },
                    audio: true
                };

                const stream = await navigator.mediaDevices.getUserMedia(constraints);
                streamRef.current = stream;
                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                }
                setPermission('granted');
            } catch (error) {
                console.error('Camera access error:', error);
                setPermission('denied');
            }
        };

        requestCamera();

        // Cleanup on unmount
        return () => {
            if (streamRef.current) {
                streamRef.current.getTracks().forEach(track => track.stop());
            }
            if (timerRef.current) {
                clearInterval(timerRef.current);
            }
        };
    }, [cameraFacing]);

    const startRecording = () => {
        if (!streamRef.current) return;

        try {
            chunksRef.current = [];
            const mimeType = getSupportedMimeType();
            const options = {
                videoBitsPerSecond: 750000, // ~0.75 Mbps
            };
            if (mimeType) options.mimeType = mimeType;

            const recorder = new MediaRecorder(streamRef.current, options);
            mediaRecorderRef.current = recorder;

            recorder.ondataavailable = (e) => {
                if (e.data.size > 0) {
                    chunksRef.current.push(e.data);
                }
            };

            recorder.onstop = async () => {
                const blob = new Blob(chunksRef.current, { type: mimeType || 'video/webm' });
                const url = URL.createObjectURL(blob);
                setRecordedVideo({ blob, url });
            };

            recorder.start();
            setIsRecording(true);
            setRecordingTime(0);

            // Start timer
            timerRef.current = setInterval(() => {
                setRecordingTime((prev) => {
                    if (prev >= MAX_DURATION - 1) {
                        stopRecording();
                        return MAX_DURATION;
                    }
                    return prev + 1;
                });
            }, 1000);
        } catch (error) {
            console.error('Recording error:', error);
            alert('Failed to start recording');
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
            if (timerRef.current) {
                clearInterval(timerRef.current);
            }
            // Stop camera preview
            if (streamRef.current) {
                streamRef.current.getTracks().forEach(track => track.stop());
                streamRef.current = null;
            }
        }
    };

    const handleSend = async () => {
        if (!recordedVideo || isSending) return;

        setIsSending(true);
        try {
            // Generate thumbnail
            const thumbnailBlob = await generateThumbnail(recordedVideo.blob);

            // Upload video
            const videoName = `videos/${Date.now()}_video.webm`;
            const videoRef = ref(storage, videoName);
            await uploadBytes(videoRef, recordedVideo.blob);
            const videoURL = await getDownloadURL(videoRef);

            // Upload thumbnail
            const thumbName = `thumbnails/${Date.now()}_thumb.jpg`;
            const thumbRef = ref(storage, thumbName);
            await uploadBytes(thumbRef, thumbnailBlob);
            const thumbnailURL = await getDownloadURL(thumbRef);

            // Return to parent
            onSend({
                videoURL,
                thumbnailURL,
                duration: recordingTime
            });

            // Cleanup
            URL.revokeObjectURL(recordedVideo.url);
            onClose();
        } catch (error) {
            console.error('Upload error:', error);
            alert('Failed to send video. Please try again.');
        } finally {
            setIsSending(false);
        }
    };

    const handleRetry = () => {
        URL.revokeObjectURL(recordedVideo.url);
        setRecordedVideo(null);
        setRecordingTime(0);

        // Restart camera
        const requestCamera = async () => {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: { facingMode: cameraFacing },
                    audio: true
                });
                streamRef.current = stream;
                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                }
            } catch (error) {
                console.error('Camera error:', error);
            }
        };
        requestCamera();
    };

    const toggleCamera = async () => {
        const newFacing = cameraFacing === 'user' ? 'environment' : 'user';
        setCameraFacing(newFacing);
    };

    const formatTime = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    return (
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            background: 'rgba(0, 0, 0, 0.95)',
            zIndex: 3000,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center'
        }}>
            {/* Permission Denied */}
            {permission === 'denied' && (
                <div style={{ textAlign: 'center', color: 'white', padding: '2rem' }}>
                    <h2 style={{ marginBottom: '1rem' }}>📹 Camera Access Denied</h2>
                    <p style={{ marginBottom: '1.5rem', color: '#94a3b8' }}>
                        Please allow camera and microphone access to record video messages.
                    </p>
                    <button
                        onClick={onClose}
                        style={{
                            padding: '0.75rem 1.5rem',
                            background: 'var(--primary)',
                            color: 'white',
                            border: 'none',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            fontSize: '1rem'
                        }}
                    >
                        Close
                    </button>
                </div>
            )}

            {/* Recording/Preview UI */}
            {permission === 'granted' && (
                <>
                    {/* Video Preview */}
                    <div style={{
                        position: 'relative',
                        width: '90vw',
                        maxWidth: '400px',
                        aspectRatio: '1/1',
                        borderRadius: '20px',
                        overflow: 'hidden',
                        background: '#000',
                        marginBottom: '2rem'
                    }}>
                        {recordedVideo ? (
                            <video
                                src={recordedVideo.url}
                                controls
                                playsInline
                                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            />
                        ) : (
                            <video
                                ref={videoRef}
                                autoPlay
                                playsInline
                                muted
                                style={{ width: '100%', height: '100%', objectFit: 'cover', transform: cameraFacing === 'user' ? 'scaleX(-1)' : 'none' }}
                            />
                        )}

                        {/* Timer Overlay */}
                        {isRecording && (
                            <div style={{
                                position: 'absolute',
                                top: '1rem',
                                right: '1rem',
                                background: 'rgba(239, 68, 68, 0.9)',
                                padding: '0.5rem 1rem',
                                borderRadius: '20px',
                                color: 'white',
                                fontSize: '1.25rem',
                                fontWeight: 600,
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem'
                            }}>
                                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'white', animation: 'pulse 1s infinite' }}></span>
                                {formatTime(recordingTime)}
                            </div>
                        )}

                        {/* Camera Flip Button (only if not recorded) */}
                        {!recordedVideo && !isRecording && (
                            <button
                                onClick={toggleCamera}
                                style={{
                                    position: 'absolute',
                                    top: '1rem',
                                    right: '1rem',
                                    background: 'rgba(255, 255, 255, 0.2)',
                                    border: 'none',
                                    borderRadius: '50%',
                                    width: '48px',
                                    height: '48px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    cursor: 'pointer',
                                    backdropFilter: 'blur(10px)'
                                }}
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                                    <path d="M15 2v6a2 2 0 0 0 2 2h6M12 16l4-4m0 0l-4-4m4 4H8"></path>
                                </svg>
                            </button>
                        )}
                    </div>

                    {/* Controls */}
                    <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                        {!recordedVideo ? (
                            <>
                                <button
                                    onClick={onClose}
                                    style={{
                                        padding: '1rem',
                                        background: 'rgba(255, 255, 255, 0.1)',
                                        border: '2px solid white',
                                        borderRadius: '50%',
                                        width: '60px',
                                        height: '60px',
                                        cursor: 'pointer',
                                        color: 'white'
                                    }}
                                >
                                    ✕
                                </button>
                                <button
                                    onClick={isRecording ? stopRecording : startRecording}
                                    disabled={isRecording && recordingTime >= MAX_DURATION}
                                    style={{
                                        padding: '1rem',
                                        background: isRecording ? '#ef4444' : '#6366f1',
                                        border: '4px solid white',
                                        borderRadius: '50%',
                                        width: '80px',
                                        height: '80px',
                                        cursor: 'pointer',
                                        fontSize: '2rem'
                                    }}
                                >
                                    {isRecording ? '⏹' : '⏺'}
                                </button>
                            </>
                        ) : (
                            <>
                                <button
                                    onClick={handleRetry}
                                    style={{
                                        padding: '0.75rem 1.5rem',
                                        background: 'rgba(255, 255, 255, 0.1)',
                                        border: '2px solid white',
                                        borderRadius: '12px',
                                        color: 'white',
                                        cursor: 'pointer',
                                        fontSize: '1rem'
                                    }}
                                >
                                    🔄 Retry
                                </button>
                                <button
                                    onClick={handleSend}
                                    disabled={isSending}
                                    style={{
                                        padding: '0.75rem 2rem',
                                        background: isSending ? '#94a3b8' : '#10b981',
                                        border: 'none',
                                        borderRadius: '12px',
                                        color: 'white',
                                        cursor: isSending ? 'not-allowed' : 'pointer',
                                        fontSize: '1rem',
                                        fontWeight: 600
                                    }}
                                >
                                    {isSending ? 'Sending...' : '✓ Send'}
                                </button>
                            </>
                        )}
                    </div>

                    {/* Duration Indicator */}
                    {!recordedVideo && !isRecording && (
                        <p style={{ color: 'white', marginTop: '1rem', opacity: 0.7, fontSize: '0.9rem' }}>
                            Tap to record (max 60s)
                        </p>
                    )}
                </>
            )}

            <style>{`
                @keyframes pulse {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.5; }
                }
            `}</style>
        </div>
    );
}
