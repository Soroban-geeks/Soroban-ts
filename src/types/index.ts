/**
 * soroban-ts — type definitions
 */

// ─── Network ────────────────────────────────────────────────────────────────

export type NetworkName = "testnet" | "mainnet" | "futurenet";

export interface RpcConfig {
  /** Full RPC URL, e.g. "https://soroban-testnet.stellar.org" */
  rpcUrl: string;
  /** Network passphrase */
  networkPassphrase: string;
}

export type NetworkConfig = NetworkName | RpcConfig;

// ─── Wallet / Signer ────────────────────────────────────────────────────────

/**
 * The interface every wallet adapter must implement.
 * Pass an adapter as `signer` when constructing SorobanClient.
 */
export interface WalletAdapter {
  /** Returns the Stellar public key (G-address) */
  getPublicKey(): Promise<string>;
  /**
   * Signs an XDR-encoded transaction envelope.
   * Returns the signed XDR string.
   */
  signTransaction(
    xdr: string,
    opts?: { networkPassphrase?: string }
  ): Promise<string>;
  /** Whether the adapter currently has an active connection */
  isConnected(): Promise<boolean>;
}

// ─── Client Config ──────────────────────────────────────────────────────────

export interface ClientConfig {
  /** Target network — shorthand name or custom RPC config */
  network: NetworkConfig;
  /** Stellar contract address (C-prefixed) */
  contractId: string;
  /** Wallet adapter for signing transactions. Required for write operations. */
  signer?: WalletAdapter;
  /**
   * Transaction timeout in seconds.
   * @default 30
   */
  timeout?: number;
  /**
   * How many times to poll for transaction confirmation before giving up.
   * @default 10
   */
  retries?: number;
  /**
   * Milliseconds between polling attempts.
   * @default 2000
   */
  pollInterval?: number;
}

// ─── Call Options ───────────────────────────────────────────────────────────

export interface CallOptions {
  /**
   * Fee strategy.
   * - "auto" (default): use the simulation estimate
   * - a numeric string: exact fee in stroops, e.g. "10000"
   */
  fee?: "auto" | string;
  /** Override the signing timeout (seconds) */
  timeout?: number;
}

export interface ReadOptions {
  /** Override the account used for simulation (defaults to zero-address) */
  simulationAccount?: string;
}

// ─── Results ────────────────────────────────────────────────────────────────

/** Decoded return value from a contract call or read */
export type ContractValue =
  | bigint
  | string
  | boolean
  | number
  | null
  | ContractValue[]
  | { [key: string]: ContractValue };

/** Result returned from client.call() — a confirmed write transaction */
export interface TxResult {
  /** Transaction hash */
  hash: string;
  /** Fee paid in stroops */
  fee: string;
  /** Ledger the transaction was confirmed in */
  ledger: number;
  /** Decoded return value from the contract function */
  value: ContractValue;
  /** Raw transaction status */
  status: "SUCCESS";
}

/** Result returned from client.simulate() — dry-run only */
export interface SimulateResult {
  /** Whether the simulation succeeded */
  success: boolean;
  /** Estimated fee in stroops */
  estimatedFee: string;
  /** Decoded return value */
  value: ContractValue;
  /** Auth entries required (already applied in client.call()) */
  authEntries: string[];
}

// ─── Args ───────────────────────────────────────────────────────────────────

/** Contract function arguments as a plain JS object */
export type ContractArgs = Record<string, unknown>;

// ─── Internal ───────────────────────────────────────────────────────────────

export interface ResolvedNetwork {
  rpcUrl: string;
  networkPassphrase: string;
  name: NetworkName | "custom";
}
