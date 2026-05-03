/**
 * soroban-ts — typed error classes
 *
 * Every error extends SorobanError so you can catch them all with:
 *   catch (err) { if (err instanceof SorobanError) { ... } }
 *
 * Or catch specific ones:
 *   catch (err) { if (err instanceof InsufficientFundsError) { ... } }
 */

// ─── Base ────────────────────────────────────────────────────────────────────

export class SorobanError extends Error {
  /** Human-readable suggestion for how to fix the error */
  readonly suggestion: string;

  constructor(message: string, suggestion = "") {
    super(message);
    this.name = this.constructor.name;
    this.suggestion = suggestion;
    // Maintain proper prototype chain in transpiled environments
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

// ─── Simulation ──────────────────────────────────────────────────────────────

export class SimulationError extends SorobanError {
  /** Raw error string from the contract host */
  readonly contractError: string;
  /** The full simulation response object for debugging */
  readonly raw: unknown;

  constructor(contractError: string, raw: unknown) {
    super(
      `Contract simulation failed: ${contractError}`,
      "Check the contract function arguments and ensure the contract state allows this call."
    );
    this.contractError = contractError;
    this.raw = raw;
  }
}

// ─── Funds ───────────────────────────────────────────────────────────────────

export class InsufficientFundsError extends SorobanError {
  /** Amount required, in stroops */
  readonly required: bigint;
  /** Amount available, in stroops */
  readonly available: bigint;
  /** The address that is underfunded */
  readonly address: string;

  constructor(required: bigint, available: bigint, address: string) {
    super(
      `Insufficient funds: need ${required} stroops, have ${available} stroops`,
      `Fund this address: https://friendbot.stellar.org/?addr=${address}`
    );
    this.required = required;
    this.available = available;
    this.address = address;
  }
}

// ─── Contract ────────────────────────────────────────────────────────────────

export class ContractNotFoundError extends SorobanError {
  readonly contractId: string;
  readonly network: string;

  constructor(contractId: string, network: string) {
    super(
      `Contract not found: ${contractId} on ${network}`,
      "Check that the contractId is correct and that you're targeting the right network (testnet vs mainnet)."
    );
    this.contractId = contractId;
    this.network = network;
  }
}

export class ContractMethodNotFoundError extends SorobanError {
  readonly method: string;
  readonly contractId: string;

  constructor(method: string, contractId: string) {
    super(
      `Method "${method}" not found on contract ${contractId}`,
      "Check the contract ABI or run `soroban-ts generate` to get typed method names."
    );
    this.method = method;
    this.contractId = contractId;
  }
}

// ─── Wallet ──────────────────────────────────────────────────────────────────

export class WalletNotConnectedError extends SorobanError {
  readonly adapter: string;

  constructor(adapter: string) {
    super(
      `Wallet adapter "${adapter}" is not connected`,
      `Call ${adapter}.connect() before performing write operations.`
    );
    this.adapter = adapter;
  }
}

export class WalletSignRejectedError extends SorobanError {
  constructor() {
    super(
      "User rejected the transaction signature request",
      "The wallet popup was dismissed. Ask the user to approve the transaction."
    );
  }
}

export class NoSignerError extends SorobanError {
  constructor(method: string) {
    super(
      `Cannot call "${method}": no signer configured`,
      "Pass a signer (FreighterAdapter or KeypairAdapter) when constructing SorobanClient."
    );
  }
}

// ─── Transaction ─────────────────────────────────────────────────────────────

export class TxTimeoutError extends SorobanError {
  /** The submitted transaction hash */
  readonly hash: string;
  /** Number of polling attempts made */
  readonly attempts: number;
  /** Last observed status string */
  readonly lastStatus: string;

  constructor(hash: string, attempts: number, lastStatus: string) {
    super(
      `Transaction ${hash} did not confirm after ${attempts} attempts (last status: ${lastStatus})`,
      "The transaction may still confirm. Check it manually at https://stellar.expert/explorer/testnet/tx/" + hash
    );
    this.hash = hash;
    this.attempts = attempts;
    this.lastStatus = lastStatus;
  }
}

export class TxFailedError extends SorobanError {
  readonly hash: string;
  readonly resultXdr: string;

  constructor(hash: string, resultXdr: string) {
    super(
      `Transaction ${hash} was submitted but failed on-chain`,
      "Inspect the resultXdr field or check the transaction on Stellar Expert for the specific failure code."
    );
    this.hash = hash;
    this.resultXdr = resultXdr;
  }
}

// ─── Arguments ───────────────────────────────────────────────────────────────

export class InvalidArgumentError extends SorobanError {
  readonly param: string;
  readonly received: unknown;
  readonly expected: string;

  constructor(param: string, received: unknown, expected: string) {
    super(
      `Invalid argument "${param}": expected ${expected}, got ${typeof received}`,
      `Check the contract function signature and ensure "${param}" matches the expected type.`
    );
    this.param = param;
    this.received = received;
    this.expected = expected;
  }
}

// ─── Network ─────────────────────────────────────────────────────────────────

export class NetworkError extends SorobanError {
  readonly rpcUrl: string;

  constructor(rpcUrl: string, cause?: string) {
    super(
      `Failed to connect to RPC at ${rpcUrl}${cause ? `: ${cause}` : ""}`,
      "Check your internet connection and verify the RPC URL is correct and reachable."
    );
    this.rpcUrl = rpcUrl;
  }
}
