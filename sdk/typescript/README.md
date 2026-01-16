# @vap/sdk

TypeScript SDK for the Verifiable Agent Protocol.

## Installation

```bash
npm install @vap/sdk
```

## Quick Start

```typescript
import { VAP, generateKeyPair, ACTION_TYPES } from '@vap/sdk';

// Generate keys for your agent
const { privateKey } = await generateKeyPair();

// Initialize SDK
const vap = new VAP({
  privateKey,
  endpoint: 'https://rpc.slim-chain.io',
  modelId: 'my-trading-bot',
});

await vap.initialize();

// Register agent
const agentId = await vap.registerAgent({
  operator: '0xYourAddress',
  metadataUri: 'ipfs://...',
});

// Certify and execute an action
const { result, recordId } = await vap.certifyAndExecute(
  () => dex.swap('ETH', 'USDC', '1.0'),
  {
    actionType: ACTION_TYPES.SWAP,
    input: { price: 3200, signal: 'bullish' },
    reasoning: 'Market analysis indicates...',
    output: { action: 'buy', amount: '1.0' },
  }
);

// Verify any record
const verification = await vap.verifyRecord(recordId);
console.log(verification.valid); // true
```

## API

### `VAP` Class

#### Constructor

```typescript
new VAP(config: VAPConfig, storage?: StorageBackend)
```

#### Methods

| Method | Description |
|--------|-------------|
| `initialize()` | Initialize client and sync state |
| `registerAgent(params)` | Register a new agent |
| `createRecord(params)` | Create a VAP record |
| `submitRecord(record)` | Submit record to storage |
| `certify(params)` | Create and submit in one call |
| `certifyAndExecute(action, params)` | Certify, then execute action |
| `verifyRecord(recordId)` | Verify a record by ID |
| `getAgentHistory(agentId, options)` | Get agent's action history |
| `getAgentReputation(agentId)` | Get reputation score |

### Crypto Utilities

```typescript
import {
  generateKeyPair,
  hashObject,
  hashString,
  sign,
  verify,
} from '@vap/sdk';
```

### Types

```typescript
import type {
  VAPRecord,
  Constraint,
  ActionType,
  VerificationResult,
  ReputationScore,
} from '@vap/sdk';
```

## Storage Backends

The SDK ships with `InMemoryStorage` for testing. For production, implement the `StorageBackend` interface:

```typescript
interface StorageBackend {
  submitRecord(record: VAPRecord): Promise<{ recordId: Bytes32 }>;
  getRecord(recordId: Bytes32): Promise<VAPRecord | null>;
  getAgentRecords(agentId: Bytes32, options?: QueryOptions): Promise<VAPRecord[]>;
  getLatestRecord(agentId: Bytes32): Promise<VAPRecord | null>;
  getAgent(agentId: Bytes32): Promise<AgentRegistration | null>;
  registerAgent(registration: AgentRegistration): Promise<void>;
  getAgentPublicKey(agentId: Bytes32): Promise<string | null>;
}
```

## License

MIT
