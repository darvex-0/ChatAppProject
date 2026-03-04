import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import ReactCrop from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import getCroppedImg from '../../utils/cropImage';

// Preset filters with CSS filter values and preview thumbnails
const FILTERS = [
    { name: 'Original', value: 'none', icon: '🔲' },
    { name: 'Bright', value: 'brightness(1.2)', icon: '☀️' },
    { name: 'Contrast', value: 'contrast(1.3)', icon: '◐' },
    { name: 'Warm', value: 'sepia(0.3) saturate(1.2)', icon: '🌅' },
    { name: 'Cool', value: 'saturate(0.8) hue-rotate(15deg)', icon: '❄️' },
    { name: 'Vivid', value: 'saturate(1.5) contrast(1.1)', icon: '🎨' },
    { name: 'B&W', value: 'grayscale(1)', icon: '⚫' },
    { name: 'Sepia', value: 'sepia(0.8)', icon: '📜' },
    { name: 'Vintage', value: 'sepia(0.4) contrast(1.1) brightness(0.9)', icon: '📷' },
    { name: 'Fade', value: 'saturate(0.7) brightness(1.1) contrast(0.9)', icon: '🌫️' }
];

export default function MediaPreviewModal({ file, onSend, onCancel }) {
    const [caption, setCaption] = useState("");
    const [sending, setSending] = useState(false);

    // Cropper state
    const [showCropper, setShowCropper] = useState(false);
    const [crop, setCrop] = useState({ unit: '%', width: 80, height: 80, x: 10, y: 10 });
    const [completedCrop, setCompletedCrop] = useState(null);
    const imgRef = useRef(null);
    const [editedFile, setEditedFile] = useState(null);

    // Filter state
    const [selectedFilter, setSelectedFilter] = useState('none');
    const [showFilters, setShowFilters] = useState(false);

    // Video trimming state
    const [showTrimmer, setShowTrimmer] = useState(false);
    const [trimStart, setTrimStart] = useState(0);
    const [trimEnd, setTrimEnd] = useState(0); // Fix: initialize to 0, not 100!
    const [videoDuration, setVideoDuration] = useState(0);
    const [currentTime, setCurrentTime] = useState(0);
    const [isDragging, setIsDragging] = useState(null); // 'start', 'end', or null
    const videoRef = useRef(null);
    const trimVideoRef = useRef(null);
    const timelineRef = useRef(null);

    // Refs to track current values for drag handler (avoid stale closures)
    const trimStartRef = useRef(trimStart);
    const trimEndRef = useRef(trimEnd);
    const videoDurationRef = useRef(videoDuration);
    const isDraggingRef = useRef(isDragging);

    // Keep refs in sync with state
    useEffect(() => { trimStartRef.current = trimStart; }, [trimStart]);
    useEffect(() => { trimEndRef.current = trimEnd; }, [trimEnd]);
    useEffect(() => { videoDurationRef.current = videoDuration; }, [videoDuration]);
    useEffect(() => { isDraggingRef.current = isDragging; }, [isDragging]);

    // Generate preview URL (Memoized to prevent video reloading on re-renders)
    const previewUrl = useMemo(() => {
        return editedFile
            ? URL.createObjectURL(editedFile)
            : URL.createObjectURL(file);
    }, [editedFile, file]);

    const isImage = file?.type?.startsWith('image/');
    const isVideo = file?.type?.startsWith('video/');
    const isGif = file?.type === 'image/gif';

    // Video metadata loaded - Only set duration (DON'T reset trim values!)
    const handleVideoMetadata = (e) => {
        const duration = e.target.duration;
        if (videoDuration === 0) {
            // Only initialize on first load
            setVideoDuration(duration);
            setTrimEnd(duration);
        }
    };

    // Video time update
    const handleTimeUpdate = (e) => {
        setCurrentTime(e.target.currentTime);
        // Keep video within trim range
        if (showTrimmer && e.target.currentTime >= trimEndRef.current) {
            e.target.pause();
            e.target.currentTime = trimStartRef.current;
        }
    };

    // Handle drag events - PERCENTAGE BASED
    const handleDragStart = (type) => (e) => {
        e.preventDefault();
        e.stopPropagation();

        // Pause video on drag start (prevents fighting with playhead)
        if (trimVideoRef.current) {
            trimVideoRef.current.pause();
        }

        // Set dragging ref IMMEDIATELY to block timeline clicks
        isDraggingRef.current = type;
        setIsDragging(type);

        if (!timelineRef.current || videoDuration === 0) return;

        // Capture INITIAL state when drag starts
        const initialTrimStart = trimStart;
        const initialTrimEnd = trimEnd;
        const duration = videoDuration;
        const timelineRect = timelineRef.current.getBoundingClientRect();

        // Calculate initial click position as percentage
        const initialClientX = e.touches ? e.touches[0].clientX : e.clientX;
        const initialClickPercent = (initialClientX - timelineRect.left) / timelineRect.width;

        const handleMove = (moveEvent) => {
            moveEvent.preventDefault();

            // Get current position as percentage
            const currentClientX = moveEvent.touches ? moveEvent.touches[0].clientX : moveEvent.clientX;
            const currentPercent = (currentClientX - timelineRect.left) / timelineRect.width;

            // Calculate percentage delta
            const deltaPercent = currentPercent - initialClickPercent;

            // Convert percentage delta to time delta
            const deltaSeconds = deltaPercent * duration;

            if (type === 'start') {
                // Add delta to initial start position
                const newStart = initialTrimStart + deltaSeconds;
                // Clamp: min 0, max = initial end - 0.5s
                const clampedStart = Math.max(0, Math.min(newStart, initialTrimEnd - 0.5));
                setTrimStart(clampedStart);

                // Update video frame while dragging (visual feedback)
                if (trimVideoRef.current) {
                    trimVideoRef.current.currentTime = clampedStart;
                }
            } else if (type === 'end') {
                // Add delta to initial end position
                const newEnd = initialTrimEnd + deltaSeconds;
                // Clamp: min = initial start + 0.5s, max = duration
                const clampedEnd = Math.max(initialTrimStart + 0.5, Math.min(newEnd, duration));
                setTrimEnd(clampedEnd);

                // Update video frame while dragging end
                if (trimVideoRef.current) {
                    trimVideoRef.current.currentTime = clampedEnd;
                }
            }
        };

        const handleUp = () => {
            window.removeEventListener('mousemove', handleMove);
            window.removeEventListener('mouseup', handleUp);
            window.removeEventListener('touchmove', handleMove);
            window.removeEventListener('touchend', handleUp);
            isDraggingRef.current = null;
            setIsDragging(null);
        };

        window.addEventListener('mousemove', handleMove);
        window.addEventListener('mouseup', handleUp);
        window.addEventListener('touchmove', handleMove, { passive: false });
        window.addEventListener('touchend', handleUp);
    };

    // Handle timeline click for seeking (NOT on handles)
    const handleTimelineClick = (e) => {
        // Use ref to check dragging state (avoids async state delay)
        if (isDraggingRef.current) return;

        // Check if click was on a handle
        if (e.target.closest('[data-handle]')) return;

        if (!timelineRef.current || videoDuration === 0) return;

        const rect = timelineRef.current.getBoundingClientRect();
        const position = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        const time = position * videoDuration;
        const newTime = Math.max(trimStart, Math.min(trimEnd, time));

        if (trimVideoRef.current) {
            trimVideoRef.current.currentTime = newTime;
        }
        setCurrentTime(newTime);
    };

    // removed onCropComplete for react-easy-crop

    // Apply filter to image via canvas
    const applyFilterToImage = async (imageUrl, filterValue) => {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext('2d');
                ctx.filter = filterValue;
                ctx.drawImage(img, 0, 0);
                canvas.toBlob((blob) => {
                    resolve(blob);
                }, 'image/jpeg', 0.9);
            };
            img.onerror = reject;
            img.src = imageUrl;
        });
    };

    const applyCrop = async () => {
        if (!completedCrop || !imgRef.current) {
            setShowCropper(false);
            return;
        }

        try {
            const scaleX = imgRef.current.naturalWidth / imgRef.current.width;
            const scaleY = imgRef.current.naturalHeight / imgRef.current.height;

            const pixelCrop = {
                x: completedCrop.x * scaleX,
                y: completedCrop.y * scaleY,
                width: completedCrop.width * scaleX,
                height: completedCrop.height * scaleY
            };

            const croppedBlob = await getCroppedImg(previewUrl, pixelCrop);
            const croppedFile = new File([croppedBlob], file.name, { type: 'image/jpeg' });
            setEditedFile(croppedFile);
            setShowCropper(false);
            setCrop({ unit: '%', width: 80, height: 80, x: 10, y: 10 });
            setCompletedCrop(null);
        } catch (e) {
            console.error("Crop error:", e);
        }
    };

    const handleSend = async () => {
        setSending(true);

        let finalFile = editedFile || file;

        // Apply filter if selected (for images)
        if (isImage && selectedFilter !== 'none') {
            try {
                const filteredBlob = await applyFilterToImage(
                    URL.createObjectURL(finalFile),
                    selectedFilter
                );
                finalFile = new File([filteredBlob], file.name, { type: 'image/jpeg' });
            } catch (e) {
                console.error("Filter apply error:", e);
            }
        }

        // Add trim metadata for videos
        const metadata = {};
        if (isVideo && (trimStart > 0 || trimEnd < videoDuration)) {
            metadata.trimStart = trimStart;
            metadata.trimEnd = trimEnd;
        }

        await onSend(finalFile, caption, metadata);
        setSending(false);
    };

    const formatFileSize = (bytes) => {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    };

    const formatTime = (seconds) => {
        if (!seconds || isNaN(seconds)) return '0:00';
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    // Styles
    const styles = {
        container: {
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            background: 'var(--modal-bg)',
            zIndex: 1100,
            display: 'flex',
            flexDirection: 'column',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
        },
        header: {
            padding: '12px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid var(--border-color)',
            minHeight: '56px'
        },
        closeBtn: {
            background: 'none',
            border: 'none',
            color: 'var(--app-text)',
            fontSize: '24px',
            cursor: 'pointer',
            padding: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
        },
        fileName: {
            color: 'var(--app-text-muted)',
            fontSize: '13px',
            textAlign: 'center',
            flex: 1,
            padding: '0 8px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap'
        },
        toolBtn: {
            background: 'rgba(99, 102, 241, 0.15)',
            border: '1px solid rgba(99, 102, 241, 0.3)',
            color: '#a5b4fc',
            padding: '8px 16px',
            borderRadius: '20px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: 500,
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            transition: 'all 0.2s'
        },
        toolBtnActive: {
            background: 'var(--primary)',
            borderColor: 'var(--primary)',
            color: 'white'
        },
        previewArea: {
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
            overflow: 'hidden',
            minHeight: 0
        },
        filterGrid: {
            display: 'grid',
            gridTemplateColumns: 'repeat(5, 1fr)',
            gap: '8px',
            padding: '12px',
            background: 'var(--input-bg)',
            borderTop: '1px solid var(--border-color)',
            maxHeight: '120px',
            overflowY: 'auto'
        },
        filterItem: {
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '4px',
            padding: '8px 4px',
            borderRadius: '8px',
            cursor: 'pointer',
            transition: 'all 0.2s',
            border: '2px solid transparent'
        },
        filterItemActive: {
            background: 'rgba(99, 102, 241, 0.2)',
            borderColor: 'var(--primary)'
        },
        filterIcon: {
            fontSize: '20px',
            width: '36px',
            height: '36px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(51, 65, 85, 0.5)',
            borderRadius: '8px'
        },
        filterName: {
            fontSize: '10px',
            color: 'var(--app-text-muted)',
            textAlign: 'center'
        },
        footer: {
            padding: '12px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            borderTop: '1px solid var(--border-color)',
            background: 'var(--modal-bg)'
        },
        captionInput: {
            flex: 1,
            padding: '12px 16px',
            background: 'var(--input-bg)',
            border: '1px solid var(--border-color)',
            borderRadius: '24px',
            color: 'var(--app-text)',
            fontSize: '15px',
            outline: 'none'
        },
        sendBtn: {
            width: '48px',
            height: '48px',
            borderRadius: '50%',
            background: 'var(--primary)',
            border: 'none',
            color: 'white',
            fontSize: '20px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
        }
    };

    return (
        <div style={styles.container}>
            {/* Header */}
            <div style={styles.header}>
                <button onClick={onCancel} style={styles.closeBtn}>✕</button>

                <span style={styles.fileName}>
                    {file?.name} • {formatFileSize(file?.size)}
                </span>

                <div style={{ display: 'flex', gap: '8px' }}>
                    {isImage && !isGif && (
                        <>
                            <button
                                onClick={() => { setShowCropper(!showCropper); setShowFilters(false); }}
                                style={{
                                    ...styles.toolBtn,
                                    ...(showCropper ? styles.toolBtnActive : {})
                                }}
                            >
                                ✂️
                            </button>
                            <button
                                onClick={() => { setShowFilters(!showFilters); setShowCropper(false); }}
                                style={{
                                    ...styles.toolBtn,
                                    ...(showFilters ? styles.toolBtnActive : {})
                                }}
                            >
                                🎨
                            </button>
                        </>
                    )}
                    {isVideo && (
                        <button
                            onClick={() => setShowTrimmer(!showTrimmer)}
                            style={{
                                ...styles.toolBtn,
                                ...(showTrimmer ? styles.toolBtnActive : {})
                            }}
                        >
                            ✂️ Trim
                        </button>
                    )}
                </div>
            </div>

            {/* Preview Area */}
            <div style={styles.previewArea}>
                {showCropper ? (
                    <div style={{ position: 'relative', width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <ReactCrop
                            crop={crop}
                            onChange={c => setCrop(c)}
                            onComplete={c => setCompletedCrop(c)}
                        >
                            <img
                                ref={imgRef}
                                src={previewUrl}
                                style={{ maxHeight: '60vh', maxWidth: '100%', objectFit: 'contain' }}
                                alt="Crop Preview"
                            />
                        </ReactCrop>
                    </div>
                ) : isImage ? (
                    <img
                        src={previewUrl}
                        alt="Preview"
                        style={{
                            maxWidth: '100%',
                            maxHeight: '100%',
                            objectFit: 'contain',
                            borderRadius: '8px',
                            filter: selectedFilter
                        }}
                    />
                ) : isVideo ? (
                    <video
                        ref={showTrimmer ? trimVideoRef : videoRef}
                        src={previewUrl}
                        controls={!showTrimmer}
                        playsInline
                        onLoadedMetadata={handleVideoMetadata}
                        onTimeUpdate={handleTimeUpdate}
                        style={{
                            maxWidth: '100%',
                            maxHeight: showTrimmer ? '50%' : '100%',
                            borderRadius: '8px'
                        }}
                    />
                ) : (
                    <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '16px',
                        color: 'var(--app-text)'
                    }}>
                        <div style={{
                            width: '80px',
                            height: '80px',
                            background: 'rgba(99, 102, 241, 0.2)',
                            borderRadius: '16px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '32px'
                        }}>
                            📄
                        </div>
                        <span style={{ fontSize: '16px', fontWeight: 500 }}>{file?.name}</span>
                        <span style={{ color: 'var(--app-text-muted)' }}>{formatFileSize(file?.size)}</span>
                    </div>
                )}
            </div>

            {/* Video Trimmer - Instagram/TikTok Style */}
            {showTrimmer && isVideo && videoDuration > 0 && (
                <div style={{
                    padding: '16px',
                    background: 'var(--input-bg)',
                    borderTop: '1px solid var(--border-color)'
                }}>
                    {/* Time display */}
                    <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        marginBottom: '12px',
                        fontSize: '13px',
                        color: 'var(--app-text-muted)'
                    }}>
                        <span>{formatTime(trimStart)}</span>
                        <span style={{ color: 'var(--primary)', fontWeight: 600 }}>
                            {formatTime(trimEnd - trimStart)}
                        </span>
                        <span>{formatTime(trimEnd)}</span>
                    </div>

                    {/* Timeline with dual handles */}
                    <div
                        ref={timelineRef}
                        style={{
                            position: 'relative',
                            height: '60px',
                            background: 'var(--app-bg-secondary)',
                            borderRadius: '8px',
                            overflow: 'hidden',
                            touchAction: 'none'
                        }}
                        onClick={handleTimelineClick}
                    >
                        {/* Unselected area (left) */}
                        <div style={{
                            position: 'absolute',
                            left: 0,
                            top: 0,
                            width: `${(trimStart / videoDuration) * 100}%`,
                            height: '100%',
                            background: 'rgba(0, 0, 0, 0.6)',
                            zIndex: 2
                        }} />

                        {/* Unselected area (right) */}
                        <div style={{
                            position: 'absolute',
                            right: 0,
                            top: 0,
                            width: `${((videoDuration - trimEnd) / videoDuration) * 100}%`,
                            height: '100%',
                            background: 'rgba(0, 0, 0, 0.6)',
                            zIndex: 2
                        }} />

                        {/* Selected range border */}
                        <div style={{
                            position: 'absolute',
                            left: `${(trimStart / videoDuration) * 100}%`,
                            width: `${((trimEnd - trimStart) / videoDuration) * 100}%`,
                            top: 0,
                            height: '100%',
                            border: '3px solid var(--primary)',
                            borderRadius: '4px',
                            boxSizing: 'border-box',
                            zIndex: 3,
                            pointerEvents: 'none'
                        }} />

                        {/* Left handle */}
                        <div
                            data-handle="start"
                            onMouseDown={handleDragStart('start')}
                            onTouchStart={handleDragStart('start')}
                            style={{
                                position: 'absolute',
                                left: `calc(${(trimStart / videoDuration) * 100}% - 14px)`,
                                top: '50%',
                                transform: 'translateY(-50%)',
                                width: '28px',
                                height: '48px',
                                background: 'var(--primary)',
                                borderRadius: '6px',
                                cursor: 'ew-resize',
                                zIndex: 5,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                boxShadow: '0 2px 8px rgba(0,0,0,0.3)'
                            }}
                        >
                            <div style={{
                                width: '4px',
                                height: '24px',
                                background: 'white',
                                borderRadius: '2px'
                            }} />
                        </div>

                        {/* Right handle */}
                        <div
                            data-handle="end"
                            onMouseDown={handleDragStart('end')}
                            onTouchStart={handleDragStart('end')}
                            style={{
                                position: 'absolute',
                                left: `calc(${(trimEnd / videoDuration) * 100}% - 14px)`,
                                top: '50%',
                                transform: 'translateY(-50%)',
                                width: '28px',
                                height: '48px',
                                background: 'var(--primary)',
                                borderRadius: '6px',
                                cursor: 'ew-resize',
                                zIndex: 5,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                boxShadow: '0 2px 8px rgba(0,0,0,0.3)'
                            }}
                        >
                            <div style={{
                                width: '4px',
                                height: '24px',
                                background: 'white',
                                borderRadius: '2px'
                            }} />
                        </div>

                        {/* Playhead */}
                        <div style={{
                            position: 'absolute',
                            left: `${(currentTime / videoDuration) * 100}%`,
                            top: 0,
                            width: '2px',
                            height: '100%',
                            background: 'white',
                            zIndex: 4,
                            boxShadow: '0 0 4px rgba(0,0,0,0.5)'
                        }} />
                    </div>

                    {/* Playback controls */}
                    <div style={{
                        display: 'flex',
                        justifyContent: 'center',
                        gap: '16px',
                        marginTop: '16px'
                    }}>
                        <button
                            onClick={() => {
                                if (trimVideoRef.current) {
                                    if (trimVideoRef.current.paused) {
                                        trimVideoRef.current.currentTime = trimStart;
                                        trimVideoRef.current.play();
                                    } else {
                                        trimVideoRef.current.pause();
                                    }
                                }
                            }}
                            style={{
                                width: '48px',
                                height: '48px',
                                borderRadius: '50%',
                                background: 'var(--primary)',
                                border: 'none',
                                color: 'white',
                                fontSize: '20px',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                            }}
                        >
                            ▶️
                        </button>
                        <button
                            onClick={() => setShowTrimmer(false)}
                            style={{
                                padding: '12px 24px',
                                background: 'rgba(34, 197, 94, 0.2)',
                                border: '1px solid rgba(34, 197, 94, 0.4)',
                                color: '#86efac',
                                borderRadius: '24px',
                                cursor: 'pointer',
                                fontSize: '14px',
                                fontWeight: 500
                            }}
                        >
                            ✓ Done
                        </button>
                    </div>
                </div>
            )}

            {/* Filter Grid */}
            {showFilters && isImage && !showCropper && (
                <div style={styles.filterGrid}>
                    {FILTERS.map((filter) => (
                        <button
                            key={filter.name}
                            onClick={() => setSelectedFilter(filter.value)}
                            style={{
                                ...styles.filterItem,
                                ...(selectedFilter === filter.value ? styles.filterItemActive : {}),
                                background: 'none',
                                border: selectedFilter === filter.value
                                    ? '2px solid var(--primary)'
                                    : '2px solid transparent'
                            }}
                        >
                            <div style={styles.filterIcon}>{filter.icon}</div>
                            <span style={{
                                ...styles.filterName,
                                color: selectedFilter === filter.value ? 'var(--primary)' : '#94a3b8'
                            }}>
                                {filter.name}
                            </span>
                        </button>
                    ))}
                </div>
            )}

            {/* Cropper Controls */}
            {showCropper && (
                <div style={{
                    padding: '16px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '16px',
                    borderTop: '1px solid var(--border-color)',
                    background: 'var(--input-bg)'
                }}>
                    <span style={{ color: 'var(--app-text-muted)', fontSize: '13px', flex: 1, textAlign: 'left' }}>Drag corners to crop</span>
                    <button
                        onClick={() => setShowCropper(false)}
                        style={{
                            padding: '10px 20px',
                            background: 'var(--app-bg-secondary)',
                            color: 'var(--app-text)',
                            border: 'none',
                            borderRadius: '20px',
                            cursor: 'pointer',
                            fontSize: '14px'
                        }}
                    >
                        Cancel
                    </button>
                    <button
                        onClick={applyCrop}
                        style={{
                            padding: '10px 20px',
                            background: 'var(--primary)',
                            color: 'white',
                            border: 'none',
                            borderRadius: '20px',
                            cursor: 'pointer',
                            fontSize: '14px',
                            fontWeight: 500
                        }}
                    >
                        Apply
                    </button>
                </div>
            )}

            {/* Caption & Send */}
            {!showCropper && !showTrimmer && (
                <div style={styles.footer}>
                    <input
                        value={caption}
                        onChange={(e) => setCaption(e.target.value)}
                        placeholder="Add a caption..."
                        style={styles.captionInput}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && !sending) {
                                handleSend();
                            }
                        }}
                    />
                    <button
                        onClick={handleSend}
                        disabled={sending}
                        style={{
                            ...styles.sendBtn,
                            opacity: sending ? 0.7 : 1,
                            cursor: sending ? 'not-allowed' : 'pointer'
                        }}
                    >
                        {sending ? '⏳' : '➤'}
                    </button>
                </div>
            )}
        </div>
    );
}
