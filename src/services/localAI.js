/**
 * Local AI Service — Connects to the Python FastAPI + Ollama backend
 * Base URL defaults to localhost:8000 (local development)
 */

const AI_BASE_URL = 'http://localhost:8000';

/**
 * Check if the local AI server is reachable
 */
export async function isAIServerAvailable() {
    try {
        const res = await fetch(`${AI_BASE_URL}/`, { signal: AbortSignal.timeout(2000) });
        return res.ok;
    } catch {
        return false;
    }
}

/**
 * Generate 3 smart reply suggestions for an incoming message
 * @param {string} messageText - The incoming message text
 * @param {Array} chatContext - Optional array of { sender, text } context messages
 * @returns {string[]|null} Array of 3 replies, or null on failure
 */
export async function fetchSmartReplies(messageText, chatContext = []) {
    try {
        const res = await fetch(`${AI_BASE_URL}/api/smart-reply`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ messageText, chatContext }),
        });
        if (!res.ok) return null;
        const data = await res.json();
        return data.replies || null;
    } catch {
        return null;
    }
}

/**
 * Rephrase a draft message to sound polished and professional
 * @param {string} text - The draft message to rephrase
 * @returns {string|null} The rephrased text, or null on failure
 */
export async function fetchRephrase(text) {
    try {
        const res = await fetch(`${AI_BASE_URL}/api/rephrase`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text }),
        });
        if (!res.ok) return null;
        const data = await res.json();
        return data.rephrased || null;
    } catch {
        return null;
    }
}

/**
 * Summarize a conversation from an array of messages
 * @param {Array} messages - Array of { senderName, text } messages
 * @returns {string|null} The summary text, or null on failure
 */
export async function fetchSummary(messages) {
    try {
        const res = await fetch(`${AI_BASE_URL}/api/summarize`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ messages }),
        });
        if (!res.ok) return null;
        const data = await res.json();
        return data.summary || null;
    } catch {
        return null;
    }
}
