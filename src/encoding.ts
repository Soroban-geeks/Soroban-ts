/**
 * soroban-ts — XDR encoding / decoding
 *
 * Converts plain JS values → ScVal for contract calls,
 * and ScVal → plain JS values for results.
 */

import {
  nativeToScVal,
  scValToNative,
  xdr,
  Address,
  StrKey,
} from "@stellar/stellar-sdk";
import type { ContractValue } from "./types/index.js";
import { InvalidArgumentError } from "./errors/index.js";

// ─── Encode args ─────────────────────────────────────────────────────────────

/**
 * Converts a plain JS value into a Soroban ScVal.
 * Handles: bigint, string (address or plain), boolean, number, null, arrays, objects.
 */
export function encodeArg(value: unknown, paramName: string): xdr.ScVal {
  if (value === null || value === undefined) {
    return xdr.ScVal.scvVoid();
  }

  if (typeof value === "bigint") {
    // Encode as i128 (covers most token amounts)
    return nativeToScVal(value, { type: "i128" });
  }

  if (typeof value === "boolean") {
    return xdr.ScVal.scvBool(value);
  }

  if (typeof value === "number") {
    if (!Number.isInteger(value)) {
      throw new InvalidArgumentError(
        paramName,
        value,
        "integer (use bigint for large values)"
      );
    }
    return nativeToScVal(value, { type: "i64" });
  }

  if (typeof value === "string") {
    // Detect Stellar G-address (ed25519 public key)
    if (StrKey.isValidEd25519PublicKey(value)) {
      return nativeToScVal(new Address(value), { type: "address" });
    }
    // Detect Stellar C-address (contract)
    if (StrKey.isValidContract(value)) {
      return nativeToScVal(new Address(value), { type: "address" });
    }
    // Plain string → Symbol (most common for short strings)
    return nativeToScVal(value, { type: "symbol" });
  }

  if (Array.isArray(value)) {
    const items = value.map((item, i) =>
      encodeArg(item, `${paramName}[${i}]`)
    );
    return xdr.ScVal.scvVec(items);
  }

  if (typeof value === "object") {
    // Encode as a map
    const entries = Object.entries(value as Record<string, unknown>).map(
      ([k, v]) =>
        new xdr.ScMapEntry({
          key: nativeToScVal(k, { type: "symbol" }),
          val: encodeArg(v, `${paramName}.${k}`),
        })
    );
    return xdr.ScVal.scvMap(entries);
  }

  throw new InvalidArgumentError(paramName, value, "a supported JS type");
}

/**
 * Encodes a ContractArgs object into an ordered array of ScVal.
 * Keys are used as parameter names in error messages.
 */
export function encodeArgs(
  args: Record<string, unknown>
): xdr.ScVal[] {
  return Object.entries(args).map(([key, value]) => encodeArg(value, key));
}

// ─── Decode result ────────────────────────────────────────────────────────────

/**
 * Converts a Soroban ScVal result into a plain JS value.
 * Uses stellar-sdk's scValToNative, then normalizes to our ContractValue type.
 */
export function decodeResult(scVal: xdr.ScVal): ContractValue {
  const native = scValToNative(scVal);
  return normalizeNative(native);
}

function normalizeNative(value: unknown): ContractValue {
  if (value === null || value === undefined) return null;
  if (typeof value === "bigint") return value;
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value;
  if (typeof value === "string") return value;

  if (Array.isArray(value)) {
    return value.map(normalizeNative);
  }

  if (value instanceof Map) {
    const obj: Record<string, ContractValue> = {};
    for (const [k, v] of value) {
      obj[String(k)] = normalizeNative(v);
    }
    return obj;
  }

  if (typeof value === "object") {
    const obj: Record<string, ContractValue> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      obj[k] = normalizeNative(v);
    }
    return obj;
  }

  return String(value);
}
