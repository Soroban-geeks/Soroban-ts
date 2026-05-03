import { describe, it, expect } from "vitest";
import {
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
} from "../src/errors/index.js";

describe("SorobanError base class", () => {
  it("sets name to subclass name", () => {
    const err = new SimulationError("failed", {});
    expect(err.name).toBe("SimulationError");
  });

  it("is instanceof SorobanError", () => {
    expect(new SimulationError("x", {})).toBeInstanceOf(SorobanError);
    expect(new InsufficientFundsError(0n, 0n, "G")).toBeInstanceOf(SorobanError);
    expect(new TxTimeoutError("hash", 10, "PENDING")).toBeInstanceOf(SorobanError);
  });

  it("is instanceof Error", () => {
    expect(new SimulationError("x", {})).toBeInstanceOf(Error);
  });
});

describe("SimulationError", () => {
  it("stores contractError and raw", () => {
    const raw = { error: "HostError" };
    const err = new SimulationError("HostError: Value too large", raw);
    expect(err.contractError).toBe("HostError: Value too large");
    expect(err.raw).toBe(raw);
    expect(err.message).toContain("HostError: Value too large");
  });

  it("provides a suggestion", () => {
    const err = new SimulationError("error", {});
    expect(err.suggestion.length).toBeGreaterThan(0);
  });
});

describe("InsufficientFundsError", () => {
  it("stores required, available, address", () => {
    const err = new InsufficientFundsError(5_000_000n, 1_000_000n, "GBZX");
    expect(err.required).toBe(5_000_000n);
    expect(err.available).toBe(1_000_000n);
    expect(err.address).toBe("GBZX");
  });

  it("includes friendbot URL in suggestion for testnet", () => {
    const addr = "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN";
    const err = new InsufficientFundsError(0n, 0n, addr);
    expect(err.suggestion).toContain("friendbot.stellar.org");
    expect(err.suggestion).toContain(addr);
  });
});

describe("ContractNotFoundError", () => {
  it("stores contractId and network", () => {
    const err = new ContractNotFoundError("CCJZ...", "testnet");
    expect(err.contractId).toBe("CCJZ...");
    expect(err.network).toBe("testnet");
  });

  it("mentions testnet/mainnet mismatch in suggestion", () => {
    const err = new ContractNotFoundError("CCJZ...", "testnet");
    expect(err.suggestion.toLowerCase()).toContain("testnet");
    expect(err.suggestion.toLowerCase()).toContain("mainnet");
  });
});

describe("ContractMethodNotFoundError", () => {
  it("stores method and contractId", () => {
    const err = new ContractMethodNotFoundError("transfer", "CCJZ...");
    expect(err.method).toBe("transfer");
    expect(err.contractId).toBe("CCJZ...");
  });
});

describe("WalletNotConnectedError", () => {
  it("stores adapter name", () => {
    const err = new WalletNotConnectedError("FreighterAdapter");
    expect(err.adapter).toBe("FreighterAdapter");
    expect(err.suggestion).toContain("FreighterAdapter.connect()");
  });
});

describe("WalletSignRejectedError", () => {
  it("is a SorobanError", () => {
    expect(new WalletSignRejectedError()).toBeInstanceOf(SorobanError);
  });

  it("has a helpful message", () => {
    const err = new WalletSignRejectedError();
    expect(err.message.toLowerCase()).toContain("reject");
  });
});

describe("NoSignerError", () => {
  it("includes method name in message", () => {
    const err = new NoSignerError("transfer");
    expect(err.message).toContain("transfer");
    expect(err.suggestion).toContain("signer");
  });
});

describe("TxTimeoutError", () => {
  it("stores hash, attempts, lastStatus", () => {
    const err = new TxTimeoutError("abc123", 10, "PENDING");
    expect(err.hash).toBe("abc123");
    expect(err.attempts).toBe(10);
    expect(err.lastStatus).toBe("PENDING");
  });

  it("includes hash in suggestion URL", () => {
    const err = new TxTimeoutError("abc123", 10, "PENDING");
    expect(err.suggestion).toContain("abc123");
  });
});

describe("TxFailedError", () => {
  it("stores hash and resultXdr", () => {
    const err = new TxFailedError("abc123", "AAAAAA==");
    expect(err.hash).toBe("abc123");
    expect(err.resultXdr).toBe("AAAAAA==");
  });
});

describe("InvalidArgumentError", () => {
  it("stores param, received, expected", () => {
    const err = new InvalidArgumentError("amount", "hello", "bigint");
    expect(err.param).toBe("amount");
    expect(err.received).toBe("hello");
    expect(err.expected).toBe("bigint");
  });

  it("includes param name in message", () => {
    const err = new InvalidArgumentError("amount", 1.5, "integer");
    expect(err.message).toContain("amount");
    expect(err.message).toContain("integer");
  });
});

describe("NetworkError", () => {
  it("stores rpcUrl", () => {
    const err = new NetworkError("https://soroban-testnet.stellar.org");
    expect(err.rpcUrl).toBe("https://soroban-testnet.stellar.org");
  });

  it("includes cause when provided", () => {
    const err = new NetworkError("https://example.com", "ECONNREFUSED");
    expect(err.message).toContain("ECONNREFUSED");
  });
});
