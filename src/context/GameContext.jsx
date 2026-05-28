import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { db } from '../services/firebase';
import { doc, setDoc, getDoc, onSnapshot, updateDoc, addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { useAuth } from './AuthContext';
import { useCall } from './CallContext';

const GameContext = createContext();

export function GameProvider({ children }) {
    const { currentUser } = useAuth();
    const { initiateGameP2P, cleanupGameP2P, sendGameMove, registerGameCallbacks } = useCall();

    const [activeGameId, setActiveGameId] = useState(null);
    const [activeGame, setActiveGame] = useState(null);
    const [gameState, setGameState] = useState('closed'); // 'closed' | 'minimized' | 'maximized'
    const [isP2PActive, setIsP2PActive] = useState(false);

    // Ref to avoid state-stale callbacks from the WebRTC thread
    const activeGameRef = useRef(null);
    useEffect(() => {
        activeGameRef.current = activeGame;
    }, [activeGame]);

    // Local Move application (called from WebRTC or Firestore sync)
    const onRemoteMoveReceived = useCallback((payload) => {
        if (!activeGameRef.current) return;
        console.log('Game P2P: Move payload received:', payload);
        if (payload.type === 'move' && payload.state) {
            // Apply remote move to local state instantly
            setActiveGame(prev => {
                if (!prev) return null;
                // Avoid double applying if state matches
                if (JSON.stringify(prev.state) === JSON.stringify(payload.state)) {
                    return prev;
                }
                return {
                    ...prev,
                    state: payload.state,
                    turn: payload.turn
                };
            });
        }
    }, []);

    // Register WebRTC callbacks when a game P2P negotiation finishes
    useEffect(() => {
        registerGameCallbacks(
            () => {
                console.log('Game WebRTC P2P Connected');
                setIsP2PActive(true);
            },
            (payload) => {
                onRemoteMoveReceived(payload);
            },
            () => {
                console.log('Game WebRTC P2P Disconnected');
                setIsP2PActive(false);
            }
        );
        return () => {
            cleanupGameP2P();
        };
    }, [registerGameCallbacks, onRemoteMoveReceived, cleanupGameP2P]);

    // Listen to current active game document
    useEffect(() => {
        if (!activeGameId) {
            setActiveGame(null);
            return;
        }

        const gameRef = doc(db, 'games', activeGameId);
        const unsubscribe = onSnapshot(gameRef, (snapshot) => {
            if (!snapshot.exists()) {
                console.log('Active game document deleted.');
                setActiveGame(null);
                setActiveGameId(null);
                setGameState('closed');
                cleanupGameP2P();
                return;
            }

            const data = snapshot.data();
            const prevGame = activeGameRef.current;

            // Only update local state if Firestore represents a newer state than local state
            // to prevent WebRTC local predictions from being overwritten by delayed Firestore read
            if (!prevGame || JSON.stringify(prevGame.state) !== JSON.stringify(data.state) || prevGame.status !== data.status || prevGame.turn !== data.turn) {
                setActiveGame({ id: snapshot.id, ...data });
            }

            // Automate WebRTC connection if game turns active and user is a player
            if (data.status === 'active' && currentUser) {
                const uids = Object.keys(data.players || {});
                if (uids.includes(currentUser.uid)) {
                    const opponentId = uids.find(uid => uid !== currentUser.uid);
                    if (opponentId && !gameDataChannelRefExists()) {
                        const isHost = currentUser.uid === data.hostId;
                        initiateGameP2P(snapshot.id, opponentId, isHost);
                    }
                }
            }
        });

        return () => {
            unsubscribe();
            cleanupGameP2P();
            setIsP2PActive(false);
        };
    }, [activeGameId, currentUser, initiateGameP2P, cleanupGameP2P]);

    // Simple check to check if data channel is active in this session
    const gameDataChannelRefExists = () => {
        return isP2PActive;
    };

    // Invite flow
    const sendGameInvite = useCallback(async (chatId, gameType, opponent) => {
        if (!currentUser) return null;

        try {
            // Define player colors and roles
            const isChess = gameType === 'chess';
            const players = {
                [currentUser.uid]: {
                    name: currentUser.displayName || 'Player 1',
                    photoURL: currentUser.photoURL || '',
                    color: isChess ? 'white' : 'red'
                },
                [opponent.uid]: {
                    name: opponent.name || opponent.displayName || 'Player 2',
                    photoURL: opponent.photoURL || opponent.photo || '',
                    color: isChess ? 'black' : 'blue'
                }
            };

            const initialGameState = isChess
                ? { fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1' }
                : { board: initLudoBoard(), diceRolled: false, diceValue: 0, pieces: initLudoPieces() };

            // Create game document
            const gameRef = doc(collection(db, 'games'));
            try {
                await setDoc(gameRef, {
                    chatId,
                    gameType,
                    status: 'waiting',
                    players,
                    hostId: currentUser.uid,
                    turn: currentUser.uid,
                    state: initialGameState,
                    winnerId: null,
                    createdAt: serverTimestamp(),
                    lastMoveAt: serverTimestamp()
                });
            } catch (err) {
                console.error('Failed to create game document:', err);
                throw new Error('Game document creation failed: ' + err.message);
            }

            // Post invite message to target chat
            const inviteMsg = {
                sender: currentUser.uid,
                senderName: currentUser.displayName || 'User',
                timestamp: serverTimestamp(),
                type: 'game_invite',
                text: `Invited you to play ${isChess ? 'Chess' : 'Ludo'} 🎮`,
                gameId: gameRef.id,
                gameType,
                status: 'sent'
            };

            try {
                await addDoc(collection(db, 'chats', chatId, 'messages'), inviteMsg);
            } catch (err) {
                console.error('Failed to post game invite message:', err);
                throw new Error('Posting invite message failed: ' + err.message);
            }

            // Host opens game in waiting lobby mode
            setActiveGameId(gameRef.id);
            setGameState('maximized');
            return gameRef.id;
        } catch (e) {
            console.error('Failed to send game invite:', e);
            throw e;
        }
    }, [currentUser]);

    // Accept invite flow
    const acceptGameInvite = useCallback(async (gameId) => {
        try {
            const gameRef = doc(db, 'games', gameId);
            await updateDoc(gameRef, {
                status: 'active',
                lastMoveAt: serverTimestamp()
            });

            setActiveGameId(gameId);
            setGameState('maximized');
        } catch (e) {
            console.error('Failed to accept game invite:', e);
        }
    }, []);

    // Perform game move
    const makeMove = useCallback(async (newState, nextTurnUid = null, winnerId = null) => {
        if (!activeGameId || !activeGame) return;

        const playersKeys = Object.keys(activeGame.players);
        const opponentUid = playersKeys.find(uid => uid !== currentUser.uid);
        const turn = nextTurnUid || opponentUid || currentUser.uid;

        const payload = {
            type: 'move',
            state: newState,
            turn: turn
        };

        // Try P2P transfer first
        const p2pSent = sendGameMove(payload);
        if (p2pSent) {
            console.log('Game move synchronized successfully via WebRTC RTCDataChannel');
        } else {
            console.log('Game P2P offline. Falling back to Firestore database routing.');
        }

        // authoritative checkpoint updates
        try {
            const gameRef = doc(db, 'games', activeGameId);
            const updates = {
                state: newState,
                turn: turn,
                lastMoveAt: serverTimestamp()
            };
            if (winnerId) {
                updates.status = 'finished';
                updates.winnerId = winnerId;
            }
            await updateDoc(gameRef, updates);
        } catch (e) {
            console.error('Failed to write move checkpoint to Firestore:', e);
        }
    }, [activeGameId, activeGame, currentUser, sendGameMove]);

    // Quit/Concede
    const quitGame = useCallback(async () => {
        if (!activeGameId || !activeGame || !currentUser) return;
        
        const playersKeys = Object.keys(activeGame.players);
        const opponentUid = playersKeys.find(uid => uid !== currentUser.uid);
        
        try {
            const gameRef = doc(db, 'games', activeGameId);
            await updateDoc(gameRef, {
                status: 'finished',
                winnerId: opponentUid || null,
                lastMoveAt: serverTimestamp()
            });
            setActiveGameId(null);
            setGameState('closed');
            cleanupGameP2P();
        } catch (e) {
            console.error('Failed to concede game:', e);
        }
    }, [activeGameId, activeGame, currentUser, cleanupGameP2P]);

    const closeGame = useCallback(() => {
        setActiveGameId(null);
        setGameState('closed');
        cleanupGameP2P();
    }, [cleanupGameP2P]);

    return (
        <GameContext.Provider value={{
            activeGameId,
            activeGame,
            gameState,
            setGameState,
            isP2PActive,
            sendGameInvite,
            acceptGameInvite,
            makeMove,
            quitGame,
            closeGame,
            setActiveGameId
        }}>
            {children}
        </GameContext.Provider>
    );
}

export function useGame() {
    return useContext(GameContext);
}

// Helpers for Ludo initialization
function initLudoBoard() {
    // 0: empty path, colors for tokens
    return Array(52).fill(null);
}

function initLudoPieces() {
    // 4 tokens per player
    return {
        red: [ { pos: 'home', step: -1 }, { pos: 'home', step: -1 }, { pos: 'home', step: -1 }, { pos: 'home', step: -1 } ],
        blue: [ { pos: 'home', step: -1 }, { pos: 'home', step: -1 }, { pos: 'home', step: -1 }, { pos: 'home', step: -1 } ]
    };
}
