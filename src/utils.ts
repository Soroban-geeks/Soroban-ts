/**
 * soroban-ts — utility functions
 */

import { StrKey } from "@stellar/stellar-sdk";

// ─── Constants ───────────────────────────────────────────────────────────────

const STROOPS_PER_XLM = 10_000_000n;

// ─── XLM / Stroops conversions ───────────────────────────────────────────────

/**
 * Convert an XLM amount (string or number) to stroops (bigint).
 *
 * @example
 * xlmToStroops("10")    // → 100_000_000n
 * xlmToStroops("0.5")   // → 5_000_000n
 * xlmToStroops(1.23)    // → 12_300_000n
 */
export function xlmToStroops(xlm: string | number): bigint {
  const str = String(xlm);
  const [intPart = "0", fracPart = ""] = str.split(".");
  const normalizedFrac = fracPart.padEnd(7, "0").slice(0, 7);
  const stroops = BigInt(intPart) * STROOPS_PER_XLM + BigInt(normalizedFrac);
  return stroops;
}

/**
 * Convert stroops (bigint or string) to an XLM string.
 *
 * @example
 * stroopsToXlm(100_000_000n) // → "10.0000000"
 * stroopsToXlm("5000000")    // → "0.5000000"
 */
export function stroopsToXlm(stroops: bigint | string): string {
  const s = BigInt(stroops);
  const int = s / STROOPS_PER_XLM;
  const frac = s % STROOPS_PER_XLM;
  return `${int}.${String(frac).padStart(7, "0")}`;
}

// ─── Address helpers ─────────────────────────────────────────────────────────

/**
 * Returns true if the string is a valid Stellar G-address (public key).
 *
 * @example
 * isValidAddress("GBZX...") // → true
 * isValidAddress("garbage") // → false
 */
export function isValidAddress(address: string): boolean {
  try {
    return StrKey.isValidEd25519PublicKey(address);
  } catch {
    return false;
  }
}

/**
 * Returns true if the string is a valid Stellar C-address (contract ID).
 *
 * @example
 * isValidContractId("CCJZ...") // → true
 */
export function isValidContractId(id: string): boolean {
  try {
    return StrKey.isValidContract(id);
  } catch {
    return false;
  }
}

/**
 * Truncates a Stellar address for display.
 *
 * @example
 * truncateAddress("GBZXYZ...SHNAP") // → "GBZX…HNAP"
 */
export function truncateAddress(
  address: string,
  startChars = 4,
  endChars = 4
): string {
  if (address.length <= startChars + endChars) return address;
  return `${address.slice(0, startChars)}…${address.slice(-endChars)}`;
}

// ─── Friendbot ───────────────────────────────────────────────────────────────

/**
 * Funds an address on testnet using Friendbot.
 * Throws if not on testnet or if funding fails.
 *
 * @example
 * await friendbotFund("GBZX...");
 */
export async function friendbotFund(address: string): Promise<void> {
  if (!isValidAddress(address)) {
    throw new Error(`Invalid Stellar address: ${address}`);
  }

  const res = await fetch(
    `https://friendbot.stellar.org/?addr=${encodeURIComponent(address)}`
  );

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Friendbot funding failed: ${res.status} ${body}`);
  }
}

// ─── Sleep ───────────────────────────────────────────────────────────────────

/** Promise-based sleep for polling loops */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
