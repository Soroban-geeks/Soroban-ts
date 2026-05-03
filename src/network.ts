import { Networks } from "@stellar/stellar-sdk";
import type { NetworkConfig, NetworkName, ResolvedNetwork } from "./types/index.js";

// ─── Built-in RPC endpoints ──────────────────────────────────────────────────

const NETWORK_PRESETS: Record<NetworkName, ResolvedNetwork> = {
  testnet: {
    rpcUrl: "https://soroban-testnet.stellar.org",
    networkPassphrase: Networks.TESTNET,
    name: "testnet",
  },
  mainnet: {
    rpcUrl: "https://mainnet.stellar.validationcloud.io/v1/XCjpkwIpqinohM6gDwwTLA",
    networkPassphrase: Networks.PUBLIC,
    name: "mainnet",
  },
  futurenet: {
    rpcUrl: "https://rpc-futurenet.stellar.org",
    networkPassphrase: Networks.FUTURENET,
    name: "futurenet",
  },
};

// ─── Resolver ────────────────────────────────────────────────────────────────

/**
 * Resolves a NetworkConfig (name string or custom RpcConfig) into a
 * fully-qualified ResolvedNetwork with rpcUrl + networkPassphrase.
 */
export function resolveNetwork(config: NetworkConfig): ResolvedNetwork {
  if (typeof config === "string") {
    const preset = NETWORK_PRESETS[config];
    if (!preset) {
      throw new Error(
        `Unknown network "${config}". Use "testnet", "mainnet", "futurenet", or pass a custom RpcConfig.`
      );
    }
    return preset;
  }

  // Custom RpcConfig
  return {
    rpcUrl: config.rpcUrl,
    networkPassphrase: config.networkPassphrase,
    name: "custom",
  };
}

export { NETWORK_PRESETS };
