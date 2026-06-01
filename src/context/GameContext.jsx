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

            // Automate WebRTC connection if game turns active and user is a player (Only for 2-player games)
            if (data.status === 'active' && currentUser) {
                const uids = Object.keys(data.players || {});
                if (uids.length === 2 && uids.includes(currentUser.uid)) {
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
    const sendGameInvite = useCallback(async (chatId, gameType, opponentInput) => {
        if (!currentUser) return null;

        try {
            const opponentsArray = Array.isArray(opponentInput) ? opponentInput : [opponentInput];
            const isChess = gameType === 'chess';
            const playerCount = opponentsArray.length + 1;

            // Define player colors and roles
            const players = {
                [currentUser.uid]: {
                    name: currentUser.displayName || 'Player 1',
                    photoURL: currentUser.photoURL || '',
                    color: isChess ? 'white' : 'red',
                    accepted: true
                }
            };

            if (isChess) {
                const opponent = opponentsArray[0];
                players[opponent.uid] = {
                    name: opponent.name || opponent.displayName || 'Player 2',
                    photoURL: opponent.photoURL || opponent.photo || '',
                    color: 'black',
                    accepted: false
                };
            } else {
                if (playerCount === 2) {
                    const opponent = opponentsArray[0];
                    players[opponent.uid] = {
                        name: opponent.name || opponent.displayName || 'Player 2',
                        photoURL: opponent.photoURL || opponent.photo || '',
                        color: 'blue',
                        accepted: false
                    };
                } else if (playerCount === 3) {
                    const opp1 = opponentsArray[0];
                    const opp2 = opponentsArray[1];
                    players[opp1.uid] = {
                        name: opp1.name || opp1.displayName || 'Player 2',
                        photoURL: opp1.photoURL || opp1.photo || '',
                        color: 'green',
                        accepted: false
                    };
                    players[opp2.uid] = {
                        name: opp2.name || opp2.displayName || 'Player 3',
                        photoURL: opp2.photoURL || opp2.photo || '',
                        color: 'yellow',
                        accepted: false
                    };
                } else if (playerCount === 4) {
                    const opp1 = opponentsArray[0];
                    const opp2 = opponentsArray[1];
                    const opp3 = opponentsArray[2];
                    players[opp1.uid] = {
                        name: opp1.name || opp1.displayName || 'Player 2',
                        photoURL: opp1.photoURL || opp1.photo || '',
                        color: 'green',
                        accepted: false
                    };
                    players[opp2.uid] = {
                        name: opp2.name || opp2.displayName || 'Player 3',
                        photoURL: opp2.photoURL || opp2.photo || '',
                        color: 'yellow',
                        accepted: false
                    };
                    players[opp3.uid] = {
                        name: opp3.name || opp3.displayName || 'Player 4',
                        photoURL: opp3.photoURL || opp3.photo || '',
                        color: 'blue',
                        accepted: false
                    };
                }
            }

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

            let inviteText = `Invited you to play ${isChess ? 'Chess' : 'Ludo'} 🎮`;
            if (!isChess && playerCount > 2) {
                inviteText = `Invited you to play ${playerCount}-Player Ludo 🎲`;
            }

            // Post invite message to target chat
            const inviteMsg = {
                sender: currentUser.uid,
                senderName: currentUser.displayName || 'User',
                timestamp: serverTimestamp(),
                type: 'game_invite',
                text: inviteText,
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
            const snap = await getDoc(gameRef);
            if (!snap.exists()) return;
            const data = snap.data();

            const isPlayer = currentUser && Object.keys(data.players || {}).includes(currentUser.uid);

            if (isPlayer) {
                const updatedPlayers = { ...data.players };
                if (updatedPlayers[currentUser.uid]) {
                    updatedPlayers[currentUser.uid].accepted = true;
                }

                // Check if everyone has accepted (supporting legacy data without accepted field)
                const allAccepted = Object.values(updatedPlayers).every(p => p.accepted === undefined || p.accepted === true);

                const updates = {
                    players: updatedPlayers,
                    lastMoveAt: serverTimestamp()
                };
                if (allAccepted) {
                    updates.status = 'active';
                }

                await updateDoc(gameRef, updates);
            }

            setActiveGameId(gameId);
            setGameState('maximized');
        } catch (e) {
            console.error('Failed to accept game invite / spectate:', e);
        }
    }, [currentUser]);

    // Perform game move
    const makeMove = useCallback(async (newState, nextTurnUid = null, winnerId = null, updatedPlayers = null) => {
        if (!activeGameId || !activeGame) return;

        const playersKeys = Object.keys(activeGame.players);
        let turn = nextTurnUid;
        if (!turn) {
            if (activeGame.gameType === 'chess') {
                const opponentUid = playersKeys.find(uid => uid !== currentUser.uid);
                turn = opponentUid || currentUser.uid;
            } else {
                turn = getNextTurnUid(activeGame.players, currentUser.uid);
            }
        }

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
            if (updatedPlayers) {
                updates.players = updatedPlayers;
            }
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

        try {
            const gameRef = doc(db, 'games', activeGameId);
            const snap = await getDoc(gameRef);
            if (!snap.exists()) return;
            const data = snap.data();

            const updatedPlayers = { ...data.players };
            const playerEntry = updatedPlayers[currentUser.uid];
            if (!playerEntry || playerEntry.conceded || playerEntry.finished) return;

            const N = Object.keys(updatedPlayers).length;
            const numConceded = Object.values(updatedPlayers).filter(p => p.conceded).length;

            playerEntry.conceded = true;
            playerEntry.rank = N - numConceded;

            const activePlayers = Object.entries(updatedPlayers).filter(([uid, p]) => !p.conceded && !p.finished);

            const updates = {
                players: updatedPlayers,
                lastMoveAt: serverTimestamp()
            };

            let shouldClose = true; // Always close locally for the conceding player

            if (activePlayers.length <= 1) {
                if (activePlayers.length === 1) {
                    const lastUid = activePlayers[0][0];
                    const numFinished = Object.values(updatedPlayers).filter(p => p.finished).length;
                    updatedPlayers[lastUid].rank = numFinished + 1;
                }
                
                updates.status = 'finished';
                const winnerEntry = Object.entries(updatedPlayers).find(([uid, p]) => p.rank === 1);
                updates.winnerId = winnerEntry ? winnerEntry[0] : currentUser.uid;
            } else {
                if (data.turn === currentUser.uid) {
                    updates.turn = getNextTurnUid(updatedPlayers, currentUser.uid);
                }
            }

            await updateDoc(gameRef, updates);

            if (shouldClose) {
                setActiveGameId(null);
                setGameState('closed');
                cleanupGameP2P();
            }
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
    // 4 tokens per player for all 4 colors
    return {
        red: [ { pos: 'home', step: -1 }, { pos: 'home', step: -1 }, { pos: 'home', step: -1 }, { pos: 'home', step: -1 } ],
        green: [ { pos: 'home', step: -1 }, { pos: 'home', step: -1 }, { pos: 'home', step: -1 }, { pos: 'home', step: -1 } ],
        yellow: [ { pos: 'home', step: -1 }, { pos: 'home', step: -1 }, { pos: 'home', step: -1 }, { pos: 'home', step: -1 } ],
        blue: [ { pos: 'home', step: -1 }, { pos: 'home', step: -1 }, { pos: 'home', step: -1 }, { pos: 'home', step: -1 } ]
    };
}

function getNextTurnUid(players, currentUid) {
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
}
