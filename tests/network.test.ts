import { describe, it, expect } from "vitest";
import { resolveNetwork } from "../src/network.js";
import { Networks } from "@stellar/stellar-sdk";

describe("resolveNetwork", () => {
  it("resolves testnet by name", () => {
    const net = resolveNetwork("testnet");
    expect(net.name).toBe("testnet");
    expect(net.rpcUrl).toContain("testnet");
    expect(net.networkPassphrase).toBe(Networks.TESTNET);
  });

  it("resolves mainnet by name", () => {
    const net = resolveNetwork("mainnet");
    expect(net.name).toBe("mainnet");
    expect(net.networkPassphrase).toBe(Networks.PUBLIC);
  });

  it("resolves futurenet by name", () => {
    const net = resolveNetwork("futurenet");
    expect(net.name).toBe("futurenet");
    expect(net.networkPassphrase).toBe(Networks.FUTURENET);
  });

  it("resolves a custom RpcConfig", () => {
    const net = resolveNetwork({
      rpcUrl: "https://my-node.example.com",
      networkPassphrase: "My Network ; 2026",
    });
    expect(net.name).toBe("custom");
    expect(net.rpcUrl).toBe("https://my-node.example.com");
    expect(net.networkPassphrase).toBe("My Network ; 2026");
  });

  it("throws for unknown network name", () => {
    // @ts-expect-error — testing invalid input
    expect(() => resolveNetwork("badnet")).toThrow();
  });
});
