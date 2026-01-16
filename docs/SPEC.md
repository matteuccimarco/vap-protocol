# Verifiable Agent Protocol (VAP) Specification

**Version:** 0.1.0-draft
**Status:** Draft
**Authors:** FRUX
**Date:** January 2025

---

## Abstract

The Verifiable Agent Protocol (VAP) defines a standard for AI agents to create cryptographically verifiable audit trails of their decisions and actions. VAP enables accountability, transparency, and trust in autonomous AI systems operating in blockchain environments.

---

## 1. Introduction

### 1.1 Problem Statement

AI agents are increasingly deployed to:
- Execute trades on behalf of users
- Vote in DAOs
- Manage DeFi vaults
- Interact with smart contracts autonomously

However, there is no standardized way to:
- Verify why an agent made a specific decision
- Prove that an agent followed its configured constraints
- Audit the complete history of an agent's actions
- Build trust and reputation for agents over time

### 1.2 Goals

VAP aims to provide:

1. **Accountability**: Every agent action has a verifiable audit trail
2. **Transparency**: Users can inspect agent reasoning (with privacy options)
3. **Trustlessness**: Verification requires no trust in the agent operator
4. **Interoperability**: Works across chains, models, and frameworks
5. **Efficiency**: Minimal overhead for real-time agent operations

### 1.3 Non-Goals

- VAP does not guarantee agent correctness (only auditability)
- VAP does not prevent malicious agents (only enables detection)
- VAP does not define AI model behavior (only logging standards)

---

## 2. Terminology

| Term | Definition |
|------|------------|
| **Agent** | An autonomous AI system that executes actions |
| **Action** | A discrete operation performed by an agent |
| **Record** | A signed, timestamped log of an action |
| **Constraint** | A rule that limits agent behavior |
| **Reasoning** | The chain-of-thought leading to a decision |
| **Attestation** | Cryptographic proof of record authenticity |

---

## 3. Data Structures

### 3.1 VAP Record

The fundamental unit of the protocol.

```
VAPRecord {
    // Header
    version:        u8,              // Protocol version (1)
    record_id:      bytes32,         // SHA256(all fields except signature)

    // Identity
    agent_id:       bytes32,         // Unique agent identifier
    operator:       address,         // Agent operator/owner address

    // Action
    action_type:    string,          // Standardized action type
    action_data:    bytes,           // Action-specific payload

    // Reasoning (privacy-preserving)
    input_hash:     bytes32,         // SHA256(input context)
    reasoning_hash: bytes32,         // SHA256(chain-of-thought)
    output_hash:    bytes32,         // SHA256(final decision)

    // Optional: Encrypted reasoning for authorized reveal
    reasoning_encrypted: bytes,      // ChaCha20-Poly1305(reasoning, shared_key)
    reveal_policy:  RevealPolicy,    // Who can decrypt

    // Model
    model_id:       string,          // Model identifier (e.g., "claude-opus-4-5")
    model_version:  string,          // Specific version/checkpoint

    // Constraints
    constraints:    Constraint[],    // Active constraints at execution time

    // Chain
    timestamp:      u64,             // Unix timestamp (milliseconds)
    prev_record:    bytes32,         // Previous record hash (chain)
    sequence:       u64,             // Monotonic sequence number

    // Attestation
    signature:      bytes64,         // Ed25519 signature
    tee_attestation: bytes,          // Optional: TEE attestation
}
```

### 3.2 Constraint

```
Constraint {
    id:          string,         // Unique constraint identifier
    type:        ConstraintType, // ALLOWLIST | DENYLIST | LIMIT | CUSTOM
    target:      string,         // What the constraint applies to
    value:       string,         // Constraint value/threshold
    enforced:    bool,           // Hard (revert) vs soft (log only)
}
```

**Constraint Types:**

| Type | Description | Example |
|------|-------------|---------|
| `ALLOWLIST` | Only allowed values | `tokens: [ETH, USDC, WBTC]` |
| `DENYLIST` | Forbidden values | `tokens: [DOGE, SHIB]` |
| `LIMIT` | Numeric threshold | `max_trade_size: 5%` |
| `RATE_LIMIT` | Frequency limit | `max_trades_per_hour: 10` |
| `CUSTOM` | Custom logic hash | `logic_hash: 0x...` |

### 3.3 Action Types

Standardized action types for interoperability:

```
// DeFi Actions
SWAP                 // Token swap
TRANSFER             // Token transfer
APPROVE              // Token approval
STAKE                // Staking
UNSTAKE              // Unstaking
PROVIDE_LIQUIDITY    // LP provision
REMOVE_LIQUIDITY     // LP withdrawal
BORROW               // Lending protocol borrow
REPAY                // Lending protocol repay
CLAIM                // Claim rewards

// Governance Actions
VOTE                 // DAO vote
DELEGATE             // Delegate voting power
PROPOSE              // Create proposal

// NFT Actions
MINT                 // Mint NFT
BUY                  // Purchase NFT
SELL                 // Sell NFT
LIST                 // List for sale

// Agent Actions
REGISTER             // Register agent
UPDATE_CONSTRAINTS   // Update agent constraints
DEREGISTER           // Remove agent

// Meta Actions
REASONING_REVEAL     // Reveal encrypted reasoning
DISPUTE              // Challenge an action
```

### 3.4 Reveal Policy

Controls who can decrypt reasoning:

```
RevealPolicy {
    type:       RevealType,      // NONE | OWNER | DISPUTE | PUBLIC | TIMELOCK

    // For DISPUTE type
    dispute_window: u64,         // Seconds to challenge

    // For TIMELOCK type
    unlock_time:    u64,         // When reasoning becomes public

    // For specific parties
    authorized:     address[],   // Addresses that can request reveal
}
```

---

## 4. Agent Identity

### 4.1 Agent Registration

Agents must register before creating records:

```
AgentRegistration {
    agent_id:       bytes32,         // SHA256(operator + nonce)
    operator:       address,         // Owner address
    public_key:     bytes32,         // Ed25519 public key for signing
    metadata_uri:   string,          // IPFS/HTTP link to agent metadata

    // Staking (optional but recommended)
    stake_amount:   u256,            // Staked tokens
    stake_token:    address,         // Token contract

    // Initial constraints
    constraints:    Constraint[],

    // Registration signature
    signature:      bytes64,
}
```

### 4.2 Agent Metadata

Off-chain metadata (stored on IPFS):

```json
{
    "name": "Alpha Trading Bot",
    "description": "ETH/USDC swing trading agent",
    "version": "1.0.0",
    "operator": {
        "name": "FRUX",
        "contact": "info@frux.pro",
        "website": "https://frux.pro"
    },
    "capabilities": ["SWAP", "TRANSFER"],
    "supported_chains": [1, 137, 42161],
    "model": {
        "provider": "anthropic",
        "model": "claude-opus-4-5",
        "system_prompt_hash": "0x..."
    },
    "audit_reports": [
        {
            "auditor": "Example Security",
            "date": "2025-01-15",
            "report_uri": "ipfs://..."
        }
    ]
}
```

---

## 5. Record Lifecycle

### 5.1 Creation Flow

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Agent     │     │  VAP SDK    │     │ SLIM-CHAIN  │     │  External   │
│  Runtime    │     │             │     │             │     │   Chain     │
└──────┬──────┘     └──────┬──────┘     └──────┬──────┘     └──────┬──────┘
       │                   │                   │                   │
       │ 1. Decide action  │                   │                   │
       │──────────────────>│                   │                   │
       │                   │                   │                   │
       │ 2. Create record  │                   │                   │
       │   (hash inputs)   │                   │                   │
       │<──────────────────│                   │                   │
       │                   │                   │                   │
       │ 3. Sign record    │                   │                   │
       │──────────────────>│                   │                   │
       │                   │                   │                   │
       │                   │ 4. Submit record  │                   │
       │                   │──────────────────>│                   │
       │                   │                   │                   │
       │                   │ 5. Confirmation   │                   │
       │                   │<──────────────────│                   │
       │                   │                   │                   │
       │ 6. Execute action │                   │                   │
       │───────────────────────────────────────────────────────────>
       │                   │                   │                   │
       │                   │ 7. Link tx hash   │                   │
       │                   │──────────────────>│                   │
       │                   │                   │                   │
```

### 5.2 Verification Flow

Anyone can verify a record:

```
1. Retrieve record from SLIM-CHAIN by record_id
2. Verify signature against agent's registered public_key
3. Verify prev_record forms valid chain
4. Verify sequence is monotonically increasing
5. Verify timestamp is within acceptable bounds
6. Optionally: request reasoning reveal if authorized
```

### 5.3 Dispute Flow

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│ Challenger  │     │ SLIM-CHAIN  │     │   Agent     │
└──────┬──────┘     └──────┬──────┘     └──────┬──────┘
       │                   │                   │
       │ 1. Open dispute   │                   │
       │   (stake bond)    │                   │
       │──────────────────>│                   │
       │                   │                   │
       │                   │ 2. Notify agent   │
       │                   │──────────────────>│
       │                   │                   │
       │                   │ 3. Reveal         │
       │                   │   reasoning       │
       │                   │<──────────────────│
       │                   │                   │
       │ 4. Evaluate       │                   │
       │<──────────────────│                   │
       │                   │                   │
       │ 5a. If valid:     │                   │
       │    Return stake   │                   │
       │<──────────────────│                   │
       │                   │                   │
       │ 5b. If violation: │                   │
       │    Slash agent,   │                   │
       │    reward challenger                  │
       │<──────────────────│                   │
```

---

## 6. Cryptographic Specifications

### 6.1 Hashing

- **Algorithm:** SHA-256
- **Encoding:** Inputs are canonicalized JSON, UTF-8 encoded

```
input_hash = SHA256(canonicalize({
    prompt: "...",
    context: {...},
    timestamp: 1234567890
}))
```

### 6.2 Signing

- **Algorithm:** Ed25519
- **Message:** SHA256(record without signature field)

```
message = SHA256(serialize(record))
signature = Ed25519.sign(agent_private_key, message)
```

### 6.3 Encryption (Optional Reasoning)

- **Algorithm:** ChaCha20-Poly1305
- **Key Derivation:** X25519 key exchange between agent and authorized parties

```
shared_secret = X25519(agent_private, authorized_public)
key = HKDF-SHA256(shared_secret, salt, "vap-reasoning")
encrypted = ChaCha20Poly1305.encrypt(key, nonce, reasoning)
```

### 6.4 Record ID

```
record_id = SHA256(serialize(record, exclude=["signature", "record_id"]))
```

---

## 7. Storage

### 7.1 On-Chain (SLIM-CHAIN)

Stored for all records:

```
RecordStore {
    record_id       -> VAPRecordCompact,    // Core fields
    agent_id        -> [record_id],         // Agent's record chain
    timestamp_index -> [record_id],         // Time-based queries
}

VAPRecordCompact {
    agent_id:       bytes32,
    action_type:    bytes8,      // First 8 bytes of action type hash
    input_hash:     bytes32,
    reasoning_hash: bytes32,
    output_hash:    bytes32,
    timestamp:      u64,
    prev_record:    bytes32,
    signature:      bytes64,
}
```

### 7.2 Off-Chain (IPFS/Arweave)

Full record data including:

```
- Complete action_data
- Encrypted reasoning (if any)
- Extended metadata
- Constraint definitions
```

Referenced by:
```
metadata_uri = "ipfs://Qm..."
```

---

## 8. SDK Interface

### 8.1 Core Functions

```typescript
interface VAPSDK {
    // Agent Management
    registerAgent(config: AgentConfig): Promise<AgentId>;
    updateConstraints(constraints: Constraint[]): Promise<void>;
    deregisterAgent(): Promise<void>;

    // Record Creation
    createRecord(params: {
        actionType: ActionType;
        actionData: any;
        input: any;
        reasoning: string;
        output: any;
        constraints?: Constraint[];
    }): Promise<VAPRecord>;

    signRecord(record: VAPRecord): Promise<SignedVAPRecord>;
    submitRecord(record: SignedVAPRecord): Promise<RecordId>;

    // Convenience
    certifyAndExecute<T>(
        action: () => Promise<T>,
        params: RecordParams
    ): Promise<{ result: T; recordId: RecordId }>;

    // Verification
    verifyRecord(recordId: RecordId): Promise<VerificationResult>;
    getAgentHistory(agentId: AgentId, options?: QueryOptions): Promise<VAPRecord[]>;
    getAgentReputation(agentId: AgentId): Promise<ReputationScore>;

    // Disputes
    openDispute(recordId: RecordId, reason: string): Promise<DisputeId>;
    revealReasoning(recordId: RecordId, authorizedKey: PrivateKey): Promise<string>;
}
```

### 8.2 Usage Example

```typescript
import { VAP } from '@vap/sdk';

const vap = new VAP({
    agentId: '0x...',
    privateKey: process.env.AGENT_KEY,
    slimChainUrl: 'https://rpc.slim-chain.io',
});

// Simple usage
const { result, recordId } = await vap.certifyAndExecute(
    () => dex.swap('ETH', 'USDC', '1.0'),
    {
        actionType: 'SWAP',
        input: { market: 'ETH/USDC', price: 3200, signal: 'bullish' },
        reasoning: `
            Market analysis shows ETH is oversold (RSI: 28).
            Historical data suggests 80% probability of bounce.
            User constraints allow up to 5% allocation.
            Executing 1 ETH swap (3% of portfolio).
        `,
        output: { action: 'swap', amount: '1.0', pair: 'ETH/USDC' },
    }
);

console.log(`Trade executed, certified as: ${recordId}`);

// Verification
const isValid = await vap.verifyRecord(recordId);
console.log(`Record valid: ${isValid.valid}`);
```

---

## 9. Reputation System

### 9.1 Score Components

```
ReputationScore {
    total_actions:      u64,     // Total certified actions
    successful_actions: u64,     // Actions without disputes
    dispute_rate:       f64,     // % of disputed actions
    violation_count:    u64,     // Confirmed violations
    stake_amount:       u256,    // Current stake
    age_days:           u64,     // Days since registration

    // Computed
    trust_score:        f64,     // 0.0 - 1.0
    tier:               Tier,    // UNVERIFIED | BRONZE | SILVER | GOLD | PLATINUM
}
```

### 9.2 Trust Score Formula

```
trust_score = (
    0.3 * success_rate +
    0.2 * log10(total_actions + 1) / 5 +
    0.2 * stake_factor +
    0.2 * age_factor +
    0.1 * (1 - dispute_rate)
)

where:
    success_rate = successful_actions / total_actions
    stake_factor = min(1.0, stake_amount / STAKE_THRESHOLD)
    age_factor = min(1.0, age_days / 365)
```

### 9.3 Tier Thresholds

| Tier | Trust Score | Min Actions | Max Violations |
|------|-------------|-------------|----------------|
| UNVERIFIED | < 0.3 | 0 | - |
| BRONZE | 0.3 - 0.5 | 10 | 5 |
| SILVER | 0.5 - 0.7 | 100 | 2 |
| GOLD | 0.7 - 0.9 | 1,000 | 1 |
| PLATINUM | > 0.9 | 10,000 | 0 |

---

## 10. Security Considerations

### 10.1 Threats

| Threat | Mitigation |
|--------|------------|
| Agent logs fake reasoning | Attestation from TEE; dispute mechanism |
| Operator replaces agent key | Key rotation requires on-chain tx with delay |
| Front-running certified actions | Use commit-reveal for sensitive trades |
| Replay attacks | Monotonic sequence numbers; timestamp bounds |
| DoS on verification | Rate limiting; stake requirements |

### 10.2 TEE Integration (Optional)

For highest assurance, agents can run in TEE:

```
TEEAttestation {
    enclave_id:     bytes32,     // SGX/TDX enclave measurement
    code_hash:      bytes32,     // Hash of agent code
    report:         bytes,       // TEE attestation report
    signature:      bytes,       // TEE signature
}
```

This proves:
1. Agent code matches expected hash
2. Record was created inside secure enclave
3. Reasoning was not modified after generation

---

## 11. Governance

### 11.1 Protocol Parameters

Governed by token holders:

| Parameter | Default | Description |
|-----------|---------|-------------|
| `MIN_STAKE` | 1,000 VAP | Minimum stake to register agent |
| `DISPUTE_BOND` | 100 VAP | Bond to open dispute |
| `DISPUTE_WINDOW` | 7 days | Time to challenge action |
| `SLASH_PERCENT` | 10% | Stake slashed on violation |
| `RECORD_FEE` | 0.01 VAP | Fee per record (burned) |

### 11.2 Action Type Registry

New action types can be proposed and voted:

```
ActionTypeProposal {
    action_type:    string,
    schema:         JSONSchema,     // Expected action_data format
    description:    string,
    proposer:       address,
    votes_for:      u256,
    votes_against:  u256,
}
```

---

## 12. Roadmap

### Phase 1: Foundation (Q1 2025)
- [ ] Core protocol specification (this document)
- [ ] Reference SDK implementation (TypeScript)
- [ ] SLIM-CHAIN integration
- [ ] Basic verification tools

### Phase 2: Ecosystem (Q2 2025)
- [ ] Python and Rust SDKs
- [ ] Major agent framework integrations (LangChain, AutoGPT)
- [ ] Block explorer with VAP record viewer
- [ ] Dispute resolution MVP

### Phase 3: Advanced (Q3 2025)
- [ ] TEE attestation support
- [ ] ZK proofs for private constraint verification
- [ ] Cross-chain record bridging
- [ ] Reputation aggregators

### Phase 4: Decentralization (Q4 2025)
- [ ] Governance token launch
- [ ] Decentralized dispute resolution (jury system)
- [ ] Third-party auditor marketplace

---

## 13. References

1. [SLIM-CHAIN Specification](./SLIM-CHAIN-SPEC.md)
2. [SLIM-RPC Protocol](./SLIM-RPC-SPEC.md)
3. [Ed25519 Signatures](https://ed25519.cr.yp.to/)
4. [ChaCha20-Poly1305](https://tools.ietf.org/html/rfc8439)
5. [Intel SGX Attestation](https://software.intel.com/content/www/us/en/develop/topics/software-guard-extensions.html)

---

## Appendix A: Canonical JSON

Records are serialized using canonical JSON (RFC 8785):

1. Object keys sorted lexicographically
2. No whitespace
3. No trailing commas
4. Numbers without unnecessary precision
5. UTF-8 encoding

Example:
```json
{"action_type":"SWAP","agent_id":"0x123...","timestamp":1736870400000}
```

---

## Appendix B: Action Data Schemas

### SWAP

```json
{
    "chain_id": 1,
    "dex": "uniswap_v3",
    "token_in": "0x...",
    "token_out": "0x...",
    "amount_in": "1000000000000000000",
    "min_amount_out": "3200000000",
    "slippage_bps": 50,
    "deadline": 1736870500
}
```

### VOTE

```json
{
    "chain_id": 1,
    "dao": "0x...",
    "proposal_id": 42,
    "support": true,
    "votes": "1000000000000000000000",
    "reason": "Aligns with treasury diversification goals"
}
```

### TRANSFER

```json
{
    "chain_id": 1,
    "token": "0x...",
    "to": "0x...",
    "amount": "1000000000000000000"
}
```

---

## Appendix C: Error Codes

| Code | Name | Description |
|------|------|-------------|
| 1001 | INVALID_SIGNATURE | Signature verification failed |
| 1002 | INVALID_CHAIN | prev_record does not match |
| 1003 | INVALID_SEQUENCE | Sequence not monotonic |
| 1004 | AGENT_NOT_FOUND | Agent ID not registered |
| 1005 | INSUFFICIENT_STAKE | Stake below minimum |
| 1006 | CONSTRAINT_VIOLATION | Action violates constraint |
| 1007 | DISPUTE_EXPIRED | Dispute window passed |
| 1008 | ALREADY_DISPUTED | Record already under dispute |
| 1009 | UNAUTHORIZED_REVEAL | Not authorized to reveal reasoning |
| 1010 | INVALID_TEE_ATTESTATION | TEE attestation invalid |

---

*This specification is a living document. Submit issues and PRs at [github.com/frux/vap-spec](https://github.com/frux/vap-spec)*
