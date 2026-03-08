import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { doc, updateDoc, arrayUnion, arrayRemove, increment } from 'firebase/firestore';
import { db } from '../services/firebase';

const BAR_COLORS = [
    'linear-gradient(90deg, #6366f1, #818cf8)',
    'linear-gradient(90deg, #8b5cf6, #a78bfa)',
    'linear-gradient(90deg, #ec4899, #f472b6)',
    'linear-gradient(90deg, #10b981, #34d399)',
    'linear-gradient(90deg, #f59e0b, #fbbf24)'
];

export default function PollMessage({ msg, chatId }) {
    const { currentUser } = useAuth();
    const { pollData } = msg;
    const [timeLeft, setTimeLeft] = useState('');

    useEffect(() => {
        if (!pollData?.settings?.expiresAt) return;

        const updateTimer = () => {
            const now = Date.now();
            const expiry = pollData.settings.expiresAt.toMillis ? pollData.settings.expiresAt.toMillis() : new Date(pollData.settings.expiresAt).getTime();
            const diff = expiry - now;

            if (diff <= 0) {
                setTimeLeft('Poll ended');
                return;
            }

            const hours = Math.floor(diff / (1000 * 60 * 60));
            const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
            const secs = Math.floor((diff % (1000 * 60)) / 1000);

            if (hours > 24) {
                setTimeLeft(`${Math.floor(hours / 24)}d left`);
            } else if (hours > 0) {
                setTimeLeft(`${hours}h ${mins}m left`);
            } else {
                setTimeLeft(`${mins}m ${secs}s left`);
            }
        };

        const timer = setInterval(updateTimer, 1000);
        updateTimer();
        return () => clearInterval(timer);
    }, [pollData?.settings?.expiresAt]);

    if (!pollData) return null;

    const { question, options = [], settings = {}, totalVotes = 0 } = pollData;
    const isExpired = timeLeft === 'Poll ended';

    // Firestore sometimes converts arrays to objects upon nested key updates
    let optionsArray = options;
    if (options && typeof options === 'object' && !Array.isArray(options)) {
        optionsArray = Object.keys(options)
            .sort((a, b) => Number(a) - Number(b))
            .map(k => options[k]);
    } else if (!Array.isArray(options)) {
        optionsArray = [];
    }

    // Normalize options for backward compatibility
    const normalizedOptions = optionsArray.map((opt, i) => {
        if (typeof opt === 'string') {
            return {
                text: opt,
                image: null,
                votes: pollData.votes?.[i] || []
            };
        }
        return {
            ...opt,
            votes: opt.votes || []
        };
    });

    const handleVote = async (optionIndex) => {
        if (isExpired || normalizedOptions.length === 0) return;

        try {
            const msgRef = doc(db, 'chats', chatId, 'messages', msg.id);
            const currentOption = normalizedOptions[optionIndex];
            const hasVotedThis = currentOption.votes.includes(currentUser.uid);

            let newOptions = [...normalizedOptions];
            let newTotalVotes = totalVotes; // default if not tracked locally accurately

            if (settings?.multipleAnswers) {
                if (hasVotedThis) {
                    newOptions[optionIndex] = { ...currentOption, votes: currentOption.votes.filter(uid => uid !== currentUser.uid) };
                    newTotalVotes = Math.max(0, newTotalVotes - 1);
                } else {
                    newOptions[optionIndex] = { ...currentOption, votes: [...currentOption.votes, currentUser.uid] };
                    newTotalVotes++;
                }
            } else {
                const previousVoteIndex = normalizedOptions.findIndex(opt => opt.votes.includes(currentUser.uid));
                if (previousVoteIndex === optionIndex) {
                    newOptions[optionIndex] = { ...currentOption, votes: currentOption.votes.filter(uid => uid !== currentUser.uid) };
                    newTotalVotes = Math.max(0, newTotalVotes - 1);
                } else {
                    if (previousVoteIndex !== -1) {
                        newOptions[previousVoteIndex] = {
                            ...normalizedOptions[previousVoteIndex],
                            votes: normalizedOptions[previousVoteIndex].votes.filter(uid => uid !== currentUser.uid)
                        };
                    } else {
                        newTotalVotes++;
                    }
                    newOptions[optionIndex] = { ...currentOption, votes: [...currentOption.votes, currentUser.uid] };
                }
            }

            // Write back entire arrays to prevent Firestore converting 'options' into a map
            await updateDoc(msgRef, {
                'pollData.options': newOptions,
                'pollData.totalVotes': newTotalVotes
            });
        } catch (e) {
            console.error('Error voting:', e);
        }
    };

    return (
        <div className={`poll-message ${isExpired ? 'poll-expired' : ''}`}>
            <div className="poll-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span className="poll-icon">📊</span>
                    <div>
                        <span className="poll-label">Poll</span>
                        {settings?.anonymous && <span className="poll-meta-badge">Anonymous</span>}
                        {settings?.multipleAnswers && <span className="poll-meta-badge">Multiple</span>}
                    </div>
                </div>
                {timeLeft && <span className={`poll-timer ${isExpired ? 'expired' : ''}`}>{timeLeft}</span>}
            </div>

            <p className="poll-question">{question}</p>

            <div className="poll-options">
                {normalizedOptions.length > 0 && normalizedOptions.map((option, i) => {
                    const votesCount = option.votes?.length || 0;
                    const pct = totalVotes === 0 ? 0 : Math.round((votesCount / totalVotes) * 100);
                    const isMyVote = option.votes?.includes(currentUser.uid);
                    const barColor = BAR_COLORS[i % BAR_COLORS.length];

                    return (
                        <button
                            key={i}
                            className={`poll-option ${isMyVote ? 'my-vote' : ''} ${option.image ? 'has-image' : ''}`}
                            onClick={() => handleVote(i)}
                            disabled={isExpired}
                        >
                            {option.image && (
                                <div className="poll-option-image-wrapper">
                                    <img src={option.image} alt="" className="poll-option-image" />
                                </div>
                            )}
                            <div className="poll-option-main">
                                <div className="poll-option-bar" style={{
                                    width: `${pct}%`,
                                    background: barColor,
                                    opacity: isMyVote ? 0.4 : 0.2,
                                    transition: 'width 0.6s cubic-bezier(0.4, 0, 0.2, 1)'
                                }} />
                                <div className="poll-option-content">
                                    <div className="poll-option-left">
                                        <div className={`poll-circle ${isMyVote ? 'checked' : ''}`}>
                                            {isMyVote && <div className="poll-circle-inner" />}
                                        </div>
                                        <span className="poll-option-text">{option.text || `Option ${i + 1}`}</span>
                                    </div>
                                    <div className="poll-option-right">
                                        <span className="poll-option-pct">{pct}%</span>
                                    </div>
                                </div>
                            </div>
                        </button>
                    );
                })}
            </div>

            <div className="poll-footer">
                <div className="poll-voter-faces">
                    {/* Placeholder for voter faces if not anonymous */}
                    {!settings.anonymous && totalVotes > 0 && (
                        <div className="voter-avatars">
                            {/* This would ideally list unique avatars from votes. 
                                For simplicity, we just show a count for now */}
                        </div>
                    )}
                    <span className="poll-vote-count">
                        {totalVotes} {totalVotes === 1 ? 'vote' : 'votes'}
                    </span>
                </div>
                {hasVotedAny(normalizedOptions, currentUser.uid) && <span className="voted-label">You voted</span>}
            </div>
        </div>
    );
}

function hasVotedAny(options, userId) {
    if (!Array.isArray(options)) return false;
    return options.some(opt => opt.votes?.includes(userId));
}

