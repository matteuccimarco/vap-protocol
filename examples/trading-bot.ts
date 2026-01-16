/**
 * Example: Trading Bot with VAP Certification
 *
 * This example shows how to integrate VAP into a DeFi trading bot
 * to create verifiable audit trails of all trading decisions.
 */

import { VAP, generateKeyPair, ACTION_TYPES } from '@vap/sdk';

// Simulated DEX interface
interface DEX {
  swap(tokenIn: string, tokenOut: string, amount: string): Promise<{ txHash: string }>;
  getPrice(pair: string): Promise<number>;
}

// Mock DEX for example
const mockDex: DEX = {
  async swap(tokenIn, tokenOut, amount) {
    console.log(`Executing swap: ${amount} ${tokenIn} → ${tokenOut}`);
    return { txHash: '0x' + Math.random().toString(16).slice(2) };
  },
  async getPrice(pair) {
    return 3200 + Math.random() * 100;
  },
};

async function main() {
  // ==========================================================================
  // 1. Setup
  // ==========================================================================

  // Generate agent keys (in production, load from secure storage)
  const { privateKey, publicKey } = await generateKeyPair();
  console.log('Agent public key:', publicKey);

  // Initialize VAP client
  const vap = new VAP({
    privateKey,
    endpoint: 'https://rpc.slim-chain.io', // Will use in-memory storage for demo
    modelId: 'trading-bot-v1',
    modelVersion: '1.0.0',
    defaultConstraints: [
      {
        id: 'max-trade-size',
        type: 'LIMIT',
        target: 'trade_percent',
        value: '5',
        enforced: true,
      },
      {
        id: 'no-memecoins',
        type: 'DENYLIST',
        target: 'tokens',
        value: 'DOGE,SHIB,PEPE',
        enforced: true,
      },
    ],
  });

  await vap.initialize();

  // Register agent
  const agentId = await vap.registerAgent({
    operator: '0x1234567890123456789012345678901234567890',
    metadataUri: 'ipfs://QmExample...',
  });
  console.log('Agent registered:', agentId);

  // ==========================================================================
  // 2. Trading with Certification
  // ==========================================================================

  // Get market data
  const ethPrice = await mockDex.getPrice('ETH/USDC');
  const marketContext = {
    pair: 'ETH/USDC',
    price: ethPrice,
    timestamp: Date.now(),
    rsi: 28, // Simulated RSI indicator
    volume24h: 1500000000,
  };

  // Agent reasoning (this would come from your AI model)
  const reasoning = `
Market Analysis for ETH/USDC:
- Current price: $${ethPrice.toFixed(2)}
- RSI: 28 (oversold territory, below 30)
- 24h Volume: $1.5B (healthy liquidity)

Decision Process:
1. RSI below 30 indicates oversold conditions
2. Historical data shows 75% probability of bounce within 24h
3. User constraints allow up to 5% of portfolio per trade
4. ETH is not on denylist

Conclusion: Execute buy order for 1 ETH (3% of portfolio)
Risk: Medium - stop loss recommended at -10%
  `.trim();

  // Decision output
  const decision = {
    action: 'BUY',
    pair: 'ETH/USDC',
    amount: '1.0',
    reason: 'RSI oversold bounce strategy',
    confidence: 0.75,
    stopLoss: ethPrice * 0.9,
    takeProfit: ethPrice * 1.15,
  };

  console.log('\n--- Executing Certified Trade ---');
  console.log('Reasoning:', reasoning.slice(0, 100) + '...');
  console.log('Decision:', decision);

  // Certify and execute
  const { result, record, recordId } = await vap.certifyAndExecute(
    () => mockDex.swap('USDC', 'ETH', '3200'),
    {
      actionType: ACTION_TYPES.SWAP,
      actionData: {
        dex: 'uniswap_v3',
        tokenIn: 'USDC',
        tokenOut: 'ETH',
        amountIn: '3200',
        minAmountOut: '0.99',
        slippageBps: 50,
      },
      input: marketContext,
      reasoning,
      output: decision,
    },
  );

  console.log('\n--- Trade Certified ---');
  console.log('Record ID:', recordId);
  console.log('Sequence:', record.sequence);
  console.log('TX Hash:', result.txHash);

  // ==========================================================================
  // 3. Verification
  // ==========================================================================

  console.log('\n--- Verifying Record ---');
  const verification = await vap.verifyRecord(recordId);
  console.log('Valid:', verification.valid);
  console.log('Checks:', verification.checks);

  // ==========================================================================
  // 4. Audit Trail
  // ==========================================================================

  console.log('\n--- Agent History ---');
  const history = await vap.getAgentHistory(agentId);
  console.log(`Total certified actions: ${history.length}`);

  for (const r of history) {
    console.log(`  #${r.sequence}: ${r.actionType} at ${new Date(r.timestamp).toISOString()}`);
  }

  // ==========================================================================
  // 5. Reputation
  // ==========================================================================

  console.log('\n--- Agent Reputation ---');
  const reputation = await vap.getAgentReputation(agentId);
  console.log('Trust Score:', reputation.trustScore.toFixed(3));
  console.log('Tier:', reputation.tier);
  console.log('Total Actions:', reputation.totalActions);
}

main().catch(console.error);
