import { createContext, useContext, useState, useEffect, useCallback } from 'react';

const UIContext = createContext();

export function UIProvider({ children }) {
    const [searchQuery, setSearchQuery] = useState("");
    const [isSearchOpen, setIsSearchOpen] = useState(false);
    const [alert, setAlert] = useState(null); // { message, isHTML }

    // Notification State
    const [notificationPermission, setNotificationPermission] = useState(Notification.permission);

    // Theme State
    const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'dark');

    useEffect(() => {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('theme', theme);
    }, [theme]);

    const toggleTheme = useCallback(() => {
        setTheme(prev => prev === 'dark' ? 'light' : 'dark');
    }, []);

    // Notification Settings (Persisted)
    const [notificationSettings, setNotificationSettings] = useState(() => {
        const saved = localStorage.getItem('notificationSettings');
        return saved ? JSON.parse(saved) : {
            sound: true,
            desktop: true,
            preview: true
        };
    });

    // Update settings and persist
    const updateNotificationSettings = useCallback((key, value) => {
        setNotificationSettings(prev => {
            const newSettings = { ...prev, [key]: value };
            localStorage.setItem('notificationSettings', JSON.stringify(newSettings));
            return newSettings;
        });
    }, []);

    useEffect(() => {
        // Sync permission changes if possible (browsers don't always fire event for this)
        const checkPerm = () => setNotificationPermission(Notification.permission);
        if ('permissions' in navigator) {
            navigator.permissions.query({ name: 'notifications' }).then(notificationPerm => {
                notificationPerm.onchange = checkPerm;
            });
        }
    }, []);

    const requestNotificationPermission = useCallback(async () => {
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
    }, []);

    const showAlert = useCallback((message, isHTML = false) => {
        setAlert({ message, isHTML });
    }, []);

    const closeAlert = useCallback(() => {
        setAlert(null);
    }, []);

    // Toast State
    const [toast, setToast] = useState(null); // { message, data }

    const showToast = useCallback((message, data) => {
        setToast({ message, data });
    }, []);

    const closeToast = useCallback(() => {
        setToast(null);
    }, []);

    const toggleSearch = useCallback(() => {
        setIsSearchOpen(prev => !prev);
        if (isSearchOpen) setSearchQuery(""); // Clear on close
    }, [isSearchOpen]);

    return (
        <UIContext.Provider value={{
            searchQuery, setSearchQuery,
            isSearchOpen, toggleSearch,
            alert, showAlert, closeAlert,
            notificationPermission, requestNotificationPermission,
            notificationSettings, updateNotificationSettings,
            theme, toggleTheme,
            toast, showToast, closeToast
        }}>
            {children}
        </UIContext.Provider>
    );
}

export function useUI() {
    return useContext(UIContext);
}
