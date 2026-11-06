# WhiteFinance frontend — completion report (UI stage)

Dark fintech UI in `apps/web` using Next.js App Router, Tailwind, shadcn-style primitives, Lucide, Recharts, React Hook Form, and Zod. **No live wallet, contract, API, or relayer integration in this stage.**

## 1. Routes and pages

| Route | Purpose |
| --- | --- |
| `/` | Marketing |
| `/docs` | Docs directory |
| `/app` | Role home redirect |
| `/app/merchant` | Merchant overview |
| `/app/merchant/onboard` | Register form |
| `/app/merchant/intents` | Payment links table |
| `/app/merchant/intents/new` | Create payment link |
| `/app/merchant/intents/[id]` | Payment detail + refund dialog |
| `/pay/[intentId]` | Hosted checkout states |
| `/pay/[intentId]/receipt` | Receipt |
| `/app/seller` | Seller overview |
| `/app/seller/invoices/new` | Create invoice |
| `/app/seller/invoices/[id]` | Invoice + factoring request |
| `/app/seller/financing` | Seller financing list |
| `/app/buyer` | Buyer inbox + financing |
| `/app/buyer/invoices/[id]` | Confirm + accounting |
| `/app/investor` | Portfolio |
| `/app/investor/opportunities` | Open requests |
| `/app/investor/[type]/[id]` | Position detail + fund dialog |
| `/app/admin` | Read-only admin |
| `/app/activity` | Activity feed |
| `/app/settings` | Role / network settings |
| `/demo/store` | Demo store |
| `/demo/store/checkout` | Store → checkout handoff |

API routes under `/api/v1/*` from the backend stage remain unchanged.

## 2. Component structure

```text
src/components/
  ui/           button, card, badge, input, label, textarea, table,
                dialog, tabs, select, separator, skeleton
  layout/       app-shell, sidebar, header, role-provider, nav-config
  shared/       demo-banner, metric-card, status-badge, empty/error,
                page-header, address, wallet-area, tx-status
  charts/       volume-chart
src/lib/demo/   fixtures.ts   ← clearly labelled demo data
```

## 3. Design system

- Near-black charcoal surfaces, 1px borders, restrained orange primary (`hsl(24 92% 52%)`).
- IBM Plex Sans + IBM Plex Mono.
- Tabular nums for money; mono for addresses/hashes.
- Status colors: success / warning / danger / muted.
- Subtle fade-in only; no glow/glass overload.

## 4. Role-based navigation

Demo role switcher (localStorage `wf_demo_role`) filters sidebar items: merchant, seller, buyer, investor, admin. Does **not** grant onchain roles.

## 5. Demo-data boundaries

- All dashboard numbers come from `src/lib/demo/fixtures.ts`.
- Persistent `DemoBanner` states fixtures are not live chain data.
- Wallet button is disabled with “UI stage · not live”.
- Forms validate with Zod/RHF and alert — they do not broadcast txs.
- Checkout “success” is explicitly soft / simulated and warns against fulfilling on local state.

## 6. Responsive behavior

- Desktop: fixed sidebar + sticky header.
- Tablet/mobile: sheet sidebar via menu button; stacked cards; horizontally scrollable tables.
- Checkout: two-column on large screens, stacked on mobile.

## 7. Build and lint

```bash
cd apps/web
npm run lint
npm run build
```

**Actual results (2026-11-07):**
- `npm run lint` — no ESLint warnings or errors.
- `npm run build` — succeeded (38 static pages generated; UI + API routes compiled).

## 8. Remaining work

- Live wagmi / Reown AppKit on Whitechain Sepolia.
- Wire forms to prepared-tx / write paths and API reads.
- Relayer quote/submit from checkout.
- Replace fixtures with chain-backed queries.
- Enable privileged admin actions only where contracts allow (pause/freeze), still no withdraw-all.
