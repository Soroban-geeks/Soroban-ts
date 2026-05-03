import { describe, it, expect } from "vitest";
import { encodeArg, encodeArgs, decodeResult } from "../src/encoding.js";
import { xdr, scValToNative, nativeToScVal } from "@stellar/stellar-sdk";
import { InvalidArgumentError } from "../src/errors/index.js";

describe("encodeArg", () => {
  it("encodes null/undefined as void", () => {
    const val = encodeArg(null, "p");
    expect(val.switch()).toBe(xdr.ScValType.scvVoid());
  });

  it("encodes bigint as i128", () => {
    const val = encodeArg(100_000_000n, "amount");
    const native = scValToNative(val);
    expect(native).toBe(100_000_000n);
  });

  it("encodes boolean", () => {
    const t = encodeArg(true, "flag");
    const f = encodeArg(false, "flag");
    expect(scValToNative(t)).toBe(true);
    expect(scValToNative(f)).toBe(false);
  });

  it("encodes integer as i64", () => {
    const val = encodeArg(42, "count");
    const native = scValToNative(val);
    expect(Number(native)).toBe(42);
  });

  it("throws for float numbers", () => {
    expect(() => encodeArg(1.5, "amount")).toThrow(InvalidArgumentError);
  });

  it("encodes G-address strings as address ScVal", () => {
    const addr = "GCLXZHLXQFLHVYNCKMXEA6CI5FMNU3CY3JVWHPWU4HPDI2C7RAPFDZPB";
    const val = encodeArg(addr, "from");
    // Should be an address type
    expect(val.switch().name).toBe("scvAddress");
  });

  it("encodes plain strings as symbol", () => {
    const val = encodeArg("hello", "name");
    expect(val.switch().name).toBe("scvSymbol");
  });

  it("encodes arrays as vec", () => {
    const val = encodeArg([1n, 2n, 3n], "items");
    expect(val.switch().name).toBe("scvVec");
    const items = val.vec()!;
    expect(items).toHaveLength(3);
  });

  it("encodes objects as map", () => {
    const val = encodeArg({ key: "value" }, "obj");
    expect(val.switch().name).toBe("scvMap");
  });
});

describe("encodeArgs", () => {
  it("returns an array of ScVal in insertion order", () => {
    const args = { from: "GCLXZHLXQFLHVYNCKMXEA6CI5FMNU3CY3JVWHPWU4HPDI2C7RAPFDZPB", amount: 100n };
    const encoded = encodeArgs(args);
    expect(encoded).toHaveLength(2);
    expect(encoded[0]?.switch().name).toBe("scvAddress");
    expect(encoded[1]?.switch().name).toBe("scvI128");
  });

  it("returns empty array for empty args", () => {
    expect(encodeArgs({})).toHaveLength(0);
  });
});

describe("decodeResult", () => {
  it("decodes i128 to bigint", () => {
    const scVal = nativeToScVal(12345n, { type: "i128" });
    expect(decodeResult(scVal)).toBe(12345n);
  });

  it("decodes bool", () => {
    expect(decodeResult(xdr.ScVal.scvBool(true))).toBe(true);
    expect(decodeResult(xdr.ScVal.scvBool(false))).toBe(false);
  });

  it("decodes void as null", () => {
    expect(decodeResult(xdr.ScVal.scvVoid())).toBeNull();
  });

  it("decodes symbol string", () => {
    const val = nativeToScVal("hello", { type: "symbol" });
    expect(decodeResult(val)).toBe("hello");
  });

  it("decodes vec of bigints", () => {
    const val = xdr.ScVal.scvVec([
      nativeToScVal(1n, { type: "i128" }),
      nativeToScVal(2n, { type: "i128" }),
    ]);
    const result = decodeResult(val);
    expect(Array.isArray(result)).toBe(true);
    expect(result).toEqual([1n, 2n]);
  });
});
