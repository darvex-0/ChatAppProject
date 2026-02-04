import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useUI } from '../context/UIContext';
import { useEffect, useState } from 'react';
import SettingsModal from './Modals/SettingsModal';
import NewChatModal from './Modals/NewChatModal';
import GroupModal from './Modals/GroupModal';
import NotificationToast from './NotificationToast';
import CustomAlert from './CustomAlert';
import StarredMessagesModal from './Modals/StarredMessagesModal';

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
        <>
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

            {/* Modals & ALerts */}
            {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
            {showNewChat && <NewChatModal onClose={() => setShowNewChat(false)} />}
            {showGroupModal && <GroupModal onClose={() => setShowGroupModal(false)} />}
            {showStarredModal && <StarredMessagesModal onClose={() => setShowStarredModal(false)} />}

            {alert && <CustomAlert message={alert.message} onClose={closeAlert} />}
            {toast && <NotificationToast message={toast.message} data={toast.data} onClose={closeToast} />}
        </>
    );
}
