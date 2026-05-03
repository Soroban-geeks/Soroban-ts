/**
 * soroban-ts React hooks
 *
 * useContract() — execute write operations (call)
 * useRead()     — subscribe to contract state
 * useWallet()   — wallet connection management
 */

"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useSorobanContext } from "./context.js";
import type { TxResult, ContractArgs, CallOptions } from "../types/index.js";
import type { SorobanError } from "../errors/index.js";

// ─── useContract ──────────────────────────────────────────────────────────────

export interface UseContractReturn {
  /**
   * Execute a write operation on the contract.
   * Returns TxResult on success, null on error (check `error`).
   */
  call: (
    method: string,
    args?: ContractArgs,
    options?: CallOptions
  ) => Promise<TxResult | null>;
  /** Whether a transaction is currently in flight */
  loading: boolean;
  /** The last error, if any */
  error: SorobanError | Error | null;
  /** The last successful result */
  result: TxResult | null;
  /** Reset loading/error/result state */
  reset: () => void;
}

export function useContract(): UseContractReturn {
  const { client } = useSorobanContext();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<SorobanError | Error | null>(null);
  const [result, setResult] = useState<TxResult | null>(null);

  const call = useCallback(
    async (
      method: string,
      args: ContractArgs = {},
      options: CallOptions = {}
    ): Promise<TxResult | null> => {
      if (!client) return null;

      setLoading(true);
      setError(null);

      try {
        const txResult = await client.call(method, args, options);
        setResult(txResult);
        return txResult;
      } catch (err) {
        const error = err as SorobanError | Error;
        setError(error);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [client]
  );

  const reset = useCallback(() => {
    setLoading(false);
    setError(null);
    setResult(null);
  }, []);

  return { call, loading, error, result, reset };
}

// ─── useRead ──────────────────────────────────────────────────────────────────

export interface UseReadReturn<T = unknown> {
  /** The decoded contract state value */
  data: T | null;
  /** Whether the initial fetch is in progress */
  loading: boolean;
  /** Any error that occurred during fetch */
  error: Error | null;
  /** Manually trigger a re-fetch */
  refetch: () => void;
}

export interface UseReadOptions {
  /** Set to false to skip the fetch (e.g., when args aren't ready yet) */
  enabled?: boolean;
  /** Re-fetch every N milliseconds. Leave undefined to disable. */
  refreshInterval?: number;
}

export function useRead<T = unknown>(
  method: string,
  args: ContractArgs = {},
  options: UseReadOptions = {}
): UseReadReturn<T> {
  const { client } = useSorobanContext();
  const { enabled = true, refreshInterval } = options;

  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [tick, setTick] = useState(0);

  // Stable ref for args to avoid spurious re-fetches
  const argsRef = useRef(args);
  argsRef.current = args;

  const fetchData = useCallback(async () => {
    if (!client || !enabled) return;

    setLoading(true);
    setError(null);

    try {
      const result = await client.read(method, argsRef.current);
      setData(result as T);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [client, method, enabled]);

  // Initial fetch + re-fetch on tick (triggered by refetch())
  useEffect(() => {
    fetchData();
  }, [fetchData, tick]);

  // Polling
  useEffect(() => {
    if (!refreshInterval || !enabled) return;
    const id = setInterval(fetchData, refreshInterval);
    return () => clearInterval(id);
  }, [fetchData, refreshInterval, enabled]);

  const refetch = useCallback(() => {
    setTick((t) => t + 1);
  }, []);

  return { data, loading, error, refetch };
}

// ─── useWallet ────────────────────────────────────────────────────────────────

export interface UseWalletReturn {
  /** Stellar G-address of the connected account */
  publicKey: string | null;
  /** Whether a wallet is currently connected */
  isConnected: boolean;
  /** Whether a connection is in progress */
  isConnecting: boolean;
  /** Any error from the last connect attempt */
  error: Error | null;
  /** Connect to the Freighter wallet */
  connect: () => Promise<void>;
  /** Disconnect the wallet */
  disconnect: () => void;
}

export function useWallet(): UseWalletReturn {
  const { publicKey, isConnected, isConnecting, connect: ctxConnect, disconnect } =
    useSorobanContext();
  const [error, setError] = useState<Error | null>(null);

  const connect = useCallback(async () => {
    setError(null);
    try {
      await ctxConnect();
    } catch (err) {
      setError(err as Error);
    }
  }, [ctxConnect]);

  return {
    publicKey,
    isConnected,
    isConnecting,
    error,
    connect,
    disconnect,
  };
}
