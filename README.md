# Verifiable Agent Protocol (VAP)

**Cryptographic audit trails for AI agents.**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue.svg)](https://www.typescriptlang.org/)

---

## The Problem

AI agents are making real decisions with real consequences:
- Trading bots managing millions in assets
- Agents voting in DAOs
- AI systems signing blockchain transactions

But there's no way to answer:
- *"Why did the agent sell my tokens?"*
- *"Did it follow the rules I configured?"*
- *"Can I trust this agent's track record?"*

## The Solution

VAP defines how AI agents create **cryptographically verifiable audit trails** of their decisions.

```
┌─────────────────────────────────────────────────────────┐
│                    VAP RECORD                           │
├─────────────────────────────────────────────────────────┤
│ agent_id:        0x123...abc                            │
│ action_type:     SWAP                                   │
│ input_hash:      SHA256(market data + context)          │
│ reasoning_hash:  SHA256(chain-of-thought)               │
│ output_hash:     SHA256(final decision)                 │
│ constraints:     ["max_slippage:2%", "no_memecoins"]    │
│ signature:       Ed25519(agent_key)                     │
│ prev_record:     → chain to previous action             │
└─────────────────────────────────────────────────────────┘
```

Every action is:
- **Signed** by the agent's key
- **Chained** to previous actions
- **Timestamped** and sequenced
- **Verifiable** by anyone

## Quick Start

```bash
npm install @vap/sdk
```

```typescript
import { VAP } from '@vap/sdk';

const vap = new VAP({
    privateKey: process.env.AGENT_KEY,
    endpoint: 'https://rpc.slim-chain.io',
});

// Certify before executing
const { result, recordId } = await vap.certifyAndExecute(
    () => dex.swap('ETH', 'USDC', '1.0'),
    {
        actionType: 'SWAP',
        input: { price: 3200, signal: 'bullish' },
        reasoning: 'ETH oversold (RSI 28), buying 1 ETH',
        output: { action: 'buy', amount: '1.0' },
    }
);

// Anyone can verify
const verification = await vap.verifyRecord(recordId);
console.log(verification.valid); // true
```

## Features

- **Language-agnostic spec** - Implement in any language
- **Privacy options** - Encrypt reasoning, reveal on dispute
- **Constraint system** - Enforce rules, slash on violation
- **Reputation scoring** - Build verifiable track record
- **Chain-agnostic** - Works on any blockchain
- **TEE support** - Optional hardware attestation

## Documentation

- [Full Specification](./docs/SPEC.md)
- [TypeScript SDK](./sdk/typescript/)
- [Examples](./examples/)

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     YOUR AI AGENT                           │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                      VAP SDK                                │
│  createRecord() → signRecord() → submitRecord()             │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                    STORAGE LAYER                            │
│         SLIM-CHAIN  │  Ethereum  │  Arweave  │  ...         │
└─────────────────────────────────────────────────────────────┘
```

## Use Cases

### DeFi Trading Bot
```typescript
// Every trade is certified with reasoning
await vap.certifyAndExecute(
    () => vault.rebalance(),
    {
        actionType: 'SWAP',
        reasoning: 'Portfolio drifted 5% from target allocation...',
        constraints: [{ type: 'LIMIT', target: 'slippage', value: '1%' }],
    }
);
```

### DAO Governance Agent
```typescript
// Every vote is transparent and auditable
await vap.certifyAndExecute(
    () => dao.vote(proposalId, true),
    {
        actionType: 'VOTE',
        reasoning: 'Proposal aligns with treasury diversification goals...',
    }
);
```

### NFT Trading Agent
```typescript
// Build verifiable track record
await vap.certifyAndExecute(
    () => marketplace.buy(nftId),
    {
        actionType: 'BUY',
        reasoning: 'Floor price 20% below 7-day average...',
    }
);
```

## Roadmap

- [x] Protocol specification v0.1
- [x] TypeScript SDK
- [ ] Python SDK
- [ ] Rust SDK
- [ ] SLIM-CHAIN integration
- [ ] Block explorer plugin
- [ ] Dispute resolution system
- [ ] TEE attestation support

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

## License

MIT - FRUX

---

*Built for the autonomous agent economy.*
