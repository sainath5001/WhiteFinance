# WhiteFinance contract layer

Implementation of the approved architecture, with one explicit change: **EscrowVault is included** because the implementation brief required it. `TransferPolicy` remains omitted.

Compiler: Solidity `^0.8.24`, Foundry pin `solc = 0.8.30`, `evm_version = prague`. Token is injected at deploy; production deploy uses prize USDT `0xcedfB56113143d55b2358b8CFbB0dEB5Ad2f55a7`.

## Locked v1 decisions

These were listed as open in `README.md` and are now encoded in the contracts:

| Decision | Implementation |
| --- | --- |
| EscrowVault | Included. Holds financing USDT only. |
| TransferPolicy | Not implemented. |
| Seller vs buyer financing | Mutually exclusive per invoice. |
| Payment intents | Onchain, unique `(merchant, orderRef)`. |
| Platform fee | 0. |
| Late interest | None. |
| Default grace | 14 days, admin-bounded 1–90 days. |
| Buyer financing requester | Named buyer only. |
| Investors | Registered `INVESTOR` role. |
| Seller factoring | Full face: `advance + discount == faceValue` (discount may be 0). |
| Buyer fee | Fixed USDT amount. |
| Dispute | Parties flag; `DISPUTE_RESOLVER_ROLE` clears; no clawback. |
| `settleWithAuthorization` | Permissionless. |
| Operate refunds | Merchant-funded, not escrowed. |
| Remainder | `payRemainder` on `BuyerFinancing`. |
| `FUNDED`/`ACTIVE` | Same transaction: vault deposit then release. |

A document hash is **not** authenticity. Buyer confirmation is required before financing.

## Modules

### BusinessRegistry

Self-register public profiles with role bitmask: merchant=1, seller=2, buyer=4, investor=8. Admin freeze only.

### InvoiceRegistry

Invoice facts, uniqueness of `(seller, invoiceNumber)` and `documentHash`, outstanding-to-seller accounting, mutually exclusive financing locks. Protocol callbacks from financing contracts.

### EscrowVault

Single USDT token. Operator role (financing contracts). Fixed depositor and beneficiary per account. `depositFrom` / `release` / `refund`. No admin withdraw. `totalHeld` must match the vault token balance under honest operation.

### SellerFinancing

`request → fund (escrow to seller) → repay (escrow to investor)`. Overdue, default, dispute, cancel, expire. Example: 100,000 face, 95,000 advance, 5,000 discount.

### BuyerFinancing

`request → fund (principal to seller) → payRemainder (to seller) + repay (principal+fee to investor)`. Principal is removed from seller outstanding so 30,000 is never owed twice.

### PaymentProcessor

Operate checkout only. Gasful `pay` pulls USDT to the merchant payout. Gasless `settleWithAuthorization` calls prize-USDT `receiveWithAuthorization` (EIP-3009) with `to == PaymentProcessor`, then forwards to the merchant. `transferWithAuthorization` is **not** an entry point.

## EIP-3009 notes

Prize USDT uses exclusive time bounds (`timestamp > validAfter` and `< validBefore`), `bytes32` nonces, packed `r||s||v` signatures, and `receiveWithAuthorization` requires `to == msg.sender`. The processor repeats those checks before calling the token.

## Tests

From `contracts/`:

```bash
forge test
forge test --match-path test/integration/WhitechainCompatibility.t.sol
```

The integration test skips unless `WHITECHAIN_SEPOLIA_RPC_URL` is set. It is read-only.

## Deploy (do not broadcast in this pass)

```bash
forge script script/Deploy.s.sol --rpc-url https://rpc.testnet.whitechain.io
```

Add `--broadcast` only when a throwaway testnet key is available.
