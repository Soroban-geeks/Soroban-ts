/**
 * Example: Token transfer using soroban-ts
 *
 * Demonstrates a full transfer flow on testnet using a raw keypair.
 * Run with: npx tsx examples/token-transfer/index.ts
 *
 * Prerequisites:
 *   1. Set STELLAR_SECRET in your .env
 *   2. Fund the account via Friendbot if needed
 */

import "dotenv/config";
import {
  SorobanClient,
  KeypairAdapter,
  xlmToStroops,
  stroopsToXlm,
  truncateAddress,
  friendbotFund,
  InsufficientFundsError,
  SimulationError,
  TxTimeoutError,
} from "soroban-ts";

// ─── Config ──────────────────────────────────────────────────────────────────

// The Stellar testnet native XLM token contract
const NATIVE_TOKEN_CONTRACT = "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC";

const RECIPIENT = "GCAL5XOFBF2FYY5MEKZ736JHH5TDQXSHQV3ICSF7G3KLRUVLVYTGMFB";

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const secret = process.env["STELLAR_SECRET"];
  if (!secret) {
    throw new Error("STELLAR_SECRET environment variable is required");
  }

  const signer = new KeypairAdapter(secret);
  const sender = await signer.getPublicKey();

  console.log("\n─── soroban-ts token transfer example ───\n");
  console.log(`Sender:    ${truncateAddress(sender, 6, 6)}`);
  console.log(`Recipient: ${truncateAddress(RECIPIENT, 6, 6)}`);

  // ── 1. Set up client ───────────────────────────────────────────────────────
  const client = new SorobanClient({
    network: "testnet",
    contractId: NATIVE_TOKEN_CONTRACT,
    signer,
    timeout: 60,
    retries: 15,
    pollInterval: 2000,
  });

  // ── 2. Read current balance ────────────────────────────────────────────────
  console.log("\n[1/4] Reading balance...");

  const balance = await client.read("balance", { address: sender }) as bigint;
  console.log(`      Balance: ${stroopsToXlm(balance)} XLM (${balance} stroops)`);

  // ── 3. Dry-run the transfer first ──────────────────────────────────────────
  const transferAmount = xlmToStroops("1"); // 1 XLM
  console.log(`\n[2/4] Simulating transfer of ${stroopsToXlm(transferAmount)} XLM...`);

  const sim = await client.simulate("transfer", {
    from: sender,
    to: RECIPIENT,
    amount: transferAmount,
  });

  console.log(`      Estimated fee: ${sim.estimatedFee} stroops`);
  console.log(`      Auth entries:  ${sim.authEntries.length}`);

  // ── 4. Execute the transfer ────────────────────────────────────────────────
  console.log(`\n[3/4] Executing transfer...`);

  const result = await client.call("transfer", {
    from: sender,
    to: RECIPIENT,
    amount: transferAmount,
  });

  console.log(`      ✓ Confirmed in ledger ${result.ledger}`);
  console.log(`      Hash: ${result.hash}`);
  console.log(`      Fee paid: ${result.fee} stroops`);

  // ── 5. Verify new balance ──────────────────────────────────────────────────
  console.log(`\n[4/4] Verifying new balance...`);

  const newBalance = await client.read("balance", { address: sender }) as bigint;
  console.log(`      New balance: ${stroopsToXlm(newBalance)} XLM`);

  const diff = balance - newBalance;
  console.log(`      Spent: ${stroopsToXlm(diff)} XLM (transfer + fee)`);

  console.log(`\n─── Done ───\n`);
  console.log(
    `View on Stellar Expert: https://stellar.expert/explorer/testnet/tx/${result.hash}\n`
  );
}

// ─── Error handling ───────────────────────────────────────────────────────────

main().catch(async (err: unknown) => {
  console.error("\n─── Error ───\n");

  if (err instanceof InsufficientFundsError) {
    console.error(`Insufficient funds on ${truncateAddress(err.address)}`);
    console.error(`Required: ${stroopsToXlm(err.required)} XLM`);
    console.error(`Available: ${stroopsToXlm(err.available)} XLM`);
    console.error(`\nFunding via Friendbot...`);
    try {
      await friendbotFund(err.address);
      console.error("Funded! Re-run the script.");
    } catch {
      console.error(err.suggestion);
    }
    process.exit(1);
  }

  if (err instanceof SimulationError) {
    console.error(`Simulation failed: ${err.contractError}`);
    console.error(`Suggestion: ${err.suggestion}`);
    process.exit(1);
  }

  if (err instanceof TxTimeoutError) {
    console.error(`Transaction timed out after ${err.attempts} attempts`);
    console.error(`Last status: ${err.lastStatus}`);
    console.error(`\nCheck manually: https://stellar.expert/explorer/testnet/tx/${err.hash}`);
    process.exit(1);
  }

  console.error(err);
  process.exit(1);
});
