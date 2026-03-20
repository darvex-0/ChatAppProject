import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { UIProvider, useUI } from "./context/UIContext";
import { lazy, Suspense, useEffect } from "react";
import ErrorBoundary from "./components/ErrorBoundary";
import { messaging, db } from "./services/firebase";
import { getToken, onMessage } from "firebase/messaging";
import { doc, updateDoc } from "firebase/firestore";

// --- CODE SPLITTING ---
// React.lazy() tells Vite to create separate bundles for each component.
// They only download when the user navigates to that route!
// This reduces the initial bundle from ~1.1MB to ~300KB.

// Login page - loads when user visits /login
const Login = lazy(() => import("./pages/Login"));

// Dashboard - loads after login (the biggest component)
const Dashboard = lazy(() => import("./pages/Dashboard"));

// Layout - the shell that wraps authenticated pages
const Layout = lazy(() => import("./components/Layout"));

// Loading spinner shown while lazy components download
const LoadingFallback = () => (
    <div style={{
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--bg-dark)',
        color: 'var(--text-primary)'
    }}>
        <div style={{ textAlign: 'center' }}>
            <div style={{
                width: '40px',
                height: '40px',
                border: '3px solid rgba(255,255,255,0.1)',
                borderTopColor: 'var(--primary)',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite',
                margin: '0 auto 1rem'
            }} />
            <span>Loading...</span>
        </div>
    </div>
);

// Component to handle FCM logic inside Auth context
function FCMHandler() {
    const { currentUser } = useAuth();
    const { notificationPermission, showToast } = useUI(); // We listen to permission state

    useEffect(() => {
        if (!currentUser || !messaging) return;

        // ONLY Try to get token if permission is already GRANTED
        if (notificationPermission === 'granted') {
            const setupFCM = async () => {
                console.log("Setting up FCM (Permission Granted)...");
                try {
                    const token = await getToken(messaging).catch(e => console.warn("No token received", e));

                    if (token) {
                        console.log("FCM Token:", token);
                        await updateDoc(doc(db, "users", currentUser.uid), {
                            fcmToken: token
                        });
                    }
                } catch (e) {
                    console.error("FCM Setup Error:", e);
                }
            };
            setupFCM();
        }

        // Foreground Message Listener
        const unsubscribe = onMessage(messaging, (payload) => {
            console.log("Foreground Message Received:", payload);
            const { title, body } = payload.notification || {};
            const { chatId } = payload.data || {};

            showToast(body, { title, chatId });
        });

        return () => unsubscribe();
    }, [currentUser, notificationPermission, showToast]);

    return null;
}

function App() {
    return (
        <ErrorBoundary>
            <AuthProvider>
                <UIProvider>
                    <FCMHandler />
                    <BrowserRouter>
                        {/* Suspense shows LoadingFallback while lazy components download */}
                        <Suspense fallback={<LoadingFallback />}>
                            <ErrorBoundary>
                                <Routes>
                                    <Route path="/login" element={<Login />} />
                                    <Route path="/" element={<Layout />}>
                                        <Route index element={<Dashboard />} />
                                        <Route path="c/:chatId" element={<Dashboard />} />
                                    </Route>
                                    <Route path="*" element={<Navigate to="/" />} />
                                </Routes>
                            </ErrorBoundary>
                        </Suspense>
                    </BrowserRouter>
                </UIProvider>
            </AuthProvider>
        </ErrorBoundary>
    );
}

export default App;
