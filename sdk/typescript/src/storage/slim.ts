/**
 * SLIM-RPC Storage Backend for VAP
 *
 * Connects to SLIM-CHAIN via the SLIM-RPC gateway for efficient
 * storage and retrieval of VAP records.
 */

import type { StorageBackend } from '../client/index.js';
import type {
  VAPRecord,
  Bytes32,
  QueryOptions,
  AgentRegistration,
} from '../types/index.js';

// ============================================================================
// SLIM-RPC Protocol
// ============================================================================

/**
 * SLIM-RPC request format: {version|method|params|id}
 */
function encodeSlimRequest(method: string, params: unknown, id: number): string {
  const encodedParams = encodeSlimValue(params);
  return `{1.0|${method}|${encodedParams}|#${id}}`;
}

/**
 * Encode a value to SLIM format.
 */
function encodeSlimValue(value: unknown): string {
  if (value === null || value === undefined) {
    return '!null';
  }

  if (typeof value === 'boolean') {
    return value ? '?T' : '?F';
  }

  if (typeof value === 'number') {
    return `#${value}`;
  }

  if (typeof value === 'bigint') {
    return `#${value.toString()}`;
  }

  if (typeof value === 'string') {
    // Check if string needs quoting (contains special chars)
    if (/[|{}\[\];,:#?!@"]/.test(value) || value.includes(' ')) {
      return `"${value.replace(/"/g, '\\"')}"`;
    }
    return value;
  }

  if (Array.isArray(value)) {
    const items = value.map((item) => encodeSlimValue(item));
    return `@[${items.join(';')}]`;
  }

  if (typeof value === 'object') {
    const pairs = Object.entries(value).map(([k, v]) => `${k}:${encodeSlimValue(v)}`);
    return `{${pairs.join(',')}}`;
  }

  throw new Error(`Cannot encode SLIM value: ${typeof value}`);
}

/**
 * Parse a SLIM-RPC response.
 */
function parseSlimResponse(response: string): { result?: unknown; error?: SlimError } {
  // Basic parsing - format: {version|result|id} or {version|!error|{code:#N,message:...}|id}
  const match = response.match(/^\{1\.0\|(.+)\|#\d+\}$/);
  if (!match) {
    throw new Error(`Invalid SLIM response format: ${response}`);
  }

  const content = match[1];

  // Check for error
  if (content.startsWith('!error|')) {
    const errorMatch = content.match(/!error\|\{code:#(-?\d+),message:(.+)\}/);
    if (errorMatch) {
      return {
        error: {
          code: parseInt(errorMatch[1], 10),
          message: errorMatch[2],
        },
      };
    }
    return { error: { code: -1, message: 'Unknown error' } };
  }

  // Parse result
  return { result: parseSlimValue(content) };
}

/**
 * Parse a SLIM value.
 */
function parseSlimValue(value: string): unknown {
  value = value.trim();

  // Null
  if (value === '!null') {
    return null;
  }

  // Boolean
  if (value === '?T') return true;
  if (value === '?F') return false;

  // Number
  if (value.startsWith('#')) {
    const num = value.slice(1);
    if (num.includes('.')) {
      return parseFloat(num);
    }
    // Check if it's a BigInt (very large number)
    if (num.length > 15) {
      return BigInt(num);
    }
    return parseInt(num, 10);
  }

  // Quoted string
  if (value.startsWith('"') && value.endsWith('"')) {
    return value.slice(1, -1).replace(/\\"/g, '"');
  }

  // Array
  if (value.startsWith('@[') && value.endsWith(']')) {
    const inner = value.slice(2, -1);
    if (inner === '') return [];
    return splitSlimArray(inner).map((item) => parseSlimValue(item));
  }

  // Object
  if (value.startsWith('{') && value.endsWith('}')) {
    const inner = value.slice(1, -1);
    if (inner === '') return {};
    const obj: Record<string, unknown> = {};
    for (const pair of splitSlimObject(inner)) {
      const colonIndex = pair.indexOf(':');
      if (colonIndex > 0) {
        const key = pair.slice(0, colonIndex);
        const val = pair.slice(colonIndex + 1);
        obj[key] = parseSlimValue(val);
      }
    }
    return obj;
  }

  // Plain string
  return value;
}

/**
 * Split SLIM array items (handling nested structures).
 */
function splitSlimArray(inner: string): string[] {
  const items: string[] = [];
  let current = '';
  let depth = 0;
  let inQuote = false;

  for (let i = 0; i < inner.length; i++) {
    const char = inner[i];

    if (char === '"' && inner[i - 1] !== '\\') {
      inQuote = !inQuote;
    }

    if (!inQuote) {
      if (char === '{' || char === '[') depth++;
      if (char === '}' || char === ']') depth--;
      if (char === ';' && depth === 0) {
        items.push(current.trim());
        current = '';
        continue;
      }
    }

    current += char;
  }

  if (current.trim()) {
    items.push(current.trim());
  }

  return items;
}

/**
 * Split SLIM object pairs (handling nested structures).
 */
function splitSlimObject(inner: string): string[] {
  const pairs: string[] = [];
  let current = '';
  let depth = 0;
  let inQuote = false;

  for (let i = 0; i < inner.length; i++) {
    const char = inner[i];

    if (char === '"' && inner[i - 1] !== '\\') {
      inQuote = !inQuote;
    }

    if (!inQuote) {
      if (char === '{' || char === '[') depth++;
      if (char === '}' || char === ']') depth--;
      if (char === ',' && depth === 0) {
        pairs.push(current.trim());
        current = '';
        continue;
      }
    }

    current += char;
  }

  if (current.trim()) {
    pairs.push(current.trim());
  }

  return pairs;
}

interface SlimError {
  code: number;
  message: string;
}

// ============================================================================
// SLIM Storage Backend
// ============================================================================

export interface SlimStorageConfig {
  /** SLIM-RPC gateway URL (e.g., http://localhost:3100) */
  endpoint: string;
  /** Optional API key for authentication */
  apiKey?: string;
  /** Request timeout in milliseconds (default: 30000) */
  timeout?: number;
  /** Use SLIM format (true) or JSON passthrough (false) */
  useSlimFormat?: boolean;
}

/**
 * Storage backend that connects to SLIM-CHAIN via SLIM-RPC gateway.
 */
export class SlimStorageBackend implements StorageBackend {
  private endpoint: string;
  private apiKey?: string;
  private timeout: number;
  private useSlimFormat: boolean;
  private requestId = 0;

  constructor(config: SlimStorageConfig | string) {
    if (typeof config === 'string') {
      this.endpoint = config;
      this.timeout = 30000;
      this.useSlimFormat = true;
    } else {
      this.endpoint = config.endpoint;
      this.apiKey = config.apiKey;
      this.timeout = config.timeout || 30000;
      this.useSlimFormat = config.useSlimFormat !== false;
    }
  }

  /**
   * Make a request to the SLIM-RPC gateway.
   */
  private async request<T>(method: string, params: unknown): Promise<T> {
    const id = ++this.requestId;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      let body: string;
      let contentType: string;
      let url: string;

      if (this.useSlimFormat) {
        body = encodeSlimRequest(method, params, id);
        contentType = 'application/slim-rpc';
        url = `${this.endpoint}/slim`;
      } else {
        body = JSON.stringify({
          jsonrpc: '2.0',
          method,
          params,
          id,
        });
        contentType = 'application/json';
        url = `${this.endpoint}/json`;
      }

      const headers: Record<string, string> = {
        'Content-Type': contentType,
      };

      if (this.apiKey) {
        headers['Authorization'] = `Bearer ${this.apiKey}`;
      }

      const response = await fetch(url, {
        method: 'POST',
        headers,
        body,
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP error: ${response.status} ${response.statusText}`);
      }

      const responseText = await response.text();

      if (this.useSlimFormat) {
        const parsed = parseSlimResponse(responseText);
        if (parsed.error) {
          throw new Error(`SLIM-RPC error ${parsed.error.code}: ${parsed.error.message}`);
        }
        return parsed.result as T;
      } else {
        const parsed = JSON.parse(responseText);
        if (parsed.error) {
          throw new Error(`JSON-RPC error ${parsed.error.code}: ${parsed.error.message}`);
        }
        return parsed.result as T;
      }
    } finally {
      clearTimeout(timeoutId);
    }
  }

  // ==========================================================================
  // StorageBackend Implementation
  // ==========================================================================

  async submitRecord(record: VAPRecord): Promise<{ recordId: Bytes32; txHash?: string }> {
    const result = await this.request<{ recordId: string; txHash?: string }>(
      'vap_submitRecord',
      { record },
    );
    return {
      recordId: result.recordId as Bytes32,
      txHash: result.txHash,
    };
  }

  async getRecord(recordId: Bytes32): Promise<VAPRecord | null> {
    const result = await this.request<VAPRecord | null>('vap_getRecord', { recordId });
    return result ? this.deserializeRecord(result) : null;
  }

  async getAgentRecords(agentId: Bytes32, options?: QueryOptions): Promise<VAPRecord[]> {
    const result = await this.request<VAPRecord[]>('vap_getAgentRecords', {
      agentId,
      ...options,
    });
    return result.map((r) => this.deserializeRecord(r));
  }

  async getLatestRecord(agentId: Bytes32): Promise<VAPRecord | null> {
    const result = await this.request<VAPRecord | null>('vap_getLatestRecord', { agentId });
    return result ? this.deserializeRecord(result) : null;
  }

  async getAgent(agentId: Bytes32): Promise<AgentRegistration | null> {
    const result = await this.request<AgentRegistration | null>('vap_getAgent', { agentId });
    return result ? this.deserializeAgent(result) : null;
  }

  async registerAgent(registration: AgentRegistration): Promise<void> {
    await this.request<void>('vap_registerAgent', { registration });
  }

  async getAgentPublicKey(agentId: Bytes32): Promise<string | null> {
    const agent = await this.getAgent(agentId);
    return agent?.publicKey || null;
  }

  // ==========================================================================
  // Deserialization helpers
  // ==========================================================================

  private deserializeRecord(raw: VAPRecord): VAPRecord {
    return {
      ...raw,
      // Ensure BigInt fields are properly converted
      timestamp: typeof raw.timestamp === 'string' ? parseInt(raw.timestamp, 10) : raw.timestamp,
      sequence: typeof raw.sequence === 'string' ? parseInt(raw.sequence, 10) : raw.sequence,
    };
  }

  private deserializeAgent(raw: AgentRegistration): AgentRegistration {
    return {
      ...raw,
      stakeAmount:
        raw.stakeAmount !== undefined
          ? typeof raw.stakeAmount === 'string'
            ? BigInt(raw.stakeAmount)
            : raw.stakeAmount
          : undefined,
    };
  }

  // ==========================================================================
  // Additional SLIM-specific methods
  // ==========================================================================

  /**
   * Check connection to the SLIM-RPC gateway.
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${this.endpoint}/health`, {
        signal: AbortSignal.timeout(5000),
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Get gateway metrics.
   */
  async getMetrics(): Promise<string> {
    const response = await fetch(`${this.endpoint}/metrics`);
    return response.text();
  }

  /**
   * Get the current block number from the underlying chain.
   */
  async getBlockNumber(): Promise<bigint> {
    const result = await this.request<string>('eth_blockNumber', []);
    return BigInt(result);
  }

  /**
   * Get chain ID.
   */
  async getChainId(): Promise<bigint> {
    const result = await this.request<string>('eth_chainId', []);
    return BigInt(result);
  }
}
