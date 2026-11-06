# WhiteFinance API specification

Database-free. Every authoritative field is read from Whitechain or from a signature the chain will check.

Base path: `/api/v1`

Auth: wallet signatures for merchant writes. Relayer uses a shared-secret header from the hosted checkout origin, not from public browsers of random sites.

## 1. Conventions

- Amounts in APIs are decimal strings in USDT (`"25.00"`) **and** base units (`"25000000"`). Clients must send `amountBase` for settlement; UI may send either. Proposed: always `amountBase` as string integer to avoid float bugs.
- Addresses are EIP-55 checksummed.
- Timestamps are unix seconds.
- Errors:

```json
{
  "error": {
    "code": "INTENT_NOT_FOUND",
    "message": "Payment intent 42 does not exist",
    "details": {}
  }
}
```

HTTP mapping:

| Code | Status |
| --- | --- |
| `INTENT_NOT_FOUND`, `INVOICE_NOT_FOUND` | 404 |
| `VALIDATION_ERROR`, `AUTH_INVALID`, `AUTH_EXPIRED` | 400 |
| `UNAUTHORIZED` | 401 |
| `FORBIDDEN` | 403 |
| `RATE_LIMITED` | 429 |
| `CHAIN_UNAVAILABLE` | 503 |
| `RELAYER_PAUSED`, `GAS_BUDGET_EXCEEDED` | 503 |
| `REORGED` | 409 |

## 2. Chain metadata

### `GET /api/v1/config`

Public.

```json
{
  "chainId": 1874,
  "networkName": "Whitechain Sepolia",
  "rpcUrl": "https://rpc.testnet.whitechain.io",
  "explorerUrl": "https://explorer.testnet.whitechain.io",
  "usdt": "0xcedfB56113143d55b2358b8CFbB0dEB5Ad2f55a7",
  "usdtSymbol": "USDT",
  "usdtDecimals": 6,
  "contracts": {
    "businessRegistry": "0x...",
    "paymentProcessor": "0x...",
    "invoiceRegistry": "0x...",
    "sellerFinancing": "0x...",
    "buyerFinancing": "0x..."
  },
  "deploymentBlock": 0,
  "features": {
    "gaslessCheckout": true,
    "escrowVault": false,
    "transferPolicy": false
  }
}
```

### `GET /api/v1/health`

```json
{
  "ok": true,
  "chainId": 1874,
  "latestBlock": 12393214,
  "relayer": { "paused": false, "wbtBalanceWei": "0", "budgetRemainingWei": "0" }
}
```

Do not put the relayer address’s private key material here. Relayer address **may** be public.

## 3. Business registry

### `GET /api/v1/businesses/:address`

Reads `BusinessRegistry`.

### `POST /api/v1/businesses/register/prepared`

Returns `{ to, data, value: "0" }` for the connected wallet to send. No server broadcast of merchant txs.

## 4. Payment intents

### `POST /api/v1/payments/intents/prepared`

Merchant is the connected wallet. Body:

```json
{
  "orderRef": "PO-1042",
  "amountBase": "25000000",
  "payer": null,
  "expiresInSeconds": 1800
}
```

Response: unsigned tx plus predicted `intentId` if statically known; otherwise tell the client to parse `PaymentIntentCreated` from the receipt.

A database-free service cannot allocate IDs offchain. The client creates the intent onchain, then reads the event.

### `GET /api/v1/payments/intents/:intentId`

```json
{
  "intentId": "1",
  "merchant": "0x...",
  "payoutAddress": "0x...",
  "merchantName": "Northwind Tools",
  "orderRef": "PO-1042",
  "amountBase": "25000000",
  "amountUsdt": "25.00",
  "token": "0xcedfB56113143d55b2358b8CFbB0dEB5Ad2f55a7",
  "payer": null,
  "payerSettled": null,
  "expiresAt": 1762450000,
  "status": "CREATED",
  "paidAmountBase": "0",
  "refundedAmountBase": "0",
  "settledBlock": null,
  "confirmationStage": null,
  "txHash": null,
  "explorerUrl": null,
  "checkoutUrl": "https://app.example/pay/1"
}
```

### `GET /api/v1/payments/intents?merchant=0x...`

Bounded list from `PaymentIntentCreated` logs (`limit` max 50, default 20). Not a full warehouse.

### `GET /api/v1/payments/intents/:intentId/receipt`

Same as get, plus decoded `PaymentSettled` / `PaymentRefunded` events and USDT `Transfer` logs.

## 5. Gasless relay

### `POST /api/v1/relayer/quote`

Body: `{ "intentId": "1" }`

Returns whether gasless is available, estimated WBT gas (if estimable), expiry hint, and EIP-712 payload the wallet must sign.

```json
{
  "available": true,
  "pauseReason": null,
  "typedData": {
    "domain": {
      "name": "Tether USD",
      "version": "1",
      "chainId": 1874,
      "verifyingContract": "0xcedfB56113143d55b2358b8CFbB0dEB5Ad2f55a7"
    },
    "types": {
      "ReceiveWithAuthorization": [
        { "name": "from", "type": "address" },
        { "name": "to", "type": "address" },
        { "name": "value", "type": "uint256" },
        { "name": "validAfter", "type": "uint256" },
        { "name": "validBefore", "type": "uint256" },
        { "name": "nonce", "type": "bytes32" }
      ]
    },
    "primaryType": "ReceiveWithAuthorization",
    "message": {
      "from": "0xCustomer",
      "to": "0xPaymentProcessor",
      "value": "25000000",
      "validAfter": "0",
      "validBefore": "1762450000",
      "nonce": "0x..."
    }
  }
}
```

The hosted page must render `message` in plain language.

### `POST /api/v1/relayer/submit`

Body:

```json
{
  "intentId": "1",
  "authorization": {
    "from": "0x...",
    "to": "0x...",
    "value": "25000000",
    "validAfter": "0",
    "validBefore": "1762450000",
    "nonce": "0x...",
    "signature": "0x"
  },
  "idempotencyKey": "uuid"
}
```

The Next.js route **forwards** to the relayer worker (localhost or private URL). It does not sign.

Worker response:

```json
{
  "txHash": "0x...",
  "status": "SUBMITTED"
}
```

Then the client polls `GET /intents/:id` until `SETTLED` or error.

If the worker is down: `RELAYER_UNAVAILABLE`. Customer can switch to gasful pay.

## 6. Refunds

### `POST /api/v1/payments/intents/:intentId/refund/prepared`

```json
{ "amountBase": "10000000" }
```

Returns `{ to, data }` for `refund(intentId, amount)`.

## 7. Invoices and financing

### `GET /api/v1/invoices/:invoiceId`

Joins invoice + optional seller financing + optional buyer financing from chain.

### `GET /api/v1/invoices?seller=0x...` / `?buyer=0x...`

Bounded event queries.

### `POST /api/v1/invoices/prepared`

Create invoice tx data. Body includes `invoiceNumber`, `buyer`, `faceValueBase`, `dueDate`, `documentHash`, `termsHash`.

### `POST /api/v1/invoices/:invoiceId/confirm/prepared`

### `POST /api/v1/financing/seller/request/prepared`

### `POST /api/v1/financing/seller/:id/fund/prepared`

### `POST /api/v1/financing/seller/:id/repay/prepared`

### `POST /api/v1/financing/buyer/...` (mirror)

Read APIs:

- `GET /api/v1/financing/seller/:id`
- `GET /api/v1/financing/buyer/:id`
- `GET /api/v1/financing/open` — open requests for investors (from events)

Computed fields: `statusComputed` (overdue even if not yet marked), accounting buckets, explorer links.

## 8. Webhooks

### 8.1 Registration

Webhook URL lives on `BusinessRegistry` (public). Signing secret is **not** onchain. For the demo, a single `WEBHOOK_SIGNING_SECRET` signs all outbound bodies. Production would need per-merchant secrets and therefore a database — **out of scope**, disclosed.

### 8.2 Delivery

Best-effort POST from the relayer worker after it observes `PaymentSettled` or `PaymentRefunded` in the receipt it just sent, and from a polling loop on financing events (also non-durable).

Retries: 3 attempts, 1s/4s/10s, in memory. Then drop.

### 8.3 Payload

```json
{
  "id": "evt_nonces_not_durable",
  "type": "payment.settled",
  "createdAt": 1762450000,
  "data": {
    "intentId": "1",
    "orderRef": "PO-1042",
    "amountBase": "25000000",
    "txHash": "0x...",
    "confirmationStage": "soft"
  }
}
```

Header: `X-WhiteFinance-Signature: sha256=hex(hmac_sha256(secret, rawBody))`

Merchant **must** `GET /payments/intents/:id` before fulfilling goods.

Events:

- `payment.settled`
- `payment.refunded`
- `payment.expired` (if a marker tx happened)
- `invoice.confirmed`
- `financing.funded`
- `financing.repaid`

## 9. SDK surface

`@whitefinance/checkout-sdk`:

- `createWhiteFinanceCheckout({ apiBase, merchant })`
- `createPayment({ orderRef, amountBase, onPaid })` → `{ checkoutUrl, intentTx }`
- `getPayment(intentId)`
- `verifyWebhook(rawBody, signatureHeader, secret)` for demo store server routes

About 20 lines in the demo store.

## 10. Relayer worker internal API

Not public.

`POST /internal/settle` on `127.0.0.1` with `RELAYER_INTERNAL_TOKEN`.

The Next.js app is the only caller.

## 11. Rate limiting

Proposed:

| Surface | Limit |
| --- | --- |
| Public GET | 120 / min / IP |
| Relayer submit | 30 / min global, 10 / min / payer |
| Prepared tx helpers | 60 / min / IP |

Return `Retry-After`.

## 12. Environment variables

### Public (browser)

```text
NEXT_PUBLIC_CHAIN_ID=1874
NEXT_PUBLIC_RPC_URL=https://rpc.testnet.whitechain.io
NEXT_PUBLIC_EXPLORER_URL=https://explorer.testnet.whitechain.io
NEXT_PUBLIC_USDT=0xcedfB56113143d55b2358b8CFbB0dEB5Ad2f55a7
NEXT_PUBLIC_BUSINESS_REGISTRY=
NEXT_PUBLIC_PAYMENT_PROCESSOR=
NEXT_PUBLIC_INVOICE_REGISTRY=
NEXT_PUBLIC_SELLER_FINANCING=
NEXT_PUBLIC_BUYER_FINANCING=
NEXT_PUBLIC_REOWN_PROJECT_ID=
NEXT_PUBLIC_WF_API_BASE=
```

### Server / relayer

```text
RPC_URL=https://rpc.testnet.whitechain.io
DEPLOYMENT_BLOCK=
RELAYER_PRIVATE_KEY=
RELAYER_INTERNAL_TOKEN=
WEBHOOK_SIGNING_SECRET=
RELAYER_MAX_WBT_PER_DAY=
RELAYER_MAX_GAS_PER_TX=
RELAYER_PAUSED=false
```

Never prefix secrets with `NEXT_PUBLIC_`.

Optional: `ANKR_RPC_URL` if the ETHGlobal Ankr key is activated.

## 13. Logging

JSON lines: `level`, `msg`, `intentId`, `txHash`, `code`, `durationMs`. No private keys. Authorization signatures may appear in debug logs locally; default info logs store only nonce and `from`.

## 14. Idempotency

- `Idempotency-Key` on `/relayer/submit` cached in memory for 15 minutes.
- Onchain uniqueness is the real guarantee.

## 15. What this API will not do

- Create an intent without an onchain transaction
- Remember a payment if the chain does not
- Guarantee webhook delivery
- Index unbounded historical analytics
- Custodial “user accounts”
