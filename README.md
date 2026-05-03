# soroban-ts

A clean TypeScript SDK for Soroban smart contracts. What [ethers.js](https://ethers.org) is to Ethereum — simplified for Stellar.

Built for the **JS SDK v13.0.0 era**. The existing tutorials and wrappers are broken. This isn't.

```bash
npm install soroban-ts
```

---

## Why

The raw `@stellar/stellar-sdk` requires you to manually construct XDR, simulate transactions, assemble them, sign them, submit them, and poll for confirmation — across 40+ lines of boilerplate per call.

`soroban-ts` collapses that into a single `client.call()`.

```ts
// Before
const contract = new Contract(contractId);
const tx = new TransactionBuilder(account, { fee, networkPassphrase })
  .addOperation(contract.call("transfer",
    nativeToScVal(from, { type: "address" }),
    nativeToScVal(to,   { type: "address" }),
    nativeToScVal(amount, { type: "i128" })
  ))
  .setTimeout(30).build();
const sim = await server.simulateTransaction(tx);
if (rpc.isSimulationError(sim)) throw new Error(sim.error);
const assembled = assembleTransaction(tx, sim).build();
assembled.sign(keypair);
await server.sendTransaction(assembled);
// ...then poll getTransaction() in a loop

// After
const result = await client.call("transfer", { from, to, amount });
```

---

## Quick start

### Node.js / server-side

```ts
import { SorobanClient, KeypairAdapter, xlmToStroops } from "soroban-ts";

const client = new SorobanClient({
  network: "testnet",
  contractId: "CCJZRL5NTE7NKOBVZXRFCJW3EAKZ3HEQHQC...",
  signer: new KeypairAdapter(process.env.STELLAR_SECRET!),
});

// Read contract state
const balance = await client.read("balance", { address: "GBZX..." });
console.log(balance); // → 50000000n

// Write (auto-simulates, signs, submits, polls)
const result = await client.call("transfer", {
  from: "GBZX...",
  to:   "GCAL...",
  amount: xlmToStroops("10"),
});

console.log(result.hash);   // → "a3f8..."
console.log(result.fee);    // → "1250"
console.log(result.ledger); // → 4821039
```

### Browser with Freighter

```ts
import { SorobanClient, FreighterAdapter } from "soroban-ts";

const wallet = await FreighterAdapter.connect();
const client = new SorobanClient({
  network: "mainnet",
  contractId: "CCJZ...",
  signer: wallet,
});

await client.call("mint", { to: await wallet.getPublicKey(), amount: 1000n });
```

### Next.js App Router

```tsx
// app/layout.tsx
import { SorobanProvider } from "soroban-ts/react";

export default function Layout({ children }) {
  return (
    <SorobanProvider network="testnet" contractId="CCJZ...">
      {children}
    </SorobanProvider>
  );
}

// app/components/TransferButton.tsx
"use client";
import { useContract, useWallet } from "soroban-ts/react";

export function TransferButton() {
  const { publicKey, connect, isConnected } = useWallet();
  const { call, loading, error } = useContract();

  if (!isConnected) {
    return <button onClick={connect}>Connect Wallet</button>;
  }

  return (
    <button
      disabled={loading}
      onClick={() => call("transfer", { from: publicKey!, to, amount })}
    >
      {loading ? "Confirming..." : "Transfer"}
    </button>
  );
}
```

---

## API Reference

### `SorobanClient`

```ts
const client = new SorobanClient(config: ClientConfig)
```

| Option | Type | Required | Default | Description |
|---|---|---|---|---|
| `network` | `"testnet" \| "mainnet" \| "futurenet" \| RpcConfig` | ✓ | — | Target network |
| `contractId` | `string` | ✓ | — | C-prefixed contract address |
| `signer` | `WalletAdapter` | — | — | Required for write operations |
| `timeout` | `number` | — | `30` | Transaction timeout (seconds) |
| `retries` | `number` | — | `10` | Polling retries before `TxTimeoutError` |
| `pollInterval` | `number` | — | `2000` | Ms between polling attempts |

#### `client.read(method, args?, options?)`

Reads contract state. No signer required. Returns decoded value.

```ts
const balance = await client.read("balance", { address: "GBZX..." });
// → 50000000n
```

#### `client.call(method, args?, options?)`

Executes a write. Simulates → signs → submits → polls → returns `TxResult`.

```ts
const result = await client.call("transfer", { from, to, amount });
// result: { hash, fee, ledger, value, status }
```

#### `client.simulate(method, args?)`

Dry-run only. Returns fee estimate and decoded return value without submitting.

```ts
const sim = await client.simulate("transfer", { from, to, amount });
// sim: { success, estimatedFee, value, authEntries }
```

---

### Wallet Adapters

#### `FreighterAdapter` — browser

```ts
const wallet = await FreighterAdapter.connect();
const publicKey = await wallet.getPublicKey();
```

#### `KeypairAdapter` — server/Node

```ts
const signer = new KeypairAdapter(process.env.STELLAR_SECRET!);
```

---

### React Hooks (import from `soroban-ts/react`)

#### `useWallet()`

```ts
const { publicKey, isConnected, isConnecting, connect, disconnect, error } = useWallet();
```

#### `useContract()`

```ts
const { call, loading, error, result, reset } = useContract();
```

#### `useRead(method, args?, options?)`

```ts
const { data, loading, error, refetch } = useRead<bigint>(
  "balance",
  { address: publicKey },
  { refreshInterval: 10_000 }
);
```

---

### Error Types

Every error extends `SorobanError` and includes a human-readable `.suggestion`.

| Error | Extra fields | When thrown |
|---|---|---|
| `SimulationError` | `.contractError`, `.raw` | Pre-flight simulation fails |
| `InsufficientFundsError` | `.required`, `.available`, `.address` | Account can't cover fee/amount |
| `ContractNotFoundError` | `.contractId`, `.network` | Contract doesn't exist on network |
| `ContractMethodNotFoundError` | `.method`, `.contractId` | Function name not in ABI |
| `WalletNotConnectedError` | `.adapter` | Freighter not installed/connected |
| `WalletSignRejectedError` | — | User rejected the signature |
| `NoSignerError` | — | `.call()` with no signer configured |
| `TxTimeoutError` | `.hash`, `.attempts`, `.lastStatus` | Polling exceeded retry limit |
| `TxFailedError` | `.hash`, `.resultXdr` | Transaction failed on-chain |
| `InvalidArgumentError` | `.param`, `.received`, `.expected` | Argument type mismatch |
| `NetworkError` | `.rpcUrl` | RPC connection failed |

```ts
import {
  InsufficientFundsError,
  SimulationError,
  TxTimeoutError,
} from "soroban-ts";

try {
  await client.call("transfer", { from, to, amount });
} catch (err) {
  if (err instanceof InsufficientFundsError) {
    console.log(err.suggestion); // Friendbot URL on testnet
  }
  if (err instanceof TxTimeoutError) {
    console.log(err.hash); // Hash is preserved for manual recovery
  }
}
```

---

### Utilities

```ts
import { xlmToStroops, stroopsToXlm, truncateAddress, isValidAddress, friendbotFund } from "soroban-ts";

xlmToStroops("10")         // → 100_000_000n
stroopsToXlm(100_000_000n) // → "10.0000000"
truncateAddress("GBZX...WXYZ") // → "GBZX…WXYZ"
isValidAddress("GBZX...")  // → true/false
await friendbotFund("GBZX...") // funds testnet address
```

---

## Custom RPC

```ts
const client = new SorobanClient({
  network: {
    rpcUrl: "https://my-rpc.example.com",
    networkPassphrase: "My Private Network ; 2026",
  },
  contractId: "CCJZ...",
});
```

---

## Development

```bash
git clone https://github.com/your-username/soroban-ts
cd soroban-ts
npm install

npm run build      # compile to dist/
npm test           # run vitest suite
npm run typecheck  # tsc --noEmit
npm run dev        # watch mode
```

---

## License

MIT
