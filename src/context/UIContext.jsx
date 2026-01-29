import { createContext, useContext, useState, useEffect } from 'react';

const UIContext = createContext();

export function UIProvider({ children }) {
    const [searchQuery, setSearchQuery] = useState("");
    const [isSearchOpen, setIsSearchOpen] = useState(false);
    const [alert, setAlert] = useState(null); // { message, isHTML }

    // Notification State
    const [notificationPermission, setNotificationPermission] = useState(Notification.permission);

    useEffect(() => {
        // Sync permission changes if possible (browsers don't always fire event for this)
        const checkPerm = () => setNotificationPermission(Notification.permission);
        if ('permissions' in navigator) {
            navigator.permissions.query({ name: 'notifications' }).then(notificationPerm => {
                notificationPerm.onchange = checkPerm;
            });
        }
    }, []);

    const requestNotificationPermission = async () => {
        console.log("Requesting notification permission...");
        try {
            const permission = await Notification.requestPermission();
            console.log("Permission result:", permission);
            setNotificationPermission(permission);
            return permission;
        } catch (e) {
            console.error("Permission request failed:", e);
            return 'denied';
        }
    };

    const showAlert = (message, isHTML = false) => {
        setAlert({ message, isHTML });
    };

    const closeAlert = () => {
        setAlert(null);
    };

    // Toast State
    const [toast, setToast] = useState(null); // { message, data }

    const showToast = (message, data) => {
        setToast({ message, data });
    };

    const closeToast = () => {
        setToast(null);
    };

    const toggleSearch = () => {
        setIsSearchOpen(prev => !prev);
        if (isSearchOpen) setSearchQuery(""); // Clear on close
    };

    return (
        <UIContext.Provider value={{
            searchQuery, setSearchQuery,
            isSearchOpen, toggleSearch,
            alert, showAlert, closeAlert,
            notificationPermission, requestNotificationPermission,
            toast, showToast, closeToast
        }}>
            {children}
        </UIContext.Provider>
    );
}

export function useUI() {
    return useContext(UIContext);
}
