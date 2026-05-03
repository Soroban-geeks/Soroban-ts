/**
 * SorobanProvider — React context for soroban-ts.
 *
 * Wraps your app (or a subtree) to make a shared SorobanClient
 * available to all children via hooks.
 *
 * Usage (Next.js App Router):
 *   // app/layout.tsx
 *   import { SorobanProvider } from "soroban-ts/react";
 *
 *   export default function RootLayout({ children }) {
 *     return (
 *       <SorobanProvider network="testnet" contractId="CCJZ...">
 *         {children}
 *       </SorobanProvider>
 *     );
 *   }
 */

"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useMemo,
  type ReactNode,
} from "react";
import { SorobanClient } from "../client.js";
import { FreighterAdapter } from "../wallet/freighter.js";
import type { ClientConfig, WalletAdapter } from "../types/index.js";

// ─── Context shape ────────────────────────────────────────────────────────────

interface SorobanContextValue {
  client: SorobanClient | null;
  wallet: WalletAdapter | null;
  publicKey: string | null;
  isConnected: boolean;
  isConnecting: boolean;
  connect: () => Promise<void>;
  disconnect: () => void;
  network: ClientConfig["network"];
  contractId: string;
}

const SorobanContext = createContext<SorobanContextValue | null>(null);

// ─── Provider ─────────────────────────────────────────────────────────────────

export interface SorobanProviderProps {
  children: ReactNode;
  network: ClientConfig["network"];
  contractId: string;
  timeout?: number;
  retries?: number;
  pollInterval?: number;
  /** Auto-connect to Freighter on mount (if already permitted) */
  autoConnect?: boolean;
}

export function SorobanProvider({
  children,
  network,
  contractId,
  timeout,
  retries,
  pollInterval,
  autoConnect = false,
}: SorobanProviderProps) {
  const [wallet, setWallet] = useState<WalletAdapter | null>(null);
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);

  // Build the client, re-created whenever wallet or config changes
  const client = useMemo(() => {
    const cfg: ClientConfig = { network, contractId };
    if (wallet) cfg.signer = wallet;
    if (timeout !== undefined) cfg.timeout = timeout;
    if (retries !== undefined) cfg.retries = retries;
    if (pollInterval !== undefined) cfg.pollInterval = pollInterval;
    return new SorobanClient(cfg);
  }, [network, contractId, wallet, timeout, retries, pollInterval]);

  const connect = async () => {
    setIsConnecting(true);
    try {
      const adapter = await FreighterAdapter.connect();
      const key = await adapter.getPublicKey();
      setWallet(adapter);
      setPublicKey(key);
    } finally {
      setIsConnecting(false);
    }
  };

  const disconnect = () => {
    setWallet(null);
    setPublicKey(null);
  };

  // Auto-connect on mount if enabled
  useEffect(() => {
    if (!autoConnect) return;
    connect().catch(() => {
      // Silently fail — user hasn't granted access yet
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value: SorobanContextValue = {
    client,
    wallet,
    publicKey,
    isConnected: wallet !== null,
    isConnecting,
    connect,
    disconnect,
    network,
    contractId,
  };

  return (
    <SorobanContext.Provider value={value}>
      {children}
    </SorobanContext.Provider>
  );
}

// ─── Internal hook ────────────────────────────────────────────────────────────

export function useSorobanContext(): SorobanContextValue {
  const ctx = useContext(SorobanContext);
  if (!ctx) {
    throw new Error(
      "useSorobanContext must be used inside <SorobanProvider>. " +
        "Wrap your app or layout with <SorobanProvider network=... contractId=...>"
    );
  }
  return ctx;
}
