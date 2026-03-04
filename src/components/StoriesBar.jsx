import { useState, useEffect, useRef } from 'react';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../context/AuthContext';

// Lazy imports for modals to avoid circular deps
import StoryViewer from './Modals/StoryViewer';
import CreateStoryModal from './Modals/CreateStoryModal';

const STORY_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours

export default function StoriesBar({ friendIds = [] }) {
    const { currentUser } = useAuth();
    const [stories, setStories] = useState([]);
    const [viewingStories, setViewingStories] = useState(null); // { userId, stories[] }
    const [showCreateModal, setShowCreateModal] = useState(false);

    // Listen to all stories from friends + current user
    useEffect(() => {
        if (!currentUser) return;

        const cutoff = new Date(Date.now() - STORY_EXPIRY_MS);

        const q = query(
            collection(db, 'stories'),
            where('createdAt', '>', cutoff),
            orderBy('createdAt', 'asc')
        );

        const unsub = onSnapshot(q, (snapshot) => {
            const allStories = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
            setStories(allStories);
        }, (err) => {
            // Silently fail - stories are non-critical
            console.warn('Stories listener error:', err);
        });

        return () => unsub();
    }, [currentUser]);

    // Group stories by user
    const storiesByUser = stories.reduce((acc, story) => {
        if (!acc[story.uid]) acc[story.uid] = [];
        acc[story.uid].push(story);
        return acc;
    }, {});

    // My stories
    const myStories = storiesByUser[currentUser.uid] || [];

    // Friend stories — simply show all stories that aren't ours
    // (If you want to STRICTLY limit to friendIds, you can change this back)
    const allOtherUids = Object.keys(storiesByUser).filter(id => id !== currentUser.uid);
    const friendStoryGroups = allOtherUids.map(uid => ({ uid, stories: storiesByUser[uid] }));

    const hasMyStory = myStories.length > 0;

    const openStories = (uid) => {
        const userStories = storiesByUser[uid];
        if (userStories?.length > 0) {
            setViewingStories({ uid, stories: userStories });
        }
    };

    const scrollRef = useRef(null);

    if (friendStoryGroups.length === 0 && myStories.length === 0 && !true /* always show "add" button */) {
        return null;
    }

    return (
        <>
            <div className="stories-bar" ref={scrollRef}>
                {/* My story / Add Story */}
                <div style={{ position: 'relative' }}>
                    <div
                        className="story-item"
                        onClick={() => hasMyStory ? openStories(currentUser.uid) : setShowCreateModal(true)}
                        title={hasMyStory ? 'View your story' : 'Add story'}
                    >
                        <div className={`story-avatar-wrapper ${hasMyStory ? 'has-story mine' : 'add-story'}`}>
                            {currentUser.photoURL ? (
                                <img src={currentUser.photoURL} className="story-avatar" alt="me" />
                            ) : (
                                <div className="story-avatar story-avatar-placeholder">
                                    {(currentUser.displayName || currentUser.email || 'M')[0].toUpperCase()}
                                </div>
                            )}
                            {/* Simple + badge always shows so users know they can add more */}
                            {!hasMyStory && <span className="story-add-badge">+</span>}
                        </div>
                        <span className="story-name">My Story</span>
                    </div>
                    {/* If they already have a story, add a separate little floating + button to add *another* one */}
                    {hasMyStory && (
                        <div
                            className="story-add-badge"
                            style={{ position: 'absolute', bottom: '20px', right: '-4px', cursor: 'pointer', zIndex: 10 }}
                            onClick={(e) => { e.stopPropagation(); setShowCreateModal(true); }}
                            title="Add another story"
                        >
                            +
                        </div>
                    )}
                </div>

                {/* Friends' stories */}
                {friendStoryGroups.map(({ uid, stories: userStories }) => {
                    const firstStory = userStories[0];
                    const allSeen = userStories.every(s => s.viewers?.includes(currentUser.uid));
                    return (
                        <div
                            key={uid}
                            className="story-item"
                            onClick={() => openStories(uid)}
                            title={`${firstStory.userName}'s story`}
                        >
                            <div className={`story-avatar-wrapper has-story ${allSeen ? 'seen' : ''}`}>
                                {firstStory.userPhoto ? (
                                    <img src={firstStory.userPhoto} className="story-avatar" alt={firstStory.userName} />
                                ) : (
                                    <div className="story-avatar story-avatar-placeholder">
                                        {(firstStory.userName || 'U')[0].toUpperCase()}
                                    </div>
                                )}
                            </div>
                            <span className="story-name">{firstStory.userName?.split(' ')[0] || 'User'}</span>
                        </div>
                    );
                })}
            </div>

            {/* Story Viewer */}
            {viewingStories && (
                <StoryViewer
                    uid={viewingStories.uid}
                    stories={viewingStories.stories}
                    onClose={() => setViewingStories(null)}
                />
            )}

            {/* Create Story Modal */}
            {showCreateModal && (
                <CreateStoryModal onClose={() => setShowCreateModal(false)} />
            )}
        </>
    );
}
