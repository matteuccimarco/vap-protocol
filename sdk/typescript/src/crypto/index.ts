/**
 * VAP Cryptographic Utilities
 *
 * Uses @noble/ed25519 and @noble/hashes for pure JS implementations.
 */

import { sha256 } from '@noble/hashes/sha256';
import { bytesToHex, hexToBytes } from '@noble/hashes/utils';
import * as ed25519 from '@noble/ed25519';
import type { Bytes32, Bytes64, VAPRecord } from '../types';

// ============================================================================
// Hashing
// ============================================================================

/**
 * Canonicalize an object for consistent hashing.
 * - Sorts object keys lexicographically
 * - No whitespace
 * - UTF-8 encoding
 */
export function canonicalize(obj: unknown): string {
  if (obj === null || obj === undefined) {
    return 'null';
  }

  if (typeof obj === 'boolean' || typeof obj === 'number') {
    return JSON.stringify(obj);
  }

  if (typeof obj === 'string') {
    return JSON.stringify(obj);
  }

  if (Array.isArray(obj)) {
    const items = obj.map((item) => canonicalize(item));
    return '[' + items.join(',') + ']';
  }

  if (typeof obj === 'object') {
    const keys = Object.keys(obj).sort();
    const pairs = keys.map((key) => {
      const value = canonicalize((obj as Record<string, unknown>)[key]);
      return `"${key}":${value}`;
    });
    return '{' + pairs.join(',') + '}';
  }

  throw new Error(`Cannot canonicalize type: ${typeof obj}`);
}

/**
 * Hash an object using SHA-256.
 * Object is first canonicalized for consistent hashing.
 */
export function hashObject(obj: unknown): Bytes32 {
  const canonical = canonicalize(obj);
  const bytes = new TextEncoder().encode(canonical);
  const hash = sha256(bytes);
  return '0x' + bytesToHex(hash);
}

/**
 * Hash a string directly using SHA-256.
 */
export function hashString(str: string): Bytes32 {
  const bytes = new TextEncoder().encode(str);
  const hash = sha256(bytes);
  return '0x' + bytesToHex(hash);
}

/**
 * Combine multiple hashes into one.
 */
export function combineHashes(...hashes: Bytes32[]): Bytes32 {
  const combined = hashes.join('');
  return hashString(combined);
}

// ============================================================================
// Signing
// ============================================================================

/**
 * Generate a new Ed25519 key pair.
 */
export async function generateKeyPair(): Promise<{
  privateKey: string;
  publicKey: string;
}> {
  const privateKey = ed25519.utils.randomPrivateKey();
  const publicKey = await ed25519.getPublicKeyAsync(privateKey);

  return {
    privateKey: '0x' + bytesToHex(privateKey),
    publicKey: '0x' + bytesToHex(publicKey),
  };
}

/**
 * Get public key from private key.
 */
export async function getPublicKey(privateKey: string): Promise<string> {
  const privateBytes = hexToBytes(privateKey.replace('0x', ''));
  const publicKey = await ed25519.getPublicKeyAsync(privateBytes);
  return '0x' + bytesToHex(publicKey);
}

/**
 * Sign a message with Ed25519.
 */
export async function sign(message: Bytes32, privateKey: string): Promise<Bytes64> {
  const messageBytes = hexToBytes(message.replace('0x', ''));
  const privateBytes = hexToBytes(privateKey.replace('0x', ''));

  const signature = await ed25519.signAsync(messageBytes, privateBytes);
  return '0x' + bytesToHex(signature);
}

/**
 * Verify an Ed25519 signature.
 */
export async function verify(
  message: Bytes32,
  signature: Bytes64,
  publicKey: string,
): Promise<boolean> {
  try {
    const messageBytes = hexToBytes(message.replace('0x', ''));
    const signatureBytes = hexToBytes(signature.replace('0x', ''));
    const publicBytes = hexToBytes(publicKey.replace('0x', ''));

    return await ed25519.verifyAsync(signatureBytes, messageBytes, publicBytes);
  } catch {
    return false;
  }
}

// ============================================================================
// Record Operations
// ============================================================================

/**
 * Fields to exclude when computing record ID.
 */
const EXCLUDED_FIELDS = ['recordId', 'signature'];

/**
 * Compute the record ID (hash of all fields except signature and recordId).
 */
export function computeRecordId(record: Omit<VAPRecord, 'recordId' | 'signature'>): Bytes32 {
  const filtered: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(record)) {
    if (!EXCLUDED_FIELDS.includes(key) && value !== undefined) {
      filtered[key] = value;
    }
  }

  return hashObject(filtered);
}

/**
 * Sign a VAP record.
 */
export async function signRecord(
  record: Omit<VAPRecord, 'signature'>,
  privateKey: string,
): Promise<VAPRecord> {
  const recordId = record.recordId || computeRecordId(record);
  const signature = await sign(recordId, privateKey);

  return {
    ...record,
    recordId,
    signature,
  } as VAPRecord;
}

/**
 * Verify a VAP record signature.
 */
export async function verifyRecordSignature(
  record: VAPRecord,
  publicKey: string,
): Promise<boolean> {
  if (!record.signature) {
    return false;
  }

  // Recompute record ID to ensure it matches
  const computedId = computeRecordId(record);
  if (computedId !== record.recordId) {
    return false;
  }

  return verify(record.recordId, record.signature, publicKey);
}

// ============================================================================
// Agent ID Generation
// ============================================================================

/**
 * Generate an agent ID from operator address and nonce.
 */
export function generateAgentId(operator: string, nonce: string): Bytes32 {
  return hashObject({ operator, nonce });
}

/**
 * Generate a random nonce.
 */
export function generateNonce(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return '0x' + bytesToHex(bytes);
}
