import React from 'react';
import { Virtuoso } from 'react-virtuoso';
import MessageItem from '../MessageItem';

export default function MessageList({
    chatId,
    messages,
    starredIds,
    currentUser,
    chatInfo,
    wallpaper,
    isMessagesReady,
    loadMoreMessages,
    isLoadingMore,
    virtuosoRef,
    isSearchOpen,
    searchQuery,
    initiateReply,
    initiateForward,
    addReaction,
    confirmDelete,
    initiateEdit,
    pinMessage,
    starMessage,
    typingUser
}) {
    return (
        <>
            {/* Messages - Virtualized */}
            <div
                id="chat-box"
                style={{
                    flexGrow: 1,
                    padding: '0 1rem',
                    background: wallpaper || 'transparent',
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    backgroundRepeat: 'no-repeat',
                    backgroundAttachment: 'local',
                    position: 'relative',
                    minHeight: 0,
                    WebkitOverflowScrolling: 'touch'
                }}
            >
                {wallpaper && <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', background: 'var(--modal-overlay)', pointerEvents: 'none', zIndex: 0 }} />}
                <Virtuoso
                    key={chatId}
                    ref={virtuosoRef}
                    style={{
                        height: '100%',
                        zIndex: 1,
                        opacity: isMessagesReady ? 1 : 0,
                        transition: 'opacity 0.15s ease-in'
                    }}
                    data={messages}
                    initialTopMostItemIndex={messages.length - 1}
                    startReached={loadMoreMessages}
                    followOutput="auto"
                    alignToBottom
                    overscan={200}
                    itemContent={(index, msg) => (
                        <MessageItem
                            key={msg.id}
                            msg={{ ...msg, isStarred: starredIds.has(msg.id) }}
                            currentUser={currentUser}
                            chatInfo={chatInfo}
                            chatId={chatId}
                            initiateReply={initiateReply}
                            initiateForward={initiateForward}
                            addReaction={addReaction}
                            confirmDelete={confirmDelete}
                            initiateEdit={initiateEdit}
                            pinMessage={pinMessage}
                            starMessage={starMessage}
                            highlightText={isSearchOpen ? searchQuery : null}
                        />
                    )}
                    components={{
                        Header: () => isLoadingMore ? <div style={{ textAlign: 'center', padding: '10px', fontSize: '0.8rem', color: '#aaa' }}>Loading older messages...</div> : null
                    }}
                />
            </div>

            <div id="typingIndicator">{typingUser && <span>{typingUser}</span>}</div>
        </>
    );
}
