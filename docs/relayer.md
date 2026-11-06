# WhiteFinance EIP-3009 gasless relayer — completion report

Separate Node worker at `apps/relayer`. Next.js proxies `/api/v1/relayer/*` and never holds `RELAYER_PRIVATE_KEY`.

## 1. Authorization flow

1. Merchant creates an onchain payment intent (`createIntent`).
2. Client calls `POST /api/v1/relayer/quote` with `intentId` (+ `payer` if unbound).
3. Relayer reads intent + prize USDT `DOMAIN_SEPARATOR`, builds exact EIP-712 `ReceiveWithAuthorization` (`to = PaymentProcessor`, `value = intent.amount`, fresh `bytes32` nonce, exclusive validity window).
4. Customer wallet signs that typed data (exact payment only).
5. Client calls `POST /api/v1/relayer/submit` with the signed authorization + optional `Idempotency-Key`.
6. Relayer validates checklist → `estimateGas` → submits only `PaymentProcessor.settleWithAuthorization` → waits for receipt.
7. Payment is marked complete only after `PaymentSettled` in the receipt **and** onchain intent status `Settled`.

Gasful fallback: `PaymentProcessor.pay` (customer holds WBT). Relayer is operational convenience; settle is permissionless onchain.

## 2. API endpoints

### Relayer worker (`HOST:PORT`, default `127.0.0.1:8787`)

| Method | Path | Auth |
| --- | --- | --- |
| GET | `/health` | public |
| GET | `/tx/:txHash` | public (in-memory status) |
| POST | `/quote` | `X-Relayer-Token` if configured |
| POST | `/submit` | `X-Relayer-Token` if configured |

### Next.js proxy

| Method | Path |
| --- | --- |
| GET | `/api/v1/relayer/health` |
| POST | `/api/v1/relayer/quote` |
| POST | `/api/v1/relayer/submit` |

## 3. Signature validation

- Type: `ReceiveWithAuthorization` (not `TransferWithAuthorization`, not EIP-2612 permit).
- Domain: name `Tether USD`, version `1`, chainId `1874`, verifyingContract prize USDT.
- Local `hashDomain` must equal onchain `DOMAIN_SEPARATOR` and the cached known value `0xcdcfacb6…2a25`.
- Recovered signer must equal `auth.from`.
- Signature length 65 bytes (`r||s||v`).
- Exclusive window: `now > validAfter` and `now < validBefore`.
- `authorizationState(from, nonce) == false`.
- `auth.to == PaymentProcessor`, `auth.value == intent.amount`.

## 4. Relayer security design

- Private key only in relayer process env.
- Single allowed calldata: `settleWithAuthorization(intentId, auth)`.
- Pause via `RELAYER_PAUSED`.
- Per-tx gas cap, daily WBT budget, minimum WBT balance.
- Max authorization amount.
- Global / payer / merchant / IP rate limits (in-memory).
- Idempotency key + auth fingerprint (15 minutes, in-memory).
- Pending nonce via `eth_getTransactionCount("pending")`.
- Structured logs redact keys/signatures.
- Webhooks best-effort HMAC; not durable.

## 5. Configuration

See `apps/relayer/.env.example` and `apps/web/.env.example`.

Critical: `RELAYER_PRIVATE_KEY`, `RELAYER_INTERNAL_TOKEN`, `RELAYER_URL` (web), prize USDT + PaymentProcessor addresses.

## 6. Tests (local mocks)

```bash
cd apps/relayer
npm install
npm test
```

Covered locally: domain separator, valid/invalid signatures, wrong chain/token domain, wrong recipient/amount, expired auth, reused nonce, replayed intent, payer mismatch, amount cap, rate limits, insufficient USDT/WBT, paused relayer, inactive merchant, duplicate submit, reverted receipt, successful verified settlement.

**Actual local test run (2026-11-07):** `6` files, `27` tests, all passed (mocked unit/integration only).

**No live Whitechain gasless settlement was executed in this pass.** Do not claim a testnet gasless payment without an explorer-linked receipt from a funded customer + funded relayer run.

## 7. Whitechain compatibility evidence

Reconfirmed via RPC `https://rpc.testnet.whitechain.io` (2026-11-07):

| Check | Result |
| --- | --- |
| `eth_chainId` | `0x752` = 1874 |
| Prize USDT | `0xcedfB56113143d55b2358b8CFbB0dEB5Ad2f55a7` |
| `decimals()` | 6 |
| `name()` | `Tether USD` |
| `DOMAIN_SEPARATOR()` | `0xcdcfacb6b15c8238b4e5fbb47bdb83b7f83f50a531d264bf9763d2bd1d3d2a25` |
| Local EIP-712 domain hash | Matches onchain separator (unit test) |
| PaymentProcessor interface | `settleWithAuthorization` → `receiveWithAuthorization` (contract source); **no ABI change required** |
| Live `receiveWithAuthorization` round-trip | **Not executed** (needs funded payer USDT + relayer WBT) |

Contract interface correctly supports EIP-3009. No Solidity change requested.

## 8. Known limitations

- In-memory idempotency, budgets, rate limits, and tx status are not durable.
- Webhooks are best-effort only.
- No frontend pages in this pass.
- End-to-end gasless testnet claim requires a separate funded run; until then Scale is implemented but not proven live.
- Relayer must not be on the prize USDT blocklist.

## 9. Local run

```bash
# Terminal A — relayer
cd apps/relayer
cp .env.example .env   # set RELAYER_PRIVATE_KEY (WBT-funded) + token
npm install
npm run dev

# Terminal B — API
cd apps/web
# RELAYER_URL=http://127.0.0.1:8787 and matching RELAYER_INTERNAL_TOKEN
npm run dev
```
