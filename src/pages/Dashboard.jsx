import { useAuth } from "../context/AuthContext";
import Sidebar from "../components/Sidebar";
import ChatWindow from "../components/ChatWindow";
import { useParams } from "react-router-dom";

export default function Dashboard() {
    const { chatId } = useParams();

    return (
        <div className="flex h-full w-full overflow-hidden">
            {/* Sidebar: Always visible on large screens. On small screens, hide if chat is open */}
            <div className={`${chatId ? 'hidden md:flex' : 'flex'} w-full md:w-[400px] flex-col shrink-0`} style={{ background: 'var(--app-bg)', borderRight: '1px solid var(--border-color)' }}>
                <Sidebar />
            </div>

            {/* ChatWindow: Visible if chatId exists. On small screens it takes full width. On large, takes remaining space */}
            {chatId ? (
                <div className="flex-1 h-full flex flex-col min-w-0 relative z-10" style={{ background: 'var(--app-bg)' }}>
                    <ChatWindow />
                </div>
            ) : (
                /* Empty state for Desktop when no chat selected */
                <div className="hidden md:flex flex-1 items-center justify-center flex-col" style={{ background: 'var(--app-bg)', color: 'var(--app-text-muted)' }}>
                    <span className="text-6xl mb-4">💬</span>
                    <p className="text-xl font-medium" style={{ color: 'var(--app-text)' }}>Select a conversation</p>
                    <p className="text-sm">Choose a chat from the sidebar to start messaging</p>
                </div>
            )}
        </div>
    );
}
