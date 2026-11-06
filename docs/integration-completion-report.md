# WhiteFinance — Frontend ↔ chain / API integration report

Generated after wiring wagmi, Reown AppKit, payment checkout, refunds, invoices, and financing flows against the existing backend and deployed Whitechain Sepolia contracts.

**Honesty rule:** This report does not invent deployment addresses, transaction hashes, Reown live-connect evidence, or funded testnet journey results. Items not executed are labeled as such.

---

## 1. Final repository structure (integration-relevant)

```
WhiteFinance/
  apps/
    web/                 # Next.js 14 App Router — API + UI + wagmi/AppKit
      src/
        app/             # routes (merchant, pay, seller, buyer, investor, api/v1)
        components/      # UI + Web3Provider, WalletArea, NetworkBanner
        lib/
          abis/          # contract ABIs
          api/client.ts  # typed frontend API client
          blockchain/    # RPC, scanner, verify
          config.ts      # single chain/address/token config
          services/      # read models + prepared txs
          web3/          # wagmi, contracts map, accounting, hooks, tx helpers
    relayer/             # EIP-3009 worker (holds RELAYER_PRIVATE_KEY)
  contracts/             # Foundry sources + deploy artifacts
  docs/                  # architecture + this report
```

---

## 2. Contract addresses (deployed defaults in `apps/web` config)

These are the addresses used by the frontend/backend defaults (overridable via `NEXT_PUBLIC_*`). They match the project’s documented Whitechain Sepolia deployment; this report does not re-verify bytecode here.

| Contract | Address |
| --- | --- |
| Prize USDT | `0xcedfB56113143d55b2358b8CFbB0dEB5Ad2f55a7` |
| BusinessRegistry | `0x3d6AEef7160Bf764821dC11F6e1402C86599F768` |
| InvoiceRegistry | `0x3d70e6469529e40731e5AC751D2F60169a5429eF` |
| EscrowVault | `0x823d09040C793e0b24528ef0D80aE645bDBa6405` |
| SellerFinancing | `0xfDe6391bB81FD9a04722DBb3d0Dd56311E4eE796` |
| BuyerFinancing | `0x302aA4646F94927AAd59dAfFe65DA271ddFF6B8d` |
| PaymentProcessor | `0xC210Cff48e44edA690E0149C98250e3eb40aaDe5` |
| Deployment block (indexer default) | `12397652` |

Forbidden token (do not use): USDT.e `0xaa7962d073935D387e8d442DA1D7149C81388f46`.

---

## 3. Whitechain explorer links

- Explorer base: https://explorer.testnet.whitechain.io/
- USDT: https://explorer.testnet.whitechain.io/token/0xcedfB56113143d55b2358b8CFbB0dEB5Ad2f55a7
- PaymentProcessor: https://explorer.testnet.whitechain.io/address/0xC210Cff48e44edA690E0149C98250e3eb40aaDe5
- BusinessRegistry: https://explorer.testnet.whitechain.io/address/0x3d6AEef7160Bf764821dC11F6e1402C86599F768
- InvoiceRegistry: https://explorer.testnet.whitechain.io/address/0x3d70e6469529e40731e5AC751D2F60169a5429eF
- EscrowVault: https://explorer.testnet.whitechain.io/address/0x823d09040C793e0b24528ef0D80aE645bDBa6405
- SellerFinancing: https://explorer.testnet.whitechain.io/address/0xfDe6391bB81FD9a04722DBb3d0Dd56311E4eE796
- BuyerFinancing: https://explorer.testnet.whitechain.io/address/0x302aA4646F94927AAd59dAfFe65DA271ddFF6B8d

Tx links in the UI use `${EXPLORER}/tx/${hash}`.

---

## 4. Backend API list (`apps/web` route handlers)

| Method | Path |
| --- | --- |
| GET | `/api/v1/health` |
| GET | `/api/v1/config` |
| GET | `/api/v1/businesses/[address]` |
| GET | `/api/v1/businesses/[address]/status` |
| POST | `/api/v1/businesses/register/prepared` |
| GET | `/api/v1/payments/intents` |
| POST | `/api/v1/payments/intents/prepared` |
| GET | `/api/v1/payments/intents/[intentId]` |
| GET | `/api/v1/payments/intents/[intentId]/receipt` |
| GET | `/api/v1/payments/intents/[intentId]/refunds` |
| POST | `/api/v1/payments/intents/[intentId]/refund/prepared` |
| POST | `/api/v1/payments/verify` |
| GET | `/api/v1/invoices` |
| POST | `/api/v1/invoices/prepared` |
| GET | `/api/v1/invoices/[invoiceId]` |
| POST | `/api/v1/invoices/[invoiceId]/confirm/prepared` |
| GET | `/api/v1/financing/open` |
| GET | `/api/v1/financing/seller/[id]` |
| GET | `/api/v1/financing/buyer/[id]` |
| GET | `/api/v1/financing/investor/[address]` |
| POST | `/api/v1/financing/seller/request/prepared` |
| POST | `/api/v1/financing/seller/[id]/fund/prepared` |
| POST | `/api/v1/financing/seller/[id]/repay/prepared` |
| POST | `/api/v1/financing/buyer/request/prepared` |
| POST | `/api/v1/financing/buyer/[id]/fund/prepared` |
| POST | `/api/v1/financing/buyer/[id]/repay/prepared` |
| POST | `/api/v1/financing/buyer/[id]/remainder/prepared` |
| GET | `/api/v1/tx/[txHash]` |
| POST | `/api/v1/indexer/scan` |
| POST | `/api/v1/relayer/quote` |
| POST | `/api/v1/relayer/submit` |
| GET | `/api/v1/relayer/health` |
| POST | `/api/v1/webhooks/preview` |
| POST | `/api/v1/webhooks/verify` |

Relayer worker (separate process): quote/submit/health on `RELAYER_URL` (default `http://127.0.0.1:8787`). Next.js never holds `RELAYER_PRIVATE_KEY`.

---

## 5. Frontend route list

| Route | Role |
| --- | --- |
| `/` | Marketing landing |
| `/docs` | In-app docs entry |
| `/demo/store` | Demo storefront (SDK-style checkout entry) |
| `/demo/store/checkout` | Demo store checkout bridge |
| `/pay/[intentId]` | Hosted checkout (gasless + gasful) |
| `/pay/[intentId]/receipt` | Verified receipt view |
| `/app` | App hub |
| `/app/merchant` | Merchant overview (live intents) |
| `/app/merchant/onboard` | `BusinessRegistry.register` |
| `/app/merchant/intents` | Intent history |
| `/app/merchant/intents/new` | `createIntent` |
| `/app/merchant/intents/[id]` | Detail + refunds |
| `/app/seller` | Seller invoice list |
| `/app/seller/invoices/new` | `createInvoice` |
| `/app/seller/invoices/[id]` | Detail + seller factor request |
| `/app/seller/financing` | Seller financing nav surface |
| `/app/buyer` | Buyer inbox |
| `/app/buyer/invoices/[id]` | Confirm, buyer financing, repay |
| `/app/investor` | Investor hub |
| `/app/investor/opportunities` | Open REQUESTED positions |
| `/app/investor/[type]/[id]` | Fund / position detail |
| `/app/activity` | Manual indexer scan |
| `/app/admin` | Admin / addresses |
| `/app/settings` | Settings |

---

## 6. Payment demo instructions

1. Fund merchant + customer with prize USDT and WBT (faucet is WBT-only).
2. Set `NEXT_PUBLIC_REOWN_PROJECT_ID` (public WalletConnect id from https://dashboard.reown.com).
3. Register merchant: `/app/merchant/onboard` (Merchant role + payout address).
4. Create link: `/app/merchant/intents/new` → broadcast `createIntent` → copy checkout URL `/pay/{intentId}`.
5. Customer opens checkout, connects wallet on chain `1874`, chooses **Pay with gas**, approves USDT if needed, calls `pay`.
6. UI waits until API status is `SETTLED` (soft inclusion is not treated as final success alone).
7. Merchant opens `/app/merchant/intents/{id}` and receipt; explorer link shown when available.

---

## 7. Seller-financing demo instructions

1. Seller creates invoice at `/app/seller/invoices/new` (buyer address, face, due date).
2. Buyer opens `/app/buyer/invoices/{id}` and confirms (`confirmInvoice`).
3. Seller requests factoring with `advance + discount == face` (e.g. 95k + 5k = 100k).
4. Investor opens `/app/investor/opportunities` → fund (approve USDT → `SellerFinancing.fund`).
5. Seller receives advance onchain (do not simulate completion in UI).
6. Buyer repays face via buyer invoice “Repay investor (seller factoring)” (`repay`).
7. Accounting shown: face, advance, expected gross repayment = face; discount = profit **if** repaid (not guaranteed).

---

## 8. Buyer-financing demo instructions

1. After buyer-confirmed invoice, buyer requests financing with principal &lt; face and fee ≥ 0.
2. Investor funds (`BuyerFinancing.fund`) — principal pays seller; remainder stays seller receivable.
3. Buyer repays investor (`principal + fee`) and optionally `payRemainder` to seller.
4. UI accounting panel must never add investor principal back onto “still owed to seller”.

---

## 9. Gasless checkout demo instructions

1. Run relayer (`apps/relayer`) with funded WBT key + matching `RELAYER_INTERNAL_TOKEN`.
2. Point `RELAYER_URL` / token in `apps/web` `.env`.
3. On checkout, **Load exact authorization** → review amount/recipient/nonce/validity → **Sign**.
4. Frontend submits signature to `/api/v1/relayer/submit` → polls until `SETTLED`.
5. If quote unavailable or submit fails: show error; **do not** auto-switch to gasful. User may manually use Pay with gas.
6. Never ask for seed/private key; never expose relayer key to the browser.

**Reown / Whitechain notes (from `docs/whitechain-compatibility.md` + AppKit config):**
- Use `whitechainSepolia` from `@reown/appkit/networks` (id `1874`).
- `features.email` / `socials` disabled — embedded wallets unsupported on Whitechain.
- Reown Blockchain API does not list `eip155:1874`; identity/swaps/on-ramp/in-modal history unavailable.
- `NEXT_PUBLIC_REOWN_PROJECT_ID` required only for AppKit connect modal; chain reads and most API routes work without it.

---

## 10. Test results

| Suite | Result | Notes |
| --- | --- | --- |
| Unit (`apps/web` vitest) | **42 passed / 14 files** | Includes accounting, error humanization, journey invariants, encode/verify/scanner |
| Lint (`next lint`) | **Exit 0** after adding `eslint@8.57.1` (one hooks warning fixed post-pass) | |
| Build (`next build`) | **Passed** (Next.js 14.2.18 production compile) | Wagmi/AppKit peer tree pinned via `overrides` (`wagmi@2.14.16`, `@wagmi/connectors@5.7.12`) |
| Funded Whitechain Sepolia E2E journeys | **Not executed in this session** | Require USDT + WBT + Reown project id + optional relayer funds |

Labels:
- **unit** — vitest, no network claim of settlement
- **mock/fixture** — leftover demo fixtures only where overview charts still use illustrative series
- **testnet** — manual checklist in `journeys.test.ts`; not auto-run

---

## 11. Known limitations

- Event history is a **bounded scan**, not a durable indexer.
- Soft confirmation ≠ finalized; UI labels soft explicitly.
- Overview charts that still mention demo series are non-authoritative; payment/invoice detail pages use chain/API.
- Relayer pause / RPC 429 / USDT issuer blocks can halt gasless or transfers.
- No verified prize-USDT faucet in official docs.
- Role switcher in the app shell is UI-only; onchain roles come from BusinessRegistry.

---

## 12. Security issues still open

- Relayer private key compromise would allow gas spend / settle attempts within policy — keep offline, rate-limited, amount-capped.
- Public webhook URLs onchain can be scraped; delivery is best-effort HMAC when configured.
- WalletConnect project id is public by design; do not confuse with secrets.
- No formal audit of contracts or frontend in this integration pass.
- Local checkpoint file is not multi-instance safe.

---

## 13. Exact steps to run locally

```bash
# Node 20+
cd apps/web
cp .env.example .env
# set NEXT_PUBLIC_REOWN_PROJECT_ID, WEBHOOK_SIGNING_SECRET, RELAYER_* as needed

cd ../relayer
cp .env.example .env
# set RELAYER_PRIVATE_KEY (WBT-funded), RELAYER_INTERNAL_TOKEN matching web

# terminal 1
cd apps/relayer && npm install && npm run dev

# terminal 2
cd apps/web && npm install && npm run dev
# open http://localhost:3000
```

Optional: `npm test` in `apps/web` for unit suite; `npm run build` for production compile.

Configuration needed for wallets: `NEXT_PUBLIC_REOWN_PROJECT_ID` only. Unrelated API/chain reads do not require it.
