const fs = require('fs');
const path = 'c:\\Users\\Rakesh\\Vs code\\ChatApp Project\\src\\components\\ChatWindow.jsx';
let content = fs.readFileSync(path, 'utf8');

// 1. loadMoreMessages
content = content.replace(
    /const loadMoreMessages = \(\) => {([\s\S]*?)    };/,
    'const loadMoreMessages = useCallback(() => {$1    }, [messages.length, messageLimit, isLoadingMore]);'
);

// 2. pinMessage
content = content.replace(
    /const pinMessage = async \(msgId, shouldPin, durationMs = null\) => {([\s\S]*?)        } catch \(e\) {([\s\S]*?)            showAlert\("Failed to pin message"\);\n        }\n    };/,
    'const pinMessage = useCallback(async (msgId, shouldPin, durationMs = null) => {$1        } catch (e) {$2            showAlert("Failed to pin message");\n        }\n    }, [messages, currentUser, chatId, showAlert]);'
);

// 3. starMessage
content = content.replace(
    /const starMessage = async \(msgId, shouldStar\) => {([\s\S]*?)        } catch \(e\) {([\s\S]*?)            showAlert\("Failed to update star status"\);\n        }\n    };/,
    'const starMessage = useCallback(async (msgId, shouldStar) => {$1        } catch (e) {$2            showAlert("Failed to update star status");\n        }\n    }, [messages, currentUser, chatId, chatInfo, showAlert]);'
);

fs.writeFileSync(path, content);
console.log('useCallback injection complete!');
