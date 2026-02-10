import { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { db } from '../services/firebase';
import { doc, setDoc, getDoc, onSnapshot, deleteDoc, collection, addDoc, serverTimestamp, query, where, getDocs } from 'firebase/firestore';
import { useAuth } from './AuthContext';

const CallContext = createContext();

// STUN-only servers (free, unlimited, for same-network calls)
const STUN_SERVERS = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
    ]
};

// Generate collision-safe call ID (same ID regardless of who calls whom)
const getCallId = (uid1, uid2) => [uid1, uid2].sort().join('_');

export function CallProvider({ children }) {
    const { currentUser } = useAuth();

    // Call State: 'idle' | 'outgoing' | 'incoming' | 'active' | 'ended'
    const [callState, setCallState] = useState('idle');
    const [callType, setCallType] = useState(null); // 'video' | 'audio'
    const [remoteUser, setRemoteUser] = useState(null); // { uid, name, photo }
    const [callId, setCallId] = useState(null);
    const [isMuted, setIsMuted] = useState(false);
    const [isCameraOff, setIsCameraOff] = useState(false);

    // Media Streams
    const [localStream, setLocalStream] = useState(null);
    const [remoteStream, setRemoteStream] = useState(null);

    // Call Duration (seconds)
    const [callDuration, setCallDuration] = useState(0);

    // WebRTC
    const peerConnectionRef = useRef(null);
    const localStreamRef = useRef(null);
    const callDocUnsubscribeRef = useRef(null);
    const iceCandidatesUnsubscribeRef = useRef(null);

    // Ringtone
    const ringtoneRef = useRef(null);

    // Call Timeout (30 seconds)
    const callTimeoutRef = useRef(null);
    const durationIntervalRef = useRef(null);

    // Ref to declineCall for Service Worker message handler
    const declineCallRef = useRef(null);

    // Wake Lock (keep screen awake during calls)
    const wakeLockRef = useRef(null);

    // TURN servers from Metered.ca (fetched on mount, used only as fallback)
    const METERED_API_KEY = '317e89a9697d7c274ffe6fc5f24817d5e405';
    const turnServersRef = useRef(null);
    const usingTurnRef = useRef(false);

    // Fetch TURN credentials on mount (but don't use them by default)
    useEffect(() => {
        const fetchTurnServers = async () => {
            try {
                const response = await fetch(`https://connecthub.metered.live/api/v1/turn/credentials?apiKey=${METERED_API_KEY}`);
                if (response.ok) {
                    const servers = await response.json();
                    turnServersRef.current = servers;
                    console.log('TURN servers pre-fetched (standby)');
                }
            } catch (error) {
                console.warn('Could not pre-fetch TURN servers:', error);
            }
        };
        fetchTurnServers();
    }, []);

    // Request Wake Lock
    const requestWakeLock = useCallback(async () => {
        if ('wakeLock' in navigator && document.visibilityState === 'visible') {
            try {
                wakeLockRef.current = await navigator.wakeLock.request('screen');
                console.log('Wake Lock acquired');
            } catch (e) {
                console.log('Wake Lock not available');
            }
        }
    }, []);

    // Release Wake Lock
    const releaseWakeLock = useCallback(() => {
        if (wakeLockRef.current) {
            wakeLockRef.current.release();
            wakeLockRef.current = null;
            console.log('Wake Lock released');
        }
    }, []);

    // Notify Service Worker to close call notification
    const closeCallNotification = useCallback(() => {
        if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
            navigator.serviceWorker.controller.postMessage({ type: 'CLOSE_CALL_NOTIFICATION' });
        }
    }, []);

    // Cleanup function
    const cleanup = useCallback(async (status = 'ended') => {
        console.log('Call cleanup:', status);

        // Stop ringtone
        if (ringtoneRef.current) {
            ringtoneRef.current.pause();
            ringtoneRef.current.currentTime = 0;
        }

        // Clear call timeout
        if (callTimeoutRef.current) {
            clearTimeout(callTimeoutRef.current);
            callTimeoutRef.current = null;
        }

        // Clear duration interval
        if (durationIntervalRef.current) {
            clearInterval(durationIntervalRef.current);
            durationIntervalRef.current = null;
        }

        // Release Wake Lock
        releaseWakeLock();

        // Close Service Worker notification
        closeCallNotification();

        // Close peer connection
        if (peerConnectionRef.current) {
            peerConnectionRef.current.close();
            peerConnectionRef.current = null;
        }

        // Stop local stream
        if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach(track => track.stop());
            localStreamRef.current = null;
        }

        // Unsubscribe from Firestore listeners
        if (callDocUnsubscribeRef.current) {
            callDocUnsubscribeRef.current();
            callDocUnsubscribeRef.current = null;
        }
        if (iceCandidatesUnsubscribeRef.current) {
            iceCandidatesUnsubscribeRef.current();
            iceCandidatesUnsubscribeRef.current = null;
        }

        // Update call document status if we have a callId
        if (callId && currentUser) {
            try {
                const callRef = doc(db, 'calls', callId);
                const callDoc = await getDoc(callRef);
                if (callDoc.exists() && callDoc.data().status !== 'ended') {
                    await setDoc(callRef, { status }, { merge: true });
                }
            } catch (e) {
                console.error('Error updating call status:', e);
            }
        }

        // Reset state
        usingTurnRef.current = false;
        setCallState('idle');
        setCallType(null);
        setRemoteUser(null);
        setCallId(null);
        setLocalStream(null);
        setRemoteStream(null);
        setIsMuted(false);
        setIsCameraOff(false);
        setCallDuration(0);
    }, [callId, currentUser, releaseWakeLock, closeCallNotification]);

    // Listen for Service Worker messages (e.g., DECLINE_CALL from notification)
    useEffect(() => {
        if (!('serviceWorker' in navigator)) return;

        const handleSWMessage = (event) => {
            if (event.data?.type === 'DECLINE_CALL' && callState === 'incoming') {
                console.log('Decline call from notification');
                declineCallRef.current?.();
            }
        };

        navigator.serviceWorker.addEventListener('message', handleSWMessage);
        return () => navigator.serviceWorker.removeEventListener('message', handleSWMessage);
    }, [callState]);

    // Ghost Ring Fix: Clean up on tab close
    useEffect(() => {
        const handleBeforeUnload = () => {
            if (callState === 'outgoing') {
                cleanup('missed');
            } else if (callState === 'incoming') {
                cleanup('missed');
            } else if (callState === 'active') {
                cleanup('ended');
            }
        };

        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [callState, cleanup]);

    // Call Duration Timer - updates every second when call is active
    useEffect(() => {
        if (callState === 'active') {
            durationIntervalRef.current = setInterval(() => {
                setCallDuration(prev => prev + 1);
            }, 1000);
        } else {
            if (durationIntervalRef.current) {
                clearInterval(durationIntervalRef.current);
                durationIntervalRef.current = null;
            }
        }
        return () => {
            if (durationIntervalRef.current) {
                clearInterval(durationIntervalRef.current);
            }
        };
    }, [callState]);

    // Listen for incoming calls
    useEffect(() => {
        if (!currentUser) return;

        const callsRef = collection(db, 'calls');
        const q = query(callsRef, where('receiverId', '==', currentUser.uid), where('status', '==', 'offering'));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            snapshot.docChanges().forEach(change => {
                if (change.type === 'added' && callState === 'idle') {
                    const data = change.doc.data();
                    console.log('Incoming call:', data);

                    setCallId(change.doc.id);
                    setCallType(data.type);
                    setRemoteUser({
                        uid: data.callerId,
                        name: data.callerName,
                        photo: data.callerPhoto
                    });
                    setCallState('incoming');

                    // Play ringtone
                    try {
                        ringtoneRef.current = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
                        ringtoneRef.current.loop = true;
                        ringtoneRef.current.play().catch(e => console.log('Ringtone blocked:', e));
                    } catch (e) {
                        console.error('Error playing ringtone:', e);
                    }

                    // Notify Service Worker
                    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
                        navigator.serviceWorker.controller.postMessage({
                            type: 'INCOMING_CALL',
                            callerName: data.callerName || 'Unknown'
                        });
                    }
                }
            });
        });

        return () => unsubscribe();
    }, [currentUser, callState]);

    // Initialize media stream
    const getMediaStream = useCallback(async (type) => {
        try {
            const constraints = {
                audio: true,
                video: type === 'video' ? { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } } : false
            };
            const stream = await navigator.mediaDevices.getUserMedia(constraints);
            localStreamRef.current = stream;
            setLocalStream(stream);
            return stream;
        } catch (e) {
            console.error('Error getting media stream:', e);
            throw new Error('Could not access camera/microphone. Please check permissions.');
        }
    }, []);

    // Create peer connection with ICE config
    // useTurn = false → STUN only (same-network, free)
    // useTurn = true  → STUN + TURN (cross-network, uses Metered quota)
    const createPeerConnection = useCallback((currentCallId, useTurn = false) => {
        let iceConfig;
        if (useTurn && turnServersRef.current) {
            // Cross-network: use TURN servers from Metered.ca
            iceConfig = { iceServers: turnServersRef.current };
            usingTurnRef.current = true;
            console.log('Using TURN servers (cross-network fallback)');
        } else {
            // Same-network: use free STUN servers only
            iceConfig = STUN_SERVERS;
            console.log('Using STUN servers (same-network)');
        }

        const pc = new RTCPeerConnection(iceConfig);

        pc.onicecandidate = async (event) => {
            if (event.candidate) {
                try {
                    await addDoc(collection(db, 'calls', currentCallId, 'iceCandidates'), {
                        candidate: event.candidate.toJSON(),
                        from: currentUser.uid
                    });
                } catch (e) {
                    console.error('Error adding ICE candidate:', e);
                }
            }
        };

        pc.ontrack = (event) => {
            console.log('Remote track received');
            setRemoteStream(event.streams[0]);
        };

        pc.onconnectionstatechange = () => {
            console.log('Connection state:', pc.connectionState);
            if (pc.connectionState === 'connected') {
                setCallState('active');
                requestWakeLock();
            } else if (pc.connectionState === 'failed') {
                // STUN failed → retry with TURN if available
                if (!usingTurnRef.current && turnServersRef.current) {
                    console.log('STUN connection failed, retrying with TURN...');
                    retryWithTurn(currentCallId);
                } else {
                    cleanup('ended');
                }
            } else if (pc.connectionState === 'disconnected') {
                // Give it a few seconds before ending (could be temporary)
                setTimeout(() => {
                    if (pc.connectionState === 'disconnected') {
                        cleanup('ended');
                    }
                }, 5000);
            }
        };

        peerConnectionRef.current = pc;
        return pc;
    }, [currentUser, cleanup, requestWakeLock]);

    // Retry failed STUN connection with TURN servers
    const retryWithTurn = useCallback(async (currentCallId) => {
        console.log('Retrying call with TURN servers...');

        // Close old peer connection
        if (peerConnectionRef.current) {
            peerConnectionRef.current.close();
            peerConnectionRef.current = null;
        }

        // Unsubscribe old ICE listener
        if (iceCandidatesUnsubscribeRef.current) {
            iceCandidatesUnsubscribeRef.current();
            iceCandidatesUnsubscribeRef.current = null;
        }

        try {
            // Create new PC with TURN
            const pc = createPeerConnection(currentCallId, true);

            // Re-add local tracks
            if (localStreamRef.current) {
                localStreamRef.current.getTracks().forEach(track => pc.addTrack(track, localStreamRef.current));
            }

            // Check if we are the caller or answerer
            const callDoc = await getDoc(doc(db, 'calls', currentCallId));
            if (!callDoc.exists()) return;
            const callData = callDoc.data();

            if (callData.callerId === currentUser.uid) {
                // We are the caller - create new offer
                const offer = await pc.createOffer();
                await pc.setLocalDescription(offer);
                await setDoc(doc(db, 'calls', currentCallId), {
                    offer: { type: offer.type, sdp: offer.sdp },
                    turnRetry: true
                }, { merge: true });
            } else {
                // We are the answerer - set offer and create new answer
                if (callData.offer) {
                    await pc.setRemoteDescription(new RTCSessionDescription(callData.offer));
                    const answer = await pc.createAnswer();
                    await pc.setLocalDescription(answer);
                    await setDoc(doc(db, 'calls', currentCallId), {
                        answer: { type: answer.type, sdp: answer.sdp },
                        turnRetry: true
                    }, { merge: true });
                }
            }

            // Re-listen for ICE candidates
            iceCandidatesUnsubscribeRef.current = onSnapshot(
                collection(db, 'calls', currentCallId, 'iceCandidates'),
                (snapshot) => {
                    snapshot.docChanges().forEach(change => {
                        if (change.type === 'added') {
                            const data = change.doc.data();
                            if (data.from !== currentUser.uid && pc.remoteDescription) {
                                pc.addIceCandidate(new RTCIceCandidate(data.candidate)).catch(console.error);
                            }
                        }
                    });
                }
            );
        } catch (e) {
            console.error('TURN retry failed:', e);
            cleanup('ended');
        }
    }, [currentUser, createPeerConnection, cleanup]);

    // Start outgoing call
    const callUser = useCallback(async (receiverUid, type) => {
        if (!currentUser || callState !== 'idle') {
            console.log('Cannot start call: busy or not logged in');
            return { success: false, error: 'You are already in a call or not logged in.' };
        }

        try {
            // Get receiver info
            const receiverDoc = await getDoc(doc(db, 'users', receiverUid));
            if (!receiverDoc.exists()) {
                return { success: false, error: 'User not found.' };
            }
            const receiverData = receiverDoc.data();

            // Check if receiver is already in a call
            const activeCallId = getCallId(currentUser.uid, receiverUid);
            const existingCall = await getDoc(doc(db, 'calls', activeCallId));
            if (existingCall.exists() && ['offering', 'answered'].includes(existingCall.data().status)) {
                return { success: false, error: 'User is busy on another call.' };
            }

            setCallState('outgoing');
            setCallType(type);
            setRemoteUser({
                uid: receiverUid,
                name: receiverData.name || 'User',
                photo: receiverData.photoURL
            });
            setCallId(activeCallId);

            // Get media stream
            const stream = await getMediaStream(type);

            // Create peer connection (STUN first)
            const pc = createPeerConnection(activeCallId, false);
            stream.getTracks().forEach(track => pc.addTrack(track, stream));

            // Create offer
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);

            // Save to Firestore
            const callData = {
                callerId: currentUser.uid,
                callerName: currentUser.displayName || 'User',
                callerPhoto: currentUser.photoURL || '',
                receiverId: receiverUid,
                type,
                status: 'offering',
                offer: { type: offer.type, sdp: offer.sdp },
                createdAt: serverTimestamp()
            };
            await setDoc(doc(db, 'calls', activeCallId), callData);

            // Listen for answer
            callDocUnsubscribeRef.current = onSnapshot(doc(db, 'calls', activeCallId), async (snapshot) => {
                const data = snapshot.data();
                if (!data) return;

                if (data.status === 'answered' && data.answer && pc.signalingState !== 'stable') {
                    console.log('Answer received');
                    const answer = new RTCSessionDescription(data.answer);
                    await pc.setRemoteDescription(answer);
                } else if (data.status === 'declined' || data.status === 'ended' || data.status === 'missed') {
                    cleanup(data.status);
                }
            });

            // Listen for ICE candidates from receiver
            iceCandidatesUnsubscribeRef.current = onSnapshot(
                collection(db, 'calls', activeCallId, 'iceCandidates'),
                (snapshot) => {
                    snapshot.docChanges().forEach(change => {
                        if (change.type === 'added') {
                            const data = change.doc.data();
                            if (data.from !== currentUser.uid && pc.remoteDescription) {
                                pc.addIceCandidate(new RTCIceCandidate(data.candidate)).catch(console.error);
                            }
                        }
                    });
                }
            );

            // Set call timeout (30 seconds)
            callTimeoutRef.current = setTimeout(() => {
                console.log('Call timeout - no answer');
                cleanup('missed');
            }, 30000);

            return { success: true };
        } catch (e) {
            console.error('Error starting call:', e);
            cleanup('ended');
            return { success: false, error: e.message };
        }
    }, [currentUser, callState, getMediaStream, createPeerConnection, cleanup]);

    // Answer incoming call
    const answerCall = useCallback(async () => {
        if (!currentUser || callState !== 'incoming' || !callId) return;

        try {
            // Stop ringtone
            if (ringtoneRef.current) {
                ringtoneRef.current.pause();
                ringtoneRef.current.currentTime = 0;
            }

            // Get call document
            const callDoc = await getDoc(doc(db, 'calls', callId));
            if (!callDoc.exists()) {
                cleanup('ended');
                return;
            }
            const callData = callDoc.data();

            // Double-accept prevention
            if (callData.status !== 'offering') {
                cleanup('ended');
                return;
            }

            // Get media stream
            const stream = await getMediaStream(callType);

            // Create peer connection (STUN first)
            const pc = createPeerConnection(callId, false);
            stream.getTracks().forEach(track => pc.addTrack(track, stream));

            // Set remote description (offer)
            const offer = new RTCSessionDescription(callData.offer);
            await pc.setRemoteDescription(offer);

            // Create answer
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);

            // Save answer to Firestore
            await setDoc(doc(db, 'calls', callId), {
                answer: { type: answer.type, sdp: answer.sdp },
                status: 'answered'
            }, { merge: true });

            // Listen for call status changes
            callDocUnsubscribeRef.current = onSnapshot(doc(db, 'calls', callId), (snapshot) => {
                const data = snapshot.data();
                if (data && (data.status === 'ended' || data.status === 'declined')) {
                    cleanup(data.status);
                }
            });

            // Listen for ICE candidates from caller
            iceCandidatesUnsubscribeRef.current = onSnapshot(
                collection(db, 'calls', callId, 'iceCandidates'),
                (snapshot) => {
                    snapshot.docChanges().forEach(change => {
                        if (change.type === 'added') {
                            const data = change.doc.data();
                            if (data.from !== currentUser.uid && pc.remoteDescription) {
                                pc.addIceCandidate(new RTCIceCandidate(data.candidate)).catch(console.error);
                            }
                        }
                    });
                }
            );

            setCallState('active');
        } catch (e) {
            console.error('Error answering call:', e);
            cleanup('ended');
        }
    }, [currentUser, callState, callId, callType, getMediaStream, createPeerConnection, cleanup]);

    // Decline incoming call
    const declineCall = useCallback(async () => {
        if (ringtoneRef.current) {
            ringtoneRef.current.pause();
            ringtoneRef.current.currentTime = 0;
        }
        cleanup('declined');
    }, [cleanup]);

    // Keep declineCallRef updated for Service Worker handler
    useEffect(() => {
        declineCallRef.current = declineCall;
    }, [declineCall]);

    // End active call
    const endCall = useCallback(() => {
        cleanup('ended');
    }, [cleanup]);

    // Toggle mute
    const toggleMute = useCallback(() => {
        if (localStreamRef.current) {
            const audioTrack = localStreamRef.current.getAudioTracks()[0];
            if (audioTrack) {
                audioTrack.enabled = !audioTrack.enabled;
                setIsMuted(!audioTrack.enabled);
            }
        }
    }, []);

    // Toggle camera
    const toggleCamera = useCallback(() => {
        if (localStreamRef.current) {
            const videoTrack = localStreamRef.current.getVideoTracks()[0];
            if (videoTrack) {
                videoTrack.enabled = !videoTrack.enabled;
                setIsCameraOff(!videoTrack.enabled);
            }
        }
    }, []);

    return (
        <CallContext.Provider value={{
            callState,
            callType,
            remoteUser,
            localStream,
            remoteStream,
            isMuted,
            isCameraOff,
            callUser,
            answerCall,
            declineCall,
            endCall,
            toggleMute,
            toggleCamera,
            callDuration
        }}>
            {children}
        </CallContext.Provider>
    );
}

export function useCall() {
    return useContext(CallContext);
}
