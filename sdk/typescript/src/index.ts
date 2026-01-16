/**
 * VAP SDK - Verifiable Agent Protocol
 *
 * Cryptographic audit trails for AI agents.
 *
 * @packageDocumentation
 */

// Types
export * from './types/index.js';

// Crypto utilities
export * from './crypto/index.js';

// Client
export { VAP, InMemoryStorage } from './client/index.js';
export type { StorageBackend } from './client/index.js';
