# WhiteFinance security model

This is the threat model, permission map, and test plan for the architecture. It is not an audit.

## 1. Trust assumptions

### 1.1 What users must trust

| Party | Trust |
| --- | --- |
| Whitechain sequencer | Soft confirmations can be reordered or dropped until `safe`. |
| Ethereum / OP Stack | Safety after batches land; withdrawals and fault proofs as documented by Whitechain. |
| Prize USDT owner | Can mint, block, burn blocked funds, upgrade the token, change authorization behaviour. |
| WhiteFinance admin (testnet EOA, proposed) | Pause, freeze registry accounts, grant roles, resolve disputes if that power is approved. **Cannot** arbitrarily withdraw USDT from protocol paths. |
| Relayer operator | Holds WBT and a private key. Can refuse to relay, delay, or (if buggy) submit malformed txs that revert. **Cannot** move customer USDT without a valid customer signature for that exact payment. |
| Next.js host | Can lie in the UI. Cannot steal funds unless it also has keys. Users should confirm typed-data fields in the wallet. |
| Public RPC | Can censor or serve stale reads. Writes that land onchain are still verifiable on the explorer. |

### 1.2 What users do not have to trust the relayer with

- Customer private keys
- Changing amount, token, or recipient of a signed EIP-3009 message
- Replaying an authorization (token nonce + `authorizationState`)
- Unsigned payments

If the relayer is compromised, the attacker can spend **relayer WBT** and grief availability. They cannot mint a customer payment unless they obtain a valid signature.

### 1.3 What the admin must never have

```text
function adminWithdraw(address token, address to, uint256 amount)  // FORBIDDEN
function rescue(address token)                                     // FORBIDDEN unless
                                                                   // strictly unused airdrops
                                                                   // and never USDT working balances
```

If a `rescue` for accidental non-USDT airdrops is desired later, it must be a separate decision, exclude the prize USDT, and still not touch accounting balances.

## 2. Role permissions

| Action | Merchant | Customer | Seller | Buyer | Investor | Relayer | Admin | Anyone |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Register business | self | | self | self | self | | | |
| Freeze account | | | | | | | yes | |
| Create payment intent | yes | | | | | | | |
| Pay gasful | | yes | | | | | | |
| Sign EIP-3009 | | yes | | | | | | |
| Submit `settleWithAuthorization` | | | | | | yes | | **yes (proposed)** |
| Refund | yes, own intents | | | | | | | |
| Create invoice | | | yes | | | | | |
| Confirm invoice | | | | yes, as named buyer | | | | |
| Request seller financing | | | yes | | | | | |
| Request buyer financing | | | TBD | TBD | | | | |
| Fund financing | | | | | yes | | | |
| Repay financing | | | | yes | | | | payer on behalf: proposed yes |
| Pause | | | | | | | `PAUSER_ROLE` | |
| Upgrade WhiteFinance contracts | | | | | | | **no proxies in v1** | |
| Upgrade prize USDT | | | | | | | token owner, not us | |

Proposed: WhiteFinance contracts are **non-upgradeable**. Wrong code is a new deploy. That reduces admin trust.

## 3. Accounting invariants

Encode as Foundry invariants / assertions.

### 3.1 PaymentProcessor

1. `refundedAmount <= paidAmount`
2. Status `REFUNDED` iff `refundedAmount == paidAmount && paidAmount > 0`
3. Status `SETTLED` or refund states imply exactly one successful settlement of `amount`
4. `token == PRIZE_USDT` for every intent
5. After every successful function, `USDT.balanceOf(processor) == 0` except the atomic window inside `settleWithAuthorization` before the forward (end of tx: 0)
6. `(merchant, orderRef)` unique
7. `pay` / `settleWithAuthorization` revert if status ≠ `CREATED`
8. Refunds only to `payerSettled`

### 3.2 InvoiceRegistry

1. `(seller, invoiceNumber)` unique
2. `documentHash` unique among non-cancelled invoices (proposed)
3. `faceValue > 0`
4. At most one live `sellerFinancingId`
5. At most one live `buyerFinancingId`
6. If mutually exclusive (proposed): not both non-zero

### 3.3 SellerFinancing

1. One investor per funded position
2. `advanceAmount + discountAmount == repayableFace` (if full-face v1)
3. `advanceAmount <= faceValue`
4. USDT paid to seller on `fund` equals `advanceAmount`
5. USDT paid to investor on `repay` equals `repayableFace`
6. No second `fund`
7. Position non-transferable: no `safeTransfer`-like function exists

### 3.4 BuyerFinancing

1. `principal + sellerRemainder == faceValue`
2. `investorReceivable == principal + fee`
3. `fund` sends `principal` to **seller**, not buyer
4. `repay` sends `principal + fee` to **investor**, not seller
5. `payRemainder` sends `sellerRemainder` to seller
6. Sum of protocol claims on the buyer = `faceValue + fee`, never `faceValue + principal + fee`

### 3.5 Global

Protocol-owned prize USDT at rest is 0 except documented dispute holding (v1 proposed: none).

## 4. Solidity controls

| Control | Where | Why |
| --- | --- | --- |
| ReentrancyGuard | All token-moving functions | USDT callbacks are unlikely but CEI + guard is cheap insurance |
| Checks-effects-interactions | Settlement, fund, repay, refund | State flips before external `transfer` |
| SafeERC20 | All USDT I/O | Future-proof if return data changes |
| Pausable | Processor, both financing, registry writes | Incident response |
| AccessControl | Admin, pauser | Not Ownable-only; roles can be split later |
| Explicit token address | Immutable prize USDT | No user-supplied token |
| No delegatecall to user data | Entire protocol | |
| No unbounded loops on user lists | Use mappings + events | |

Do not use `transfer`/`send` for WBT. Contracts should not receive native WBT except possibly a payable rejector.

## 5. Signature validation

Relayer **and** token **and** processor validate. Defense in depth.

### 5.1 Relayer

- Reconstruct EIP-712 typed data with onchain `DOMAIN_SEPARATOR` / name / version / chainId / verifyingContract
- `ecrecover` or viem `verifyTypedData`
- Reject `s` malleability (low-s) to match token `ECRecover`
- Reject if signer ≠ `from`
- Reject ERC-1271 failures
- Bound `validBefore - validAfter` (proposed max 1 hour for checkout)

### 5.2 Token (given)

- `TetherToken: invalid signature`
- `TetherToken: auth early` / `auth expired` / `auth invalid`
- `to != msg.sender` on receive
- Blocklist

### 5.3 PaymentProcessor

- Bind authorization to `intentId`
- `to == address(this)`
- `value == intent.amount`
- `from` matches bound payer
- Intent not expired, status `CREATED`

Never accept a signature for `TransferWithAuthorization` in the v1 settle function. Wrong typehash is a different message.

## 6. Replay protection

| Layer | Mechanism |
| --- | --- |
| EIP-3009 | `bytes32` nonce + `authorizationState` |
| Chain | EIP-712 `chainId` 1874 |
| Token | `verifyingContract` = prize USDT proxy |
| Intent | One settlement |
| Relayer | In-memory idempotency key (best-effort) |
| Order | `(merchant, orderRef)` unique |

Used and canceled nonces are both `true` in `authorizationState`. Do not interpret `true` as “paid”; check the intent.

## 7. Refund limits

- Caller is merchant of the intent
- Intent is `SETTLED` or `PARTIALLY_REFUNDED`
- `amount > 0`
- `refundedAmount + amount <= paidAmount`
- Token pulled from merchant, not from protocol reserves
- Recipient is original `payerSettled`

No admin refund from other people’s wallets.

## 8. Duplicate financing protection

- Invoice locks
- Revert if funded
- Mutually exclusive workflows if approved
- `documentHash` uniqueness
- No second investor

Cross-platform duplicate financing of the same real-world invoice **cannot** be prevented. Disclose it.

## 9. Escrow accounting

v1 includes `EscrowVault` for Tokenize flows only (required by the contract implementation brief). Operate checkout does not use it.

Each vault account has a fixed depositor and beneficiary. Only the opening operator can deposit, release, or refund. Admin cannot withdraw. `totalHeld` is the accounting invariant against `balanceOf(vault)`.

Operate still requires a zero residual `PaymentProcessor` USDT balance after every successful transaction.

## 10. Pause and recovery

| Event | Action |
| --- | --- |
| Relayer key leak | Pause relayer process; rotate key; gasless path down; gasful path still works |
| WBT drain / unexpected gas use | Relayer pause flag; lower budget |
| Prize USDT blocklist on processor | Pause processor; users stop paying; do not “rescue” through admin withdraw |
| Prize USDT upgrade changes EIP-3009 | Pause gasless; inspect ABI; ship adapter or disable Scale |
| Bug in refund | Pause processor; gasful pay may also pause |
| Sequencer issues | Show degraded banner; do not hide confirmation stage |

Unpause is admin. Document a 2-person process even if testnet is one EOA.

Emergency user action: customers can `cancelAuthorization` on USDT if unused.

## 11. Relayer threat model

| Threat | Effect | Control |
| --- | --- | --- |
| Stolen relayer key | WBT theft, spam txs | Isolated key, low balance, budget, pause, no other powers |
| Malicious relayer | Censorship of gasless | Gasful fallback; permissionless settle so a second relayer can submit |
| Customer griefing | Infinite signed junk | Rate limits, expiry, balance checks before send |
| Auth front-running | If `transferWithAuthorization` used, funds move without accounting | Use `receiveWithAuthorization` only |
| RPC replay / nonce clash | Stuck relayer nonce | `eth_getTransactionCount("pending")`, replace-by-fee policy documented |
| Browser exposure | Full drain | Key only in worker env |
| Open settle + bogus intent | Revert onchain | Relayer still rate-limits to save WBT |

Spending limits (proposed):

- Max WBT per hour
- Max WBT per day
- Max gas per tx
- Min WBT reserve; stop below threshold

## 12. Event verification

Never take a client’s word that they paid.

Verification recipe:

1. `getTransactionReceipt(hash)`
2. `status == success`
3. `to == PaymentProcessor` (or the known proxy if any; v1 no proxy)
4. Decode `PaymentSettled`
5. Match `intentId`, `merchant`, `amount`, `payer`
6. Optionally require a matching USDT `Transfer` log `from=payer` `to=payout` or `to=processor` then `to=payout`
7. Confirm log still present at current head

Webhooks must be treated as hints. Merchants re-fetch.

## 13. Frontend / API threats

- XSS stealing a live wallet session: standard Next hardening, no `dangerouslySetInnerHTML` for invoice docs
- Open redirect after checkout: allowlist `onPaid` URLs
- Fake checkout: hosted page always loads intent from chain, not from query amount
- Query string `amount=1` ignored if intent says `25`
- localStorage spoof: ignored for balances and statuses
- Webhook forgery: HMAC; still re-read chain

## 14. Privacy

No names, emails, invoices with real counterparties, or government IDs onchain. Display names are demo strings. Webhook URLs onchain are a privacy leak for the merchant’s infra — disclosed.

## 15. Test strategy

Foundry, no application code in this pass.

### 15.1 Unit

Each state transition, each revert reason, role restrictions, pause.

### 15.2 Accounting

Table tests for the 100,000 / 95,000 factoring example and the 100,000 / 30,000 / 70,000 buyer example, including fee.

### 15.3 Fork / integration against Whitechain Sepolia

When a funded test account exists:

- `decimals`, `DOMAIN_SEPARATOR`, `authorizationState`
- A live `receiveWithAuthorization` to a throwaway processor mock
- Blocklist read on processor address

### 15.4 Invariant (fuzz)

- Processor USDT balance is 0 between txs
- Refunds never exceed payments
- Invoice claims never exceed `face + fee`
- At most one investor per financing

### 15.5 Relayer tests (later, Node)

- Reject wrong typehash
- Reject expired
- Reject amount mismatch
- Refuse to send if gas budget exceeded
- Idempotent resubmit

### 15.6 UI tests (later)

- Checkout shows token, amount, recipient, nonce, validity
- Wrong network banner
- Soft vs finalized copy
- Refund disabled when merchant USDT low

## 16. Disclosure for judges and users

README must state:

- Test tokens have no value
- Admin can pause
- USDT issuer can block
- Soft confirmations are not final
- Invoice hashes are not authenticity
- Webhooks are best-effort
- Relayer is a centralized convenience
