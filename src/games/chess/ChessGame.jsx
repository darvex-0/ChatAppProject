import { useState, useEffect, useMemo, useRef } from 'react';
import { Chess } from 'chess.js';
import { useAuth } from '../../context/AuthContext';
import { useGame } from '../../context/GameContext';

// Concise inline SVGs for standard Chess pieces
const PieceSVG = ({ type, color }) => {
    const isWhite = color === 'w';
    const fill = isWhite ? '#f8fafc' : '#0f172a';
    const stroke = isWhite ? '#0f172a' : '#f8fafc';

    // Renders custom SVGs for the chess pieces
    switch (type) {
        case 'p': // Pawn
            return (
                <svg viewBox="0 0 45 45" style={{ width: '85%', height: '85%' }}>
                    <path d="M22.5 9c-2.21 0-4 1.79-4 4 0 .89.29 1.71.78 2.38C17.33 16.5 16 18.59 16 21c0 2.03.93 3.84 2.38 5.03-.49.67-.78 1.49-.78 2.38 0 2.21 1.79 4 4 4s4-1.79 4-4c0-.89-.29-1.71-.78-2.38 1.45-1.19 2.38-3 2.38-5.03 0-2.41-1.33-4.5-3.28-5.62.49-.67.78-1.49.78-2.38 0-2.21-1.79-4-4-4z" fill={fill} stroke={stroke} strokeWidth="1.5" />
                </svg>
            );
        case 'r': // Rook
            return (
                <svg viewBox="0 0 45 45" style={{ width: '85%', height: '85%' }}>
                    <path d="M9 39h27v-3H9v3zm3-6h21v-4H12v4zm2.5-7h16l1.5-8H13l1.5 8zM12 12v4h4v-4h-4zm7 0v4h3v-4h-3zm6 0v4h3v-4h-3zm6 0v4h4v-4h-4z" fill={fill} stroke={stroke} strokeWidth="1.5" />
                    <path d="M14 29h17v-3H14v3z" fill={fill} stroke={stroke} />
                </svg>
            );
        case 'n': // Knight
            return (
                <svg viewBox="0 0 45 45" style={{ width: '85%', height: '85%' }}>
                    <path d="M 22,10 C 22,10 19,11 16,15 C 13,19 13,23 13,23 C 13,23 14,20 18,20 C 18,20 17,21 15,24 C 13,27 13,31 15,32 C 17,33 21,32 23,29 C 25,26 26,22 28,21 C 30,20 31,20 32,21 C 33,22 34,24 32,25 C 30,26 28,26 28,26 C 28,26 31,27 32,26 C 33,25 36,22 34,17 C 32,12 27,10 22,10 z" fill={fill} stroke={stroke} strokeWidth="1.5" />
                    <circle cx="27" cy="15" r="2" fill={stroke} />
                </svg>
            );
        case 'b': // Bishop
            return (
                <svg viewBox="0 0 45 45" style={{ width: '85%', height: '85%' }}>
                    <path d="M9 36c3.39 0 7.66-.69 11.77-2.3 4.11 1.61 8.38 2.3 11.77 2.3H9zm13.5-30C15 6 15 13.5 15 13.5c0 0 2.25-1.5 7.5-1.5s7.5 1.5 7.5 1.5c0 0 0-7.5-7.5-7.5zM15 18.5c0 5.5 3.38 10.12 7.5 11.5 4.12-1.38 7.5-6 7.5-11.5 0-5.5-3.38-10.12-7.5-11.5-4.12 1.38-7.5 6-7.5 11.5z" fill={fill} stroke={stroke} strokeWidth="1.5" />
                    <circle cx="22.5" cy="5" r="2" fill={stroke} />
                </svg>
            );
        case 'q': // Queen
            return (
                <svg viewBox="0 0 45 45" style={{ width: '85%', height: '85%' }}>
                    <path d="M8 12a2 2 0 1 1-4 0 2 2 0 0 1 4 0zm9-3a2 2 0 1 1-4 0 2 2 0 0 1 4 0zm9 0a2 2 0 1 1-4 0 2 2 0 0 1 4 0zm9 3a2 2 0 1 1-4 0 2 2 0 0 1 4 0zm-17.5 7.5L6 33h33L29.5 16.5 22.5 30l-7-13.5z" fill={fill} stroke={stroke} strokeWidth="1.5" />
                    <path d="M6 37h33v-3H6v3z" fill={fill} stroke={stroke} />
                </svg>
            );
        case 'k': // King
            return (
                <svg viewBox="0 0 45 45" style={{ width: '85%', height: '85%' }}>
                    <path d="M22.5 11.63V6M19.5 8h6M11.5 37h22v-3h-22v3zm6-5h10v-3h-10v3zm-5.5-7.5C12 24.5 14 16 22.5 16S33 24.5 33 24.5C33 24.5 28.5 30 22.5 30S12 24.5 12 24.5z" fill={fill} stroke={stroke} strokeWidth="1.5" />
                </svg>
            );
        default:
            return null;
    }
};

export default function ChessGame() {
    const { currentUser } = useAuth();
    const { activeGame, makeMove, quitGame, closeGame, isP2PActive } = useGame();
    
    const [selectedSquare, setSelectedSquare] = useState(null);
    const [possibleMoves, setPossibleMoves] = useState([]);
    
    // Web Audio synthesizer beep for moves
    const playSound = (isCapture = false) => {
        try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            
            osc.connect(gain);
            gain.connect(ctx.destination);
            
            osc.type = 'sine';
            osc.frequency.setValueAtTime(isCapture ? 180 : 320, ctx.currentTime);
            
            gain.gain.setValueAtTime(0.1, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
            
            osc.start(ctx.currentTime);
            osc.stop(ctx.currentTime + 0.15);
        } catch (e) {
            console.warn('Audio play blocked or unsupported:', e);
        }
    };

    // Instantiate chess.js engine
    const chess = useMemo(() => {
        const c = new Chess();
        if (activeGame?.state?.fen) {
            try {
                c.load(activeGame.state.fen);
            } catch (e) {
                console.error('Invalid FEN loaded:', e);
            }
        }
        return c;
    }, [activeGame?.state?.fen]);

    const board = useMemo(() => chess.board(), [chess]);

    // Game stats
    const players = activeGame?.players || {};
    const turnUid = activeGame?.turn;
    const gameStatus = activeGame?.status;
    const winnerId = activeGame?.winnerId;

    // Verify user role
    const isPlayer = currentUser && Object.keys(players).includes(currentUser.uid);
    const playerColor = isPlayer ? players[currentUser.uid].color : 'spectator';
    const isMyTurn = isPlayer && currentUser.uid === turnUid;

    // Flip board if player is playing black
    const isFlipped = playerColor === 'black';

    const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
    const ranks = ['8', '7', '6', '5', '4', '3', '2', '1'];

    const displayFiles = isFlipped ? [...files].reverse() : files;
    const displayRanks = isFlipped ? [...ranks].reverse() : ranks;

    // Check game condition on state change
    useEffect(() => {
        if (chess.isGameOver() && gameStatus === 'active') {
            let winId = null;
            if (chess.isCheckmate()) {
                // If it is checkmate, the player whose turn it WAS lost.
                // Meaning the winner is the OTHER player.
                const turnColor = chess.turn(); // 'w' or 'b'
                const winningColor = turnColor === 'w' ? 'black' : 'white';
                winId = Object.keys(players).find(uid => players[uid].color === winningColor);
            }
            // Trigger automatic finish update
            makeMove({ fen: chess.fen() }, null, winId || 'draw');
        }
    }, [chess, gameStatus, players, makeMove]);

    // Handle Square click
    const handleSquareClick = (square) => {
        if (!isPlayer || !isMyTurn) return;

        const piece = chess.get(square);

        // Clicked own piece - select it and show legal moves
        if (piece && piece.color === playerColor[0]) {
            setSelectedSquare(square);
            const moves = chess.moves({ square, verbose: true });
            setPossibleMoves(moves.map(m => m.to));
            return;
        }

        // Clicked a possible target square - execute move
        if (possibleMoves.includes(square)) {
            executeMove(selectedSquare, square);
        } else {
            // Clicked elsewhere - reset selection
            setSelectedSquare(null);
            setPossibleMoves([]);
        }
    };

    const executeMove = (from, to) => {
        try {
            const piece = chess.get(from);
            const isCapture = chess.get(to) !== null;
            
            // Check for pawn promotion
            const isPromotion = piece.type === 'p' && (to[1] === '8' || to[1] === '1');
            
            const moveResult = chess.move({
                from,
                to,
                promotion: isPromotion ? 'q' : undefined
            });

            if (moveResult) {
                playSound(isCapture);
                setSelectedSquare(null);
                setPossibleMoves([]);
                
                // Determine opponent UID
                const opponentUid = Object.keys(players).find(uid => uid !== currentUser.uid);
                
                // sync to partner/database
                makeMove({ fen: chess.fen() }, opponentUid);
            }
        } catch (e) {
            console.error('Invalid move attempt:', e);
        }
    };

    // Drag and Drop
    const handleDragStart = (e, square) => {
        if (!isPlayer || !isMyTurn) {
            e.preventDefault();
            return;
        }
        const piece = chess.get(square);
        if (!piece || piece.color !== playerColor[0]) {
            e.preventDefault();
            return;
        }
        e.dataTransfer.setData('text/plain', square);
        setSelectedSquare(square);
        const moves = chess.moves({ square, verbose: true });
        setPossibleMoves(moves.map(m => m.to));
    };

    const handleDrop = (e, targetSquare) => {
        e.preventDefault();
        const fromSquare = e.dataTransfer.getData('text/plain');
        if (possibleMoves.includes(targetSquare)) {
            executeMove(fromSquare, targetSquare);
        } else {
            setSelectedSquare(null);
            setPossibleMoves([]);
        }
    };

    const opponentInfo = useMemo(() => {
        const opponentId = Object.keys(players).find(uid => uid !== currentUser?.uid);
        return opponentId ? players[opponentId] : null;
    }, [players, currentUser]);

    const hostInfo = useMemo(() => {
        const hostId = activeGame?.hostId;
        return hostId ? players[hostId] : null;
    }, [activeGame, players]);

    // Game stats label
    let statusText = '';
    if (gameStatus === 'waiting') {
        statusText = 'Waiting for opponent to join...';
    } else if (gameStatus === 'active') {
        statusText = isMyTurn ? "Your Turn" : "Opponent's Turn";
    } else if (gameStatus === 'finished') {
        if (winnerId === 'draw') {
            statusText = 'Draw! 🤝';
        } else {
            statusText = players[winnerId] ? `${players[winnerId].name} Wins! 🏆` : 'Game Over';
        }
    }

    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            width: '100%',
            color: 'white',
            background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%)',
            padding: '1rem',
            overflowY: 'auto'
        }}>
            {/* Header controls */}
            <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', maxWidth: '480px', marginBottom: '0.75rem', alignItems: 'center' }}>
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

            {/* Players Info & Turn Display */}
            <div style={{ width: '100%', maxWidth: '480px', marginBottom: '0.75rem' }}>
                {/* Opponent Profile */}
                {opponentInfo && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.5rem', borderRadius: '8px', background: 'rgba(255,255,255,0.03)', marginBottom: '0.5rem' }}>
                        <img
                            src={opponentInfo.photoURL || `https://ui-avatars.com/api/?name=${opponentInfo.name}`}
                            alt=""
                            style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover' }}
                        />
                        <div style={{ flex: 1 }}>
                            <strong style={{ fontSize: '0.9rem' }}>{opponentInfo.name}</strong>
                            <span style={{ fontSize: '0.75rem', color: '#94a3b8', marginLeft: '0.5rem' }}>
                                ({opponentInfo.color})
                            </span>
                        </div>
                        {activeGame?.turn === opponentInfo.uid && gameStatus === 'active' && (
                            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#6366f1', boxShadow: '0 0 8px #6366f1' }} />
                        )}
                    </div>
                )}
            </div>

            {/* Checkerboard */}
            <div style={{
                width: '100%',
                maxWidth: '440px',
                aspectRatio: '1/1',
                background: 'rgba(255, 255, 255, 0.05)',
                border: '4px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '12px',
                overflow: 'hidden',
                boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.5), 0 8px 10px -6px rgb(0 0 0 / 0.5)',
                display: 'grid',
                gridTemplateColumns: 'repeat(8, 1fr)',
                gridTemplateRows: 'repeat(8, 1fr)',
                position: 'relative'
            }}>
                {displayRanks.map((rank, rankIdx) => {
                    return displayFiles.map((file, fileIdx) => {
                        const square = `${file}${rank}`;
                        const piece = chess.get(square);
                        
                        // Alternate square colors
                        const isLight = (rankIdx + fileIdx) % 2 === 0;
                        const isSelected = selectedSquare === square;
                        const isPossible = possibleMoves.includes(square);
                        const isCheck = chess.inCheck() && piece?.type === 'k' && piece?.color === chess.turn();

                        let bg = isLight ? '#e2e8f0' : '#475569'; // Standard modern grey-slate squares
                        if (isSelected) bg = '#a5b4fc'; // Light violet selection
                        else if (isPossible) bg = isLight ? '#cbd5e1' : '#64748b'; // Valid target highlights

                        return (
                            <div
                                key={square}
                                onClick={() => handleSquareClick(square)}
                                onDragOver={(e) => {
                                    if (possibleMoves.includes(square)) {
                                        e.preventDefault();
                                    }
                                }}
                                onDrop={(e) => handleDrop(e, square)}
                                style={{
                                    width: '100%',
                                    height: '100%',
                                    backgroundColor: bg,
                                    position: 'relative',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    cursor: isPlayer && isMyTurn ? 'pointer' : 'default',
                                    transition: 'all 0.15s ease',
                                    border: isCheck ? '2px solid #ef4444' : 'none'
                                }}
                            >
                                {/* Piece element */}
                                {piece && (
                                    <div
                                        draggable={isPlayer && isMyTurn && piece.color === playerColor[0]}
                                        onDragStart={(e) => handleDragStart(e, square)}
                                        style={{
                                            width: '100%',
                                            height: '100%',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            cursor: (isPlayer && isMyTurn && piece.color === playerColor[0]) ? 'grab' : 'default',
                                            zIndex: 5
                                        }}
                                    >
                                        <PieceSVG type={piece.type} color={piece.color} />
                                    </div>
                                )}

                                {/* Dot overlay for possible moves on empty square */}
                                {isPossible && !piece && (
                                    <div style={{
                                        width: '12px',
                                        height: '12px',
                                        borderRadius: '50%',
                                        backgroundColor: '#6366f1',
                                        opacity: 0.8,
                                        zIndex: 3
                                    }} />
                                )}

                                {/* Coordinates (only on bottom and left edges of the viewport perspective) */}
                                {fileIdx === 0 && (
                                    <span style={{
                                        position: 'absolute',
                                        top: '2px',
                                        left: '4px',
                                        fontSize: '0.65rem',
                                        fontWeight: 600,
                                        color: isLight ? '#475569' : '#e2e8f0',
                                        opacity: 0.5
                                    }}>
                                        {rank}
                                    </span>
                                )}
                                {rankIdx === 7 && (
                                    <span style={{
                                        position: 'absolute',
                                        bottom: '2px',
                                        right: '4px',
                                        fontSize: '0.65rem',
                                        fontWeight: 600,
                                        color: isLight ? '#475569' : '#e2e8f0',
                                        opacity: 0.5
                                    }}>
                                        {file}
                                    </span>
                                )}
                            </div>
                        );
                    });
                })}
            </div>

            {/* Bottom Panel Info */}
            <div style={{ width: '100%', maxWidth: '480px', marginTop: '0.75rem' }}>
                {/* Local user profile */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.5rem', borderRadius: '8px', background: 'rgba(255,255,255,0.03)', marginTop: '0.5rem' }}>
                    <img
                        src={currentUser?.photoURL || `https://ui-avatars.com/api/?name=${currentUser?.displayName}`}
                        alt=""
                        style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover' }}
                    />
                    <div style={{ flex: 1 }}>
                        <strong style={{ fontSize: '0.9rem' }}>You ({playerColor})</strong>
                    </div>
                    {activeGame?.turn === currentUser?.uid && gameStatus === 'active' && (
                        <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#6366f1', boxShadow: '0 0 8px #6366f1' }} />
                    )}
                </div>

                {/* Status and Action Buttons */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '1rem', padding: '0 0.25rem' }}>
                    <span style={{ fontWeight: 600, fontSize: '0.95rem', color: isMyTurn ? '#818cf8' : '#e2e8f0' }}>
                        {statusText}
                    </span>
                    {isPlayer && gameStatus === 'active' && (
                        <button
                            onClick={() => {
                                if (window.confirm('Are you sure you want to resign?')) {
                                    quitGame();
                                }
                            }}
                            style={{
                                padding: '6px 14px',
                                borderRadius: '6px',
                                border: '1px solid rgba(239, 68, 68, 0.4)',
                                background: 'rgba(239, 68, 68, 0.1)',
                                color: '#ef4444',
                                fontSize: '0.8rem',
                                fontWeight: 500,
                                cursor: 'pointer',
                                transition: 'all 0.2s'
                            }}
                        >
                            Resign
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
