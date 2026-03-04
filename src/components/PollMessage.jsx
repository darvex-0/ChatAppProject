import { useAuth } from '../context/AuthContext';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../services/firebase';

const BAR_COLORS = [
    '#6366f1', '#8b5cf6', '#ec4899', '#10b981', '#f59e0b'
];

export default function PollMessage({ msg, chatId }) {
    const { currentUser } = useAuth();
    const { pollData } = msg;

    if (!pollData) return null;

    const { question, options, votes } = pollData;

    // Count votes per option
    const voteCounts = options.map((_, i) => (votes?.[i]?.length || 0));
    const totalVotes = voteCounts.reduce((a, b) => a + b, 0);

    // Check what the current user voted for
    const myVoteIndex = options.findIndex((_, i) => votes?.[i]?.includes(currentUser.uid));
    const hasVoted = myVoteIndex !== -1;

    const handleVote = async (optionIndex) => {
        try {
            const msgRef = doc(db, 'chats', chatId, 'messages', msg.id);

            // Build vote updates
            const updateData = {};

            if (myVoteIndex === optionIndex) {
                // Toggle off — remove my vote
                const currentVoters = votes?.[optionIndex] || [];
                updateData[`pollData.votes.${optionIndex}`] = currentVoters.filter(uid => uid !== currentUser.uid);
            } else {
                // Remove old vote if exists
                if (myVoteIndex !== -1) {
                    const oldVoters = votes?.[myVoteIndex] || [];
                    updateData[`pollData.votes.${myVoteIndex}`] = oldVoters.filter(uid => uid !== currentUser.uid);
                }
                // Add new vote
                const currentVoters = votes?.[optionIndex] || [];
                updateData[`pollData.votes.${optionIndex}`] = [...currentVoters, currentUser.uid];
            }

            await updateDoc(msgRef, updateData);
        } catch (e) {
            console.error('Error voting:', e);
        }
    };

    return (
        <div className="poll-message">
            <div className="poll-header">
                <span className="poll-icon">📊</span>
                <span className="poll-label">Poll</span>
            </div>
            <p className="poll-question">{question}</p>

            <div className="poll-options">
                {options.map((option, i) => {
                    const count = voteCounts[i];
                    const pct = totalVotes === 0 ? 0 : Math.round((count / totalVotes) * 100);
                    const isMyVote = myVoteIndex === i;
                    const barColor = BAR_COLORS[i % BAR_COLORS.length];

                    return (
                        <button
                            key={i}
                            className={`poll-option ${isMyVote ? 'my-vote' : ''}`}
                            onClick={() => handleVote(i)}
                        >
                            <div className="poll-option-bar" style={{ width: `${pct}%`, background: barColor + '40' }} />
                            <div className="poll-option-content">
                                <div className="poll-option-left">
                                    <span className={`poll-vote-check ${isMyVote ? 'checked' : ''}`}>
                                        {isMyVote ? '✓' : '○'}
                                    </span>
                                    <span className="poll-option-text">{option}</span>
                                </div>
                                <div className="poll-option-right">
                                    <span className="poll-option-pct">{pct}%</span>
                                    <span className="poll-option-count">({count})</span>
                                </div>
                            </div>
                        </button>
                    );
                })}
            </div>

            <p className="poll-footer">
                {totalVotes} {totalVotes === 1 ? 'vote' : 'votes'}
                {hasVoted && <span className="poll-voted-badge"> · ✓ Voted</span>}
            </p>
        </div>
    );
}
