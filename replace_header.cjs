const fs = require('fs');
const path = 'c:\\Users\\Rakesh\\Vs code\\ChatApp Project\\src\\components\\ChatWindow.jsx';
let content = fs.readFileSync(path, 'utf8');

if (!content.includes("import ChatHeader")) {
    content = content.replace("import ChatModals from './chat/ChatModals';", "import ChatModals from './chat/ChatModals';\nimport ChatHeader from './chat/ChatHeader';");
}

const startToken = '{/* Header */}';
const endToken = '{/* Messages - Virtualized */}';

const startIdx = content.indexOf(startToken);
const endIdx = content.indexOf(endToken);

if (startIdx !== -1 && endIdx !== -1) {
    const pre = content.substring(0, startIdx);
    const post = content.substring(endIdx);
    const newComponent = `<ChatHeader 
                chatInfo={chatInfo}
                handleStartCall={handleStartCall}
                isMenuOpen={isMenuOpen} setIsMenuOpen={setIsMenuOpen}
                setShowInfoModal={setShowInfoModal}
                setShowWallpaperModal={setShowWallpaperModal}
                isSearchOpen={isSearchOpen} setIsSearchOpen={setIsSearchOpen}
                searchInputRef={searchInputRef}
                searchQuery={searchQuery} performSearch={performSearch} nextResult={nextResult} prevResult={prevResult} closeSearch={closeSearch} searchResults={searchResults} currentResultIndex={currentResultIndex}
                messages={messages}
                showPinnedBar={showPinnedBar} setShowPinnedBar={setShowPinnedBar}
                currentPinIndex={currentPinIndex} setCurrentPinIndex={setCurrentPinIndex}
                pinMessage={pinMessage}
                virtuosoRef={virtuosoRef}
            />\n\n            `;
    fs.writeFileSync(path, pre + newComponent + post);
    console.log('ChatHeader substitution success');
} else {
    console.log('Tokens not found', {startIdx, endIdx});
}
