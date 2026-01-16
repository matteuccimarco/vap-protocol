/**
 * VAP SDK - Verifiable Agent Protocol
 *
 * Cryptographic audit trails for AI agents.
 *
 * @packageDocumentation
 */

// Types
export * from './types';

// Crypto utilities
export * from './crypto';

// Client
export { VAP, InMemoryStorage } from './client';
export type { StorageBackend } from './client';
