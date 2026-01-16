/**
 * VAP Protocol Types
 * Version: 0.1.0
 */

// ============================================================================
// Core Types
// ============================================================================

/** 32-byte hash represented as hex string */
export type Bytes32 = string;

/** 64-byte signature represented as hex string */
export type Bytes64 = string;

/** Ethereum-style address */
export type Address = string;

/** Unix timestamp in milliseconds */
export type Timestamp = number;

// ============================================================================
// Action Types
// ============================================================================

export const ACTION_TYPES = {
  // DeFi
  SWAP: 'SWAP',
  TRANSFER: 'TRANSFER',
  APPROVE: 'APPROVE',
  STAKE: 'STAKE',
  UNSTAKE: 'UNSTAKE',
  PROVIDE_LIQUIDITY: 'PROVIDE_LIQUIDITY',
  REMOVE_LIQUIDITY: 'REMOVE_LIQUIDITY',
  BORROW: 'BORROW',
  REPAY: 'REPAY',
  CLAIM: 'CLAIM',

  // Governance
  VOTE: 'VOTE',
  DELEGATE: 'DELEGATE',
  PROPOSE: 'PROPOSE',

  // NFT
  MINT: 'MINT',
  BUY: 'BUY',
  SELL: 'SELL',
  LIST: 'LIST',

  // Agent
  REGISTER: 'REGISTER',
  UPDATE_CONSTRAINTS: 'UPDATE_CONSTRAINTS',
  DEREGISTER: 'DEREGISTER',

  // Meta
  REASONING_REVEAL: 'REASONING_REVEAL',
  DISPUTE: 'DISPUTE',
} as const;

export type ActionType = (typeof ACTION_TYPES)[keyof typeof ACTION_TYPES];

// ============================================================================
// Constraint Types
// ============================================================================

export const CONSTRAINT_TYPES = {
  ALLOWLIST: 'ALLOWLIST',
  DENYLIST: 'DENYLIST',
  LIMIT: 'LIMIT',
  RATE_LIMIT: 'RATE_LIMIT',
  CUSTOM: 'CUSTOM',
} as const;

export type ConstraintType = (typeof CONSTRAINT_TYPES)[keyof typeof CONSTRAINT_TYPES];

export interface Constraint {
  /** Unique constraint identifier */
  id: string;
  /** Constraint type */
  type: ConstraintType;
  /** What the constraint applies to (e.g., "tokens", "amount") */
  target: string;
  /** Constraint value or threshold */
  value: string;
  /** Hard enforcement (revert) vs soft (log only) */
  enforced: boolean;
}

// ============================================================================
// Reveal Policy
// ============================================================================

export const REVEAL_TYPES = {
  NONE: 'NONE',
  OWNER: 'OWNER',
  DISPUTE: 'DISPUTE',
  PUBLIC: 'PUBLIC',
  TIMELOCK: 'TIMELOCK',
} as const;

export type RevealType = (typeof REVEAL_TYPES)[keyof typeof REVEAL_TYPES];

export interface RevealPolicy {
  /** Type of reveal policy */
  type: RevealType;
  /** For DISPUTE type: seconds to challenge */
  disputeWindow?: number;
  /** For TIMELOCK type: when reasoning becomes public */
  unlockTime?: Timestamp;
  /** Addresses that can request reveal */
  authorized?: Address[];
}

// ============================================================================
// VAP Record
// ============================================================================

export interface VAPRecord {
  // Header
  /** Protocol version */
  version: number;
  /** Record ID: SHA256 of all fields except signature */
  recordId: Bytes32;

  // Identity
  /** Unique agent identifier */
  agentId: Bytes32;
  /** Agent operator/owner address */
  operator: Address;

  // Action
  /** Standardized action type */
  actionType: ActionType;
  /** Action-specific payload */
  actionData: unknown;

  // Reasoning (privacy-preserving)
  /** SHA256 of input context */
  inputHash: Bytes32;
  /** SHA256 of chain-of-thought */
  reasoningHash: Bytes32;
  /** SHA256 of final decision */
  outputHash: Bytes32;

  // Optional: Encrypted reasoning
  /** Encrypted reasoning for authorized reveal */
  reasoningEncrypted?: string;
  /** Who can decrypt */
  revealPolicy?: RevealPolicy;

  // Model
  /** Model identifier */
  modelId: string;
  /** Model version/checkpoint */
  modelVersion?: string;

  // Constraints
  /** Active constraints at execution time */
  constraints: Constraint[];

  // Chain
  /** Unix timestamp (milliseconds) */
  timestamp: Timestamp;
  /** Previous record hash */
  prevRecord: Bytes32 | null;
  /** Monotonic sequence number */
  sequence: number;

  // Attestation
  /** Ed25519 signature */
  signature?: Bytes64;
  /** Optional TEE attestation */
  teeAttestation?: string;
}

// ============================================================================
// Agent Registration
// ============================================================================

export interface AgentRegistration {
  /** Agent ID: SHA256(operator + nonce) */
  agentId: Bytes32;
  /** Owner address */
  operator: Address;
  /** Ed25519 public key for signing */
  publicKey: Bytes32;
  /** IPFS/HTTP link to agent metadata */
  metadataUri: string;
  /** Staked tokens (optional) */
  stakeAmount?: bigint;
  /** Stake token contract */
  stakeToken?: Address;
  /** Initial constraints */
  constraints: Constraint[];
  /** Registration signature */
  signature: Bytes64;
}

export interface AgentMetadata {
  name: string;
  description: string;
  version: string;
  operator: {
    name: string;
    contact?: string;
    website?: string;
  };
  capabilities: ActionType[];
  supportedChains: number[];
  model: {
    provider: string;
    model: string;
    systemPromptHash?: Bytes32;
  };
  auditReports?: Array<{
    auditor: string;
    date: string;
    reportUri: string;
  }>;
}

// ============================================================================
// Reputation
// ============================================================================

export const REPUTATION_TIERS = {
  UNVERIFIED: 'UNVERIFIED',
  BRONZE: 'BRONZE',
  SILVER: 'SILVER',
  GOLD: 'GOLD',
  PLATINUM: 'PLATINUM',
} as const;

export type ReputationTier = (typeof REPUTATION_TIERS)[keyof typeof REPUTATION_TIERS];

export interface ReputationScore {
  /** Total certified actions */
  totalActions: number;
  /** Actions without disputes */
  successfulActions: number;
  /** Percentage of disputed actions */
  disputeRate: number;
  /** Confirmed violations */
  violationCount: number;
  /** Current stake */
  stakeAmount: bigint;
  /** Days since registration */
  ageDays: number;
  /** Computed trust score (0.0 - 1.0) */
  trustScore: number;
  /** Reputation tier */
  tier: ReputationTier;
}

// ============================================================================
// Verification
// ============================================================================

export interface VerificationResult {
  /** Is the record valid? */
  valid: boolean;
  /** Verification checks performed */
  checks: {
    signature: boolean;
    chain: boolean;
    sequence: boolean;
    timestamp: boolean;
    constraints: boolean;
  };
  /** Error message if invalid */
  error?: string;
}

// ============================================================================
// Disputes
// ============================================================================

export const DISPUTE_STATUS = {
  OPEN: 'OPEN',
  RESOLVED_VALID: 'RESOLVED_VALID',
  RESOLVED_VIOLATION: 'RESOLVED_VIOLATION',
  EXPIRED: 'EXPIRED',
} as const;

export type DisputeStatus = (typeof DISPUTE_STATUS)[keyof typeof DISPUTE_STATUS];

export interface Dispute {
  /** Dispute ID */
  disputeId: Bytes32;
  /** Record being disputed */
  recordId: Bytes32;
  /** Challenger address */
  challenger: Address;
  /** Reason for dispute */
  reason: string;
  /** Bond staked by challenger */
  bond: bigint;
  /** Dispute status */
  status: DisputeStatus;
  /** When dispute was opened */
  openedAt: Timestamp;
  /** When dispute was resolved */
  resolvedAt?: Timestamp;
  /** Resolution details */
  resolution?: string;
}

// ============================================================================
// SDK Config
// ============================================================================

export interface VAPConfig {
  /** Agent's Ed25519 private key (hex) */
  privateKey: string;
  /** Storage endpoint (e.g., SLIM-CHAIN RPC) */
  endpoint: string;
  /** Agent ID (if already registered) */
  agentId?: Bytes32;
  /** Model identifier */
  modelId?: string;
  /** Model version */
  modelVersion?: string;
  /** Default constraints */
  defaultConstraints?: Constraint[];
}

// ============================================================================
// SDK Params
// ============================================================================

export interface CreateRecordParams {
  /** Action type */
  actionType: ActionType;
  /** Action-specific data */
  actionData?: unknown;
  /** Input context (will be hashed) */
  input: unknown;
  /** Chain-of-thought reasoning (will be hashed) */
  reasoning: string;
  /** Final decision/output (will be hashed) */
  output: unknown;
  /** Constraints for this action */
  constraints?: Constraint[];
  /** Reveal policy for reasoning */
  revealPolicy?: RevealPolicy;
}

export interface QueryOptions {
  /** Start timestamp */
  from?: Timestamp;
  /** End timestamp */
  to?: Timestamp;
  /** Filter by action type */
  actionType?: ActionType;
  /** Maximum records to return */
  limit?: number;
  /** Offset for pagination */
  offset?: number;
}

// ============================================================================
// Errors
// ============================================================================

export const VAP_ERROR_CODES = {
  INVALID_SIGNATURE: 1001,
  INVALID_CHAIN: 1002,
  INVALID_SEQUENCE: 1003,
  AGENT_NOT_FOUND: 1004,
  INSUFFICIENT_STAKE: 1005,
  CONSTRAINT_VIOLATION: 1006,
  DISPUTE_EXPIRED: 1007,
  ALREADY_DISPUTED: 1008,
  UNAUTHORIZED_REVEAL: 1009,
  INVALID_TEE_ATTESTATION: 1010,
} as const;

export type VAPErrorCode = (typeof VAP_ERROR_CODES)[keyof typeof VAP_ERROR_CODES];

export class VAPError extends Error {
  constructor(
    public code: VAPErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'VAPError';
  }
}
