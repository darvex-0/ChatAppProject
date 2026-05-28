import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useUI } from '../context/UIContext';
import { CallProvider } from '../context/CallContext';
import { useEffect, useState, lazy, Suspense } from 'react';
import SettingsModal from './Modals/SettingsModal';
import NewChatModal from './Modals/NewChatModal';
import GroupModal from './Modals/GroupModal';
import NotificationToast from './NotificationToast';
import CustomAlert from './CustomAlert';
import StarredMessagesModal from './Modals/StarredMessagesModal';
import CallModal from './Modals/CallModal';
import CallInfoModal from './Modals/CallInfoModal';
import { GameProvider, useGame } from '../context/GameContext';

const ChessGame = lazy(() => import('../games/chess/ChessGame'));
const LudoGame = lazy(() => import('../games/ludo/LudoGame'));


function ActiveGameOverlay() {
    const { activeGame, gameState, setGameState } = useGame();

    if (gameState === 'closed' || !activeGame) return null;

    const isMax = gameState === 'maximized';

    return (
        <div style={isMax ? {
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            background: 'rgba(15, 23, 42, 0.85)',
            backdropFilter: 'blur(8px)',
            zIndex: 9990,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            animation: 'fadeIn 0.2s ease-out'
        } : {
            position: 'fixed',
            bottom: '20px',
            right: '20px',
            width: '240px',
            height: '240px',
            borderRadius: '16px',
            border: '2px solid rgba(99, 102, 241, 0.4)',
            boxShadow: '0 12px 32px rgba(0,0,0,0.6)',
            background: '#0f172a',
            overflow: 'hidden',
            zIndex: 9990,
            cursor: 'pointer',
            transition: 'all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)'
        }}
        onClick={!isMax ? () => setGameState('maximized') : undefined}
        >
            {/* Header controls for maximized state */}
            {isMax && (
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        setGameState('minimized');
                    }}
                    style={{
                        position: 'absolute',
                        top: '16px',
                        right: '16px',
                        padding: '8px 16px',
                        background: 'rgba(255,255,255,0.08)',
                        border: '1px solid rgba(255,255,255,0.15)',
                        borderRadius: '20px',
                        color: 'white',
                        fontWeight: 600,
                        fontSize: '0.8rem',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        zIndex: 9999,
                        transition: 'background 0.2s'
                    }}
                >
                    <span>🗖</span> Minimize
                </button>
            )}

            {/* Hover expand indicator for PIP */}
            {!isMax && (
                <div className="pip-hover" style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    background: 'rgba(0,0,0,0.4)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    opacity: 0,
                    transition: 'opacity 0.2s',
                    zIndex: 9995,
                    pointerEvents: 'none'
                }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: 600, background: 'rgba(0,0,0,0.7)', padding: '6px 12px', borderRadius: '20px', color: 'white' }}>
                        🔍 Expand Game
                    </span>
                </div>
            )}

            <div style={{ width: '100%', height: '100%', pointerEvents: !isMax ? 'none' : 'auto' }}>
                <Suspense fallback={
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#94a3b8' }}>
                        Loading board...
                    </div>
                }>
                    {activeGame.gameType === 'chess' ? <ChessGame /> : <LudoGame />}
                </Suspense>
            </div>
            
            {/* Inject hover CSS for PIP */}
            {!isMax && (
                <style>{`
                    div:hover > .pip-hover { opacity: 1 !important; }
                `}</style>
            )}
        </div>
    );
}

export default function Layout() {
    const { currentUser } = useAuth();
    const { isSearchOpen, toggleSearch, searchQuery, setSearchQuery, alert, closeAlert, toast, closeToast } = useUI();
    const navigate = useNavigate();
    const location = useLocation();

    // Modal State
    const [showSettings, setShowSettings] = useState(false);
    const [showNewChat, setShowNewChat] = useState(false);
    const [showGroupModal, setShowGroupModal] = useState(false);
    const [showStarredModal, setShowStarredModal] = useState(false);

    const isChatOpen = location.pathname.startsWith('/c/');

    useEffect(() => {
        if (!currentUser) {
            navigate('/login');
        }
    }, [currentUser, navigate]);

    if (!currentUser) return null;

    return (
        <CallProvider>
            <GameProvider>
                <ActiveGameOverlay />
                {/* Header - Only show on Inbox view */}
                {!isChatOpen && (
                    <header>
                        <div
                            onClick={() => navigate('/')}
                            className="logo"
                            style={{ cursor: 'pointer' }}
                        >
                            <span style={{ color: 'var(--app-text)', marginRight: '5px' }}>💬</span>
                            <span>ConnectHub</span>
                        </div>

                        <div className="header-icons" id="topIcons">

                            <div onClick={() => setShowNewChat(true)} className="icon-btn" title="New Chat">
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20v-6M6 14H0M18 14h6M14 6V0M14 18v6M6 14V6M0 6h6M18 6h6M6 0v6M18 0v6" /></svg>
                            </div>
                            <div onClick={() => setShowGroupModal(true)} className="icon-btn" title="Create Group">
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
                            </div>
                            <div onClick={() => setShowStarredModal(true)} className="icon-btn" title="Starred Messages">
                                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
                            </div>
                            <div onClick={() => setShowSettings(true)} className="icon-btn" title="Settings">
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
                            </div>
                        </div>
                    </header>
                )}

                {/* Search Area */}
                {isSearchOpen && (
                    <div id="search-area" style={{ display: 'block' }}>
                        <input
                            className="search-input"
                            placeholder="Filter your inbox..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            autoFocus
                        />
                    </div>
                )}

                {/* Main Content Area */}
                <div style={{ flexGrow: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                    <Outlet />
                </div>

                {/* Modals & Alerts */}
                {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
                {showNewChat && <NewChatModal onClose={() => setShowNewChat(false)} />}
                {showGroupModal && <GroupModal onClose={() => setShowGroupModal(false)} />}
                {showStarredModal && <StarredMessagesModal onClose={() => setShowStarredModal(false)} />}

                {alert && <CustomAlert message={alert.message} onClose={closeAlert} />}
                {toast && <NotificationToast message={toast.message} data={toast.data} onClose={closeToast} />}

                {/* Call Modal - Always rendered, shows based on call state */}
                <CallModal />
                <CallInfoModal />
            </GameProvider>
        </CallProvider>
    );
}
