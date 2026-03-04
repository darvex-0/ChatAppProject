import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';

export default function PollCreator({ onClose, onSubmit }) {
    const { currentUser } = useAuth();
    const [question, setQuestion] = useState('');
    const [options, setOptions] = useState(['', '']); // Start with 2 empty options

    const updateOption = (index, value) => {
        setOptions(prev => prev.map((o, i) => i === index ? value : o));
    };

    const addOption = () => {
        if (options.length < 5) setOptions(prev => [...prev, '']);
    };

    const removeOption = (index) => {
        if (options.length > 2) setOptions(prev => prev.filter((_, i) => i !== index));
    };

    const handleCreate = () => {
        if (!question.trim()) {
            alert('Please enter a question.');
            return;
        }
        const validOptions = options.map(o => o.trim()).filter(o => o.length > 0);
        if (validOptions.length < 2) {
            alert('Please enter at least 2 options.');
            return;
        }

        const votes = {};
        validOptions.forEach((_, i) => { votes[i] = []; });

        onSubmit({
            question: question.trim(),
            options: validOptions,
            votes
        });
        onClose();
    };

    return (
        <div className="modal-overlay" style={{ zIndex: 9999 }}>
            <div className="modal" style={{ maxWidth: '24rem', padding: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                    <h3 style={{ color: 'var(--app-text)', fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>
                        📊 Create Poll
                    </h3>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--app-text-muted)', cursor: 'pointer', fontSize: '1.25rem' }}>✕</button>
                </div>

                <label style={{ fontSize: '0.8rem', color: 'var(--app-text-muted)', marginBottom: '0.4rem', display: 'block' }}>Question</label>
                <input
                    className="modal-input"
                    placeholder="Ask something..."
                    value={question}
                    onChange={e => setQuestion(e.target.value)}
                    maxLength={200}
                    style={{ marginBottom: '1.25rem', width: '100%' }}
                    autoFocus
                />

                <label style={{ fontSize: '0.8rem', color: 'var(--app-text-muted)', marginBottom: '0.5rem', display: 'block' }}>
                    Options <span style={{ color: 'var(--app-text-muted)' }}>({options.length}/5)</span>
                </label>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1rem' }}>
                    {options.map((opt, i) => (
                        <div key={i} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                            <span style={{
                                width: '24px', height: '24px', borderRadius: '50%',
                                background: 'var(--input-bg)', color: 'var(--app-text-muted)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: '0.75rem', fontWeight: 600, flexShrink: 0,
                                border: '1px solid var(--border-color)'
                            }}>{i + 1}</span>
                            <input
                                className="modal-input"
                                placeholder={`Option ${i + 1}`}
                                value={opt}
                                onChange={e => updateOption(i, e.target.value)}
                                maxLength={100}
                                style={{ marginBottom: 0, flex: 1 }}
                            />
                            {options.length > 2 && (
                                <button
                                    onClick={() => removeOption(i)}
                                    style={{
                                        background: 'none', border: 'none', cursor: 'pointer',
                                        color: 'var(--danger)', fontSize: '1rem', padding: '0 0.25rem',
                                        flexShrink: 0
                                    }}
                                    title="Remove option"
                                >✕</button>
                            )}
                        </div>
                    ))}
                </div>

                {options.length < 5 && (
                    <button
                        onClick={addOption}
                        style={{
                            width: '100%', padding: '0.5rem', background: 'transparent',
                            border: '1.5px dashed var(--border-color)', borderRadius: '8px',
                            color: 'var(--primary-light)', cursor: 'pointer', fontSize: '0.85rem',
                            marginBottom: '1.25rem', transition: 'all 0.2s'
                        }}
                        onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--primary)'}
                        onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border-color)'}
                    >
                        + Add Option
                    </button>
                )}

                <div style={{ display: 'flex', gap: '0.75rem' }}>
                    <button onClick={onClose} className="modal-btn secondary" style={{ flex: 1 }}>Cancel</button>
                    <button onClick={handleCreate} className="modal-btn" style={{ flex: 1 }}>Create Poll</button>
                </div>
            </div>
        </div>
    );
}
