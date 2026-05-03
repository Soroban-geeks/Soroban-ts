import { describe, it, expect } from "vitest";
import { KeypairAdapter } from "../src/wallet/keypair.js";
import { Keypair } from "@stellar/stellar-sdk";
import { InvalidArgumentError } from "../src/errors/index.js";

describe("KeypairAdapter", () => {
  const keypair = Keypair.random();

  it("accepts a valid secret key", () => {
    expect(() => new KeypairAdapter(keypair.secret())).not.toThrow();
  });

  it("throws InvalidArgumentError for an invalid secret", () => {
    expect(() => new KeypairAdapter("not-a-secret")).toThrow(InvalidArgumentError);
  });

  it("returns the correct public key", async () => {
    const adapter = new KeypairAdapter(keypair.secret());
    const pubKey = await adapter.getPublicKey();
    expect(pubKey).toBe(keypair.publicKey());
  });

  it("exposes publicKey as a getter", () => {
    const adapter = new KeypairAdapter(keypair.secret());
    expect(adapter.publicKey).toBe(keypair.publicKey());
  });

  it("isConnected always returns true", async () => {
    const adapter = new KeypairAdapter(keypair.secret());
    expect(await adapter.isConnected()).toBe(true);
  });

  it("signs a transaction and returns valid XDR", async () => {
    const { TransactionBuilder, Account, Networks, BASE_FEE, Operation, Asset } =
      await import("@stellar/stellar-sdk");

    const account = new Account(keypair.publicKey(), "100");
    const tx = new TransactionBuilder(account, {
      fee: BASE_FEE,
      networkPassphrase: Networks.TESTNET,
    })
      .addOperation(
        Operation.payment({
          destination: Keypair.random().publicKey(),
          asset: Asset.native(),
          amount: "1",
        })
      )
      .setTimeout(30)
      .build();

    const adapter = new KeypairAdapter(keypair.secret());
    const signedXdr = await adapter.signTransaction(tx.toXDR(), {
      networkPassphrase: Networks.TESTNET,
    });

    // Should return a non-empty XDR string
    expect(typeof signedXdr).toBe("string");
    expect(signedXdr.length).toBeGreaterThan(0);

    // The signed transaction should have one signature
    const signedTx = TransactionBuilder.fromXDR(signedXdr, Networks.TESTNET);
    expect(signedTx.signatures).toHaveLength(1);
  });
});
