import { useAuth } from "../context/AuthContext";
import Sidebar from "../components/Sidebar";
import ChatWindow from "../components/ChatWindow";
import { useParams } from "react-router-dom";

export default function Dashboard() {
    const { chatId } = useParams();

    return (
        <div className="flex h-full w-full overflow-hidden">
            {/* Sidebar: Always visible on large screens. On small screens, hide if chat is open */}
            <div className={`${chatId ? 'hidden md:flex' : 'flex'} w-full md:w-[400px] flex-col border-r border-white/5 bg-darker shrink-0`}>
                <Sidebar />
            </div>

            {/* ChatWindow: Visible if chatId exists. On small screens it takes full width. On large, takes remaining space */}
            {chatId ? (
                <div className="flex-1 h-full flex flex-col min-w-0 bg-darker relative z-10">
                    <ChatWindow />
                </div>
            ) : (
                /* Empty state for Desktop when no chat selected */
                <div className="hidden md:flex flex-1 items-center justify-center bg-darker text-gray-500 flex-col">
                    <span className="text-6xl mb-4">💬</span>
                    <p className="text-xl font-medium">Select a conversation</p>
                    <p className="text-sm">Choose a chat from the sidebar to start messaging</p>
                </div>
            )}
        </div>
    );
}
