/**
 * KeypairAdapter — server-side signer using a raw Stellar keypair.
 *
 * Usage:
 *   const signer = new KeypairAdapter(process.env.STELLAR_SECRET!);
 *   const client = new SorobanClient({ ..., signer });
 *
 * Never expose the secret key in client-side code.
 */

import { Keypair, TransactionBuilder } from "@stellar/stellar-sdk";
import type { WalletAdapter } from "../types/index.js";
import { InvalidArgumentError } from "../errors/index.js";

export class KeypairAdapter implements WalletAdapter {
  private readonly keypair: Keypair;

  constructor(secretKey: string) {
    try {
      this.keypair = Keypair.fromSecret(secretKey);
    } catch {
      throw new InvalidArgumentError(
        "secretKey",
        "[redacted]",
        "a valid Stellar secret key (S-prefixed, 56 chars)"
      );
    }
  }

  async getPublicKey(): Promise<string> {
    return this.keypair.publicKey();
  }

  async signTransaction(
    xdr: string,
    opts?: { networkPassphrase?: string }
  ): Promise<string> {
    const tx = TransactionBuilder.fromXDR(
      xdr,
      opts?.networkPassphrase ?? "Test SDF Network ; September 2015"
    );
    tx.sign(this.keypair);
    return tx.toXDR();
  }

  async isConnected(): Promise<boolean> {
    return true; // Always connected — keypair is in memory
  }

  /** The public key of this keypair */
  get publicKey(): string {
    return this.keypair.publicKey();
  }
}
