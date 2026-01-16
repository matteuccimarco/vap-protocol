import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SlimStorageBackend } from './slim.js';
import type { VAPRecord, AgentRegistration } from '../types/index.js';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('SlimStorageBackend', () => {
  let storage: SlimStorageBackend;

  beforeEach(() => {
    mockFetch.mockReset();
    storage = new SlimStorageBackend('http://localhost:3100');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('SLIM-RPC encoding', () => {
    it('should encode a simple request in SLIM format', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => '{1.0|0x123|#1}',
      });

      await storage.getBlockNumber();

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3100/slim',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/slim-rpc',
          },
          body: expect.stringMatching(/^\{1\.0\|eth_blockNumber\|/),
        }),
      );
    });

    it('should fall back to JSON format when configured', async () => {
      const jsonStorage = new SlimStorageBackend({
        endpoint: 'http://localhost:3100',
        useSlimFormat: false,
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => '{"jsonrpc":"2.0","result":"0x123","id":1}',
      });

      await jsonStorage.getBlockNumber();

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3100/json',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
        }),
      );
    });
  });

  describe('SLIM-RPC parsing', () => {
    it('should parse simple result', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => '{1.0|#123456|#1}',
      });

      const result = await storage.getBlockNumber();
      expect(result).toBe(123456n);
    });

    it('should parse hex string result', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => '{1.0|0x1e240|#1}',
      });

      const result = await storage.getChainId();
      expect(result).toBe(123456n);
    });

    it('should handle null result', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => '{1.0|!null|#1}',
      });

      const result = await storage.getRecord('0x' + '1'.repeat(64));
      expect(result).toBeNull();
    });

    it('should parse error response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => '{1.0|!error|{code:#-32600,message:Invalid request}|#1}',
      });

      await expect(storage.getBlockNumber()).rejects.toThrow('SLIM-RPC error -32600');
    });
  });

  describe('submitRecord', () => {
    it('should submit a record and return recordId', async () => {
      const recordId = '0x' + '1'.repeat(64);
      const txHash = '0x' + '2'.repeat(64);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => `{1.0|{recordId:${recordId},txHash:${txHash}}|#1}`,
      });

      const record: VAPRecord = {
        version: 1,
        recordId,
        agentId: '0x' + '3'.repeat(64),
        operator: '0x' + '4'.repeat(40),
        actionType: 'SWAP',
        actionData: { amount: 100 },
        inputHash: '0x' + '5'.repeat(64),
        reasoningHash: '0x' + '6'.repeat(64),
        outputHash: '0x' + '7'.repeat(64),
        modelId: 'test-model',
        constraints: [],
        timestamp: Date.now(),
        prevRecord: null,
        sequence: 1,
        signature: '0x' + '8'.repeat(128),
      };

      const result = await storage.submitRecord(record);

      expect(result.recordId).toBe(recordId);
      expect(result.txHash).toBe(txHash);
    });
  });

  describe('getRecord', () => {
    it('should retrieve a record by ID', async () => {
      const recordId = '0x' + '1'.repeat(64);
      const mockRecord = {
        version: '#1',
        recordId,
        agentId: '0x' + '3'.repeat(64),
        operator: '0x' + '4'.repeat(40),
        actionType: 'SWAP',
        actionData: '{amount:#100}',
        inputHash: '0x' + '5'.repeat(64),
        reasoningHash: '0x' + '6'.repeat(64),
        outputHash: '0x' + '7'.repeat(64),
        modelId: 'test-model',
        constraints: '@[]',
        timestamp: '#1705123456000',
        prevRecord: '!null',
        sequence: '#1',
        signature: '0x' + '8'.repeat(128),
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () =>
          `{1.0|{version:#1,recordId:${recordId},agentId:${'0x' + '3'.repeat(64)},operator:${'0x' + '4'.repeat(40)},actionType:SWAP,inputHash:${'0x' + '5'.repeat(64)},reasoningHash:${'0x' + '6'.repeat(64)},outputHash:${'0x' + '7'.repeat(64)},modelId:test-model,constraints:@[],timestamp:#1705123456000,prevRecord:!null,sequence:#1,signature:${'0x' + '8'.repeat(128)}}|#1}`,
      });

      const result = await storage.getRecord(recordId);

      expect(result).not.toBeNull();
      expect(result?.recordId).toBe(recordId);
      expect(result?.actionType).toBe('SWAP');
    });

    it('should return null for non-existent record', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => '{1.0|!null|#1}',
      });

      const result = await storage.getRecord('0x' + '0'.repeat(64));
      expect(result).toBeNull();
    });
  });

  describe('registerAgent', () => {
    it('should register an agent', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => '{1.0|!null|#1}',
      });

      const registration: AgentRegistration = {
        agentId: '0x' + '1'.repeat(64),
        operator: '0x' + '2'.repeat(40),
        publicKey: '0x' + '3'.repeat(64),
        metadataUri: 'https://example.com/metadata.json',
        constraints: [],
        signature: '0x' + '4'.repeat(128),
      };

      await expect(storage.registerAgent(registration)).resolves.not.toThrow();
    });
  });

  describe('healthCheck', () => {
    it('should return true when gateway is healthy', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
      });

      const result = await storage.healthCheck();
      expect(result).toBe(true);
    });

    it('should return false when gateway is unhealthy', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 503,
      });

      const result = await storage.healthCheck();
      expect(result).toBe(false);
    });

    it('should return false on network error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await storage.healthCheck();
      expect(result).toBe(false);
    });
  });

  describe('configuration', () => {
    it('should accept string configuration', () => {
      const backend = new SlimStorageBackend('http://example.com:3100');
      expect(backend).toBeInstanceOf(SlimStorageBackend);
    });

    it('should accept object configuration', () => {
      const backend = new SlimStorageBackend({
        endpoint: 'http://example.com:3100',
        apiKey: 'test-key',
        timeout: 60000,
        useSlimFormat: true,
      });
      expect(backend).toBeInstanceOf(SlimStorageBackend);
    });

    it('should include API key in headers when provided', async () => {
      const backend = new SlimStorageBackend({
        endpoint: 'http://localhost:3100',
        apiKey: 'my-secret-key',
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => '{1.0|#123|#1}',
      });

      await backend.getBlockNumber();

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer my-secret-key',
          }),
        }),
      );
    });
  });

  describe('HTTP errors', () => {
    it('should throw on HTTP error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });

      await expect(storage.getBlockNumber()).rejects.toThrow('HTTP error: 500');
    });
  });
});
