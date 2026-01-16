/**
 * VAP SDK Client
 *
 * Main interface for creating and verifying agent action records.
 */

import {
  hashObject,
  hashString,
  signRecord,
  verifyRecordSignature,
  computeRecordId,
  getPublicKey,
  generateAgentId,
  generateNonce,
} from '../crypto';
import type {
  VAPConfig,
  VAPRecord,
  CreateRecordParams,
  VerificationResult,
  QueryOptions,
  ReputationScore,
  Bytes32,
  Constraint,
  AgentRegistration,
} from '../types';
import { VAPError, VAP_ERROR_CODES } from '../types';

// ============================================================================
// Storage Interface (to be implemented by specific backends)
// ============================================================================

export interface StorageBackend {
  /** Submit a record to storage */
  submitRecord(record: VAPRecord): Promise<{ recordId: Bytes32; txHash?: string }>;

  /** Get a record by ID */
  getRecord(recordId: Bytes32): Promise<VAPRecord | null>;

  /** Get agent's record history */
  getAgentRecords(agentId: Bytes32, options?: QueryOptions): Promise<VAPRecord[]>;

  /** Get the latest record for an agent */
  getLatestRecord(agentId: Bytes32): Promise<VAPRecord | null>;

  /** Get agent registration */
  getAgent(agentId: Bytes32): Promise<AgentRegistration | null>;

  /** Register a new agent */
  registerAgent(registration: AgentRegistration): Promise<void>;

  /** Get agent's public key */
  getAgentPublicKey(agentId: Bytes32): Promise<string | null>;
}

// ============================================================================
// In-Memory Storage (for testing)
// ============================================================================

export class InMemoryStorage implements StorageBackend {
  private records: Map<Bytes32, VAPRecord> = new Map();
  private agentRecords: Map<Bytes32, Bytes32[]> = new Map();
  private agents: Map<Bytes32, AgentRegistration> = new Map();

  async submitRecord(record: VAPRecord): Promise<{ recordId: Bytes32 }> {
    this.records.set(record.recordId, record);

    const agentRecordIds = this.agentRecords.get(record.agentId) || [];
    agentRecordIds.push(record.recordId);
    this.agentRecords.set(record.agentId, agentRecordIds);

    return { recordId: record.recordId };
  }

  async getRecord(recordId: Bytes32): Promise<VAPRecord | null> {
    return this.records.get(recordId) || null;
  }

  async getAgentRecords(agentId: Bytes32, options?: QueryOptions): Promise<VAPRecord[]> {
    const recordIds = this.agentRecords.get(agentId) || [];
    let records = recordIds.map((id) => this.records.get(id)!).filter(Boolean);

    if (options?.from) {
      records = records.filter((r) => r.timestamp >= options.from!);
    }
    if (options?.to) {
      records = records.filter((r) => r.timestamp <= options.to!);
    }
    if (options?.actionType) {
      records = records.filter((r) => r.actionType === options.actionType);
    }
    if (options?.limit) {
      records = records.slice(options.offset || 0, (options.offset || 0) + options.limit);
    }

    return records;
  }

  async getLatestRecord(agentId: Bytes32): Promise<VAPRecord | null> {
    const recordIds = this.agentRecords.get(agentId) || [];
    if (recordIds.length === 0) return null;
    return this.records.get(recordIds[recordIds.length - 1]) || null;
  }

  async getAgent(agentId: Bytes32): Promise<AgentRegistration | null> {
    return this.agents.get(agentId) || null;
  }

  async registerAgent(registration: AgentRegistration): Promise<void> {
    this.agents.set(registration.agentId, registration);
  }

  async getAgentPublicKey(agentId: Bytes32): Promise<string | null> {
    const agent = await this.getAgent(agentId);
    return agent?.publicKey || null;
  }
}

// ============================================================================
// VAP Client
// ============================================================================

export class VAP {
  private config: VAPConfig;
  private storage: StorageBackend;
  private publicKey: string | null = null;
  private sequence: number = 0;
  private prevRecord: Bytes32 | null = null;

  constructor(config: VAPConfig, storage?: StorageBackend) {
    this.config = config;
    this.storage = storage || new InMemoryStorage();
  }

  // ==========================================================================
  // Initialization
  // ==========================================================================

  /**
   * Initialize the client and sync with storage.
   */
  async initialize(): Promise<void> {
    // Get public key from private key
    this.publicKey = await getPublicKey(this.config.privateKey);

    // If agent ID is provided, sync sequence number
    if (this.config.agentId) {
      const latestRecord = await this.storage.getLatestRecord(this.config.agentId);
      if (latestRecord) {
        this.sequence = latestRecord.sequence;
        this.prevRecord = latestRecord.recordId;
      }
    }
  }

  /**
   * Get or generate agent ID.
   */
  async getAgentId(): Promise<Bytes32> {
    if (this.config.agentId) {
      return this.config.agentId;
    }

    // Generate from public key and nonce
    if (!this.publicKey) {
      this.publicKey = await getPublicKey(this.config.privateKey);
    }

    const nonce = generateNonce();
    const agentId = generateAgentId(this.publicKey, nonce);
    this.config.agentId = agentId;

    return agentId;
  }

  // ==========================================================================
  // Agent Registration
  // ==========================================================================

  /**
   * Register a new agent.
   */
  async registerAgent(params: {
    operator: string;
    metadataUri: string;
    constraints?: Constraint[];
  }): Promise<Bytes32> {
    if (!this.publicKey) {
      await this.initialize();
    }

    const nonce = generateNonce();
    const agentId = generateAgentId(params.operator, nonce);

    const registration: Omit<AgentRegistration, 'signature'> = {
      agentId,
      operator: params.operator,
      publicKey: this.publicKey!,
      metadataUri: params.metadataUri,
      constraints: params.constraints || this.config.defaultConstraints || [],
    };

    // Sign the registration
    const registrationHash = hashObject(registration);
    const { sign } = await import('../crypto');
    const signature = await sign(registrationHash, this.config.privateKey);

    const signedRegistration: AgentRegistration = {
      ...registration,
      signature,
    };

    await this.storage.registerAgent(signedRegistration);
    this.config.agentId = agentId;

    return agentId;
  }

  // ==========================================================================
  // Record Creation
  // ==========================================================================

  /**
   * Create a new VAP record.
   */
  async createRecord(params: CreateRecordParams): Promise<VAPRecord> {
    if (!this.publicKey) {
      await this.initialize();
    }

    const agentId = await this.getAgentId();

    // Hash inputs
    const inputHash = hashObject(params.input);
    const reasoningHash = hashString(params.reasoning);
    const outputHash = hashObject(params.output);

    // Increment sequence
    this.sequence++;

    // Build record
    const record: Omit<VAPRecord, 'recordId' | 'signature'> = {
      version: 1,
      agentId,
      operator: this.publicKey!, // Using public key as operator for now
      actionType: params.actionType,
      actionData: params.actionData,
      inputHash,
      reasoningHash,
      outputHash,
      revealPolicy: params.revealPolicy,
      modelId: this.config.modelId || 'unknown',
      modelVersion: this.config.modelVersion,
      constraints: params.constraints || this.config.defaultConstraints || [],
      timestamp: Date.now(),
      prevRecord: this.prevRecord,
      sequence: this.sequence,
    };

    // Compute record ID
    const recordId = computeRecordId(record);

    // Sign record
    const signedRecord = await signRecord({ ...record, recordId }, this.config.privateKey);

    return signedRecord;
  }

  /**
   * Submit a record to storage.
   */
  async submitRecord(record: VAPRecord): Promise<{ recordId: Bytes32; txHash?: string }> {
    const result = await this.storage.submitRecord(record);

    // Update local state
    this.prevRecord = record.recordId;

    return result;
  }

  /**
   * Create, sign, and submit a record in one call.
   */
  async certify(params: CreateRecordParams): Promise<{ record: VAPRecord; recordId: Bytes32 }> {
    const record = await this.createRecord(params);
    const { recordId } = await this.submitRecord(record);
    return { record, recordId };
  }

  /**
   * Certify an action and execute it.
   * The action is only executed after certification succeeds.
   */
  async certifyAndExecute<T>(
    action: () => Promise<T>,
    params: CreateRecordParams,
  ): Promise<{ result: T; record: VAPRecord; recordId: Bytes32 }> {
    // Create and submit record first
    const { record, recordId } = await this.certify(params);

    // Execute action
    const result = await action();

    return { result, record, recordId };
  }

  // ==========================================================================
  // Verification
  // ==========================================================================

  /**
   * Verify a record by ID.
   */
  async verifyRecord(recordId: Bytes32): Promise<VerificationResult> {
    const record = await this.storage.getRecord(recordId);

    if (!record) {
      return {
        valid: false,
        checks: {
          signature: false,
          chain: false,
          sequence: false,
          timestamp: false,
          constraints: false,
        },
        error: 'Record not found',
      };
    }

    return this.verifyRecordData(record);
  }

  /**
   * Verify a record object.
   */
  async verifyRecordData(record: VAPRecord): Promise<VerificationResult> {
    const checks = {
      signature: false,
      chain: false,
      sequence: false,
      timestamp: false,
      constraints: false,
    };

    // Get agent's public key
    const publicKey = await this.storage.getAgentPublicKey(record.agentId);
    if (!publicKey) {
      return {
        valid: false,
        checks,
        error: 'Agent not found',
      };
    }

    // Verify signature
    checks.signature = await verifyRecordSignature(record, publicKey);
    if (!checks.signature) {
      return {
        valid: false,
        checks,
        error: 'Invalid signature',
      };
    }

    // Verify chain (prev_record exists or is first record)
    if (record.prevRecord) {
      const prevRecord = await this.storage.getRecord(record.prevRecord);
      checks.chain = prevRecord !== null && prevRecord.agentId === record.agentId;
    } else {
      checks.chain = record.sequence === 1;
    }

    if (!checks.chain) {
      return {
        valid: false,
        checks,
        error: 'Invalid chain reference',
      };
    }

    // Verify sequence is monotonic
    if (record.prevRecord) {
      const prevRecord = await this.storage.getRecord(record.prevRecord);
      checks.sequence = prevRecord !== null && record.sequence === prevRecord.sequence + 1;
    } else {
      checks.sequence = record.sequence === 1;
    }

    if (!checks.sequence) {
      return {
        valid: false,
        checks,
        error: 'Invalid sequence number',
      };
    }

    // Verify timestamp is reasonable (not in future, not too old)
    const now = Date.now();
    const maxAge = 30 * 24 * 60 * 60 * 1000; // 30 days
    checks.timestamp = record.timestamp <= now && record.timestamp > now - maxAge;

    if (!checks.timestamp) {
      return {
        valid: false,
        checks,
        error: 'Invalid timestamp',
      };
    }

    // Constraints are valid (basic check - just that they're well-formed)
    checks.constraints = record.constraints.every(
      (c) => c.id && c.type && c.target !== undefined && c.value !== undefined,
    );

    return {
      valid: true,
      checks,
    };
  }

  // ==========================================================================
  // Queries
  // ==========================================================================

  /**
   * Get an agent's action history.
   */
  async getAgentHistory(agentId: Bytes32, options?: QueryOptions): Promise<VAPRecord[]> {
    return this.storage.getAgentRecords(agentId, options);
  }

  /**
   * Get reputation score for an agent.
   */
  async getAgentReputation(agentId: Bytes32): Promise<ReputationScore> {
    const records = await this.storage.getAgentRecords(agentId);
    const agent = await this.storage.getAgent(agentId);

    const totalActions = records.length;
    const successfulActions = records.length; // TODO: Track disputes
    const disputeRate = 0; // TODO: Calculate from disputes
    const violationCount = 0; // TODO: Track violations
    const stakeAmount = agent?.stakeAmount || BigInt(0);

    // Calculate age
    const firstRecord = records[0];
    const ageDays = firstRecord
      ? Math.floor((Date.now() - firstRecord.timestamp) / (24 * 60 * 60 * 1000))
      : 0;

    // Calculate trust score
    const successRate = totalActions > 0 ? successfulActions / totalActions : 0;
    const stakeThreshold = BigInt(1000);
    const stakeFactor = Number(stakeAmount) / Number(stakeThreshold);
    const ageFactor = Math.min(1.0, ageDays / 365);

    const trustScore =
      0.3 * successRate +
      0.2 * (Math.log10(totalActions + 1) / 5) +
      0.2 * Math.min(1.0, stakeFactor) +
      0.2 * ageFactor +
      0.1 * (1 - disputeRate);

    // Determine tier
    let tier: ReputationScore['tier'];
    if (trustScore < 0.3 || totalActions < 10) {
      tier = 'UNVERIFIED';
    } else if (trustScore < 0.5 || totalActions < 100) {
      tier = 'BRONZE';
    } else if (trustScore < 0.7 || totalActions < 1000) {
      tier = 'SILVER';
    } else if (trustScore < 0.9 || totalActions < 10000) {
      tier = 'GOLD';
    } else {
      tier = 'PLATINUM';
    }

    return {
      totalActions,
      successfulActions,
      disputeRate,
      violationCount,
      stakeAmount,
      ageDays,
      trustScore,
      tier,
    };
  }

  // ==========================================================================
  // Utilities
  // ==========================================================================

  /**
   * Get current sequence number.
   */
  getSequence(): number {
    return this.sequence;
  }

  /**
   * Get previous record ID.
   */
  getPrevRecord(): Bytes32 | null {
    return this.prevRecord;
  }
}
