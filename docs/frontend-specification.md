# WhiteFinance frontend specification

One Next.js App Router app. Dark terminal-inspired fintech UI, restrained orange accent, clear type, useful charts, responsive layouts.

Stack: TypeScript, Tailwind CSS, shadcn/ui, wagmi, viem, Reown AppKit, React Hook Form, Zod, Recharts, Lucide.

AppKit: `whitechainSepolia` only. `features.email` and `features.socials` **false**. Embedded wallets are not supported on Whitechain.

## 1. Design system

| Token | Use |
| --- | --- |
| Background | Near-black, not pure `#000` if shadcn default zinc-950 is used |
| Surface | Slightly lifted panels, 1px muted border, **no glow, no gradient** |
| Accent | One orange for primary buttons, active nav, and chart highlights |
| Positive | Muted green for settled / repaid |
| Warning | Amber for overdue, soft confirmation |
| Danger | Red for defaulted, failed, paused |
| Font | Tabular nums for money; mono for addresses, tx hashes, nonces |
| Radius | Modest; terminal feel is typography and density, not skeuomorph scanlines |

Copy is professional and literal. No “degen”, no meme tone.

Money always shows token symbol and 6 decimal precision where relevant (`25.00 USDT`). Addresses abbreviate with copy button.

## 2. Global chrome

- Left nav on desktop, bottom nav or sheet on mobile
- Top bar: network badge `Whitechain Sepolia · 1874`, connect button, relayer status (ok / paused)
- Footer: “Testnet. Tokens have no value. Chain is source of truth.”
- Role switcher for the demo (localStorage only): Merchant / Customer / Seller / Buyer / Investor / Admin. It does not grant onchain roles; it only changes default landing. Wrong role still sees connect and revert reasons.

### Wallet states

| State | UI |
| --- | --- |
| Disconnected | Connect CTA, pages that need a wallet show a gate |
| Connected, wrong chain | Blocking banner + switch network |
| Connected, right chain | Address, WBT balance, USDT balance |
| Reconnecting | Skeleton of the top bar |
| Rejected request | Toast, stay on page |

### Data states

Every table and dashboard supports: loading skeleton, empty, error with retry, paused protocol banner.

Transaction states: `Idle → Wallet prompt → Pending → Soft confirmed → Safe → Finalized → Failed / Rejected / Reorged`.

Never show “Final” on a 1-second inclusion.

## 3. Routes

```text
/                         marketing + product explanation
/app                      role home
/app/merchant             merchant dashboard
/app/merchant/onboard     register
/app/merchant/intents/new payment link / intent form
/app/merchant/intents     history
/app/merchant/intents/[id]
/pay/[intentId]           hosted checkout (customer, public)
/pay/[intentId]/receipt
/app/seller
/app/seller/invoices/new
/app/seller/invoices/[id]
/app/buyer
/app/buyer/invoices/[id]
/app/investor
/app/investor/opportunities
/app/investor/[type]/[id]
/app/admin
/demo/store               separate merchant integration demo
/demo/store/checkout
/docs                     link out to /docs in repo, not a second CMS
```

Public pages: `/`, `/pay/*`, `/demo/store`.

## 4. Merchant experience

### Onboarding

Form: display name, payout address (default connected), optional webhook URL, accept that webhook is public onchain. Zod-validated. Submit → `register` tx.

### Dashboard

Cards: volume settled (USDT), open intents, refunds, USDT balance, WBT balance.

Charts (Recharts): daily settled volume, last 14 days, from events (bounded). If too few events, show table only — no fake series.

### Create payment link

Fields: order reference, amount, optional bound payer, expiry (default 30 min). Preview the checkout URL after tx.

### Intent table

Columns: order ref, amount, status, payer, confirmation stage, created, actions (open, refund, cancel, explorer).

Filters: status chips.

### Intent detail

Timeline of events. Refund form: full or partial, live `refunded/paid` bar. Disabled if merchant USDT < refund.

## 5. Customer experience (hosted checkout)

This is the Operate + Scale surface.

Layout, desktop: left summary, right action. Mobile: stacked.

**Always loaded from chain**, never from query-string amount.

Summary:

- Merchant display name
- Order reference
- Amount `25.00 USDT`
- Token address (copy) with warning if it is not the prize USDT (should be impossible)
- Payout address
- Expiry countdown
- Status

If `EXPIRED` / `CANCELLED` / `SETTLED`: no pay button; show receipt or reason.

Pay panel tabs:

1. **Gasless (recommended)** — “You sign the exact USDT transfer. WhiteFinance pays WBT gas.”
2. **Pay with gas** — “Your wallet sends the transaction. You need WBT.”

### Gasless review screen (mandatory)

Before the wallet signature prompt, the page lists:

- Token: Tether USD (USDT)
- Amount
- From (their address)
- Recipient contract (`PaymentProcessor`) and “then forwarded to merchant {payout}”
- Valid after / valid before (local time)
- Nonce (mono)
- Chain ID 1874

Button label: `Sign payment authorization`. Not `Pay without signing`.

If relayer paused: disable tab, explain gasful fallback.

After submit: pending spinner, then receipt.

### Receipt

- Paid amount
- Tx hash + explorer link
- Confirmation stage with short glossary
- Refunds if any

## 6. Seller experience

List of invoices, CTA create invoice.

Create form: buyer address, invoice number, face value, due date, pick a synthetic demo document (dropdown of repo files; client hashes with keccak256 and shows the hash). Checkbox: “A hash does not prove this invoice is authentic.”

Detail: state machine stepper (CREATED → CONFIRMED → …). Request factoring: advance and discount fields with live preview of investor profit. Cannot request until buyer confirmed.

## 7. Buyer experience

Inbox of invoices where `buyer == connected`.

Confirm CTA with copy: “You acknowledge this invoice for the demo. This is not a legal admission in the real world.”

Pay remainder / repay investor buttons when applicable, with accounting panel:

```text
Invoice face          100,000
Paid to seller by investor  30,000
Still owed to seller        70,000
Owed to investor            31,500
```

Numbers from chain, not localStorage.

## 8. Investor experience

Open requests table: type (seller / buyer), face, advance or principal, discount or fee, due date, seller, buyer.

Opportunity detail: accounting, risks (buyer default, no legal assignment, USDT blocklist), fund button (needs USDT + WBT).

Portfolio: funded positions, status, expected vs received.

Chart: outstanding principal vs repaid.

## 9. Administrator experience

- Pause / unpause each module
- Freeze / unfreeze a business
- Relayer pause flag (via env or admin tx if we add `setGaslessPaused` — proposed: relayer env **and** onchain pause)
- Dispute queue if that feature is approved
- Read-only: token `isBlocked` for protocol addresses, USDT `DOMAIN_SEPARATOR`, balances

No “withdraw all” control in the UI.

## 10. Demo store

Looks like a small industrial shop, still dark, but clearly labeled `Demo store · integrates WhiteFinance checkout`.

Flow: add item → checkout → 20-line SDK redirect to `/pay/{id}` → return `onPaid`.

This is the Operate “drop-in” proof. It must not call `usdt.write.transfer` itself.

## 11. Navigation by role

| Role | Primary nav |
| --- | --- |
| Merchant | Dashboard, New payment, History |
| Customer | (no app nav; checkout link) |
| Seller | Invoices, New invoice |
| Buyer | To confirm, To pay |
| Investor | Opportunities, Portfolio |
| Admin | Controls, Health |

Shared: Docs, Explorer, Faucet (WBT), token add-to-wallet for prize USDT.

## 12. Forms and validation

Zod schemas mirror contract constraints: 6 decimal amounts, address checksum, expiry in future, `advance + discount == face` if that rule is approved, `principal < face`, fee >= 0.

React Hook Form for all write forms. Wallet errors mapped to human strings (`TetherToken: from is blocked` → “This USDT address is blocked by the token issuer.”).

## 13. Charts

Use Recharts only with real event-derived points. If a series has 0–1 points, show a table or a single number, not an empty axis labeled “Revenue.”

## 14. Accessibility and responsive

- Contrast on orange-on-black buttons
- Keyboard for checkout
- Mobile: checkout first; dashboards stack cards; tables scroll horizontally
- Reduced-motion: no looping pending animations

## 15. Copy constraints

- Never say unsigned payment is possible
- Never say the invoice is “onchain verified authentic”
- Never say soft confirmation is irreversible
- Never say webhooks are guaranteed
- Always name the token USDT at the prize address in advanced details
