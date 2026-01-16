# Guida VAP - Verifiable Agent Protocol

**La guida completa per capire e utilizzare il Verifiable Agent Protocol**

---

## Indice

1. [Cos'è VAP?](#cosè-vap)
2. [Perché serve?](#perché-serve)
3. [Come funziona](#come-funziona)
4. [Installazione](#installazione)
5. [Primi passi](#primi-passi)
6. [Concetti chiave](#concetti-chiave)
7. [Esempi pratici](#esempi-pratici)
8. [API Reference](#api-reference)
9. [FAQ](#faq)

---

## Cos'è VAP?

VAP (Verifiable Agent Protocol) è un protocollo che permette agli agenti AI di creare **tracce di audit crittograficamente verificabili** delle loro decisioni.

In parole semplici: ogni volta che un agente AI fa qualcosa (un trade, un voto, una transazione), VAP crea un "certificato" firmato che dimostra:

- **Cosa** ha fatto l'agente
- **Quando** l'ha fatto
- **Perché** l'ha fatto (il suo ragionamento)
- **Quali regole** stava seguendo

Questo certificato è:
- **Immutabile** - non può essere modificato dopo la creazione
- **Verificabile** - chiunque può controllare che sia autentico
- **Concatenato** - ogni azione è collegata alla precedente

---

## Perché serve?

### Il problema

Gli agenti AI stanno diventando sempre più autonomi:

- **Trading bot** che gestiscono milioni di euro
- **Agenti DAO** che votano su proposte importanti
- **AI** che firmano transazioni blockchain

Ma oggi non c'è modo di sapere:

- *"Perché il bot ha venduto i miei token?"*
- *"Ha seguito le regole che avevo impostato?"*
- *"Posso fidarmi della sua storia passata?"*

### La soluzione

VAP risolve questi problemi creando un **registro pubblico e verificabile** di ogni azione dell'agente.

| Senza VAP | Con VAP |
|-----------|---------|
| "Il bot ha venduto" | "Il bot ha venduto perché RSI era 28, seguendo la regola di comprare quando oversold" |
| "Fidati di me" | "Ecco la prova crittografica verificabile" |
| "Ho 1000 trade di successo" | "Ecco i 1000 record firmati e verificabili on-chain" |

---

## Come funziona

### Schema semplificato

```
┌─────────────────────────────────────────────────────────────┐
│                     IL TUO AGENTE AI                        │
│                                                             │
│  1. Riceve input (dati mercato, contesto, ecc.)            │
│  2. Ragiona ("RSI basso, devo comprare...")                │
│  3. Decide l'azione ("compra 1 ETH")                       │
│                                                             │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                       VAP SDK                               │
│                                                             │
│  1. Crea un HASH dell'input                                │
│  2. Crea un HASH del ragionamento                          │
│  3. Crea un HASH dell'output                               │
│  4. Firma tutto con la chiave dell'agente                  │
│  5. Collega al record precedente                           │
│                                                             │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                    VAP RECORD                               │
├─────────────────────────────────────────────────────────────┤
│ agent_id:        0x123...abc                                │
│ action_type:     SWAP                                       │
│ input_hash:      SHA256(dati mercato)                       │
│ reasoning_hash:  SHA256("RSI basso, compro...")            │
│ output_hash:     SHA256("compra 1 ETH")                    │
│ constraints:     ["max_slippage:2%"]                        │
│ signature:       Ed25519(chiave_agente)                     │
│ prev_record:     0xabc...789 (link al record precedente)   │
│ sequence:        42                                         │
│ timestamp:       1705123456000                              │
└─────────────────────────────────────────────────────────────┘
```

### Perché gli hash?

Gli hash servono per:

1. **Privacy** - Il ragionamento completo non è esposto pubblicamente
2. **Efficienza** - Gli hash sono piccoli (32 byte) vs il ragionamento completo
3. **Verificabilità** - Se hai il testo originale, puoi verificare che l'hash corrisponda

Se serve rivelare il ragionamento (es. in caso di disputa), l'agente può fornire il testo completo e chiunque può verificare che corrisponda all'hash registrato.

---

## Installazione

### Requisiti

- Node.js 18+
- npm o yarn

### Installazione

```bash
npm install @vap/sdk
```

O con yarn:

```bash
yarn add @vap/sdk
```

---

## Primi passi

### 1. Importa il SDK

```typescript
import { VAP, generateKeyPair } from '@vap/sdk';
```

### 2. Genera una chiave per l'agente

```typescript
const { privateKey, publicKey } = await generateKeyPair();
console.log('Chiave privata:', privateKey);
console.log('Chiave pubblica:', publicKey);

// IMPORTANTE: Salva la chiave privata in modo sicuro!
// Es: process.env.AGENT_PRIVATE_KEY
```

### 3. Inizializza il client VAP

```typescript
const vap = new VAP({
  privateKey: process.env.AGENT_PRIVATE_KEY,
  modelId: 'il-mio-agente-v1',
});

await vap.initialize();
```

### 4. Registra l'agente

```typescript
const agentId = await vap.registerAgent({
  operator: '0x...', // Il tuo indirizzo wallet
  metadataUri: 'https://example.com/agent-metadata.json',
});

console.log('Agente registrato con ID:', agentId);
```

### 5. Certifica un'azione

```typescript
const { record, recordId } = await vap.certify({
  actionType: 'SWAP',
  input: {
    price: 3200,
    rsi: 28,
    signal: 'oversold',
  },
  reasoning: 'ETH è in oversold (RSI 28), il segnale suggerisce di comprare. Procedo con acquisto di 1 ETH.',
  output: {
    action: 'buy',
    token: 'ETH',
    amount: '1.0',
  },
  actionData: {
    tokenIn: 'USDC',
    tokenOut: 'ETH',
    amountIn: '3200',
  },
});

console.log('Azione certificata:', recordId);
```

### 6. Verifica un record

```typescript
const verification = await vap.verifyRecord(recordId);

if (verification.valid) {
  console.log('Record valido!');
  console.log('Controlli:', verification.checks);
} else {
  console.log('Record NON valido:', verification.error);
}
```

---

## Concetti chiave

### Agent ID

Ogni agente ha un identificatore unico (32 byte). Viene generato da:

```
agent_id = SHA256(operator_address + nonce)
```

L'agent ID è usato per:
- Tracciare tutte le azioni di un agente
- Costruire la reputazione
- Verificare le firme

### Record Chain

Ogni record contiene un riferimento al record precedente (`prevRecord`), creando una **catena immutabile** di azioni.

```
Record 1 ← Record 2 ← Record 3 ← Record 4
   │           │           │           │
   seq=1      seq=2       seq=3       seq=4
```

Questo garantisce:
- **Ordinamento** - Nessuno può inserire record "nel passato"
- **Completezza** - Nessun record può essere nascosto
- **Integrità** - Modificare un record invalida tutti i successivi

### Constraints (Vincoli)

I vincoli sono regole che l'agente dichiara di seguire:

```typescript
const constraints = [
  {
    id: 'max-slippage',
    type: 'LIMIT',
    target: 'slippage',
    value: '2%',
    description: 'Slippage massimo consentito',
  },
  {
    id: 'no-memecoins',
    type: 'DENYLIST',
    target: 'token',
    value: ['DOGE', 'SHIB', 'PEPE'],
    description: 'Token vietati',
  },
  {
    id: 'allowed-pools',
    type: 'ALLOWLIST',
    target: 'pool',
    value: ['uniswap-v3', 'curve'],
    description: 'Pool consentiti',
  },
];
```

Tipi di vincoli disponibili:

| Tipo | Descrizione | Esempio |
|------|-------------|---------|
| `LIMIT` | Limite numerico | max slippage 2% |
| `ALLOWLIST` | Lista di valori consentiti | solo token X, Y, Z |
| `DENYLIST` | Lista di valori vietati | no memecoins |
| `RATE_LIMIT` | Limite di frequenza | max 10 trade/ora |
| `CUSTOM` | Logica personalizzata | qualsiasi regola |

### Action Types (Tipi di azione)

VAP definisce tipi standard di azione:

| Tipo | Descrizione |
|------|-------------|
| `SWAP` | Scambio di token |
| `TRANSFER` | Trasferimento di fondi |
| `STAKE` | Staking di token |
| `UNSTAKE` | Unstaking di token |
| `VOTE` | Voto su proposta |
| `DELEGATE` | Delega di voto |
| `APPROVE` | Approvazione di spesa |
| `MINT` | Creazione di token/NFT |
| `BURN` | Distruzione di token |
| `CUSTOM` | Azione personalizzata |

### Reputation (Reputazione)

VAP calcola un punteggio di reputazione basato su:

```typescript
const reputation = await vap.getAgentReputation(agentId);

console.log('Azioni totali:', reputation.totalActions);
console.log('Tasso di successo:', reputation.successRate);
console.log('Violazioni:', reputation.violationCount);
console.log('Punteggio fiducia:', reputation.trustScore);
console.log('Tier:', reputation.tier);
```

I tier disponibili sono:

| Tier | Requisiti |
|------|-----------|
| `UNVERIFIED` | < 10 azioni o trust < 0.3 |
| `BRONZE` | 10+ azioni, trust 0.3-0.5 |
| `SILVER` | 100+ azioni, trust 0.5-0.7 |
| `GOLD` | 1000+ azioni, trust 0.7-0.9 |
| `PLATINUM` | 10000+ azioni, trust 0.9+ |

---

## Esempi pratici

### Trading Bot DeFi

```typescript
import { VAP } from '@vap/sdk';

class TradingBot {
  private vap: VAP;

  constructor(privateKey: string) {
    this.vap = new VAP({
      privateKey,
      modelId: 'defi-trader-v1',
      defaultConstraints: [
        { id: 'slippage', type: 'LIMIT', target: 'slippage', value: '1%' },
        { id: 'no-meme', type: 'DENYLIST', target: 'token', value: ['DOGE', 'SHIB'] },
      ],
    });
  }

  async initialize() {
    await this.vap.initialize();
  }

  async executeSwap(tokenIn: string, tokenOut: string, amount: string) {
    // Analizza il mercato
    const analysis = await this.analyzeMarket(tokenIn, tokenOut);

    // Decidi se procedere
    if (!analysis.shouldTrade) {
      console.log('Nessun trade consigliato');
      return null;
    }

    // Certifica ed esegui atomicamente
    const { result, record, recordId } = await this.vap.certifyAndExecute(
      // L'azione da eseguire
      async () => {
        return await this.dex.swap(tokenIn, tokenOut, amount);
      },
      // I metadati del record
      {
        actionType: 'SWAP',
        input: {
          tokenIn,
          tokenOut,
          amount,
          price: analysis.price,
          indicators: analysis.indicators,
        },
        reasoning: `
          Analisi: ${tokenIn}/${tokenOut} a ${analysis.price}
          RSI: ${analysis.indicators.rsi} (${analysis.indicators.rsi < 30 ? 'oversold' : 'normale'})
          Trend: ${analysis.indicators.trend}
          Decisione: ${analysis.recommendation}
        `,
        output: {
          action: 'swap',
          tokenIn,
          tokenOut,
          amount,
          expectedOut: analysis.expectedOutput,
        },
        actionData: {
          dex: 'uniswap-v3',
          pool: analysis.bestPool,
          slippage: '0.5%',
        },
      }
    );

    console.log(`Trade eseguito e certificato: ${recordId}`);
    return { result, recordId };
  }
}

// Uso
const bot = new TradingBot(process.env.AGENT_KEY);
await bot.initialize();
await bot.executeSwap('USDC', 'ETH', '1000');
```

### Agente DAO

```typescript
import { VAP } from '@vap/sdk';

class DAOAgent {
  private vap: VAP;

  constructor(privateKey: string) {
    this.vap = new VAP({
      privateKey,
      modelId: 'dao-voter-v1',
    });
  }

  async voteOnProposal(proposalId: string, dao: any) {
    // Analizza la proposta
    const proposal = await dao.getProposal(proposalId);
    const analysis = await this.analyzeProposal(proposal);

    // Certifica il voto
    const { record, recordId } = await this.vap.certifyAndExecute(
      async () => dao.vote(proposalId, analysis.vote),
      {
        actionType: 'VOTE',
        input: {
          proposalId,
          proposalTitle: proposal.title,
          proposalSummary: proposal.summary,
          currentVotes: proposal.votes,
        },
        reasoning: `
          Proposta: "${proposal.title}"

          Pro:
          ${analysis.pros.map(p => `- ${p}`).join('\n')}

          Contro:
          ${analysis.cons.map(c => `- ${c}`).join('\n')}

          Allineamento con obiettivi del DAO: ${analysis.alignment}/10

          Decisione finale: ${analysis.vote ? 'A FAVORE' : 'CONTRO'}
          Motivazione: ${analysis.summary}
        `,
        output: {
          vote: analysis.vote,
          confidence: analysis.confidence,
        },
      }
    );

    console.log(`Voto registrato: ${analysis.vote ? 'A FAVORE' : 'CONTRO'}`);
    console.log(`Record: ${recordId}`);
  }
}
```

### Verificare la storia di un agente

```typescript
import { VAP } from '@vap/sdk';

async function auditAgent(agentId: string) {
  const vap = new VAP({ privateKey: '...' });

  // Ottieni la storia completa
  const history = await vap.getAgentHistory(agentId, {
    from: Date.now() - 30 * 24 * 60 * 60 * 1000, // ultimi 30 giorni
    limit: 100,
  });

  console.log(`Trovati ${history.length} record\n`);

  // Verifica ogni record
  for (const record of history) {
    const verification = await vap.verifyRecordData(record);

    console.log(`Record ${record.sequence}:`);
    console.log(`  Tipo: ${record.actionType}`);
    console.log(`  Data: ${new Date(record.timestamp).toISOString()}`);
    console.log(`  Valido: ${verification.valid ? 'SI' : 'NO'}`);

    if (!verification.valid) {
      console.log(`  Errore: ${verification.error}`);
    }
    console.log('');
  }

  // Ottieni reputazione
  const reputation = await vap.getAgentReputation(agentId);
  console.log('=== REPUTAZIONE ===');
  console.log(`Tier: ${reputation.tier}`);
  console.log(`Trust Score: ${(reputation.trustScore * 100).toFixed(1)}%`);
  console.log(`Azioni totali: ${reputation.totalActions}`);
  console.log(`Violazioni: ${reputation.violationCount}`);
}
```

---

## API Reference

### Classe VAP

#### Constructor

```typescript
new VAP(config: VAPConfig, storage?: StorageBackend)
```

**VAPConfig:**

| Campo | Tipo | Obbligatorio | Descrizione |
|-------|------|--------------|-------------|
| `privateKey` | string | Si | Chiave privata Ed25519 (hex) |
| `agentId` | string | No | ID agente esistente |
| `modelId` | string | No | Identificatore del modello AI |
| `modelVersion` | string | No | Versione del modello |
| `defaultConstraints` | Constraint[] | No | Vincoli di default |

#### Metodi

| Metodo | Descrizione |
|--------|-------------|
| `initialize()` | Inizializza il client e sincronizza con storage |
| `registerAgent(params)` | Registra un nuovo agente |
| `createRecord(params)` | Crea un record (senza submit) |
| `submitRecord(record)` | Invia un record allo storage |
| `certify(params)` | Crea e invia un record |
| `certifyAndExecute(action, params)` | Certifica ed esegui atomicamente |
| `verifyRecord(recordId)` | Verifica un record per ID |
| `verifyRecordData(record)` | Verifica un oggetto record |
| `getAgentHistory(agentId, options)` | Ottieni storia dell'agente |
| `getAgentReputation(agentId)` | Ottieni punteggio reputazione |

### Funzioni Crypto

```typescript
import {
  generateKeyPair,
  getPublicKey,
  sign,
  verify,
  hashObject,
  hashString,
  computeRecordId,
  signRecord,
  verifyRecordSignature,
  generateAgentId,
  generateNonce,
} from '@vap/sdk';
```

| Funzione | Descrizione |
|----------|-------------|
| `generateKeyPair()` | Genera coppia chiavi Ed25519 |
| `getPublicKey(privateKey)` | Deriva chiave pubblica |
| `sign(message, privateKey)` | Firma un messaggio |
| `verify(message, signature, publicKey)` | Verifica firma |
| `hashObject(obj)` | Hash SHA256 di un oggetto |
| `hashString(str)` | Hash SHA256 di una stringa |
| `computeRecordId(record)` | Calcola ID di un record |
| `signRecord(record, privateKey)` | Firma un record |
| `verifyRecordSignature(record, publicKey)` | Verifica firma record |

---

## FAQ

### Il ragionamento dell'agente è pubblico?

**No.** Solo l'hash del ragionamento è pubblico. Il testo completo rimane privato a meno che:
- L'agente decida di rivelarlo volontariamente
- Sia richiesto in caso di disputa
- La reveal policy lo permetta

### Quanto costa usare VAP?

Dipende dallo storage backend:
- **InMemoryStorage** (test): Gratuito
- **SLIM-CHAIN**: Costo minimo per record (pochi centesimi)
- **Ethereum**: Costo gas standard

### VAP garantisce che l'agente sia onesto?

**No.** VAP garantisce solo che:
- L'agente ha dichiarato di fare X per il motivo Y
- La dichiarazione è firmata e immutabile
- Puoi verificare la storia completa

Un agente può comunque mentire nel suo ragionamento. VAP rende le bugie **rilevabili e punibili**, non impossibili.

### Posso usare VAP con qualsiasi blockchain?

Si. VAP è chain-agnostic. Puoi implementare un `StorageBackend` per qualsiasi blockchain o sistema di storage.

### Come gestisco le chiavi in produzione?

Raccomandazioni:
1. Mai hardcodare le chiavi nel codice
2. Usa variabili d'ambiente o secret manager
3. Considera l'uso di HSM per chiavi di alto valore
4. Ruota le chiavi periodicamente

```typescript
// Buono
const vap = new VAP({
  privateKey: process.env.AGENT_PRIVATE_KEY,
});

// Cattivo
const vap = new VAP({
  privateKey: '0x123...', // MAI fare questo!
});
```

### Cosa succede se perdo la chiave privata?

Se perdi la chiave privata:
- Non puoi più firmare nuovi record per quell'agente
- I record esistenti rimangono validi
- Devi creare un nuovo agente con nuova chiave

Backup sempre le chiavi in modo sicuro!

---

## Risorse aggiuntive

- [Specifica completa (inglese)](./SPEC.md)
- [Repository GitHub](https://github.com/matteuccimarco/vap-protocol)
- [Esempi completi](../examples/)

---

*Built with love by FRUX*
