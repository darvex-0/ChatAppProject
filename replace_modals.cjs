const fs = require('fs');
const path = 'c:\\Users\\Rakesh\\Vs code\\ChatApp Project\\src\\components\\ChatWindow.jsx';
let content = fs.readFileSync(path, 'utf8');
const startToken = '{showInfoModal && <ChatInfoModal';
const endToken = 'onSubmit={sendPoll}\r\n                />\r\n            )}';
const endTokenAlt = 'onSubmit={sendPoll}\n                />\n            )}';

const startIdx = content.indexOf(startToken);
let endIdx = content.indexOf(endToken);
let len = endToken.length;

if (endIdx === -1) {
    endIdx = content.indexOf(endTokenAlt);
    len = endTokenAlt.length;
}

if (startIdx !== -1 && endIdx !== -1) {
    const pre = content.substring(0, startIdx);
    const post = content.substring(endIdx + len);
    const newComponent = `<ChatModals
                chatId={chatId}
                chatInfo={chatInfo}
                currentUser={currentUser}
                showInfoModal={showInfoModal} setShowInfoModal={setShowInfoModal}
                showWallpaperModal={showWallpaperModal} setShowWallpaperModal={setShowWallpaperModal} handleUpdateWallpaper={handleUpdateWallpaper}
                deleteMsgId={deleteMsgId} setDeleteMsgId={setDeleteMsgId} performDelete={performDelete}
                pendingPinMsg={pendingPinMsg} setPendingPinMsg={setPendingPinMsg} pinMessage={pinMessage}
                showScheduledList={showScheduledList} setShowScheduledList={setShowScheduledList} scheduledMessages={scheduledMessages}
                startEditingScheduledMsg={startEditingScheduledMsg} deleteScheduledMessage={deleteScheduledMessage}
                isScheduleModalOpen={isScheduleModalOpen} setIsScheduleModalOpen={setIsScheduleModalOpen} editingScheduledMsg={editingScheduledMsg}
                setEditingScheduledMsg={setEditingScheduledMsg} scheduledTime={scheduledTime} setScheduledTime={setScheduledTime} handleScheduleMessage={handleScheduleMessage}
                voicePreviewUrl={voicePreviewUrl} cancelVoicePreview={cancelVoicePreview} confirmSendVoice={confirmSendVoice}
                editMsg={editMsg} editText={editText} setEditText={setEditText} cancelEdit={cancelEdit} performEdit={performEdit}
                forwardMsg={forwardMsg} setForwardMsg={setForwardMsg} performForward={performForward}
                previewFile={previewFile} setPreviewFile={setPreviewFile} handleMediaPreviewSend={handleMediaPreviewSend}
                showVideoRecorder={showVideoRecorder} setShowVideoRecorder={setShowVideoRecorder} sendVideoMessage={sendVideoMessage}
                showMediaCamera={showMediaCamera} setShowMediaCamera={setShowMediaCamera} handleCameraCapture={handleCameraCapture}
                showPollCreator={showPollCreator} setShowPollCreator={setShowPollCreator} sendPoll={sendPoll}
            />`;
    fs.writeFileSync(path, pre + newComponent + post);
    console.log('Replacement Success');
} else {
    console.log('Tokens not found', {startIdx, endIdx});
}
