import { describe, it, expect } from "vitest";
import {
  xlmToStroops,
  stroopsToXlm,
  isValidAddress,
  isValidContractId,
  truncateAddress,
} from "../src/utils.js";

describe("xlmToStroops", () => {
  it("converts whole XLM", () => {
    expect(xlmToStroops("10")).toBe(100_000_000n);
    expect(xlmToStroops("1")).toBe(10_000_000n);
    expect(xlmToStroops("100")).toBe(1_000_000_000n);
  });

  it("converts fractional XLM", () => {
    expect(xlmToStroops("0.5")).toBe(5_000_000n);
    expect(xlmToStroops("1.5")).toBe(15_000_000n);
    expect(xlmToStroops("0.0000001")).toBe(1n);
  });

  it("handles numeric input", () => {
    expect(xlmToStroops(10)).toBe(100_000_000n);
    expect(xlmToStroops(1.5)).toBe(15_000_000n);
  });

  it("truncates beyond 7 decimal places", () => {
    expect(xlmToStroops("0.00000001")).toBe(0n); // 8th decimal place is dropped
  });
});

describe("stroopsToXlm", () => {
  it("converts stroops to XLM string", () => {
    expect(stroopsToXlm(100_000_000n)).toBe("10.0000000");
    expect(stroopsToXlm(10_000_000n)).toBe("1.0000000");
    expect(stroopsToXlm(1n)).toBe("0.0000001");
  });

  it("accepts string input", () => {
    expect(stroopsToXlm("100000000")).toBe("10.0000000");
  });

  it("round-trips with xlmToStroops", () => {
    const original = "12.3456789";
    // Note: only 7 decimal places preserved
    const stroops = xlmToStroops(original);
    expect(stroopsToXlm(stroops)).toBe("12.3456789");
  });
});

describe("isValidAddress", () => {
  it("returns true for valid G-addresses", () => {
    expect(
      isValidAddress("GCLXZHLXQFLHVYNCKMXEA6CI5FMNU3CY3JVWHPWU4HPDI2C7RAPFDZPB")
    ).toBe(true);
  });

  it("returns false for garbage input", () => {
    expect(isValidAddress("garbage")).toBe(false);
    expect(isValidAddress("")).toBe(false);
    expect(isValidAddress("GBZX")).toBe(false);
  });
});

describe("isValidContractId", () => {
  it("returns false for non-contract strings", () => {
    expect(isValidContractId("garbage")).toBe(false);
    expect(isValidContractId("GBZX...")).toBe(false);
  });
});

describe("truncateAddress", () => {
  const addr = "GCLXZHLXQFLHVYNCKMXEA6CI5FMNU3CY3JVWHPWU4HPDI2C7RAPFDZPB";

  it("truncates with default settings", () => {
    expect(truncateAddress(addr)).toBe("GCLX…DZPB");
  });

  it("respects custom lengths", () => {
    expect(truncateAddress(addr, 6, 6)).toBe("GCLXZH…PFDZPB");
  });

  it("returns short strings unchanged", () => {
    expect(truncateAddress("GAAZ", 4, 4)).toBe("GAAZ");
  });
});
