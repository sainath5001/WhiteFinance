# WhiteFinance development roadmap

Architecture-only work is complete when the eight documents in this folder plus `README.md` are approved. **Do not start Solidity or application code before that approval.**

This is the exact proposed implementation order.

## Guardrails

- Prize USDT only: `0xcedfB56113143d55b2358b8CFbB0dEB5Ad2f55a7`
- No database
- No EscrowVault / TransferPolicy unless approval changes that
- No ERC-721 / ERC-1155
- No relayer key in the browser
- Foundry on Windows via WSL
- Verify every contract on Blockscout (`/api/` suffix)
- Independent features: Operate can demo without Tokenize; Scale plugs into Operate; Tokenize does not depend on the relayer

## Phase 0 — Preflight (no product logic)

1. Confirm WSL + `forge` + `cast`.
2. Re-read prize USDT `name`, `decimals`, `DOMAIN_SEPARATOR`, `authorizationState`.
3. Probe `eth_getBlockByNumber("safe")` and `"finalized"`.
4. Dry-run a `receiveWithAuthorization` against a local fork or a throwaway contract once a funded USDT account exists.
5. Confirm how demo wallets obtain prize USDT. **If still unknown, stop and ask.** Do not mint a lookalike token.
6. Create `.env.example` with public config only.

Exit: a short note in `docs/whitechain-compatibility.md` updated with preflight results.

## Phase 1 — Foundry skeleton

1. `contracts/` Foundry project, `solc = 0.8.30`, `evm_version = prague`, `pragma ^0.8.24`.
2. OpenZeppelin install.
3. Interface `IPrizeUSDT` with ERC-20 + EIP-3009 + `isBlocked`.
4. Constants module for chain id and token address.
5. Test helpers / mock USDT that mirrors exclusive time bounds, receive-to-self rule, and blocklist.

Exit: `forge test` green on mocks.

## Phase 2 — Operate contracts (gasful)

1. `BusinessRegistry`
2. `PaymentProcessor` without gasless
3. Tests: register, unique orderRef, pay, full refund, partial refund, expire, cancel, pause, residual USDT = 0
4. Deploy script to Sepolia (when keys exist, throwaway)
5. Verify source

Exit: explorer links for registry + processor.

## Phase 3 — Merchant + customer UI (gasful)

1. Next.js app, Tailwind, shadcn, AppKit locked to Whitechain Sepolia
2. Merchant onboard, create intent, dashboard, history
3. Hosted checkout `/pay/[id]` with **pay with gas**
4. Receipt + confirmation stage copy
5. Demo store using SDK against prepared-tx helpers

Exit: a merchant can get paid with prize USDT while the customer holds WBT.

## Phase 4 — Scale (gasless)

1. Relayer worker
2. `settleWithAuthorization` on `PaymentProcessor`
3. Checkout gasless tab with full typed-data review
4. Relayer budgets, pause, rate limits
5. Tests: wrong to, wrong value, expired, reused nonce, blocklist, domain mismatch
6. Live Sepolia gasless payment

Exit: qualifying Scale demo. Customer WBT balance can be 0. Explorer link saved for README.

## Phase 5 — Tokenize seller factoring

1. `InvoiceRegistry`
2. `SellerFinancing`
3. Tests for 100,000 / 95,000 example, duplicate financing, cancel, overdue, default
4. Seller / buyer / investor UI for this workflow only

Exit: independently working factoring demo with prize USDT fund + repay.

## Phase 6 — Tokenize buyer financing

1. `BuyerFinancing`
2. Invariant tests: no double-count of 30,000
3. Remainder payment path
4. UI accounting panel

Exit: independently working buyer-financing demo.

## Phase 7 — Admin, webhooks, polish

1. Admin pause UI
2. Best-effort webhook worker
3. Accountant CSV export from events (extra credit, no DB)
4. Empty/error/reorg states
5. Rate-limit and RPC backoff

## Phase 8 — Qualification pack

Required by ETHGlobal Whitechain rules:

1. Contracts deployed and verified on Whitechain Sepolia
2. At least one prize-USDT payment in the main flow; explorer link in README
3. README paragraph: why onchain USDT on Whitechain vs a regular payment rail
4. Public GitHub with steady commits (not one dump)
5. 2–4 minute demo video showing each party
6. `WHITECHAIN_FEEDBACK.md`

Tracks to show in the video:

- Operate: merchant + customer, payment + refund
- Tokenize: seller factoring **or** buyer financing (both if time)
- Scale: gasless checkout explicitly, WBT not required for the customer

## Exact implementation order (checklist)

1. Preflight compatibility (Phase 0)
2. Foundry skeleton + mock USDT (Phase 1)
3. `BusinessRegistry` (Phase 2)
4. `PaymentProcessor` gasful + refunds (Phase 2)
5. Merchant UI + hosted checkout gasful (Phase 3)
6. Checkout SDK + demo store (Phase 3)
7. Relayer + `settleWithAuthorization` (Phase 4)
8. Gasless checkout UI (Phase 4)
9. `InvoiceRegistry` (Phase 5)
10. `SellerFinancing` (Phase 5)
11. Seller / buyer / investor UI for factoring (Phase 5)
12. `BuyerFinancing` (Phase 6)
13. Buyer-financing UI + accounting (Phase 6)
14. Admin + webhooks + export (Phase 7)
15. Verify, qualifying tx, video, feedback file (Phase 8)

## What not to do in any phase

- Do not add a database “just for webhooks”
- Do not implement `EscrowVault` or `TransferPolicy` without approval
- Do not enable Reown email/social
- Do not use USDT.e
- Do not ship a transfer button as checkout
- Do not gaslessly fund financing in v1
- Do not claim compatibility tests that were not run

## Suggested commit slicing

Small, reviewable commits aligned to the checklist above so the public repo shows progress.
