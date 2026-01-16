import { describe, it, expect, beforeEach } from 'vitest';
import { VAP, InMemoryStorage } from './index.js';
import { generateKeyPair } from '../crypto/index.js';
import { ACTION_TYPES } from '../types/index.js';

describe('VAP Client', () => {
  let privateKey: string;
  let publicKey: string;
  let storage: InMemoryStorage;
  let vap: VAP;

  beforeEach(async () => {
    const keys = await generateKeyPair();
    privateKey = keys.privateKey;
    publicKey = keys.publicKey;
    storage = new InMemoryStorage();
    vap = new VAP(
      {
        privateKey,
        endpoint: 'http://localhost:3000',
        modelId: 'test-model',
        modelVersion: '1.0.0',
      },
      storage,
    );
    await vap.initialize();
  });

  describe('initialization', () => {
    it('should initialize with sequence 0', () => {
      expect(vap.getSequence()).toBe(0);
    });

    it('should have no previous record initially', () => {
      expect(vap.getPrevRecord()).toBeNull();
    });
  });

  describe('agent registration', () => {
    it('should register a new agent', async () => {
      const agentId = await vap.registerAgent({
        operator: '0x' + '1'.repeat(40),
        metadataUri: 'ipfs://test',
      });

      expect(agentId).toMatch(/^0x[a-f0-9]{64}$/);

      const agent = await storage.getAgent(agentId);
      expect(agent).not.toBeNull();
      expect(agent?.publicKey).toBe(publicKey);
    });
  });

  describe('record creation', () => {
    beforeEach(async () => {
      await vap.registerAgent({
        operator: '0x' + '1'.repeat(40),
        metadataUri: 'ipfs://test',
      });
    });

    it('should create a valid record', async () => {
      const record = await vap.createRecord({
        actionType: ACTION_TYPES.SWAP,
        actionData: { tokenIn: 'ETH', tokenOut: 'USDC' },
        input: { price: 3200 },
        reasoning: 'Test reasoning',
        output: { action: 'buy' },
      });

      expect(record.version).toBe(1);
      expect(record.actionType).toBe('SWAP');
      expect(record.sequence).toBe(1);
      expect(record.prevRecord).toBeNull();
      expect(record.signature).toBeDefined();
      expect(record.inputHash).toMatch(/^0x[a-f0-9]{64}$/);
      expect(record.reasoningHash).toMatch(/^0x[a-f0-9]{64}$/);
      expect(record.outputHash).toMatch(/^0x[a-f0-9]{64}$/);
    });

    it('should increment sequence for each record', async () => {
      const record1 = await vap.createRecord({
        actionType: ACTION_TYPES.SWAP,
        input: {},
        reasoning: 'First',
        output: {},
      });

      await vap.submitRecord(record1);

      const record2 = await vap.createRecord({
        actionType: ACTION_TYPES.TRANSFER,
        input: {},
        reasoning: 'Second',
        output: {},
      });

      expect(record1.sequence).toBe(1);
      expect(record2.sequence).toBe(2);
      expect(record2.prevRecord).toBe(record1.recordId);
    });
  });

  describe('certify and execute', () => {
    beforeEach(async () => {
      await vap.registerAgent({
        operator: '0x' + '1'.repeat(40),
        metadataUri: 'ipfs://test',
      });
    });

    it('should certify before executing', async () => {
      let executionOrder: string[] = [];

      const { result, recordId } = await vap.certifyAndExecute(
        async () => {
          executionOrder.push('action');
          return { success: true };
        },
        {
          actionType: ACTION_TYPES.SWAP,
          input: { price: 100 },
          reasoning: 'Test',
          output: { buy: true },
        },
      );

      // Record should exist in storage
      const storedRecord = await storage.getRecord(recordId);
      expect(storedRecord).not.toBeNull();

      // Action should have executed
      expect(result.success).toBe(true);
    });

    it('should return both result and record', async () => {
      const { result, record, recordId } = await vap.certifyAndExecute(
        async () => ({ value: 42 }),
        {
          actionType: ACTION_TYPES.TRANSFER,
          input: {},
          reasoning: 'Test',
          output: {},
        },
      );

      expect(result.value).toBe(42);
      expect(record.actionType).toBe('TRANSFER');
      expect(recordId).toBe(record.recordId);
    });
  });

  describe('verification', () => {
    let agentId: string;

    beforeEach(async () => {
      agentId = await vap.registerAgent({
        operator: '0x' + '1'.repeat(40),
        metadataUri: 'ipfs://test',
      });
    });

    it('should verify a valid record', async () => {
      const { recordId } = await vap.certify({
        actionType: ACTION_TYPES.VOTE,
        input: { proposalId: 1 },
        reasoning: 'Good proposal',
        output: { vote: 'for' },
      });

      const result = await vap.verifyRecord(recordId);

      expect(result.valid).toBe(true);
      expect(result.checks.signature).toBe(true);
      expect(result.checks.chain).toBe(true);
      expect(result.checks.sequence).toBe(true);
      expect(result.checks.timestamp).toBe(true);
    });

    it('should reject non-existent record', async () => {
      const result = await vap.verifyRecord('0x' + '0'.repeat(64));

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Record not found');
    });
  });

  describe('history and reputation', () => {
    let agentId: string;

    beforeEach(async () => {
      agentId = await vap.registerAgent({
        operator: '0x' + '1'.repeat(40),
        metadataUri: 'ipfs://test',
      });
    });

    it('should retrieve agent history', async () => {
      await vap.certify({
        actionType: ACTION_TYPES.SWAP,
        input: {},
        reasoning: 'First',
        output: {},
      });

      await vap.certify({
        actionType: ACTION_TYPES.TRANSFER,
        input: {},
        reasoning: 'Second',
        output: {},
      });

      const history = await vap.getAgentHistory(agentId);

      expect(history.length).toBe(2);
      expect(history[0].actionType).toBe('SWAP');
      expect(history[1].actionType).toBe('TRANSFER');
    });

    it('should calculate reputation score', async () => {
      await vap.certify({
        actionType: ACTION_TYPES.SWAP,
        input: {},
        reasoning: 'Trade 1',
        output: {},
      });

      const reputation = await vap.getAgentReputation(agentId);

      expect(reputation.totalActions).toBe(1);
      expect(reputation.successfulActions).toBe(1);
      expect(reputation.tier).toBe('UNVERIFIED'); // Need more actions for higher tier
      expect(reputation.trustScore).toBeGreaterThan(0);
    });
  });
});
