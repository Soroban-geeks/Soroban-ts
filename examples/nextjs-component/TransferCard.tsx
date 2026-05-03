/**
 * Example: Next.js App Router component using soroban-ts/react hooks
 *
 * Drop this into your Next.js project after:
 *   1. Wrapping your layout with <SorobanProvider>
 *   2. Installing soroban-ts
 *
 * app/layout.tsx:
 *   import { SorobanProvider } from "soroban-ts/react";
 *   export default function Layout({ children }) {
 *     return (
 *       <SorobanProvider network="testnet" contractId="CCJZ...">
 *         {children}
 *       </SorobanProvider>
 *     );
 *   }
 */

"use client";

import { useState } from "react";
import { useContract, useRead, useWallet } from "soroban-ts/react";
import {
  xlmToStroops,
  stroopsToXlm,
  truncateAddress,
  isValidAddress,
  InsufficientFundsError,
  WalletSignRejectedError,
} from "soroban-ts";

// ─── Balance display ──────────────────────────────────────────────────────────

function BalanceDisplay({ address }: { address: string }) {
  const { data: balance, loading, refetch } = useRead<bigint>(
    "balance",
    { address },
    { refreshInterval: 10_000, enabled: isValidAddress(address) }
  );

  if (loading) return <span className="text-gray-400">Loading...</span>;
  if (balance === null) return <span className="text-gray-400">—</span>;

  return (
    <span className="font-mono">
      {stroopsToXlm(balance)} XLM
      <button
        onClick={refetch}
        className="ml-2 text-xs text-blue-400 hover:text-blue-300"
      >
        ↻
      </button>
    </span>
  );
}

// ─── Transfer card ────────────────────────────────────────────────────────────

export function TransferCard() {
  const { publicKey, isConnected, isConnecting, connect, error: walletError } = useWallet();
  const { call, loading, error, result, reset } = useContract();

  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);

  const handleTransfer = async () => {
    // Validate inputs
    if (!isValidAddress(recipient)) {
      setValidationError("Invalid recipient address");
      return;
    }
    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      setValidationError("Enter a valid amount");
      return;
    }

    setValidationError(null);
    reset();

    await call("transfer", {
      from: publicKey!,
      to: recipient,
      amount: xlmToStroops(amount),
    });
  };

  // ── Not connected ──────────────────────────────────────────────────────────
  if (!isConnected) {
    return (
      <div className="rounded-xl border border-gray-800 bg-gray-900 p-6 max-w-md">
        <h2 className="text-lg font-semibold mb-1">Token Transfer</h2>
        <p className="text-sm text-gray-400 mb-6">
          Connect your Freighter wallet to send XLM via Soroban contracts.
        </p>
        <button
          onClick={connect}
          disabled={isConnecting}
          className="w-full bg-teal-500 hover:bg-teal-400 disabled:opacity-50 text-black font-medium py-2.5 px-4 rounded-lg transition-colors"
        >
          {isConnecting ? "Connecting..." : "Connect Freighter"}
        </button>
        {walletError && (
          <p className="mt-3 text-sm text-red-400">{walletError.message}</p>
        )}
      </div>
    );
  }

  // ── Success state ──────────────────────────────────────────────────────────
  if (result) {
    return (
      <div className="rounded-xl border border-teal-800 bg-gray-900 p-6 max-w-md">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-8 h-8 bg-teal-500 rounded-full flex items-center justify-center text-black">
            ✓
          </div>
          <div>
            <h2 className="font-semibold">Transfer Confirmed</h2>
            <p className="text-xs text-gray-400">Ledger #{result.ledger}</p>
          </div>
        </div>

        <div className="space-y-2 text-sm font-mono bg-gray-800 rounded-lg p-3 mb-4">
          <div className="flex justify-between">
            <span className="text-gray-400">Hash</span>
            <span className="text-gray-200">{truncateAddress(result.hash, 8, 8)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Fee</span>
            <span className="text-gray-200">{result.fee} stroops</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Amount</span>
            <span className="text-gray-200">{amount} XLM</span>
          </div>
        </div>

        <div className="flex gap-2">
          <a
            href={`https://stellar.expert/explorer/testnet/tx/${result.hash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 text-center text-sm text-teal-400 border border-teal-800 rounded-lg py-2 hover:bg-teal-950 transition-colors"
          >
            View on Explorer →
          </a>
          <button
            onClick={() => { reset(); setRecipient(""); setAmount(""); }}
            className="flex-1 text-sm bg-gray-800 hover:bg-gray-700 rounded-lg py-2 transition-colors"
          >
            New Transfer
          </button>
        </div>
      </div>
    );
  }

  // ── Transfer form ──────────────────────────────────────────────────────────
  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 p-6 max-w-md">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold">Token Transfer</h2>
        <div className="text-xs text-gray-400 font-mono">
          {truncateAddress(publicKey!)}
        </div>
      </div>

      {/* Balance */}
      <div className="bg-gray-800 rounded-lg p-3 mb-4 text-sm flex justify-between items-center">
        <span className="text-gray-400">Your balance</span>
        <BalanceDisplay address={publicKey!} />
      </div>

      {/* Recipient */}
      <div className="mb-3">
        <label className="block text-xs text-gray-400 mb-1.5 uppercase tracking-wider">
          Recipient
        </label>
        <input
          value={recipient}
          onChange={(e) => { setRecipient(e.target.value); setValidationError(null); }}
          placeholder="G..."
          className="w-full bg-gray-800 border border-gray-700 focus:border-teal-500 rounded-lg px-3 py-2.5 text-sm font-mono outline-none transition-colors"
          disabled={loading}
        />
      </div>

      {/* Amount */}
      <div className="mb-4">
        <label className="block text-xs text-gray-400 mb-1.5 uppercase tracking-wider">
          Amount (XLM)
        </label>
        <input
          value={amount}
          onChange={(e) => { setAmount(e.target.value); setValidationError(null); }}
          type="number"
          min="0"
          step="0.1"
          placeholder="0.00"
          className="w-full bg-gray-800 border border-gray-700 focus:border-teal-500 rounded-lg px-3 py-2.5 text-sm font-mono outline-none transition-colors"
          disabled={loading}
        />
      </div>

      {/* Errors */}
      {(validationError || error) && (
        <div className="mb-4 p-3 bg-red-950 border border-red-800 rounded-lg text-sm text-red-300">
          {validationError ?? formatError(error!)}
        </div>
      )}

      {/* Submit */}
      <button
        onClick={handleTransfer}
        disabled={loading || !recipient || !amount}
        className="w-full bg-teal-500 hover:bg-teal-400 disabled:opacity-40 disabled:cursor-not-allowed text-black font-medium py-2.5 px-4 rounded-lg transition-colors"
      >
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <span className="animate-spin">⟳</span>
            {loading ? "Confirming on Stellar..." : "Transfer"}
          </span>
        ) : (
          `Transfer${amount ? ` ${amount} XLM` : ""}`
        )}
      </button>
    </div>
  );
}

// ─── Error formatter ──────────────────────────────────────────────────────────

function formatError(err: Error): string {
  if (err instanceof InsufficientFundsError) {
    return `Insufficient funds. Need ${stroopsToXlm(err.required)} XLM, have ${stroopsToXlm(err.available)} XLM.`;
  }
  if (err instanceof WalletSignRejectedError) {
    return "Transaction rejected. Please approve in Freighter.";
  }
  return err.message;
}
