const fs = require('fs');
const path = 'c:\\Users\\Rakesh\\Vs code\\ChatApp Project\\src\\components\\ChatWindow.jsx';
let content = fs.readFileSync(path, 'utf8');

if (!content.includes("import MessageList")) {
    content = content.replace("import ChatHeader from './chat/ChatHeader';", "import ChatHeader from './chat/ChatHeader';\nimport MessageList from './chat/MessageList';");
    content = content.replace("import MessageItem from './MessageItem';\n", "");
    content = content.replace("import { Virtuoso } from 'react-virtuoso';\n", "");
}

const startToken = '{/* Messages - Virtualized */}';
const endTokenExact = '<div id="typingIndicator">{typingUser && <span>{typingUser}</span>}</div>';

const startIdx = content.indexOf(startToken);
const endIdx = content.indexOf(endTokenExact);

if (startIdx !== -1 && endIdx !== -1) {
    const pre = content.substring(0, startIdx);
    const post = content.substring(endIdx + endTokenExact.length);
    const newComponent = `<MessageList 
                chatId={chatId}
                messages={messages}
                starredIds={starredIds}
                currentUser={currentUser}
                chatInfo={chatInfo}
                wallpaper={wallpaper}
                isMessagesReady={isMessagesReady}
                loadMoreMessages={loadMoreMessages}
                isLoadingMore={isLoadingMore}
                virtuosoRef={virtuosoRef}
                isSearchOpen={isSearchOpen}
                searchQuery={searchQuery}
                initiateReply={initiateReply}
                initiateForward={initiateForward}
                addReaction={addReaction}
                confirmDelete={confirmDelete}
                initiateEdit={initiateEdit}
                pinMessage={pinMessage}
                starMessage={starMessage}
                typingUser={typingUser}
            />`;
    fs.writeFileSync(path, pre + newComponent + post);
    console.log('MessageList substitution success');
} else {
    console.log('Tokens not found', {startIdx, endIdx});
}
