/**
 * FreighterAdapter — browser wallet adapter for the Freighter extension.
 *
 * Usage:
 *   const wallet = await FreighterAdapter.connect();
 *   const client = new SorobanClient({ ..., signer: wallet });
 *
 * Requires the Freighter browser extension to be installed.
 */

import type { WalletAdapter } from "../types/index.js";
import {
  WalletNotConnectedError,
  WalletSignRejectedError,
} from "../errors/index.js";

// Freighter injects window.freighter — we type just what we need
interface FreighterWindow {
  freighter?: {
    isConnected(): Promise<boolean>;
    getPublicKey(): Promise<string>;
    signTransaction(
      xdr: string,
      opts?: { network?: string; networkPassphrase?: string }
    ): Promise<string>;
    requestAccess(): Promise<string>;
  };
}

declare const window: FreighterWindow & Window;

export class FreighterAdapter implements WalletAdapter {
  private publicKey: string | null = null;

  private constructor() {}

  /**
   * Requests wallet access and returns a connected FreighterAdapter.
   * Call this in response to a user action (button click, etc.)
   *
   * @throws WalletNotConnectedError if Freighter is not installed
   * @throws WalletSignRejectedError if the user rejects the access request
   */
  static async connect(): Promise<FreighterAdapter> {
    if (typeof window === "undefined" || !window.freighter) {
      throw new WalletNotConnectedError("FreighterAdapter");
    }

    const adapter = new FreighterAdapter();

    try {
      const result = await window.freighter.requestAccess();
      adapter.publicKey = result;
    } catch (err) {
      if (
        err instanceof Error &&
        err.message.toLowerCase().includes("reject")
      ) {
        throw new WalletSignRejectedError();
      }
      throw new WalletNotConnectedError("FreighterAdapter");
    }

    return adapter;
  }

  async getPublicKey(): Promise<string> {
    if (this.publicKey) return this.publicKey;

    if (!window.freighter) {
      throw new WalletNotConnectedError("FreighterAdapter");
    }

    const key = await window.freighter.getPublicKey();
    this.publicKey = key;
    return key;
  }

  async signTransaction(
    xdr: string,
    opts?: { networkPassphrase?: string }
  ): Promise<string> {
    if (!window.freighter) {
      throw new WalletNotConnectedError("FreighterAdapter");
    }

    try {
      const signOpts: { network?: string; networkPassphrase?: string } = {};
      if (opts?.networkPassphrase !== undefined) {
        signOpts.networkPassphrase = opts.networkPassphrase;
      }
      return await window.freighter.signTransaction(xdr, signOpts);
    } catch (err) {
      if (
        err instanceof Error &&
        (err.message.toLowerCase().includes("reject") ||
          err.message.toLowerCase().includes("denied"))
      ) {
        throw new WalletSignRejectedError();
      }
      throw err;
    }
  }

  async isConnected(): Promise<boolean> {
    if (!window.freighter) return false;
    try {
      return await window.freighter.isConnected();
    } catch {
      return false;
    }
  }
}
