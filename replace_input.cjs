const fs = require('fs');
const path = 'c:\\Users\\Rakesh\\Vs code\\ChatApp Project\\src\\components\\ChatWindow.jsx';
let content = fs.readFileSync(path, 'utf8');

if (!content.includes("import MessageInputArea")) {
    content = content.replace("import MessageList from './chat/MessageList';", "import MessageList from './chat/MessageList';\nimport MessageInputArea from './chat/MessageInputArea';");
    content = content.replace("import SmartReplies from './SmartReplies';\n", "");
    content = content.replace("import MentionSuggestions from './MentionSuggestions';\n", "");
    content = content.replace("import EmojiPicker from 'emoji-picker-react';\n", "");
}

const startToken = '{/* Smart Replies */}';
const chatModalsIdx = content.indexOf('<ChatModals');
const startIdx = content.indexOf(startToken);

if (startIdx !== -1 && chatModalsIdx !== -1) {
    const pre = content.substring(0, startIdx);
    const post = content.substring(chatModalsIdx);
    const newComponent = `<MessageInputArea
                smartReplies={smartReplies} isLoadingReplies={isLoadingReplies} handleSmartReplyClick={handleSmartReplyClick}
                isRecording={isRecording} voicePreviewUrl={voicePreviewUrl} editMsg={editMsg}
                voiceDraft={voiceDraft} formatDuration={formatDuration} deleteVoiceDraft={deleteVoiceDraft} sendVoiceDraft={sendVoiceDraft}
                replyTo={replyTo} cancelReply={cancelReply}
                dragOffset={dragOffset} isDraggingRef={isDraggingRef} recordingDuration={recordingDuration} cancelRecording={cancelRecording} stopRecording={stopRecording} handleDragStart={handleDragStart}
                uploadProgress={uploadProgress} cancelUpload={cancelUpload} fileInputRef={fileInputRef} handleFileUpload={handleFileUpload}
                setShowVideoRecorder={setShowVideoRecorder} startRecording={startRecording}
                setShowMediaCamera={setShowMediaCamera}
                scheduledMessages={scheduledMessages} setShowScheduledList={setShowScheduledList}
                setEditingScheduledMsg={setEditingScheduledMsg} setIsScheduleModalOpen={setIsScheduleModalOpen}
                setShowPollCreator={setShowPollCreator}
                mentionState={mentionState} groupMembers={groupMembers} insertMention={insertMention} setMentionState={setMentionState} mentionIndex={mentionIndex} setMentionIndex={setMentionIndex}
                showEmojiPicker={showEmojiPicker} setShowEmojiPicker={setShowEmojiPicker} emojiPickerPos={emojiPickerPos} isDraggingEmoji={isDraggingEmoji} setIsDraggingEmoji={setIsDraggingEmoji}
                emojiDragOffset={emojiDragOffset} setEmojiPickerPos={setEmojiPickerPos} onEmojiClick={onEmojiClick}
                inputText={inputText} setInputText={setInputText} handleInputChange={handleInputChange} inputRef={inputRef}
                isRephrasing={isRephrasing} setIsRephrasing={setIsRephrasing} fetchRephrase={fetchRephrase} showAlert={showAlert} sendMessage={sendMessage}
            />\n\n            `;
    fs.writeFileSync(path, pre + newComponent + post);
    console.log('MessageInputArea substitution success');
} else {
    console.log('Tokens not found', {startIdx, chatModalsIdx});
}
