import { describe, it, expect } from 'vitest';
import {
  canonicalize,
  hashObject,
  hashString,
  generateKeyPair,
  getPublicKey,
  sign,
  verify,
  computeRecordId,
  signRecord,
  verifyRecordSignature,
  generateAgentId,
  generateNonce,
} from './index.js';
import type { VAPRecord } from '../types/index.js';

describe('Crypto Utilities', () => {
  describe('canonicalize', () => {
    it('should sort object keys', () => {
      const result = canonicalize({ b: 1, a: 2 });
      expect(result).toBe('{"a":2,"b":1}');
    });

    it('should handle nested objects', () => {
      const result = canonicalize({ b: { d: 1, c: 2 }, a: 3 });
      expect(result).toBe('{"a":3,"b":{"c":2,"d":1}}');
    });

    it('should handle arrays', () => {
      const result = canonicalize([3, 1, 2]);
      expect(result).toBe('[3,1,2]');
    });

    it('should handle null', () => {
      expect(canonicalize(null)).toBe('null');
    });

    it('should handle strings', () => {
      expect(canonicalize('hello')).toBe('"hello"');
    });

    it('should handle numbers', () => {
      expect(canonicalize(42)).toBe('42');
    });

    it('should handle booleans', () => {
      expect(canonicalize(true)).toBe('true');
      expect(canonicalize(false)).toBe('false');
    });
  });

  describe('hashing', () => {
    it('should produce consistent hashes for same input', () => {
      const hash1 = hashObject({ a: 1, b: 2 });
      const hash2 = hashObject({ b: 2, a: 1 });
      expect(hash1).toBe(hash2);
    });

    it('should produce different hashes for different input', () => {
      const hash1 = hashObject({ a: 1 });
      const hash2 = hashObject({ a: 2 });
      expect(hash1).not.toBe(hash2);
    });

    it('should produce 32-byte hash (64 hex chars + 0x)', () => {
      const hash = hashString('test');
      expect(hash).toMatch(/^0x[a-f0-9]{64}$/);
    });
  });

  describe('key generation', () => {
    it('should generate valid key pair', async () => {
      const { privateKey, publicKey } = await generateKeyPair();

      expect(privateKey).toMatch(/^0x[a-f0-9]{64}$/);
      expect(publicKey).toMatch(/^0x[a-f0-9]{64}$/);
    });

    it('should derive public key from private key', async () => {
      const { privateKey, publicKey } = await generateKeyPair();
      const derivedPublic = await getPublicKey(privateKey);

      expect(derivedPublic).toBe(publicKey);
    });
  });

  describe('signing and verification', () => {
    it('should sign and verify a message', async () => {
      const { privateKey, publicKey } = await generateKeyPair();
      const message = hashString('test message');

      const signature = await sign(message, privateKey);
      expect(signature).toMatch(/^0x[a-f0-9]{128}$/);

      const isValid = await verify(message, signature, publicKey);
      expect(isValid).toBe(true);
    });

    it('should reject invalid signature', async () => {
      const { publicKey } = await generateKeyPair();
      const { privateKey: otherKey } = await generateKeyPair();

      const message = hashString('test message');
      const signature = await sign(message, otherKey);

      const isValid = await verify(message, signature, publicKey);
      expect(isValid).toBe(false);
    });

    it('should reject tampered message', async () => {
      const { privateKey, publicKey } = await generateKeyPair();

      const message1 = hashString('original');
      const message2 = hashString('tampered');

      const signature = await sign(message1, privateKey);

      const isValid = await verify(message2, signature, publicKey);
      expect(isValid).toBe(false);
    });
  });

  describe('record operations', () => {
    it('should compute consistent record ID', () => {
      const record = {
        version: 1,
        agentId: '0x' + '1'.repeat(64),
        operator: '0x' + '2'.repeat(40),
        actionType: 'SWAP' as const,
        actionData: { amount: 100 },
        inputHash: '0x' + '3'.repeat(64),
        reasoningHash: '0x' + '4'.repeat(64),
        outputHash: '0x' + '5'.repeat(64),
        modelId: 'test-model',
        constraints: [],
        timestamp: 1234567890000,
        prevRecord: null,
        sequence: 1,
      };

      const id1 = computeRecordId(record);
      const id2 = computeRecordId(record);

      expect(id1).toBe(id2);
      expect(id1).toMatch(/^0x[a-f0-9]{64}$/);
    });

    it('should sign and verify a record', async () => {
      const { privateKey, publicKey } = await generateKeyPair();

      // Don't include recordId - it will be computed by signRecord
      const recordData = {
        version: 1,
        agentId: '0x' + '1'.repeat(64),
        operator: publicKey,
        actionType: 'SWAP' as const,
        actionData: { amount: 100 },
        inputHash: '0x' + '3'.repeat(64),
        reasoningHash: '0x' + '4'.repeat(64),
        outputHash: '0x' + '5'.repeat(64),
        modelId: 'test-model',
        constraints: [] as const,
        timestamp: Date.now(),
        prevRecord: null,
        sequence: 1,
      };

      const signedRecord = await signRecord(recordData as Omit<VAPRecord, 'signature'>, privateKey);

      expect(signedRecord.signature).toBeDefined();
      expect(signedRecord.recordId).toMatch(/^0x[a-f0-9]{64}$/);

      const isValid = await verifyRecordSignature(signedRecord, publicKey);
      expect(isValid).toBe(true);
    });
  });

  describe('agent ID generation', () => {
    it('should generate consistent agent ID', () => {
      const operator = '0x' + '1'.repeat(40);
      const nonce = '0x' + '2'.repeat(64);

      const id1 = generateAgentId(operator, nonce);
      const id2 = generateAgentId(operator, nonce);

      expect(id1).toBe(id2);
    });

    it('should generate unique nonces', () => {
      const nonce1 = generateNonce();
      const nonce2 = generateNonce();

      expect(nonce1).not.toBe(nonce2);
      expect(nonce1).toMatch(/^0x[a-f0-9]{64}$/);
    });
  });
});
