# WhiteFinance backend — completion report

Database-free Next.js API + viem blockchain reader for Whitechain Sepolia.

## 1. Folder structure

```text
apps/web/
  src/
    app/
      api/v1/           # Route handlers
      layout.tsx
      page.tsx
    lib/
      abis/             # Contract ABIs (JSON + typed exports)
      blockchain/       # viem client, scanner, verify, confirmations, checkpoint
      services/         # Domain reads + prepared txs + webhooks
      schemas.ts        # Zod
      http.ts           # CORS, rate limit, error mapping
      config.ts
      chain.ts
  .env.example
  package.json
  vitest.config.ts
```

## 2. API routes

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/v1/health` | RPC + heads + contract map |
| GET | `/api/v1/config` | Public chain/config |
| GET | `/api/v1/businesses/:address` | Merchant profile |
| GET | `/api/v1/businesses/:address/status` | Registration status |
| POST | `/api/v1/businesses/register/prepared` | Unsigned register tx |
| POST | `/api/v1/payments/intents/prepared` | Unsigned createIntent |
| GET | `/api/v1/payments/intents?merchant=` | Payment history (bounded) |
| GET | `/api/v1/payments/intents/:id` | Intent read |
| GET | `/api/v1/payments/intents/:id/receipt` | Events + verification |
| GET | `/api/v1/payments/intents/:id/refunds` | Refund status |
| POST | `/api/v1/payments/intents/:id/refund/prepared` | Unsigned refund |
| POST | `/api/v1/payments/verify` | Verify claimed txHash |
| POST | `/api/v1/invoices/prepared` | Unsigned createInvoice |
| GET | `/api/v1/invoices?seller=&buyer=` | Invoice list |
| GET | `/api/v1/invoices/:id` | Invoice + financing join |
| POST | `/api/v1/invoices/:id/confirm/prepared` | Unsigned confirm |
| GET | `/api/v1/financing/open` | Open investor requests |
| GET | `/api/v1/financing/seller/:id` | Seller position |
| GET | `/api/v1/financing/buyer/:id` | Buyer position |
| GET | `/api/v1/financing/investor/:address` | Investor history |
| POST | `/api/v1/financing/*/prepared` | Unsigned financing txs |
| GET | `/api/v1/tx/:txHash` | Confirmation status |
| POST | `/api/v1/indexer/scan` | Local checkpoint tick |
| POST | `/api/v1/webhooks/preview` | Signed payload preview |
| POST | `/api/v1/webhooks/verify` | HMAC check helper |
| POST | `/api/v1/relayer/quote` | Stub (relayer out of scope) |
| POST | `/api/v1/relayer/submit` | Returns `RELAYER_UNAVAILABLE` |

### Examples

```bash
curl http://localhost:3000/api/v1/health
curl http://localhost:3000/api/v1/config
curl "http://localhost:3000/api/v1/businesses/0xAE7168d00595a769C9434AB1ddE4D9F0273177CE/status"
curl -X POST http://localhost:3000/api/v1/payments/verify \
  -H "content-type: application/json" \
  -d '{"txHash":"0x...","intentId":"1"}'
```

Prepared helpers return `{ to, data, value: "0" }` for wallet broadcast. The API never holds private keys.

## 3. Blockchain reader architecture

- `getPublicClient()` — viem public client on Whitechain Sepolia (1874), optional Ankr fallback.
- `withRpcRetry` — exponential backoff (250ms → 8s, 4 attempts).
- `scanContractEvents` — chunked `getLogs` from `DEPLOYMENT_BLOCK`, newest-first, capped.
- `eventId` — `chainId:txHash:logIndex` for idempotency.
- `getChainHeads` + `confirmationStage` — soft / safe / finalized.
- `verifyPaymentSettlement` — receipt status, contract address, `PaymentSettled` args, USDT `Transfer`, reorg check.
- `checkpoint.json` — optional local non-authoritative scan cursor.

## 4. Event verification logic

For a claimed payment:

1. Load receipt; require `status === success`.
2. Require `receipt.to === PaymentProcessor`.
3. Reject if `blockNumber > latest` (reorg / tip race).
4. Re-fetch receipt; require same `blockHash`.
5. Decode `PaymentSettled` for the intent; match merchant + amount.
6. Optionally match USDT `Transfer` to payout (or processor).
7. Return `confirmationStage` + canonical `eventId`.

Frontend completion flags and unverified hashes are never trusted.

## 5. Reorg and retry handling

- Soft tip ahead of settlement → `reorged` / `REORGED`.
- Receipt hash mismatch after recheck → verification failure.
- RPC failures → retry with backoff, then `CHAIN_UNAVAILABLE`.
- Duplicate event IDs → in-process skip via `markProcessed` (not durable across restarts).

## 6. Security protections

- Zod on every JSON/query body.
- In-memory rate limits (read/write per IP).
- CORS allowlist via `CORS_ORIGINS`.
- Safe error bodies (no stack leaks).
- No private keys in API routes; secrets never `NEXT_PUBLIC_*`.
- Prepared txs only target configured protocol contracts (no arbitrary user `to`/`data`).
- Webhook HMAC (`X-WhiteFinance-Signature`).

## 7. Webhooks (best-effort)

Payload:

```json
{
  "id": "evt_...",
  "type": "payment.settled",
  "createdAt": 1762450000,
  "data": { "intentId": "1", "amountBase": "...", "txHash": "0x..." }
}
```

- Idempotency key = payload `id` (+ optional chain event key).
- Retries: 1s / 4s / 10s, 5s timeout, then drop.
- **Not durable.** No guaranteed delivery without a database. Merchants must re-read the intent before fulfillment.

## 8. Tests

```bash
cd apps/web && npm test
```

**Actual run (2026-11-07):** `11` files, `32` tests, all passed.

Covered: Zod validation, invalid requests, event IDs, duplicate processing, confirmation stages, reorg detection, receipt verification (mocked), RPC retry, webhook HMAC, rate limit, error mapping, prepared encoding.

## 9. Local commands

```bash
cd apps/web
cp .env.example .env
npm install
npm test
npm run dev
```

Open `http://localhost:3000/api/v1/health`.

## 10. Remaining limitations

- No database → no shared durable webhooks, analytics warehouse, or cross-instance rate limits.
- Event lists are bounded scans from deployment block, not a full indexer warehouse.
- Relayer worker not implemented (`RELAYER_UNAVAILABLE`).
- Frontend and deployment out of scope.
- In-memory processed-event set and rate limiter reset on process restart.
- Single shared `WEBHOOK_SIGNING_SECRET` (per-merchant secrets need a DB).
- Checkpoint file is local/dev only and non-authoritative.
