import { useState, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { storage } from '../../services/firebase';

export default function PollCreator({ onClose, onSubmit, chatId }) {
    const { currentUser } = useAuth();
    const [question, setQuestion] = useState('');
    const [options, setOptions] = useState([{ text: '', image: null, imageUrl: null }, { text: '', image: null, imageUrl: null }]);

    // Advanced Settings
    const [anonymous, setAnonymous] = useState(false);
    const [multipleAnswers, setMultipleAnswers] = useState(false);
    const [durationHours, setDurationHours] = useState(0); // 0 = never

    const [isUploading, setIsUploading] = useState(false);
    const fileInputRefs = useRef([]);

    const updateOptionText = (index, value) => {
        setOptions(prev => prev.map((o, i) => i === index ? { ...o, text: value } : o));
    };

    const handleImageSelect = (index, e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (file.size > 5 * 1024 * 1024) {
            alert('Image must be less than 5MB');
            return;
        }
        const previewUrl = URL.createObjectURL(file);
        setOptions(prev => prev.map((o, i) => i === index ? { ...o, image: file, imageUrl: previewUrl } : o));
    };

    const removeImage = (index) => {
        setOptions(prev => prev.map((o, i) => {
            if (i === index) {
                if (o.imageUrl) URL.revokeObjectURL(o.imageUrl);
                return { ...o, image: null, imageUrl: null };
            }
            return o;
        }));
    };

    const addOption = () => {
        if (options.length < 5) setOptions(prev => [...prev, { text: '', image: null, imageUrl: null }]);
    };

    const removeOption = (index) => {
        if (options.length > 2) {
            setOptions(prev => prev.filter((o, i) => {
                if (i === index && o.imageUrl) URL.revokeObjectURL(o.imageUrl);
                return i !== index;
            }));
        }
    };

    const handleCreate = async () => {
        if (!question.trim()) {
            alert('Please enter a question.');
            return;
        }

        // At least 2 options must have text or an image
        const validOptionsInfo = options.filter(o => o.text.trim().length > 0 || o.image);
        if (validOptionsInfo.length < 2) {
            alert('Please provide at least 2 valid options (text or image).');
            return;
        }

        setIsUploading(true);

        try {
            // Upload images if any
            const finalOptions = await Promise.all(validOptionsInfo.map(async (opt) => {
                let downloadedUrl = null;
                if (opt.image) {
                    const fileRef = ref(storage, `polls/${chatId}/${Date.now()}_${opt.image.name}`);
                    const uploadTask = await uploadBytesResumable(fileRef, opt.image);
                    downloadedUrl = await getDownloadURL(uploadTask.ref);
                }
                return {
                    text: opt.text.trim(),
                    image: downloadedUrl,
                    votes: [] // Ensure votes array is initialized here
                };
            }));

            // Prepare settings
            const settings = {
                anonymous,
                multipleAnswers,
            };

            if (durationHours > 0) {
                // Set expiry date
                settings.expiresAt = new Date(Date.now() + durationHours * 60 * 60 * 1000);
            }

            onSubmit({
                question: question.trim(),
                options: finalOptions,
                settings,
                totalVotes: 0
            });
            onClose();
        } catch (error) {
            console.error("Error creating poll:", error);
            alert("Failed to upload images. Please try again.");
            setIsUploading(false);
        }
    };

    return (
        <div className="modal-overlay" style={{ zIndex: 9999 }}>
            <div className="modal" style={{ maxWidth: '28rem', padding: '1.5rem', maxHeight: '90vh', overflowY: 'auto' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                    <h3 style={{ color: 'var(--app-text)', fontSize: '1.15rem', fontWeight: 700, margin: 0 }}>
                        📊 Create Poll
                    </h3>
                    <button onClick={onClose} disabled={isUploading} style={{ background: 'none', border: 'none', color: 'var(--app-text-muted)', cursor: 'pointer', fontSize: '1.25rem' }}>✕</button>
                </div>

                <label style={{ fontSize: '0.85rem', color: 'var(--app-text-muted)', marginBottom: '0.4rem', display: 'block', fontWeight: 500 }}>Question</label>
                <input
                    className="modal-input"
                    placeholder="Ask a question..."
                    value={question}
                    onChange={e => setQuestion(e.target.value)}
                    maxLength={200}
                    style={{ marginBottom: '1.25rem', width: '100%', fontSize: '1rem', padding: '0.75rem' }}
                    autoFocus
                    disabled={isUploading}
                />

                <label style={{ fontSize: '0.85rem', color: 'var(--app-text-muted)', marginBottom: '0.5rem', display: 'block', fontWeight: 500 }}>
                    Options <span style={{ color: 'var(--app-text-muted)' }}>({options.length}/5)</span>
                </label>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.25rem' }}>
                    {options.map((opt, i) => (
                        <div key={i} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', background: 'var(--message-hover)', padding: '0.5rem', borderRadius: '8px' }}>
                            <span style={{
                                width: '24px', height: '24px', borderRadius: '50%',
                                background: 'var(--input-bg)', color: 'var(--app-text-muted)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: '0.75rem', fontWeight: 600, flexShrink: 0,
                                border: '1px solid var(--border-color)'
                            }}>{i + 1}</span>

                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                    <input
                                        className="modal-input"
                                        placeholder={`Option ${i + 1}`}
                                        value={opt.text}
                                        onChange={e => updateOptionText(i, e.target.value)}
                                        maxLength={100}
                                        style={{ marginBottom: 0, flex: 1 }}
                                        disabled={isUploading}
                                    />
                                    <button
                                        onClick={() => fileInputRefs.current[i]?.click()}
                                        title={opt.imageUrl ? "Change image" : "Add image"}
                                        style={{ background: opt.imageUrl ? 'var(--primary-light)' : 'var(--input-bg)', border: '1px solid var(--border-color)', borderRadius: '8px', cursor: 'pointer', padding: '0 0.5rem', color: opt.imageUrl ? 'white' : 'var(--app-text-muted)' }}
                                        disabled={isUploading}
                                    >📷</button>
                                    <input
                                        type="file"
                                        accept="image/*"
                                        ref={el => fileInputRefs.current[i] = el}
                                        style={{ display: 'none' }}
                                        onChange={(e) => handleImageSelect(i, e)}
                                    />
                                </div>
                                {opt.imageUrl && (
                                    <div style={{ position: 'relative', width: 'fit-content' }}>
                                        <img src={opt.imageUrl} alt="" style={{ height: '40px', borderRadius: '4px', objectFit: 'cover' }} />
                                        <button onClick={() => removeImage(i)} style={{ position: 'absolute', top: -5, right: -5, background: 'var(--danger)', color: 'white', border: 'none', borderRadius: '50%', width: 16, height: 16, fontSize: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>✕</button>
                                    </div>
                                )}
                            </div>

                            {options.length > 2 && (
                                <button
                                    onClick={() => removeOption(i)}
                                    style={{
                                        background: 'none', border: 'none', cursor: 'pointer',
                                        color: 'var(--danger)', fontSize: '1.2rem', padding: '0 0.25rem',
                                        flexShrink: 0
                                    }}
                                    title="Remove option"
                                    disabled={isUploading}
                                >✕</button>
                            )}
                        </div>
                    ))}
                </div>

                {options.length < 5 && (
                    <button
                        onClick={addOption}
                        disabled={isUploading}
                        style={{
                            width: '100%', padding: '0.5rem', background: 'transparent',
                            border: '1.5px dashed var(--border-color)', borderRadius: '8px',
                            color: 'var(--primary-light)', cursor: 'pointer', fontSize: '0.85rem',
                            marginBottom: '1.25rem', transition: 'all 0.2s', fontWeight: 500
                        }}
                    >
                        + Add Option
                    </button>
                )}

                {/* Settings Section */}
                <div style={{ background: 'rgba(0,0,0,0.1)', padding: '1rem', borderRadius: '8px', marginBottom: '1.5rem' }}>
                    <h4 style={{ fontSize: '0.85rem', color: 'var(--app-text-muted)', marginBottom: '0.75rem', fontWeight: 600 }}>Settings</h4>

                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem', cursor: 'pointer', fontSize: '0.9rem', color: 'var(--app-text)' }}>
                        <input type="checkbox" checked={anonymous} onChange={e => setAnonymous(e.target.checked)} disabled={isUploading} />
                        Anonymous Voting (voters are hidden)
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem', cursor: 'pointer', fontSize: '0.9rem', color: 'var(--app-text)' }}>
                        <input type="checkbox" checked={multipleAnswers} onChange={e => setMultipleAnswers(e.target.checked)} disabled={isUploading} />
                        Allow Multiple Answers
                    </label>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <label style={{ fontSize: '0.9rem', color: 'var(--app-text)' }}>Expires in:</label>
                        <select
                            value={durationHours}
                            onChange={e => setDurationHours(Number(e.target.value))}
                            disabled={isUploading}
                            style={{ padding: '4px 8px', borderRadius: '4px', background: 'var(--input-bg)', color: 'var(--app-text)', border: '1px solid var(--border-color)' }}
                        >
                            <option value={0}>Never</option>
                            <option value={1}>1 Hour</option>
                            <option value={6}>6 Hours</option>
                            <option value={24}>24 Hours</option>
                        </select>
                    </div>
                </div>


                <div style={{ display: 'flex', gap: '0.75rem' }}>
                    <button onClick={onClose} disabled={isUploading} className="modal-btn secondary" style={{ flex: 1 }}>Cancel</button>
                    <button onClick={handleCreate} disabled={isUploading} className="modal-btn" style={{ flex: 1 }}>
                        {isUploading ? 'Creating...' : 'Create Poll'}
                    </button>
                </div>
            </div>
        </div>
    );
}

