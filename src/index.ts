/**
 * soroban-ts
 *
 * A clean TypeScript SDK for Soroban smart contracts.
 * What ethers.js is to Ethereum — simplified for Stellar.
 *
 * @example
 * import { SorobanClient, KeypairAdapter, xlmToStroops } from "soroban-ts";
 *
 * const client = new SorobanClient({
 *   network: "testnet",
 *   contractId: "CCJZ...",
 *   signer: new KeypairAdapter(process.env.STELLAR_SECRET!),
 * });
 *
 * const balance = await client.read("balance", { address: "GBZX..." });
 * const result  = await client.call("transfer", { from, to, amount: xlmToStroops("10") });
 */

// ─── Core ──────────────────────────────────────────────────────────────────
export { SorobanClient } from "./client.js";

// ─── Wallet Adapters ──────────────────────────────────────────────────────
export { FreighterAdapter } from "./wallet/freighter.js";
export { KeypairAdapter } from "./wallet/keypair.js";

// ─── Errors ───────────────────────────────────────────────────────────────
export {
  SorobanError,
  SimulationError,
  InsufficientFundsError,
  ContractNotFoundError,
  ContractMethodNotFoundError,
  WalletNotConnectedError,
  WalletSignRejectedError,
  NoSignerError,
  TxTimeoutError,
  TxFailedError,
  InvalidArgumentError,
  NetworkError,
} from "./errors/index.js";

// ─── Utils ────────────────────────────────────────────────────────────────
export {
  xlmToStroops,
  stroopsToXlm,
  isValidAddress,
  isValidContractId,
  truncateAddress,
  friendbotFund,
} from "./utils.js";

// ─── Types ────────────────────────────────────────────────────────────────
export type {
  NetworkName,
  NetworkConfig,
  RpcConfig,
  WalletAdapter,
  ClientConfig,
  CallOptions,
  ReadOptions,
  ContractArgs,
  ContractValue,
  TxResult,
  SimulateResult,
  ResolvedNetwork,
} from "./types/index.js";
