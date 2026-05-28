import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useGame } from '../../context/GameContext';

export default function GameLobbyModal({ onClose, groupMembers, chatInfo, chatId }) {
    const { currentUser } = useAuth();
    const { sendGameInvite } = useGame();
    const [selectedGame, setSelectedGame] = useState('chess'); // 'chess' | 'ludo'
    const [selectedOpponent, setSelectedOpponent] = useState(null);
    const [isSending, setIsSending] = useState(false);

    // Resolve possible opponents:
    // 1. If group chat: filter out currentUser from groupMembers
    // 2. If private chat: find the other participant (usually only one member in groupMembers)
    const opponents = (groupMembers || []).filter(m => m.uid !== currentUser.uid);

    // If it's private chat and opponents is empty, try to resolve from chatInfo
    if (opponents.length === 0 && chatInfo?.members) {
        const otherId = chatInfo.members.find(id => id !== currentUser.uid);
        if (otherId) {
            opponents.push({
                uid: otherId,
                name: chatInfo.name || chatInfo.displayName || 'Opponent',
                photo: chatInfo.photo || chatInfo.photoURL || ''
            });
        }
    }

    const handleSendInvite = async () => {
        if (!selectedOpponent && opponents.length > 1) {
            alert('Please select an opponent to play!');
            return;
        }

        const opponentUser = selectedOpponent || opponents[0];
        if (!opponentUser) {
            alert('No opponent available in this chat!');
            return;
        }

        setIsSending(true);
        try {
            await sendGameInvite(chatId, selectedGame, opponentUser);
            onClose();
        } catch (e) {
            console.error('Invite failed:', e);
            alert('Failed to send game invite: ' + e.message);
        } finally {
            setIsSending(false);
        }
    };

    return (
        <div className="modal-overlay" style={{ zIndex: 9999 }}>
            <div className="modal" style={{ maxWidth: '450px', background: 'var(--bg-dark, #1e293b)', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.1)', padding: '1.75rem' }}>
                <h3 style={{ color: 'var(--app-text, #f8fafc)', marginBottom: '1.25rem', fontSize: '1.35rem', fontWeight: 700, textAlign: 'center' }}>
                    🎮 Play a Game
                </h3>

                {/* Game Selection */}
                <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
                    <div
                        onClick={() => setSelectedGame('chess')}
                        style={{
                            flex: 1,
                            padding: '1.25rem 1rem',
                            borderRadius: '12px',
                            background: selectedGame === 'chess' ? 'rgba(99, 102, 241, 0.25)' : 'rgba(255,255,255,0.03)',
                            border: `2px solid ${selectedGame === 'chess' ? '#6366f1' : 'transparent'}`,
                            cursor: 'pointer',
                            textAlign: 'center',
                            transition: 'all 0.2s ease-in-out'
                        }}
                    >
                        <span style={{ fontSize: '2.5rem', display: 'block', marginBottom: '0.5rem' }}>♟️</span>
                        <strong style={{ color: 'var(--app-text, #f8fafc)', display: 'block', fontSize: '1rem' }}>Chess</strong>
                        <span style={{ fontSize: '0.75rem', color: 'var(--gray, #94a3b8)', display: 'block', marginTop: '0.25rem' }}>1v1 Classic Board Game</span>
                    </div>

                    <div
                        onClick={() => setSelectedGame('ludo')}
                        style={{
                            flex: 1,
                            padding: '1.25rem 1rem',
                            borderRadius: '12px',
                            background: selectedGame === 'ludo' ? 'rgba(99, 102, 241, 0.25)' : 'rgba(255,255,255,0.03)',
                            border: `2px solid ${selectedGame === 'ludo' ? '#6366f1' : 'transparent'}`,
                            cursor: 'pointer',
                            textAlign: 'center',
                            transition: 'all 0.2s ease-in-out'
                        }}
                    >
                        <span style={{ fontSize: '2.5rem', display: 'block', marginBottom: '0.5rem' }}>🎲</span>
                        <strong style={{ color: 'var(--app-text, #f8fafc)', display: 'block', fontSize: '1rem' }}>Ludo</strong>
                        <span style={{ fontSize: '0.75rem', color: 'var(--gray, #94a3b8)', display: 'block', marginTop: '0.25rem' }}>1v1 Local path-run (2 Colors)</span>
                    </div>
                </div>

                {/* Opponent Selection (Only shown if more than 1 opponent, otherwise auto-selects) */}
                {opponents.length > 1 ? (
                    <div style={{ marginBottom: '1.5rem' }}>
                        <label style={{ display: 'block', color: 'var(--gray, #94a3b8)', fontSize: '0.85rem', marginBottom: '0.5rem', fontWeight: 600 }}>
                            Choose Opponent:
                        </label>
                        <select
                            value={selectedOpponent ? selectedOpponent.uid : ''}
                            onChange={(e) => {
                                const matched = opponents.find(m => m.uid === e.target.value);
                                setSelectedOpponent(matched || null);
                            }}
                            style={{
                                width: '100%',
                                padding: '0.75rem',
                                borderRadius: '8px',
                                border: '1px solid rgba(255,255,255,0.1)',
                                background: 'rgba(255,255,255,0.05)',
                                color: 'var(--app-text, #f8fafc)',
                                fontSize: '0.95rem',
                                outline: 'none'
                            }}
                        >
                            <option value="" disabled style={{ background: '#1e293b' }}>Select a member...</option>
                            {opponents.map(m => (
                                <option key={m.uid} value={m.uid} style={{ background: '#1e293b' }}>
                                    {m.name || 'Group Member'}
                                </option>
                            ))}
                        </select>
                    </div>
                ) : opponents.length === 1 ? (
                    <div style={{ marginBottom: '1.5rem', padding: '0.75rem', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '0.75rem', border: '1px solid rgba(255,255,255,0.05)' }}>
                        <img
                            src={opponents[0].photo || `https://ui-avatars.com/api/?name=${opponents[0].name}`}
                            alt=""
                            style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover' }}
                        />
                        <div>
                            <span style={{ fontSize: '0.75rem', color: 'var(--gray, #94a3b8)', display: 'block' }}>Playing against:</span>
                            <strong style={{ color: 'var(--app-text, #f8fafc)', fontSize: '0.95rem' }}>{opponents[0].name}</strong>
                        </div>
                    </div>
                ) : (
                    <div style={{ marginBottom: '1.5rem', color: '#ef4444', textAlign: 'center', fontSize: '0.9rem' }}>
                        No eligible opponents found in this chat room.
                    </div>
                )}

                <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
                    <button
                        onClick={onClose}
                        className="modal-btn secondary"
                        style={{ flex: 1, padding: '0.75rem', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSendInvite}
                        disabled={isSending || opponents.length === 0}
                        className="modal-btn"
                        style={{
                            flex: 1,
                            padding: '0.75rem',
                            borderRadius: '8px',
                            background: '#6366f1',
                            color: 'white',
                            border: 'none',
                            cursor: opponents.length === 0 ? 'not-allowed' : 'pointer',
                            fontWeight: 600,
                            opacity: (isSending || opponents.length === 0) ? 0.6 : 1
                        }}
                    >
                        {isSending ? 'Sending...' : 'Invite & Play'}
                    </button>
                </div>
            </div>
        </div>
    );
}
