/**
 * Example: DAO Voting Agent with VAP Certification
 *
 * This example shows how a DAO governance agent can create
 * verifiable records of its voting decisions.
 */

import { VAP, generateKeyPair, ACTION_TYPES } from '@vap/sdk';

// Simulated DAO interface
interface DAO {
  getProposal(id: number): Promise<Proposal>;
  vote(proposalId: number, support: boolean): Promise<{ txHash: string }>;
}

interface Proposal {
  id: number;
  title: string;
  description: string;
  proposer: string;
  forVotes: bigint;
  againstVotes: bigint;
  startTime: number;
  endTime: number;
}

// Mock DAO
const mockDao: DAO = {
  async getProposal(id) {
    return {
      id,
      title: 'Treasury Diversification: Allocate 10% to ETH',
      description:
        'This proposal aims to diversify the DAO treasury by converting 10% of stablecoin holdings to ETH to benefit from potential appreciation while maintaining a conservative risk profile.',
      proposer: '0xabc...123',
      forVotes: BigInt('15000000000000000000000000'),
      againstVotes: BigInt('5000000000000000000000000'),
      startTime: Date.now() - 3 * 24 * 60 * 60 * 1000,
      endTime: Date.now() + 4 * 24 * 60 * 60 * 1000,
    };
  },
  async vote(proposalId, support) {
    console.log(`Voting ${support ? 'FOR' : 'AGAINST'} proposal #${proposalId}`);
    return { txHash: '0x' + Math.random().toString(16).slice(2) };
  },
};

async function main() {
  // Setup
  const { privateKey } = await generateKeyPair();

  const vap = new VAP({
    privateKey,
    endpoint: 'https://rpc.slim-chain.io',
    modelId: 'dao-voter-v1',
    defaultConstraints: [
      {
        id: 'voting-principles',
        type: 'CUSTOM',
        target: 'governance',
        value: 'conservative-treasury-management',
        enforced: true,
      },
      {
        id: 'min-quorum-check',
        type: 'LIMIT',
        target: 'quorum_percent',
        value: '10',
        enforced: true,
      },
    ],
  });

  await vap.initialize();

  const agentId = await vap.registerAgent({
    operator: '0xDAO_MULTISIG_ADDRESS',
    metadataUri: 'ipfs://QmDAOVoterMetadata...',
  });

  console.log('DAO Voting Agent registered:', agentId);

  // ==========================================================================
  // Analyze and Vote on Proposal
  // ==========================================================================

  const proposalId = 42;
  const proposal = await mockDao.getProposal(proposalId);

  console.log('\n--- Analyzing Proposal ---');
  console.log('Title:', proposal.title);
  console.log('Current votes: FOR', proposal.forVotes.toString(), 'AGAINST', proposal.againstVotes.toString());

  // Agent's analysis context
  const analysisContext = {
    proposalId: proposal.id,
    title: proposal.title,
    description: proposal.description,
    currentForVotes: proposal.forVotes.toString(),
    currentAgainstVotes: proposal.againstVotes.toString(),
    timeRemaining: proposal.endTime - Date.now(),
    treasuryBalance: '50000000', // $50M in stables
    ethPrice: 3200,
  };

  // Agent's reasoning (from AI model)
  const reasoning = `
# Proposal Analysis: Treasury Diversification

## Summary
Proposal #42 seeks to allocate 10% of treasury stablecoins to ETH.

## Evaluation Against Governance Principles

### 1. Conservative Treasury Management ✓
- 10% allocation is within acceptable risk parameters
- Maintains 90% in stablecoins for operational needs
- Diversification reduces single-asset risk

### 2. Risk Assessment
- ETH is a blue-chip crypto asset with strong fundamentals
- Historical drawdowns up to 80% in bear markets
- Current market conditions: neutral to slightly bullish
- Risk: MODERATE

### 3. Alignment with DAO Goals
- Treasury growth is a stated DAO objective
- ETH staking could generate additional yield (3-5% APR)
- Aligns with long-term sustainability goals

### 4. Quorum Check ✓
- Current participation: 20M votes out of 200M supply (10%)
- Meets minimum quorum requirement

## Decision
Based on the analysis, this proposal aligns with conservative treasury
management principles while providing reasonable upside potential.

RECOMMENDATION: VOTE FOR
CONFIDENCE: 78%
  `.trim();

  // Decision
  const decision = {
    vote: 'FOR',
    reasoning_summary: 'Aligns with conservative treasury management while providing diversification',
    confidence: 0.78,
    key_factors: [
      '10% allocation is within risk parameters',
      'ETH staking provides additional yield',
      'Meets quorum requirements',
    ],
  };

  console.log('\n--- Voting Decision ---');
  console.log('Vote:', decision.vote);
  console.log('Confidence:', (decision.confidence * 100).toFixed(0) + '%');

  // Certify and vote
  const { result, recordId } = await vap.certifyAndExecute(
    () => mockDao.vote(proposalId, true),
    {
      actionType: ACTION_TYPES.VOTE,
      actionData: {
        chainId: 1,
        dao: '0xDAO_CONTRACT_ADDRESS',
        proposalId,
        support: true,
        votes: '1000000000000000000000', // 1000 tokens
      },
      input: analysisContext,
      reasoning,
      output: decision,
      revealPolicy: {
        type: 'PUBLIC', // DAO votes should be transparent
      },
    },
  );

  console.log('\n--- Vote Certified ---');
  console.log('Record ID:', recordId);
  console.log('TX Hash:', result.txHash);

  // Verify
  const verification = await vap.verifyRecord(recordId);
  console.log('\n--- Verification ---');
  console.log('Valid:', verification.valid);

  // Show how anyone can audit
  console.log('\n--- Audit Trail ---');
  console.log('Any DAO member can now verify:');
  console.log('1. What information the agent had (input_hash)');
  console.log('2. How it reasoned about the vote (reasoning_hash)');
  console.log('3. What decision it made (output_hash)');
  console.log('4. That it followed its constraints');
  console.log('5. Complete chain of all past votes');
}

main().catch(console.error);
