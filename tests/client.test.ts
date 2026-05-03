import { describe, it, expect, vi, beforeEach } from "vitest";
import { SorobanClient } from "../src/client.js";
import {
  NoSignerError,
  TxTimeoutError,
  TxFailedError,
  SimulationError,
} from "../src/errors/index.js";
import type { WalletAdapter } from "../src/types/index.js";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const TEST_PUBLIC_KEY = "GCLXZHLXQFLHVYNCKMXEA6CI5FMNU3CY3JVWHPWU4HPDI2C7RAPFDZPB";
const TEST_CONTRACT_ID = "CAAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAEAQC526";

// ─── Mock stellar-sdk rpc.Server ─────────────────────────────────────────────

const mockGetAccount = vi.fn();
const mockSimulateTransaction = vi.fn();
const mockSendTransaction = vi.fn();
const mockGetTransaction = vi.fn();

// A minimal transaction stub that satisfies toXDR() and sign()
const mockTxStub = {
  toXDR: () => "AAAAAQAAAAAAAAAA_MOCK_XDR",
  sign: vi.fn(),
  signatures: [{ signature: Buffer.alloc(64) }],
};

vi.mock("@stellar/stellar-sdk", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@stellar/stellar-sdk")>();

  // Inline stub — vi.mock factories are hoisted, so external vars aren't available
  const txStub = {
    toXDR: () => "AAAAAQAAAAAAAAAA_MOCK_XDR",
    sign: () => {},
    signatures: [{ signature: new Uint8Array(64) }],
  };

  class MockServer {
    getAccount = mockGetAccount;
    simulateTransaction = mockSimulateTransaction;
    sendTransaction = mockSendTransaction;
    getTransaction = mockGetTransaction;
  }

  // Subclass TransactionBuilder so it stays constructable,
  // and override the static fromXDR to return our stub
  class MockTransactionBuilder extends actual.TransactionBuilder {
    static fromXDR() { return txStub as unknown as actual.Transaction; }
  }

  return {
    ...actual,
    TransactionBuilder: MockTransactionBuilder,
    rpc: {
      ...actual.rpc,
      Server: MockServer,
      Api: actual.rpc.Api,
      // assembleTransaction lives on rpc in v13 — mock it to return a stub builder
      assembleTransaction: () => ({ build: () => txStub }),
    },
  };
});

// ─── Mock wallet adapter ──────────────────────────────────────────────────────

const mockSigner: WalletAdapter = {
  getPublicKey: vi.fn().mockResolvedValue(TEST_PUBLIC_KEY),
  signTransaction: vi.fn().mockResolvedValue("AAAAAQAAAAAAAAAA_MOCK_XDR"),
  isConnected: vi.fn().mockResolvedValue(true),
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeClient(withSigner = true) {
  return new SorobanClient({
    network: "testnet",
    contractId: TEST_CONTRACT_ID,
    signer: withSigner ? mockSigner : undefined,
    retries: 3,
    pollInterval: 10,
  });
}

function mockAccountResponse() {
  const { Account } = require("@stellar/stellar-sdk");
  mockGetAccount.mockResolvedValue(
    new Account(TEST_PUBLIC_KEY, "100")
  );
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("SorobanClient.read", () => {
  beforeEach(() => vi.clearAllMocks());

  it("calls simulateTransaction and returns decoded value", async () => {
    const { nativeToScVal, rpc } = await import("@stellar/stellar-sdk");

    mockAccountResponse();

    const returnVal = nativeToScVal(50_000_000n, { type: "i128" });
    mockSimulateTransaction.mockResolvedValue({
      result: { retval: returnVal, auth: [] },
      minResourceFee: "1000",
      error: undefined,
    });

    // Make isSimulationSuccess return true for this mock
    vi.spyOn(rpc.Api, "isSimulationError").mockReturnValue(false);
    vi.spyOn(rpc.Api, "isSimulationSuccess").mockReturnValue(true);

    const client = makeClient(false);
    const result = await client.read("balance", { address: TEST_PUBLIC_KEY });

    expect(result).toBe(50_000_000n);
    expect(mockSimulateTransaction).toHaveBeenCalledOnce();
  });
});

describe("SorobanClient.call", () => {
  beforeEach(() => vi.clearAllMocks());

  it("throws NoSignerError when no signer is configured", async () => {
    const client = makeClient(false);
    await expect(client.call("transfer", {})).rejects.toBeInstanceOf(NoSignerError);
  });

  it("throws SimulationError when simulation fails", async () => {
    const { rpc } = await import("@stellar/stellar-sdk");

    mockAccountResponse();
    mockSimulateTransaction.mockResolvedValue({ error: "HostError: budget exceeded" });
    vi.spyOn(rpc.Api, "isSimulationError").mockReturnValue(true);
    vi.spyOn(rpc.Api, "isSimulationSuccess").mockReturnValue(false);

    const client = makeClient();
    await expect(
      client.call("transfer", { from: TEST_PUBLIC_KEY, amount: 100n })
    ).rejects.toBeInstanceOf(SimulationError);
  });

  it("throws TxFailedError when send returns ERROR", async () => {
    const { rpc, nativeToScVal } = await import("@stellar/stellar-sdk");

    mockAccountResponse();

    mockSimulateTransaction.mockResolvedValue({
      result: { retval: nativeToScVal(null), auth: [] },
      minResourceFee: "1000",
    });
    vi.spyOn(rpc.Api, "isSimulationError").mockReturnValue(false);
    vi.spyOn(rpc.Api, "isSimulationSuccess").mockReturnValue(true);

    mockSendTransaction.mockResolvedValue({
      status: "ERROR",
      hash: "deadbeef",
      errorResult: null,
    });

    const client = makeClient();
    await expect(client.call("transfer", {})).rejects.toBeInstanceOf(TxFailedError);
  });

  it("throws TxTimeoutError when polling exceeds retries", async () => {
    const { rpc, nativeToScVal } = await import("@stellar/stellar-sdk");

    mockAccountResponse();

    mockSimulateTransaction.mockResolvedValue({
      result: { retval: nativeToScVal(null), auth: [] },
      minResourceFee: "1000",
    });
    vi.spyOn(rpc.Api, "isSimulationError").mockReturnValue(false);
    vi.spyOn(rpc.Api, "isSimulationSuccess").mockReturnValue(true);

    mockSendTransaction.mockResolvedValue({
      status: "PENDING",
      hash: "abc123",
    });

    mockGetTransaction.mockResolvedValue({
      status: rpc.Api.GetTransactionStatus.NOT_FOUND,
    });

    const client = makeClient();
    const err = await client.call("transfer", {}).catch((e) => e);
    expect(err).toBeInstanceOf(TxTimeoutError);
    expect((err as TxTimeoutError).hash).toBe("abc123");
  });

  it("resolves with TxResult on successful confirmation", async () => {
    const { rpc, nativeToScVal } = await import("@stellar/stellar-sdk");

    mockAccountResponse();

    const returnVal = nativeToScVal(200_000_000n, { type: "i128" });

    mockSimulateTransaction.mockResolvedValue({
      result: { retval: returnVal, auth: [] },
      minResourceFee: "1250",
    });
    vi.spyOn(rpc.Api, "isSimulationError").mockReturnValue(false);
    vi.spyOn(rpc.Api, "isSimulationSuccess").mockReturnValue(true);

    mockSendTransaction.mockResolvedValue({
      status: "PENDING",
      hash: "success123",
    });

    mockGetTransaction.mockResolvedValue({
      status: rpc.Api.GetTransactionStatus.SUCCESS,
      returnValue: returnVal,
      ledger: 4821039,
      // resultXdr with feeCharged() method
      resultXdr: {
        feeCharged: () => ({ toString: () => "1250" }),
      },
    });

    const client = makeClient();
    const result = await client.call("transfer", { amount: 100n });

    expect(result.hash).toBe("success123");
    expect(result.ledger).toBe(4821039);
    expect(result.value).toBe(200_000_000n);
    expect(result.status).toBe("SUCCESS");
    // fee comes from resultXdr.feeCharged().toString()
    expect(result.fee).toBe("1250");
  });
});

describe("SorobanClient.simulate", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns SimulateResult without submitting", async () => {
    const { rpc, nativeToScVal } = await import("@stellar/stellar-sdk");

    mockAccountResponse();

    const returnVal = nativeToScVal(999n, { type: "i128" });
    mockSimulateTransaction.mockResolvedValue({
      result: { retval: returnVal, auth: [] },
      minResourceFee: "500",
    });
    vi.spyOn(rpc.Api, "isSimulationError").mockReturnValue(false);
    vi.spyOn(rpc.Api, "isSimulationSuccess").mockReturnValue(true);

    const client = makeClient();
    const sim = await client.simulate("balance", {});

    expect(sim.success).toBe(true);
    expect(sim.estimatedFee).toBe("500");
    expect(sim.value).toBe(999n);
    expect(mockSendTransaction).not.toHaveBeenCalled();
  });
});
