/**
 * Auth barrel file - NextAuth exports and utilities
 */

export { auth, signIn, signOut, GET, POST } from './auth';
export { authConfig } from './auth.config';
export { validateDebugAuth, DEFAULT_DEBUG_SECRET } from './debug-auth';
