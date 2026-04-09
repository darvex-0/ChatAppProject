const fs = require('fs');
const path = require('path');

const dir = 'c:\\Users\\Rakesh\\Vs code\\ChatApp Project\\src\\components\\chat';
const files = ['ChatModals.jsx', 'ChatHeader.jsx', 'MessageList.jsx', 'MessageInputArea.jsx'];

for (const file of files) {
    const fullPath = path.join(dir, file);
    let content = fs.readFileSync(fullPath, 'utf8');

    // Make sure we haven't already memoized it
    if (!content.includes('React.memo(function')) {
        // Replace the top export
        content = content.replace(
            new RegExp(`export default function ${file.replace('.jsx', '')}\\s*\\(`),
            `export default React.memo(function ${file.replace('.jsx', '')}(`
        );

        // Replace the very last closing brace of the file with });
        const lastBraceIndex = content.lastIndexOf('}');
        if (lastBraceIndex !== -1) {
            content = content.substring(0, lastBraceIndex) + '});\n' + content.substring(lastBraceIndex + 1);
        }

        // Ensure React is imported
        if (!content.includes("import React")) {
            content = "import React from 'react';\n" + content;
        }

        fs.writeFileSync(fullPath, content);
        console.log(`Successfully memoized ${file}`);
    } else {
        console.log(`${file} is already memoized`);
    }
}
