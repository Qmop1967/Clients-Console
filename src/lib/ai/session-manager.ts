// ============================================
// TSH Clients Console - AI Session Manager
// Manages conversation state in Redis
// ============================================

import { Redis } from '@upstash/redis';
import { nanoid } from 'nanoid';

// Initialize Upstash Redis client for AI session management
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

// ============================================
// Types
// ============================================

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
}

export interface ChatSession {
  sessionId: string;
  userId?: string; // Optional: for authenticated users
  messages: Message[];
  createdAt: number;
  lastActivity: number;
  metadata?: {
    priceListId?: string;
    currencyCode?: string;
  };
}

// ============================================
// Configuration
// ============================================

const SESSION_TTL = parseInt(process.env.AI_SESSION_TTL || '1800'); // 30 minutes default
const SESSION_PREFIX = 'ai:session:';
const MAX_MESSAGES_PER_SESSION = 50; // Prevent unbounded growth

// ============================================
// Session Management
// ============================================

/**
 * Create a new chat session
 */
export async function createSession(
  userId?: string,
  metadata?: ChatSession['metadata']
): Promise<string> {
  const sessionId = nanoid(16); // Short, URL-safe ID
  const now = Date.now();

  const session: ChatSession = {
    sessionId,
    userId,
    messages: [],
    createdAt: now,
    lastActivity: now,
    metadata,
  };

  await redis.set(
    `${SESSION_PREFIX}${sessionId}`,
    session,
    { ex: SESSION_TTL }
  );

  console.log(`✅ Created session: ${sessionId} (user: ${userId || 'anonymous'})`);
  return sessionId;
}

/**
 * Get session by ID
 */
export async function getSession(sessionId: string): Promise<ChatSession | null> {
  try {
    const data = await redis.get<ChatSession>(`${SESSION_PREFIX}${sessionId}`);

    if (!data) {
      return null;
    }

    return data;
  } catch (error) {
    console.error(`❌ Failed to get session ${sessionId}:`, error);
    return null;
  }
}

/**
 * Save message to session
 */
export async function saveMessage(
  sessionId: string,
  role: Message['role'],
  content: string
): Promise<void> {
  try {
    const session = await getSession(sessionId);

    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    const message: Message = {
      id: nanoid(12),
      role,
      content,
      timestamp: Date.now(),
    };

    session.messages.push(message);
    session.lastActivity = Date.now();

    // Enforce message limit (keep most recent)
    if (session.messages.length > MAX_MESSAGES_PER_SESSION) {
      session.messages = session.messages.slice(-MAX_MESSAGES_PER_SESSION);
    }

    await redis.set(
      `${SESSION_PREFIX}${sessionId}`,
      session,
      { ex: SESSION_TTL }
    );

    console.log(`✅ Saved ${role} message to session ${sessionId}`);
  } catch (error) {
    console.error(`❌ Failed to save message to session ${sessionId}:`, error);
    throw error;
  }
}

/**
 * Get conversation history for session
 */
export async function getConversationHistory(
  sessionId: string
): Promise<Message[]> {
  try {
    const session = await getSession(sessionId);

    if (!session) {
      return [];
    }

    return session.messages;
  } catch (error) {
    console.error(`❌ Failed to get conversation history for ${sessionId}:`, error);
    return [];
  }
}

/**
 * Update session metadata
 */
export async function updateSessionMetadata(
  sessionId: string,
  metadata: ChatSession['metadata']
): Promise<void> {
  try {
    const session = await getSession(sessionId);

    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    session.metadata = { ...session.metadata, ...metadata };
    session.lastActivity = Date.now();

    await redis.set(
      `${SESSION_PREFIX}${sessionId}`,
      session,
      { ex: SESSION_TTL }
    );

    console.log(`✅ Updated metadata for session ${sessionId}`);
  } catch (error) {
    console.error(`❌ Failed to update session metadata ${sessionId}:`, error);
    throw error;
  }
}

/**
 * Clear session (delete all messages)
 */
export async function clearSession(sessionId: string): Promise<void> {
  try {
    await redis.del(`${SESSION_PREFIX}${sessionId}`);
    console.log(`✅ Cleared session: ${sessionId}`);
  } catch (error) {
    console.error(`❌ Failed to clear session ${sessionId}:`, error);
    throw error;
  }
}

/**
 * Extend session TTL (keep alive)
 */
export async function extendSession(sessionId: string): Promise<void> {
  try {
    const session = await getSession(sessionId);

    if (!session) {
      console.warn(`⚠️ Session ${sessionId} not found, cannot extend`);
      return;
    }

    session.lastActivity = Date.now();

    await redis.set(
      `${SESSION_PREFIX}${sessionId}`,
      session,
      { ex: SESSION_TTL }
    );

    console.log(`✅ Extended session TTL: ${sessionId}`);
  } catch (error) {
    console.error(`❌ Failed to extend session ${sessionId}:`, error);
    // Don't throw - extension failures are not critical
  }
}

/**
 * Get session statistics
 */
export async function getSessionStats(sessionId: string): Promise<{
  messageCount: number;
  age: number; // in seconds
  lastActivity: number; // timestamp
} | null> {
  try {
    const session = await getSession(sessionId);

    if (!session) {
      return null;
    }

    const now = Date.now();

    return {
      messageCount: session.messages.length,
      age: Math.floor((now - session.createdAt) / 1000),
      lastActivity: session.lastActivity,
    };
  } catch (error) {
    console.error(`❌ Failed to get session stats ${sessionId}:`, error);
    return null;
  }
}

/**
 * Clean up old sessions (manual cleanup)
 * Note: Redis TTL handles automatic cleanup
 */
export async function cleanupExpiredSessions(): Promise<number> {
  try {
    // This is handled automatically by Redis TTL
    // This function is a placeholder for manual cleanup if needed
    console.log('ℹ️ Session cleanup handled automatically by Redis TTL');
    return 0;
  } catch (error) {
    console.error('❌ Failed to cleanup sessions:', error);
    return 0;
  }
}

// ============================================
// Helper Functions
// ============================================

/**
 * Format conversation history for LLM
 */
export function formatMessagesForLLM(messages: Message[]): Array<{
  role: 'user' | 'assistant' | 'system';
  content: string;
}> {
  return messages.map((msg) => ({
    role: msg.role,
    content: msg.content,
  }));
}

/**
 * Get recent messages (for context window management)
 */
export function getRecentMessages(messages: Message[], count: number = 10): Message[] {
  return messages.slice(-count);
}

/**
 * Calculate token estimate (rough approximation)
 */
export function estimateTokens(messages: Message[]): number {
  // Rough estimate: 1 token ≈ 4 characters for English, 2 characters for Arabic
  const totalChars = messages.reduce((sum, msg) => sum + msg.content.length, 0);
  return Math.ceil(totalChars / 3); // Conservative estimate
}
