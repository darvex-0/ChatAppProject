import { useState, useRef, useEffect } from 'react';

export default function MediaCamera({ onClose, onCapture }) {
    // Camera State
    const [facingMode, setFacingMode] = useState('user'); // 'user' | 'environment'
    const [hasFlash, setHasFlash] = useState(false);
    const [flashOn, setFlashOn] = useState(false);
    const [permission, setPermission] = useState('pending'); // 'pending' | 'granted' | 'denied'

    // Recording State
    const [isRecording, setIsRecording] = useState(false);
    const [recordingTime, setRecordingTime] = useState(0);

    // Refs
    const videoRef = useRef(null);
    const mediaRecorderRef = useRef(null);
    const chunksRef = useRef([]);
    const timerRef = useRef(null);
    const pressStartTimeRef = useRef(0);
    const longPressTimerRef = useRef(null);

    // Stream Ref for cleanup (Critical for preventing leaks)
    const streamRef = useRef(null);

    // --- Camera Setup ---
    useEffect(() => {
        let isMounted = true;

        const initCamera = async () => {
            // Cleanup existing stream
            stopCamera();

            try {
                const constraints = {
                    video: {
                        facingMode: facingMode,
                        width: { ideal: 1920 },
                        height: { ideal: 1080 },
                        aspectRatio: { ideal: 1.777 } // 16:9
                    },
                    audio: true
                };

                const newStream = await navigator.mediaDevices.getUserMedia(constraints);

                // If unmounted during setup, huge leak potential -> stop immediately
                if (!isMounted) {
                    newStream.getTracks().forEach(track => track.stop());
                    return;
                }

                streamRef.current = newStream;
                if (videoRef.current) {
                    videoRef.current.srcObject = newStream;
                }
                setPermission('granted');

                // Check for Flash (Torch) support
                const track = newStream.getVideoTracks()[0];
                const capabilities = track.getCapabilities ? track.getCapabilities() : {};
                if (capabilities.torch) {
                    setHasFlash(true);
                } else {
                    setHasFlash(false);
                }

            } catch (error) {
                console.error("Camera Error:", error);
                if (isMounted) setPermission('denied');
            }
        };

        initCamera();

        return () => {
            isMounted = false;
            stopCamera();
        };
    }, [facingMode]);

    const stopCamera = () => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        }
    };

    const toggleCamera = () => {
        setFacingMode(prev => prev === 'user' ? 'environment' : 'user');
        setFlashOn(false);
    };

    const toggleFlash = async () => {
        if (!streamRef.current || !hasFlash) return;
        const track = streamRef.current.getVideoTracks()[0];
        try {
            await track.applyConstraints({
                advanced: [{ torch: !flashOn }]
            });
            setFlashOn(!flashOn);
        } catch (err) {
            console.error("Flash toggle error:", err);
        }
    };

    // --- Capture Logic ---

    // 1. Take Photo
    const takePhoto = () => {
        if (!videoRef.current) return;

        const video = videoRef.current;
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;

        const ctx = canvas.getContext('2d');
        // Mirror if front camera
        if (facingMode === 'user') {
            ctx.translate(canvas.width, 0);
            ctx.scale(-1, 1);
        }
        ctx.drawImage(video, 0, 0);

        canvas.toBlob(blob => {
            const file = new File([blob], `photo_${Date.now()}.jpg`, { type: 'image/jpeg' });
            stopCamera(); // Stop locally before unmount
            onCapture(file);
        }, 'image/jpeg', 0.9);
    };

    // 2. Start Video
    const startRecording = () => {
        if (!streamRef.current) return;

        setIsRecording(true);
        chunksRef.current = [];
        setRecordingTime(0);

        const options = { mimeType: 'video/webm;codecs=vp9' };
        if (!MediaRecorder.isTypeSupported(options.mimeType)) {
            delete options.mimeType; // Fallback
        }

        try {
            const recorder = new MediaRecorder(streamRef.current, options);
            mediaRecorderRef.current = recorder;

            recorder.ondataavailable = (e) => {
                if (e.data.size > 0) chunksRef.current.push(e.data);
            };

            recorder.onstop = () => {
                const blob = new Blob(chunksRef.current, { type: 'video/webm' });
                const file = new File([blob], `video_${Date.now()}.webm`, { type: 'video/webm' });
                stopCamera(); // Stop locally
                onCapture(file);
                setIsRecording(false);
                clearInterval(timerRef.current);
            };

            recorder.start();

            // Timer for UI
            timerRef.current = setInterval(() => {
                setRecordingTime(prev => prev + 1);
            }, 1000);

        } catch (err) {
            console.error("Recording start error:", err);
            setIsRecording(false);
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
            mediaRecorderRef.current.stop();
        }
    };

    // --- Gestures (Tap vs Hold) ---

    const handlePressStart = (e) => {
        pressStartTimeRef.current = Date.now();

        // Start "Hold" timer - if held for 200ms, start video
        longPressTimerRef.current = setTimeout(() => {
            startRecording();
        }, 200);
    };

    const handlePressEnd = (e) => {
        // Clear the hold timer
        if (longPressTimerRef.current) {
            clearTimeout(longPressTimerRef.current);
            longPressTimerRef.current = null;
        }

        // Check if we are recording
        if (isRecording) {
            stopRecording();
        } else {
            // Check duration to confirm it was a tap
            const duration = Date.now() - pressStartTimeRef.current;
            if (duration < 200) {
                takePhoto();
            }
        }
    };

    // --- Render ---
    if (permission === 'denied') {
        return (
            <div style={{ position: 'fixed', inset: 0, background: 'black', zIndex: 3000, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
                <p>Camera access denied. Please enable permissions.</p>
                <button onClick={onClose} style={{ marginLeft: '1rem', padding: '0.5rem 1rem', background: '#333' }}>Close</button>
            </div>
        );
    }

    return (
        <div style={{
            position: 'fixed',
            inset: 0,
            background: 'black',
            zIndex: 3000,
            display: 'flex',
            flexDirection: 'column'
        }}>

            {/* Viewport */}
            <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
                <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        transform: facingMode === 'user' ? 'scaleX(-1)' : 'none'
                    }}
                />

                {/* Top Controls */}
                <div style={{ position: 'absolute', top: '1rem', left: '1rem', right: '1rem', display: 'flex', justifyContent: 'space-between', zIndex: 10 }}>
                    <button onClick={onClose} style={{ background: 'rgba(0,0,0,0.3)', border: 'none', borderRadius: '50%', width: '40px', height: '40px', color: 'white', fontSize: '1.2rem', cursor: 'pointer' }}>✕</button>

                    {hasFlash && (
                        <button onClick={toggleFlash} style={{ background: 'rgba(0,0,0,0.3)', border: 'none', borderRadius: '50%', width: '40px', height: '40px', color: flashOn ? '#fbbf24' : 'white', cursor: 'pointer' }}>
                            ⚡
                        </button>
                    )}
                </div>

                {/* Bottom Controls */}
                <div style={{ position: 'absolute', bottom: '2rem', left: 0, right: 0, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '3rem' }}>

                    {/* Gallery/Placeholder (Visual balance) */}
                    <div style={{ width: '40px' }} />

                    {/* Shutter Button */}
                    <div
                        className="shutter-button"
                        onMouseDown={handlePressStart}
                        onMouseUp={handlePressEnd}
                        onMouseLeave={handlePressEnd}
                        onTouchStart={handlePressStart}
                        onTouchEnd={handlePressEnd}
                        style={{
                            width: '80px',
                            height: '80px',
                            borderRadius: '50%',
                            border: '4px solid white',
                            background: isRecording ? '#ef4444' : 'transparent',
                            transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            transform: isRecording ? 'scale(1.1)' : 'scale(1)',
                            userSelect: 'none',
                            WebkitUserSelect: 'none',
                            touchAction: 'none'
                        }}
                    >
                        {isRecording && <div style={{ width: '20px', height: '20px', background: 'white', borderRadius: '4px' }} />}
                    </div>

                    {/* Camera Toggle */}
                    <button
                        onClick={toggleCamera}
                        style={{
                            background: 'rgba(255,255,255,0.2)',
                            border: 'none',
                            borderRadius: '50%',
                            width: '40px',
                            height: '40px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            backdropFilter: 'blur(5px)'
                        }}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"></path><circle cx="12" cy="10" r="3"></circle></svg>
                    </button>
                </div>

                {/* Recording Timer */}
                {isRecording && (
                    <div style={{ position: 'absolute', top: '5rem', left: '50%', transform: 'translateX(-50%)', background: 'red', padding: '4px 12px', borderRadius: '12px', color: 'white' }}>
                        {Math.floor(recordingTime / 60)}:{(recordingTime % 60).toString().padStart(2, '0')}
                    </div>
                )}
            </div>
        </div>
    );
}
