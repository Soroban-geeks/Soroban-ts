/**
 * SorobanClient — the main entry point for soroban-ts.
 *
 * Abstracts the full Soroban transaction lifecycle:
 *   encode args → simulate → assemble → sign → submit → poll → decode result
 *
 * Usage:
 *   const client = new SorobanClient({
 *     network: "testnet",
 *     contractId: "CCJZ...",
 *     signer: new KeypairAdapter(secret),
 *   });
 *
 *   const balance = await client.read("balance", { address: "GBZX..." });
 *   const result  = await client.call("transfer", { from, to, amount });
 */

import {
  Contract,
  TransactionBuilder,
  BASE_FEE,
  Account,
  rpc,
} from "@stellar/stellar-sdk";

import { resolveNetwork } from "./network.js";
import { encodeArgs, decodeResult } from "./encoding.js";
import { sleep } from "./utils.js";
import {
  SimulationError,
  ContractNotFoundError,
  NoSignerError,
  TxTimeoutError,
  TxFailedError,
  NetworkError,
  InsufficientFundsError,
} from "./errors/index.js";
import type {
  ClientConfig,
  CallOptions,
  ReadOptions,
  TxResult,
  SimulateResult,
  ContractArgs,
  ResolvedNetwork,
} from "./types/index.js";

// ─── Defaults ────────────────────────────────────────────────────────────────

const DEFAULT_TIMEOUT = 30;
const DEFAULT_RETRIES = 10;
const DEFAULT_POLL_INTERVAL = 2000;
// Simulation account when no signer is provided (all-zeros public key)
const SIM_ACCOUNT = "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN";

// ─── Client ──────────────────────────────────────────────────────────────────

export class SorobanClient {
  private readonly server: rpc.Server;
  private readonly contract: Contract;
  private readonly network: ResolvedNetwork;
  private readonly config: Required<
    Pick<ClientConfig, "timeout" | "retries" | "pollInterval">
  >;
  private readonly signer: ClientConfig["signer"];

  constructor(config: ClientConfig) {
    this.network = resolveNetwork(config.network);
    this.server = new rpc.Server(this.network.rpcUrl, {
      allowHttp: this.network.rpcUrl.startsWith("http://"),
    });
    this.contract = new Contract(config.contractId);
    this.signer = config.signer;
    this.config = {
      timeout: config.timeout ?? DEFAULT_TIMEOUT,
      retries: config.retries ?? DEFAULT_RETRIES,
      pollInterval: config.pollInterval ?? DEFAULT_POLL_INTERVAL,
    };
  }

  // ─── Public: read ──────────────────────────────────────────────────────────

  /**
   * Reads contract state without submitting a transaction.
   * No signer required.
   *
   * @param method   Contract view function name
   * @param args     Function arguments as a plain JS object
   * @param options  ReadOptions
   * @returns        Decoded return value
   */
  async read(
    method: string,
    args: ContractArgs = {},
    options: ReadOptions = {}
  ): Promise<unknown> {
    const sim = await this._simulate(method, args, options.simulationAccount);
    return sim.value;
  }

  // ─── Public: call ──────────────────────────────────────────────────────────

  /**
   * Executes a write operation on the contract.
   * Automatically simulates, signs, submits, and polls for confirmation.
   *
   * @param method   Contract function name
   * @param args     Function arguments as a plain JS object
   * @param options  CallOptions (fee strategy, timeout override)
   * @returns        TxResult with hash, fee, ledger, and decoded return value
   *
   * @throws NoSignerError            if no signer is configured
   * @throws SimulationError          if pre-flight simulation fails
   * @throws InsufficientFundsError   if the account can't cover fees
   * @throws TxTimeoutError           if confirmation polling times out
   * @throws TxFailedError            if the transaction fails on-chain
   */
  async call(
    method: string,
    args: ContractArgs = {},
    options: CallOptions = {}
  ): Promise<TxResult> {
    if (!this.signer) {
      throw new NoSignerError(method);
    }

    const publicKey = await this.signer.getPublicKey();

    // 1. Load the source account
    const account = await this._loadAccount(publicKey);

    // 2. Build the unsigned transaction
    const encodedArgs = encodeArgs(args);
    const tx = new TransactionBuilder(account, {
      fee: options.fee === "auto" || !options.fee ? BASE_FEE : options.fee,
      networkPassphrase: this.network.networkPassphrase,
    })
      .addOperation(this.contract.call(method, ...encodedArgs))
      .setTimeout(options.timeout ?? this.config.timeout)
      .build();

    // 3. Simulate
    const simResult = await this.server.simulateTransaction(tx);

    if (rpc.Api.isSimulationError(simResult)) {
      this._handleSimulationError(simResult, publicKey);
    }

    if (!rpc.Api.isSimulationSuccess(simResult)) {
      throw new SimulationError("Simulation returned unexpected response", simResult);
    }

    // 4. Assemble (applies auth entries + fee from simulation)
    const assembled = rpc.assembleTransaction(tx, simResult).build();

    // 5. Sign
    const signedXdr = await this.signer.signTransaction(assembled.toXDR(), {
      networkPassphrase: this.network.networkPassphrase,
    });

    const signedTx = TransactionBuilder.fromXDR(
      signedXdr,
      this.network.networkPassphrase
    );

    // 6. Submit
    const sendResult = await this.server.sendTransaction(signedTx);

    if (sendResult.status === "ERROR") {
      throw new TxFailedError(
        sendResult.hash,
        sendResult.errorResult?.toXDR("base64") ?? "unknown"
      );
    }

    // 7. Poll for confirmation
    const confirmed = await this._pollTransaction(sendResult.hash);

    // 8. Decode return value
    const returnValue = confirmed.returnValue
      ? decodeResult(confirmed.returnValue)
      : null;

    // Extract fee from the result XDR
    let feeCharged = "0";
    try {
      feeCharged = confirmed.resultXdr.feeCharged().toString();
    } catch {
      // feeCharged not available — leave as "0"
    }

    return {
      hash: sendResult.hash,
      fee: feeCharged,
      ledger: confirmed.ledger,
      value: returnValue,
      status: "SUCCESS",
    };
  }

  // ─── Public: simulate ─────────────────────────────────────────────────────

  /**
   * Dry-runs a contract call without submitting anything.
   * Useful for fee estimation or pre-validating calls.
   *
   * @param method   Contract function name
   * @param args     Function arguments
   * @returns        SimulateResult with fee estimate and decoded return value
   */
  async simulate(
    method: string,
    args: ContractArgs = {}
  ): Promise<SimulateResult> {
    return this._simulate(method, args);
  }

  // ─── Internal helpers ─────────────────────────────────────────────────────

  private async _simulate(
    method: string,
    args: ContractArgs,
    simulationAccount?: string
  ): Promise<SimulateResult> {
    const accountId = simulationAccount ?? (await this._signerKey()) ?? SIM_ACCOUNT;
    const account = await this._loadAccount(accountId);

    const encodedArgs = encodeArgs(args);
    const tx = new TransactionBuilder(account, {
      fee: BASE_FEE,
      networkPassphrase: this.network.networkPassphrase,
    })
      .addOperation(this.contract.call(method, ...encodedArgs))
      .setTimeout(this.config.timeout)
      .build();

    const simResult = await this.server.simulateTransaction(tx);

    if (rpc.Api.isSimulationError(simResult)) {
      this._handleSimulationError(simResult, accountId);
    }

    if (!rpc.Api.isSimulationSuccess(simResult)) {
      throw new SimulationError("Simulation returned unexpected response", simResult);
    }

    const returnValue = simResult.result?.retval
      ? decodeResult(simResult.result.retval)
      : null;

    const authEntries = (simResult.result?.auth ?? []).map((entry) =>
      entry.toXDR("base64")
    );

    return {
      success: true,
      estimatedFee: simResult.minResourceFee ?? "0",
      value: returnValue,
      authEntries,
    };
  }

  private async _loadAccount(publicKey: string): Promise<Account> {
    try {
      return await this.server.getAccount(publicKey);
    } catch (err) {
      if (err instanceof Error && err.message.includes("404")) {
        throw new InsufficientFundsError(0n, 0n, publicKey);
      }
      throw new NetworkError(this.network.rpcUrl, (err as Error).message);
    }
  }

  private async _pollTransaction(hash: string): Promise<rpc.Api.GetSuccessfulTransactionResponse> {
    let attempts = 0;
    let lastStatus = "PENDING";

    while (attempts < this.config.retries) {
      await sleep(this.config.pollInterval);
      attempts++;

      const result = await this.server.getTransaction(hash);
      lastStatus = result.status;

      if (result.status === rpc.Api.GetTransactionStatus.SUCCESS) {
        return result as rpc.Api.GetSuccessfulTransactionResponse;
      }

      if (result.status === rpc.Api.GetTransactionStatus.FAILED) {
        const failed = result as rpc.Api.GetFailedTransactionResponse;
        throw new TxFailedError(
          hash,
          failed.resultXdr?.toXDR("base64") ?? "unknown"
        );
      }

      // PENDING or NOT_FOUND — keep polling
    }

    throw new TxTimeoutError(hash, attempts, lastStatus);
  }

  private _handleSimulationError(
    simResult: rpc.Api.SimulateTransactionErrorResponse,
    publicKey: string
  ): never {
    const errorStr = simResult.error ?? "Unknown simulation error";

    // Check for insufficient funds pattern
    if (
      errorStr.toLowerCase().includes("insufficient") ||
      errorStr.toLowerCase().includes("balance")
    ) {
      throw new InsufficientFundsError(0n, 0n, publicKey);
    }

    // Check for contract not found
    if (
      errorStr.toLowerCase().includes("not found") ||
      errorStr.toLowerCase().includes("missing")
    ) {
      throw new ContractNotFoundError(
        this.contract.contractId(),
        this.network.name
      );
    }

    throw new SimulationError(errorStr, simResult);
  }

  private async _signerKey(): Promise<string | undefined> {
    try {
      return await this.signer?.getPublicKey();
    } catch {
      return undefined;
    }
  }
}
