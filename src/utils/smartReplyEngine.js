/**
 * Smart Reply Engine — Client-side context-aware reply suggestions.
 * Uses pattern matching and NLP-lite heuristics to generate relevant replies.
 * Zero API calls, zero cost, instant responses.
 */

const PATTERNS = [
    // Greetings
    {
        match: /\b(hi|hey|hello|hii+|hyy*|hola|sup)\b/i,
        replies: ["Hey! How are you? 😊", "Hi there! What's up?", "Hello! 👋"]
    },
    // Good morning/evening/night
    {
        match: /\bgood\s*morning\b/i,
        replies: ["Good morning! ☀️", "Morning! How's your day?", "Good morning! 😊"]
    },
    {
        match: /\bgood\s*night\b/i,
        replies: ["Good night! 🌙", "Night! Sleep well 😴", "Good night! See you tomorrow"]
    },
    {
        match: /\bgood\s*evening\b/i,
        replies: ["Good evening! 🌆", "Evening! How was your day?", "Hey! Good evening 😊"]
    },
    {
        match: /\bgood\s*afternoon\b/i,
        replies: ["Good afternoon! ☀️", "Afternoon! What's up?", "Hey! How's your day going?"]
    },
    // How are you / What's up
    {
        match: /\b(how\s*are\s*you|how\s*r\s*u|how\s*you\s*doing|wassup|what'?s\s*up|sup|wyd)\b/i,
        replies: ["I'm doing great! You? 😊", "All good! What about you?", "Pretty good, thanks! 🙌"]
    },
    // Questions about food/lunch/dinner
    {
        match: /\b(lunch|dinner|breakfast|eaten|food|hungry|eat)\b/i,
        replies: ["Yes, just had it! 😋", "Not yet, you?", "Just about to! 🍽️"]
    },
    // Are you free / available
    {
        match: /\b(free|available|busy|occupied)\b/i,
        replies: ["Yes, I'm free!", "Give me a moment 🕐", "What's up? Tell me"]
    },
    // Where are you
    {
        match: /\b(where\s*are\s*you|where\s*r\s*u|kahan|kidhar)\b/i,
        replies: ["At home 🏠", "I'm out, what's up?", "Nearby, why?"]
    },
    // Thanks / Thank you
    {
        match: /\b(thanks|thank\s*you|thx|thnx|ty)\b/i,
        replies: ["You're welcome! 😊", "No problem at all!", "Anytime! 🙌"]
    },
    // Sorry
    {
        match: /\b(sorry|apologi[sz]e|my\s*bad)\b/i,
        replies: ["No worries! 😊", "It's all good!", "Don't worry about it 👍"]
    },
    // Yes/No questions — "Do you", "Can you", "Will you", "Are you"
    {
        match: /^(do|can|will|would|could|shall|are|is|did|have|has)\s+(you|we|i)\b/i,
        replies: ["Yes, sure! 👍", "Let me think about it", "Maybe, why?"]
    },
    // When / Time questions
    {
        match: /\b(when|what\s*time|kab)\b/i,
        replies: ["Let me check and tell you", "Soon! 🕐", "I'll let you know"]
    },
    // Invitations / Plans — "let's", "want to", "wanna"
    {
        match: /\b(let'?s|wanna|want\s*to|shall\s*we|come|join)\b/i,
        replies: ["Sounds like a plan! 🎉", "I'm in! When?", "Sure, let's do it!"]
    },
    // Congratulations / Good news
    {
        match: /\b(congrats|congratulations|awesome|amazing|great\s*news|woah|wow)\b/i,
        replies: ["That's amazing! 🎉", "So happy for you! 🥳", "Wow, that's great!"]
    },
    // Sad / Bad news
    {
        match: /\b(sad|upset|bad|terrible|awful|unfortunate|miss\s*you|worried)\b/i,
        replies: ["I'm here for you ❤️", "It'll get better 🤗", "Sending you a hug 🫂"]
    },
    // LOL / Funny
    {
        match: /\b(lol|lmao|haha|😂|rofl|funny|hilarious)\b/i,
        replies: ["😂😂😂", "That's hilarious!", "Can't stop laughing 🤣"]
    },
    // OK / Acknowledgements
    {
        match: /^(ok|okay|k|alright|sure|fine|cool|great|nice|got\s*it|hmm|ohh?|acha|accha)\s*[.!?]*$/i,
        replies: ["👍", "Anything else?", "Cool! 😊"]
    },
    // What / Tell me
    {
        match: /\b(what|tell\s*me|explain|why)\b/i,
        replies: ["Let me explain...", "Good question! 🤔", "Here's the thing..."]
    },
    // Bye / See you
    {
        match: /\b(bye|goodbye|see\s*you|cya|later|take\s*care|gtg)\b/i,
        replies: ["Bye! Take care! 👋", "See you later! 😊", "Catch you soon!"]
    },
    // Love / Affection
    {
        match: /\b(love|miss|care|❤️|💕|😘|🥰)\b/i,
        replies: ["Aww, same here! ❤️", "You're the best! 😊", "Love you too! 💕"]
    },
    // Help / Requesting something
    {
        match: /\b(help|need|please|plz|pls|favor|favour)\b/i,
        replies: ["Sure, what do you need?", "I'm here to help! 😊", "Of course, tell me!"]
    },
    // Sharing links/photos
    {
        match: /\b(check\s*this|look\s*at|see\s*this|sent\s*you|sending)\b/i,
        replies: ["Let me see! 👀", "Looks interesting!", "Thanks for sharing! 👍"]
    },
    // Wait / Hold on
    {
        match: /\b(wait|hold\s*on|one\s*sec|brb|minute)\b/i,
        replies: ["Sure, take your time! 😊", "No rush! 👍", "I'll be here"]
    },
];

// Fallback replies for unmatched messages
const CONTEXTUAL_FALLBACKS = [
    // Question-like (ends with ?)
    {
        match: /\?$/,
        replies: ["Let me think about it 🤔", "Good question!", "Hmm, I'll get back to you"]
    },
    // Exclamation (excited)
    {
        match: /!$/,
        replies: ["That's exciting! 🎉", "Wow, really?!", "Nice! Tell me more"]
    },
];

const GENERIC_FALLBACKS = [
    ["Got it! 👍", "Makes sense!", "I see 🤔"],
    ["Interesting! 😊", "Tell me more", "Okay! 👍"],
    ["Sounds good! 🙌", "Noted! 📝", "Understood!"],
    ["Right! 😊", "For sure!", "Alright! 👍"],
];

/**
 * Generate smart reply suggestions for a given message.
 * @param {string} messageText - The last received message text.
 * @param {Array} chatContext - Optional array of recent messages for context.
 * @returns {string[]} An array of 3 reply suggestions.
 */
export function generateSmartReplies(messageText, chatContext = []) {
    if (!messageText || typeof messageText !== 'string') {
        return ["👍", "Okay!", "Got it"];
    }

    const text = messageText.trim();

    // Try pattern matches first (most specific wins)
    for (const pattern of PATTERNS) {
        if (pattern.match.test(text)) {
            return [...pattern.replies];
        }
    }

    // Try contextual fallbacks
    for (const fb of CONTEXTUAL_FALLBACKS) {
        if (fb.match.test(text)) {
            return [...fb.replies];
        }
    }

    // Use generic fallbacks with some variety based on message hash
    const hash = text.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
    const idx = hash % GENERIC_FALLBACKS.length;
    return [...GENERIC_FALLBACKS[idx]];
}
