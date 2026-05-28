import { createContext, useContext, useEffect, useState } from "react";
import { auth, db, rtdb } from "../services/firebase";
import { ref, onValue, onDisconnect, set, off } from "firebase/database";
import {
    onAuthStateChanged,
    GoogleAuthProvider,
    signInWithPopup,
    signOut
} from "firebase/auth";
import { doc, setDoc, updateDoc, serverTimestamp } from "firebase/firestore";

const AuthContext = createContext();

export function useAuth() {
    return useContext(AuthContext);
}

export function AuthProvider({ children }) {
    const [currentUser, setCurrentUser] = useState(null);
    const [loading, setLoading] = useState(true);

    async function login() {
        const provider = new GoogleAuthProvider();
        try {
            const result = await signInWithPopup(auth, provider);
            // Create/Update user in Firestore
            const user = result.user;
            const userRef = doc(db, "users", user.uid);

            const fallbackName = user.displayName || user.email?.split('@')[0] || "User";
            await setDoc(userRef, {
                name: fallbackName,
                displayName: fallbackName,
                username: fallbackName,
                email: user.email,
                photoURL: user.photoURL || null,
                profilePic: user.photoURL || null,
                lowerCaseName: fallbackName.toLowerCase(), // Helper for search
                updatedAt: serverTimestamp()
            }, { merge: true });

            return user;
        } catch (error) {
            console.error("Login failed", error);
            throw error;
        }
    }

    function logout() {
        return signOut(auth);
    }

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            setCurrentUser(user);
            setLoading(false);

            if (user) {
                // Presence Logic
                const userStatusRef = ref(rtdb, '/status/' + user.uid);
                const connectedRef = ref(rtdb, '.info/connected');

                onValue(connectedRef, (snap) => {
                    if (snap.val() === true) {
                        // We're connected!
                        const con = {
                            state: 'online',
                            online: true,
                            last_changed: serverTimestamp()
                        };

                        onDisconnect(userStatusRef).set({
                            state: 'offline',
                            online: false,
                            last_changed: serverTimestamp()
                        });

                        set(userStatusRef, con);

                        // Sync to Firestore for UI
                        updateDoc(doc(db, "users", user.uid), { online: true }).catch(e => console.log("Online update failed", e));

                        // Handle tab close/refresh to update Firestore immediately
                        const handleTabClose = () => {
                            updateDoc(doc(db, "users", user.uid), { online: false });
                        };
                        window.addEventListener("beforeunload", handleTabClose);

                        return () => {
                            window.removeEventListener("beforeunload", handleTabClose);
                        };
                    } else {
                        updateDoc(doc(db, "users", user.uid), { online: false }).catch(() => { });
                    }
                });
            }
        });

        return unsubscribe;
    }, []);

    const value = {
        currentUser,
        login,
        logout,
        loading
    };

    return (
        <AuthContext.Provider value={value}>
            {!loading && children}
        </AuthContext.Provider>
    );
}
