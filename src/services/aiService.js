import { httpsCallable } from 'firebase/functions';
import { cloudFunctions } from './firebase';
import { generateSmartReplies as generateStaticReplies } from '../utils/smartReplyEngine';

/**
 * AI Service — Unified interface for AI features with multi-layer fallback:
 * 1. Local AI (FastAPI + Ollama)
 * 2. Cloud AI (Firebase Cloud Functions / Google Gemini)
 * 3. Static Engine (Regex pattern matching)
 */

const getAIBaseUrl = () => {
    return localStorage.getItem('custom_ai_base_url') || import.meta.env.VITE_AI_BASE_URL || 'http://localhost:8000';
};

const isLocalAIEnabled = () => {
    return localStorage.getItem('local_ai_enabled') === 'true';
};

/**
 * Check if the local AI server is reachable and running our engine
 */
export async function isAIServerAvailable() {
    if (!isLocalAIEnabled()) return false;
    try {
        const url = getAIBaseUrl();
        const res = await fetch(`${url}/`, { 
            signal: AbortSignal.timeout(2000),
            headers: { 'ngrok-skip-browser-warning': 'true' }
        });
        if (res.ok) {
            const data = await res.json();
            return data.status === 'ok' && data.engine === 'ConnectHub AI';
        }
        return false;
    } catch {
        return false;
    }
}

/**
 * Generate 3 smart reply suggestions for an incoming message
 * @param {string} messageText - The incoming message text
 * @param {Array} chatContext - Optional array of { sender, text } context messages
 * @returns {string[]} Array of 3 replies
 */
export async function fetchSmartReplies(messageText, chatContext = []) {
    // Layer 1: Local AI (Zero cost, maximum privacy)
    if (isLocalAIEnabled()) {
        try {
            const url = getAIBaseUrl();
            const res = await fetch(`${url}/api/smart-reply`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'ngrok-skip-browser-warning': 'true'
                },
                body: JSON.stringify({ messageText, chatContext }),
                signal: AbortSignal.timeout(3000)
            });
            if (res.ok) {
                const data = await res.json();
                if (data.replies && Array.isArray(data.replies)) {
                    return data.replies;
                }
            }
        } catch (e) {
            console.log("Local AI unavailable, falling back to Gemini...");
        }
    }

    // Layer 2: Cloud AI (Gemini via Firebase Cloud Functions)
    try {
        const genSmartReplies = httpsCallable(cloudFunctions, 'generateSmartReplies');
        const result = await genSmartReplies({ messageText, chatContext });
        if (result.data && result.data.replies && Array.isArray(result.data.replies)) {
            return result.data.replies;
        }
    } catch (e) {
        console.error("Gemini AI failed, using static engine fallback...");
    }

    // Layer 3: Static Engine (Instant patterns, offline-safe)
    return generateStaticReplies(messageText, chatContext);
}

/**
 * Rephrase a draft message to sound polished and professional
 * @param {string} text - The draft message to rephrase
 * @returns {string|null} The rephrased text, or null on failure
 */
export async function fetchRephrase(text) {
    // Try Local AI
    if (isLocalAIEnabled()) {
        try {
            const url = getAIBaseUrl();
            const res = await fetch(`${url}/api/rephrase`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'ngrok-skip-browser-warning': 'true'
                },
                body: JSON.stringify({ text }),
                signal: AbortSignal.timeout(5000)
            });
            if (res.ok) {
                const data = await res.json();
                return data.rephrased || null;
            }
        } catch (e) {
            console.log("Local Rephrase unavailable, falling back to Gemini...");
        }
    }

    // Layer 2: Cloud AI (Gemini via Firebase Cloud Functions)
    try {
        const genRephrase = httpsCallable(cloudFunctions, 'generateRephrase');
        const result = await genRephrase({ text });
        if (result.data && result.data.rephrased) {
            return result.data.rephrased;
        }
    } catch (e) {
        console.error("Gemini Rephrase failed:", e);
    }

    return null;
}

/**
 * Summarize a conversation from an array of messages
 * @param {Array} messages - Array of { senderName, text } messages
 * @returns {string|null} The summary text, or null on failure
 */
export async function fetchSummary(messages) {
    // Try Local AI
    if (isLocalAIEnabled()) {
        try {
            const url = getAIBaseUrl();
            const res = await fetch(`${url}/api/summarize`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'ngrok-skip-browser-warning': 'true'
                },
                body: JSON.stringify({ messages }),
                signal: AbortSignal.timeout(10000)
            });
            if (res.ok) {
                const data = await res.json();
                return data.summary || null;
            }
        } catch (e) {
            console.log("Local Summarize unavailable, falling back to Gemini...");
        }
    }

    // Layer 2: Cloud AI (Gemini via Firebase Cloud Functions)
    try {
        const genSummary = httpsCallable(cloudFunctions, 'generateSummary');
        const result = await genSummary({ messages });
        if (result.data && result.data.summary) {
            return result.data.summary;
        }
    } catch (e) {
        console.error("Gemini Summarize failed:", e);
    }

    return null;
}
