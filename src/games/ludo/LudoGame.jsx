import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useGame } from '../../context/GameContext';

// track path coordinates (52 cells)
const TRACK_COORDS = [
    { r: 6, c: 1 }, { r: 6, c: 2 }, { r: 6, c: 3 }, { r: 6, c: 4 }, { r: 6, c: 5 }, // 0-4
    { r: 5, c: 6 }, { r: 4, c: 6 }, { r: 3, c: 6 }, { r: 2, c: 6 }, { r: 1, c: 6 }, { r: 0, c: 6 }, // 5-10
    { r: 0, c: 7 }, // 11
    { r: 0, c: 8 }, { r: 1, c: 8 }, { r: 2, c: 8 }, { r: 3, c: 8 }, { r: 4, c: 8 }, { r: 5, c: 8 }, // 12-17
    { r: 6, c: 9 }, { r: 6, c: 10 }, { r: 6, c: 11 }, { r: 6, c: 12 }, { r: 6, c: 13 }, { r: 6, c: 14 }, // 18-23
    { r: 7, c: 14 }, // 24
    { r: 8, c: 14 }, { r: 8, c: 13 }, { r: 8, c: 12 }, { r: 8, c: 11 }, { r: 8, c: 10 }, { r: 8, c: 9 }, // 25-30
    { r: 9, c: 8 }, { r: 10, c: 8 }, { r: 11, c: 8 }, { r: 12, c: 8 }, { r: 13, c: 8 }, { r: 14, c: 8 }, // 31-36
    { r: 14, c: 7 }, // 37
    { r: 14, c: 6 }, { r: 13, c: 6 }, { r: 12, c: 6 }, { r: 11, c: 6 }, { r: 10, c: 6 }, { r: 9, c: 6 }, // 38-43
    { r: 8, c: 5 }, { r: 8, c: 4 }, { r: 8, c: 3 }, { r: 8, c: 2 }, { r: 8, c: 1 }, { r: 8, c: 0 }, // 44-49
    { r: 7, c: 0 } // 50
];

const getStartStep = (color, numPlayers) => {
    if (color === 'red') return 0;
    if (color === 'green') return 13;
    if (color === 'yellow') return 26;
    if (color === 'blue') {
        return numPlayers === 2 ? 26 : 39;
    }
    return 0;
};

const getHomeStretchCoords = (color, numPlayers) => {
    if (color === 'red') {
        return [
            { r: 7, c: 1 }, { r: 7, c: 2 }, { r: 7, c: 3 }, { r: 7, c: 4 }, { r: 7, c: 5 }
        ];
    }
    if (color === 'green') {
        return [
            { r: 1, c: 7 }, { r: 2, c: 7 }, { r: 3, c: 7 }, { r: 4, c: 7 }, { r: 5, c: 7 }
        ];
    }
    if (color === 'yellow') {
        return [
            { r: 7, c: 13 }, { r: 7, c: 12 }, { r: 7, c: 11 }, { r: 7, c: 10 }, { r: 7, c: 9 }
        ];
    }
    if (color === 'blue') {
        if (numPlayers === 2) {
            return [
                { r: 7, c: 13 }, { r: 7, c: 12 }, { r: 7, c: 11 }, { r: 7, c: 10 }, { r: 7, c: 9 }
            ];
        }
        return [
            { r: 13, c: 7 }, { r: 12, c: 7 }, { r: 11, c: 7 }, { r: 10, c: 7 }, { r: 9, c: 7 }
        ];
    }
    return [];
};

const getNextTurnUid = (players, currentUid) => {
    const colorOrder = ['red', 'green', 'yellow', 'blue'];
    const eligiblePlayers = Object.entries(players)
        .filter(([uid, p]) => !p.conceded && !p.finished)
        .map(([uid, p]) => ({
            uid,
            color: p.color
        }));

    if (eligiblePlayers.length === 0) return currentUid;

    eligiblePlayers.sort((a, b) => colorOrder.indexOf(a.color) - colorOrder.indexOf(b.color));

    let currentIndex = eligiblePlayers.findIndex(p => p.uid === currentUid);
    if (currentIndex === -1) {
        const fullPlayers = Object.entries(players).map(([uid, p]) => ({ uid, color: p.color }));
        fullPlayers.sort((a, b) => colorOrder.indexOf(a.color) - colorOrder.indexOf(b.color));
        const oldIndex = fullPlayers.findIndex(p => p.uid === currentUid);

        for (let i = 1; i <= fullPlayers.length; i++) {
            const nextIdx = (oldIndex + i) % fullPlayers.length;
            const candidate = fullPlayers[nextIdx];
            if (eligiblePlayers.some(p => p.uid === candidate.uid)) {
                return candidate.uid;
            }
        }
        return eligiblePlayers[0]?.uid || currentUid;
    }

    const nextIndex = (currentIndex + 1) % eligiblePlayers.length;
    return eligiblePlayers[nextIndex].uid;
};

const getOrdinal = (n) => {
    if (!n) return '';
    const s = ["th", "st", "nd", "rd"];
    const v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
};

// Safe spot indices where tokens cannot be captured
const SAFE_SPOTS = [0, 8, 13, 21, 26, 34, 39, 47];

// Red starts at index 0, exits lap at 50, enters Home stretch at index 50 exit.
// Blue starts at index 26, exits lap at 24, enters Home stretch at index 24 exit.

export default function LudoGame() {
    const { currentUser } = useAuth();
    const { activeGame, makeMove, quitGame, closeGame, isP2PActive } = useGame();

    const [isRolling, setIsRolling] = useState(false);

    const players = activeGame?.players || {};
    const turnUid = activeGame?.turn;
    const gameStatus = activeGame?.status;
    const winnerId = activeGame?.winnerId;

    const isPlayer = currentUser && Object.keys(players).includes(currentUser.uid);
    const playerColor = isPlayer ? players[currentUser.uid].color : 'spectator'; // 'red' | 'green' | 'yellow' | 'blue'
    const isMyTurn = isPlayer && currentUser.uid === turnUid;

    const numPlayers = Object.keys(players).length || 2;
    const activeColors = Object.values(players).map(p => p.color);
    const isColorActive = (color) => activeColors.includes(color);

    const gameState = activeGame?.state || {
        pieces: {
            red: [ { pos: 'home', step: -1 }, { pos: 'home', step: -1 }, { pos: 'home', step: -1 }, { pos: 'home', step: -1 } ],
            green: [ { pos: 'home', step: -1 }, { pos: 'home', step: -1 }, { pos: 'home', step: -1 }, { pos: 'home', step: -1 } ],
            yellow: [ { pos: 'home', step: -1 }, { pos: 'home', step: -1 }, { pos: 'home', step: -1 }, { pos: 'home', step: -1 } ],
            blue: [ { pos: 'home', step: -1 }, { pos: 'home', step: -1 }, { pos: 'home', step: -1 }, { pos: 'home', step: -1 } ]
        },
        diceValue: 0,
        diceRolled: false
    };

    const playSound = (type = 'click') => {
        try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            
            osc.connect(gain);
            gain.connect(ctx.destination);
            
            if (type === 'win') {
                osc.frequency.setValueAtTime(300, ctx.currentTime);
                osc.frequency.exponentialRampToValueAtTime(600, ctx.currentTime + 0.3);
                gain.gain.setValueAtTime(0.15, ctx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
                osc.start(ctx.currentTime);
                osc.stop(ctx.currentTime + 0.3);
            } else if (type === 'capture') {
                osc.frequency.setValueAtTime(400, ctx.currentTime);
                osc.frequency.setValueAtTime(150, ctx.currentTime + 0.1);
                gain.gain.setValueAtTime(0.15, ctx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
                osc.start(ctx.currentTime);
                osc.stop(ctx.currentTime + 0.25);
            } else {
                osc.frequency.setValueAtTime(260, ctx.currentTime);
                gain.gain.setValueAtTime(0.08, ctx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
                osc.start(ctx.currentTime);
                osc.stop(ctx.currentTime + 0.12);
            }
        } catch (e) {}
    };

    // Roll Dice handler
    const rollDice = () => {
        if (!isPlayer || !isMyTurn || gameState.diceRolled || isRolling) return;

        setIsRolling(true);
        playSound();

        setTimeout(() => {
            const value = Math.floor(Math.random() * 6) + 1;
            setIsRolling(false);

            // boardgame.io style state mutation
            const nextState = {
                ...gameState,
                diceValue: value,
                diceRolled: true
            };

            // Check if player has ANY moves. If not, automatically pass turn
            const hasMoves = checkHasMoves(nextState.pieces[playerColor], value);
            if (!hasMoves) {
                setTimeout(() => {
                    const nextTurnUid = getNextTurnUid(players, currentUser.uid);
                    makeMove({
                        ...nextState,
                        diceRolled: false,
                        diceValue: 0
                    }, nextTurnUid);
                }, 1500);
            } else {
                makeMove(nextState, currentUser.uid);
            }
        }, 800);
    };

    const checkHasMoves = (pieces, dice) => {
        return pieces.some((p) => {
            if (p.pos === 'home' && dice !== 6) return false;
            if (p.pos === 'goal') return false;
            if (p.pos === 'stretch') {
                return p.step + dice <= 5;
            }
            return true;
        });
    };

    // Move Piece handler
    const movePiece = (pieceIdx) => {
        if (!isPlayer || !isMyTurn || !gameState.diceRolled || gameStatus !== 'active') return;

        const dice = gameState.diceValue;
        const pieces = [...gameState.pieces[playerColor]];
        const piece = { ...pieces[pieceIdx] };

        if (piece.pos === 'home') {
            if (dice !== 6) return;
            piece.pos = 'track';
            piece.step = getStartStep(playerColor, numPlayers);
        } else if (piece.pos === 'track') {
            const startStep = getStartStep(playerColor, numPlayers);

            const relativeStep = (piece.step - startStep + 52) % 52;
            const nextRelative = relativeStep + dice;

            if (nextRelative > 50) {
                // Enters home stretch
                const stretchStep = nextRelative - 51; // 0 to 4
                if (stretchStep > 5) return; // Exceeds target
                piece.pos = 'stretch';
                piece.step = stretchStep;
            } else {
                piece.step = (piece.step + dice) % 52;
            }
        } else if (piece.pos === 'stretch') {
            if (piece.step + dice > 5) return; // Must land exactly on 5
            piece.step += dice;
            if (piece.step === 5) {
                piece.pos = 'goal';
            }
        } else if (piece.pos === 'goal') {
            return;
        }

        pieces[pieceIdx] = piece;
        playSound();

        // Check capturing
        const nextPieces = { ...gameState.pieces, [playerColor]: pieces };
        let captured = false;

        if (piece.pos === 'track' && !SAFE_SPOTS.includes(piece.step)) {
            Object.keys(nextPieces).forEach((color) => {
                if (color === playerColor) return;
                const otherPieces = [...(nextPieces[color] || [])];
                let otherCaptured = false;
                otherPieces.forEach((op, opIdx) => {
                    if (op.pos === 'track' && op.step === piece.step) {
                        otherPieces[opIdx] = { pos: 'home', step: -1 };
                        otherCaptured = true;
                        captured = true;
                    }
                });
                if (otherCaptured) {
                    nextPieces[color] = otherPieces;
                }
            });
        }

        if (captured) {
            playSound('capture');
        }

        // Check if current player has finished
        const allHome = pieces.every(p => p.pos === 'goal');
        
        let nextWinnerId = null;
        let updatedPlayers = null;
        let isGameFinished = false;

        if (allHome) {
            playSound('win');
            
            updatedPlayers = { ...players };
            const currentEntry = updatedPlayers[currentUser.uid];
            if (currentEntry && !currentEntry.finished) {
                const numFinished = Object.values(updatedPlayers).filter(p => p.finished).length;
                currentEntry.finished = true;
                currentEntry.rank = numFinished + 1;
            }

            const activePlayers = Object.entries(updatedPlayers).filter(([uid, p]) => !p.conceded && !p.finished);

            if (activePlayers.length <= 1) {
                isGameFinished = true;
                if (activePlayers.length === 1) {
                    const lastUid = activePlayers[0][0];
                    const numFinished = Object.values(updatedPlayers).filter(p => p.finished).length;
                    updatedPlayers[lastUid].rank = numFinished + 1;
                }
                const winnerEntry = Object.entries(updatedPlayers).find(([uid, p]) => p.rank === 1);
                nextWinnerId = winnerEntry ? winnerEntry[0] : currentUser.uid;
            }
        }

        const nextState = {
            ...gameState,
            pieces: nextPieces,
            diceRolled: false,
            diceValue: 0
        };

        if (isGameFinished) {
            makeMove(nextState, null, nextWinnerId, updatedPlayers);
        } else {
            const targetPlayers = updatedPlayers || players;
            const nextTurnUid = getNextTurnUid(targetPlayers, currentUser.uid);
            
            // If rolled a 6 or captured a piece (and hasn't finished!), they get another turn!
            const keepTurn = (dice === 6 || captured) && !allHome;
            makeMove(nextState, keepTurn ? currentUser.uid : nextTurnUid, null, updatedPlayers);
        }
    };

    // Calculate absolute position on the grid
    const getPieceGridPos = (color, p, idx) => {
        if (p.pos === 'home') {
            if (color === 'red') {
                return [ { r: 2, c: 2 }, { r: 2, c: 3 }, { r: 3, c: 2 }, { r: 3, c: 3 } ][idx];
            } else if (color === 'green') {
                return [ { r: 2, c: 11 }, { r: 2, c: 12 }, { r: 3, c: 11 }, { r: 3, c: 12 } ][idx];
            } else if (color === 'yellow') {
                return [ { r: 11, c: 11 }, { r: 11, c: 12 }, { r: 12, c: 11 }, { r: 12, c: 12 } ][idx];
            } else if (color === 'blue') {
                if (numPlayers === 2) {
                    return [ { r: 11, c: 11 }, { r: 11, c: 12 }, { r: 12, c: 11 }, { r: 12, c: 12 } ][idx];
                }
                return [ { r: 11, c: 2 }, { r: 11, c: 3 }, { r: 12, c: 2 }, { r: 12, c: 3 } ][idx];
            }
        } else if (p.pos === 'track') {
            return TRACK_COORDS[p.step];
        } else if (p.pos === 'stretch') {
            return getHomeStretchCoords(color, numPlayers)[p.step];
        } else {
            // goal position (center)
            return { r: 7, c: 7 };
        }
    };

    const currentTurnPlayer = players[turnUid];
    const currentTurnColor = currentTurnPlayer?.color || 'red';

    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            width: '100%',
            color: 'white',
            background: 'linear-gradient(135deg, #090d16 0%, #15102a 100%)',
            padding: '1rem',
            overflowY: 'auto'
        }}>
            {/* Header controls */}
            <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', maxWidth: '440px', marginBottom: '0.5rem', alignItems: 'center' }}>
                <span style={{
                    fontSize: '0.75rem',
                    background: isP2PActive ? 'rgba(34, 197, 94, 0.2)' : 'rgba(234, 179, 8, 0.2)',
                    color: isP2PActive ? '#22c55e' : '#eab308',
                    padding: '4px 8px',
                    borderRadius: '20px',
                    border: `1px solid ${isP2PActive ? '#22c55e' : '#eab308'}`,
                    fontWeight: 600
                }}>
                    {isP2PActive ? '⚡ WebRTC Sync' : '☁️ Cloud Sync'}
                </span>
                <button
                    onClick={closeGame}
                    style={{
                        background: 'transparent',
                        border: 'none',
                        color: '#94a3b8',
                        cursor: 'pointer',
                        fontSize: '1.25rem'
                    }}
                    title="Minimize Board"
                >
                    ✕
                </button>
            </div>

            {/* Players Panel */}
            <div style={{
                display: 'flex',
                gap: '0.75rem',
                justifyContent: 'center',
                width: '100%',
                maxWidth: '440px',
                marginBottom: '1rem',
                flexWrap: 'wrap'
            }}>
                {Object.entries(players).map(([uid, p]) => {
                    const isTurn = gameStatus === 'active' && turnUid === uid;
                    const borderRing = p.color === 'red' ? '#ef4444' :
                                       p.color === 'green' ? '#22c55e' :
                                       p.color === 'yellow' ? '#eab308' : '#3b82f6';
                    
                    let statusLabel = 'Playing';
                    let statusColor = '#94a3b8';
                    let statusBg = 'rgba(255,255,255,0.05)';

                    if (p.conceded) {
                        statusLabel = `Left (${getOrdinal(p.rank)})`;
                        statusColor = '#f87171';
                        statusBg = 'rgba(239, 68, 68, 0.1)';
                    } else if (p.finished) {
                        statusLabel = `🏆 ${getOrdinal(p.rank)}`;
                        statusColor = '#fbbf24';
                        statusBg = 'rgba(251, 191, 36, 0.15)';
                    } else if (isTurn) {
                        statusLabel = 'Active';
                        statusColor = '#818cf8';
                        statusBg = 'rgba(129, 140, 248, 0.15)';
                    }

                    return (
                        <div
                            key={uid}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem',
                                padding: '6px 10px',
                                borderRadius: '20px',
                                background: statusBg,
                                border: `1.5px solid ${isTurn ? '#818cf8' : 'rgba(255,255,255,0.05)'}`,
                                transition: 'all 0.25s ease',
                                boxShadow: isTurn ? `0 0 10px rgba(129, 140, 248, 0.25)` : 'none'
                            }}
                        >
                            <div style={{ position: 'relative' }}>
                                <img
                                    src={p.photoURL || `https://ui-avatars.com/api/?name=${p.name}`}
                                    alt=""
                                    style={{
                                        width: '28px',
                                        height: '28px',
                                        borderRadius: '50%',
                                        border: `2.5px solid ${borderRing}`,
                                        objectFit: 'cover'
                                    }}
                                />
                                {isTurn && (
                                    <span style={{
                                        position: 'absolute',
                                        bottom: 0,
                                        right: 0,
                                        width: '8px',
                                        height: '8px',
                                        borderRadius: '50%',
                                        background: '#22c55e',
                                        border: '1.5px solid #1e293b'
                                    }} />
                                )}
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--app-text, #f8fafc)', maxWidth: '75px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {p.name}
                                </span>
                                <span style={{ fontSize: '0.6rem', fontWeight: 500, color: statusColor }}>
                                    {statusLabel}
                                </span>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Board representation */}
            <div style={{
                position: 'relative',
                width: '100%',
                maxWidth: '400px',
                aspectRatio: '1/1',
                background: '#e2e8f0',
                border: '6px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '12px',
                boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.5)',
                overflow: 'hidden'
            }}>
                {/* 15x15 Grid Layout */}
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(15, 1fr)',
                    gridTemplateRows: 'repeat(15, 1fr)',
                    width: '100%',
                    height: '100%',
                    position: 'absolute',
                    top: 0,
                    left: 0
                }}>
                    {/* Render bases */}
                    {/* Red base (top-left) */}
                    <div style={{ gridArea: '1 / 1 / 7 / 7', background: 'linear-gradient(135deg, #f87171, #ef4444)', border: '1px solid #dc2626' }} />
                    <div style={{ gridArea: '2 / 2 / 6 / 6', background: 'rgba(255,255,255,0.75)', borderRadius: '8px' }} />

                    {/* Green base (top-right) */}
                    {isColorActive('green') ? (
                        <>
                            <div style={{ gridArea: '1 / 10 / 7 / 16', background: 'linear-gradient(135deg, #4ade80, #22c55e)', border: '1px solid #16a34a' }} />
                            <div style={{ gridArea: '2 / 11 / 6 / 15', background: 'rgba(255,255,255,0.75)', borderRadius: '8px' }} />
                        </>
                    ) : (
                        <div style={{ gridArea: '1 / 10 / 7 / 16', background: '#94a3b8', opacity: 0.15, border: '1px solid #475569' }} />
                    )}

                    {/* Yellow (or 2p Blue) base (bottom-right) */}
                    {isColorActive('yellow') || (isColorActive('blue') && numPlayers === 2) ? (
                        <>
                            <div style={{
                                gridArea: '10 / 10 / 16 / 16',
                                background: isColorActive('yellow')
                                    ? 'linear-gradient(135deg, #fde047, #eab308)'
                                    : 'linear-gradient(135deg, #60a5fa, #3b82f6)',
                                border: `1px solid ${isColorActive('yellow') ? '#ca8a04' : '#2563eb'}`
                            }} />
                            <div style={{ gridArea: '11 / 11 / 15 / 15', background: 'rgba(255,255,255,0.75)', borderRadius: '8px' }} />
                        </>
                    ) : (
                        <div style={{ gridArea: '10 / 10 / 16 / 16', background: '#94a3b8', opacity: 0.15, border: '1px solid #475569' }} />
                    )}

                    {/* Blue (4p) base (bottom-left) */}
                    {isColorActive('blue') && numPlayers > 2 ? (
                        <>
                            <div style={{ gridArea: '10 / 1 / 16 / 7', background: 'linear-gradient(135deg, #60a5fa, #3b82f6)', border: '1px solid #2563eb' }} />
                            <div style={{ gridArea: '11 / 2 / 15 / 6', background: 'rgba(255,255,255,0.75)', borderRadius: '8px' }} />
                        </>
                    ) : (
                        <div style={{ gridArea: '10 / 1 / 16 / 7', background: '#94a3b8', opacity: 0.15, border: '1px solid #475569' }} />
                    )}

                    {/* Central Target Triangle (7,7) */}
                    <div style={{
                        gridArea: '7 / 7 / 10 / 10',
                        background: '#1e293b',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 700,
                        color: 'white',
                        fontSize: '1.25rem'
                    }}>
                        🏁
                    </div>

                    {/* Render Path Cells */}
                    {Array(15).fill(null).map((_, r) => {
                        return Array(15).fill(null).map((_, c) => {
                            // Check if cell is in the path tracks (columns 7,8,9 or rows 7,8,9)
                            const isPath = (c >= 6 && c <= 8) || (r >= 6 && r <= 8);
                            const isBase = (r < 6 && c < 6) || (r < 6 && c > 8) || (r > 8 && c < 6) || (r > 8 && c > 8);
                            const isCenter = (r >= 6 && r <= 8) && (c >= 6 && c <= 8);

                            if (!isPath || isBase || isCenter) return null;

                            // Color exit cells and stretches
                            let cellBg = '#f1f5f9';
                            let border = '1px solid #cbd5e1';

                            // Red home stretch and start spot
                            if (r === 7 && c >= 1 && c <= 5) {
                                cellBg = '#fca5a5'; // Red stretch
                            } else if (r === 6 && c === 1) {
                                cellBg = '#ef4444'; // Red starting point
                            }

                            // Green home stretch and start spot
                            if (c === 7 && r >= 1 && r <= 5) {
                                cellBg = '#86efac'; // Green stretch
                            } else if (r === 1 && c === 8) {
                                cellBg = '#22c55e'; // Green starting point
                            }

                            // Yellow (or 2p Blue) home stretch and start spot
                            if (r === 7 && c >= 9 && c <= 13) {
                                cellBg = (numPlayers === 2) ? '#93c5fd' : '#fef08a'; // Blue or Yellow stretch
                            } else if (r === 8 && c === 13) {
                                cellBg = (numPlayers === 2) ? '#3b82f6' : '#eab308'; // Blue or Yellow starting point
                            }

                            // Blue (4p) home stretch and start spot
                            if (c === 7 && r >= 9 && r <= 13) {
                                cellBg = '#93c5fd'; // Blue stretch
                            } else if (r === 13 && c === 6) {
                                cellBg = '#3b82f6'; // Blue starting point
                            }

                            return (
                                <div
                                    key={`${r}-${c}`}
                                    style={{
                                        gridRowStart: r + 1,
                                        gridColStart: c + 1,
                                        background: cellBg,
                                        border: border,
                                        boxSizing: 'border-box'
                                    }}
                                />
                            );
                        });
                    })}
                </div>

                {/* Render Token pieces with CSS Glide transitions */}
                {Object.keys(gameState.pieces).map((color) => {
                    if (!isColorActive(color)) return null;

                    const fill = color === 'red' ? '#ef4444' :
                                 color === 'green' ? '#22c55e' :
                                 color === 'yellow' ? '#eab308' : '#3b82f6';

                    const glow = color === 'red' ? '0 0 10px #f87171' :
                                 color === 'green' ? '0 0 10px #86efac' :
                                 color === 'yellow' ? '0 0 10px #fef08a' : '0 0 10px #60a5fa';

                    return gameState.pieces[color].map((p, idx) => {
                        const cell = getPieceGridPos(color, p, idx);
                        const topPct = (cell.r * 100) / 15;
                        const leftPct = (cell.c * 100) / 15;

                        const isPieceSelectable = isPlayer && isMyTurn && color === playerColor && (
                            (p.pos === 'home' && gameState.diceValue === 6) ||
                            (p.pos === 'track') ||
                            (p.pos === 'stretch' && p.step + gameState.diceValue <= 5)
                        ) && gameState.diceRolled && gameStatus === 'active';

                        return (
                            <div
                                key={`${color}-${idx}`}
                                onClick={() => isPieceSelectable && movePiece(idx)}
                                style={{
                                    position: 'absolute',
                                    top: `${topPct}%`,
                                    left: `${leftPct}%`,
                                    width: '6.66%',
                                    height: '6.66%',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    transition: 'top 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94), left 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
                                    zIndex: p.pos === 'home' ? 10 : 20,
                                    cursor: isPieceSelectable ? 'pointer' : 'default'
                                }}
                            >
                                <div style={{
                                    width: '80%',
                                    height: '80%',
                                    borderRadius: '50%',
                                    backgroundColor: fill,
                                    border: '2px solid white',
                                    boxShadow: isPieceSelectable ? glow : '0 2px 4px rgba(0,0,0,0.3)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: 'white',
                                    fontSize: '0.6rem',
                                    fontWeight: 700,
                                    transform: isPieceSelectable ? 'scale(1.18)' : 'scale(1)',
                                    transition: 'transform 0.2s ease-in-out',
                                    animation: isPieceSelectable ? 'pulse 1.2s infinite' : 'none'
                                }}>
                                    {idx + 1}
                                </div>
                            </div>
                        );
                    });
                })}
            </div>

            {/* Bottom Actions Area */}
            <div style={{ width: '100%', maxWidth: '440px', marginTop: '0.75rem' }}>
                <div style={{ display: 'flex', gap: '0.5rem', background: 'rgba(255,255,255,0.03)', borderRadius: '10px', padding: '0.5rem', border: '1px solid rgba(255,255,255,0.05)', alignItems: 'center' }}>
                    {/* Dice Roller */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem', padding: '0.25rem' }}>
                        <button
                            onClick={rollDice}
                            disabled={!isMyTurn || gameState.diceRolled || isRolling || gameStatus !== 'active'}
                            style={{
                                width: '56px',
                                height: '56px',
                                borderRadius: '10px',
                                background: isMyTurn && !gameState.diceRolled && gameStatus === 'active' ? 'linear-gradient(135deg, #6366f1, #4f46e5)' : 'rgba(255,255,255,0.05)',
                                color: 'white',
                                border: 'none',
                                cursor: (isMyTurn && !gameState.diceRolled && !isRolling && gameStatus === 'active') ? 'pointer' : 'not-allowed',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '1.75rem',
                                boxShadow: (isMyTurn && !gameState.diceRolled && gameStatus === 'active') ? '0 0 12px rgba(99, 102, 241, 0.4)' : 'none',
                                transition: 'all 0.2s',
                                animation: isRolling ? 'spin 0.2s linear infinite' : 'none'
                            }}
                        >
                            {isRolling ? '🎲' : (
                                gameState.diceValue === 1 ? '⚀' :
                                gameState.diceValue === 2 ? '⚁' :
                                gameState.diceValue === 3 ? '⚂' :
                                gameState.diceValue === 4 ? '⚃' :
                                gameState.diceValue === 5 ? '⚄' :
                                gameState.diceValue === 6 ? '⚅' : '🎲'
                            )}
                        </button>
                        <span style={{ fontSize: '0.65rem', color: '#94a3b8' }}>
                            {gameStatus === 'active' ? (isMyTurn ? (gameState.diceRolled ? 'Move token' : 'Roll!') : 'Waiting...') : 'Waiting...'}
                        </span>
                    </div>

                    <div style={{ flex: 1, paddingLeft: '0.5rem' }}>
                        <div style={{ fontSize: '0.9rem', fontWeight: 600 }}>
                            {players[currentUser.uid]?.conceded ? (
                                <span style={{ color: '#f87171' }}>You Conceded ({getOrdinal(players[currentUser.uid].rank)} Place)</span>
                            ) : players[currentUser.uid]?.finished ? (
                                <span style={{ color: '#fbbf24' }}>You Finished ({getOrdinal(players[currentUser.uid].rank)} Place) 🏆</span>
                            ) : gameStatus === 'active' ? (
                                isMyTurn ? (
                                    <span style={{ color: '#818cf8' }}>Your Turn ({playerColor.toUpperCase()})</span>
                                ) : (
                                    <span>{currentTurnPlayer?.name || 'Opponent'}'s Turn ({currentTurnColor.toUpperCase()})</span>
                                )
                            ) : gameStatus === 'finished' ? (
                                winnerId === currentUser?.uid ? (
                                    <span style={{ color: '#22c55e' }}>You Won! 🏆</span>
                                ) : (
                                    <span style={{ color: '#ef4444' }}>Winner: {players[winnerId]?.name || 'Opponent'}</span>
                                )
                            ) : 'Waiting to start...'}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '2px' }}>
                            {gameStatus === 'active' && !players[currentUser.uid]?.conceded && !players[currentUser.uid]?.finished && (
                                gameState.diceRolled ? `Rolled a ${gameState.diceValue}. Select piece ${playerColor} to move.` : 'Roll the dice to start your turn.'
                            )}
                            {gameStatus === 'waiting' && 'Lobby waiting for all invitees to join.'}
                        </div>
                    </div>

                    {isPlayer && gameStatus === 'active' && !players[currentUser.uid]?.conceded && !players[currentUser.uid]?.finished && (
                        <button
                            onClick={() => {
                                if (window.confirm('Concede match?')) {
                                    quitGame();
                                }
                            }}
                            style={{
                                padding: '6px 12px',
                                borderRadius: '6px',
                                border: '1px solid rgba(239, 68, 68, 0.4)',
                                background: 'transparent',
                                color: '#ef4444',
                                fontSize: '0.75rem',
                                cursor: 'pointer'
                            }}
                        >
                            Concede
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
