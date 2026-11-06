# Whitechain compatibility

This document records what was independently verified before implementation, what was not verified, and how WhiteFinance should behave on Whitechain Sepolia.

No deployment, signing, or dependency installation was performed for this review.

## 1. Verification method

Sources used:

- Official docs: [Whitechain Sepolia](https://docs.whitechain.io/learn/network/testnet), [Connect wallet](https://docs.whitechain.io/learn/get-started/connect-wallet), [Foundry deploy](https://docs.whitechain.io/build/deploy/deploy-with-foundry), [Transaction finality](https://docs.whitechain.io/learn/network/transaction-finality), [Faucet](https://docs.whitechain.io/learn/get-started/get-testnet-wbt), [Token list](https://docs.whitechain.io/build/block-explorer/token-list), [Reown AppKit](https://docs.whitechain.io/build/dapps/connect-wallet-with-reown), [FAQ](https://docs.whitechain.io/learn/general/faq)
- Prize rules: [ETHGlobal Mumbai / Whitechain](https://ethglobal.com/events/mumbai/prizes/whitechain)
- Explorer: [prize USDT token page](https://explorer.testnet.whitechain.io/token/0xcedfB56113143d55b2358b8CFbB0dEB5Ad2f55a7) and Blockscout `getabi` / `getsourcecode`
- JSON-RPC against `https://rpc.testnet.whitechain.io` on 6 November 2026

JSON-RPC calls performed:

| Call | Result |
| --- | --- |
| `eth_chainId` | `0x752` = `1874` |
| `eth_blockNumber` | `0xbd1afe` = `12393214` |
| `eth_getCode` on prize USDT | bytecode present (`2227` bytes at the proxy) |
| `decimals()` | `6` |
| `name()` | `Tether USD` |
| `symbol()` | `USDT` |
| `totalSupply()` | `1945285000000` = `1,945,285` USDT |
| `owner()` | `0x8790832ba493cc16a4dbc5c961b0c4950632799c` |
| EIP-1967 implementation slot | `0x26425662d126412128967ecf0a02ec48573026f7` (code present, `16067` bytes) |
| `DOMAIN_SEPARATOR()` | `0xcdcfacb6b15c8238b4e5fbb47bdb83b7f83f50a531d264bf9763d2bd1d3d2a25` |

ABI and verified source were fetched from the explorer contract API. That source is `TetherTokenV2`, a Tether implementation with Circle-adapted EIP-3009.

## 2. Network configuration

| Parameter | Project input | Official docs | Onchain / explorer | Status |
| --- | --- | --- | --- | --- |
| Network name | Whitechain Sepolia | Whitechain Sepolia | — | Verified |
| Chain ID | `1874` | `1874` (`0x752`) | `1874` | Verified |
| RPC | `https://rpc.testnet.whitechain.io` | same | reachable | Verified |
| WebSocket | not supplied | `wss://rpc.testnet.whitechain.io/ws` | not probed | Documented, not probed |
| Explorer | `https://explorer.testnet.whitechain.io/` | same | used | Verified |
| Faucet | `https://faucet.testnet.whitechain.io/` | same; drips **WBT only** | page exists | Verified as WBT faucet |
| Native gas token | WBT | WBT, 18 decimals | not independently read from a contract | Treat as native coin |
| L2 block time | not supplied | 1 second | not measured | Use docs |
| L1 | not supplied | Ethereum Sepolia `11155111` | not checked | Use docs |
| Architecture | not supplied | OP Stack L2 | — | Use docs |

Public RPC limits from official docs (not independently load-tested):

- 50 requests/second sustained per client IP
- Burst up to 500
- `429` with `Retry-After: 1`
- Batch up to 100 JSON-RPC calls per HTTP request

Implementation must retry on `429`, batch reads, and treat the public RPC as shared infrastructure rather than a dedicated indexer.

ETHGlobal also advertises a free Ankr RPC for hackers (1,500 requests/second for 7 days). That endpoint was **not** activated or verified here.

## 3. Prize USDT versus listed USDT.e

These are different tokens. WhiteFinance must use the prize address only.

| Token | Address | Symbol reported | Role |
| --- | --- | --- | --- |
| **Official prize USDT** | `0xcedfB56113143d55b2358b8CFbB0dEB5Ad2f55a7` | `USDT` / name `Tether USD` | **Only qualifying payment token** |
| Whitechain token-list USDT | `0xaa7962d073935D387e8d442DA1D7149C81388f46` | list says `USDT`; contract reports `USDT.e` | Bridged test USDT. **Do not use** |

Explorer title for the prize token: `Tether USD (USDT)`, Transparent Upgradeable Proxy, 6 decimals, ~499 holders and ~3,009 transfers at the time of inspection.

Do not substitute USDT.e, USDW, USDC, or a self-minted token. Prize qualification requires at least one settled payment in the prize USDT, with the explorer link in the README.

## 4. Prize USDT ABI and behaviour

Verified source (`TetherTokenV2`) and explorer ABI agree. Relevant surface:

### 4.1 ERC-20

Standard `name`, `symbol`, `decimals`, `totalSupply`, `balanceOf`, `allowance`, `approve`, `transfer`, `transferFrom`, `increaseAllowance`, `decreaseAllowance`.

`decimals()` is stored as `tetherDecimals` and was observed as `6` onchain.

`transferFrom` reverts rather than returning `false` in the OpenZeppelin-style implementation. WhiteFinance still uses SafeERC20.

### 4.2 EIP-3009 — present and usable

The token implements:

- `transferWithAuthorization` (v,r,s and packed `bytes signature`)
- `receiveWithAuthorization` (v,r,s and packed `bytes signature`)
- `cancelAuthorization`
- `authorizationState(authorizer, nonce) → bool`
- `TRANSFER_WITH_AUTHORIZATION_TYPEHASH`
- `RECEIVE_WITH_AUTHORIZATION_TYPEHASH`
- `CANCEL_AUTHORIZATION_TYPEHASH`
- `DOMAIN_SEPARATOR`
- events `AuthorizationUsed`, `AuthorizationCanceled`

Typehashes match EIP-3009:

```text
TransferWithAuthorization(address from,address to,uint256 value,uint256 validAfter,uint256 validBefore,bytes32 nonce)
ReceiveWithAuthorization(address from,address to,uint256 value,uint256 validAfter,uint256 validBefore,bytes32 nonce)
CancelAuthorization(address authorizer,bytes32 nonce)
```

Observed rules in verified source:

1. **The customer must still sign.** There is no unsigned transfer path.
2. **Nonce is `bytes32`, not a sequential integer.** Treat it as a unique random value per authorization.
3. **`authorizationState == true` means used or canceled.** It cannot be reused.
4. **Validity is exclusive of the bounds:** `block.timestamp > validAfter` and `block.timestamp < validBefore`. Setting `validAfter = 0` is valid immediately. Do not use `>=` / `<=` in client checks if you want to match the token.
5. **Packed EOA signatures are `r || s || v`.**
6. **ERC-1271 contract wallets are supported** via `SignatureChecker`.
7. **`receiveWithAuthorization` requires `to == msg.sender`.** Only the payee contract can execute it. This is the function WhiteFinance should use so a front-runner cannot pull the authorization outside `PaymentProcessor` accounting.
8. **`transferWithAuthorization` is callable by any unblocked address** and would send tokens even if WhiteFinance never records the payment intent. Do not use it as the primary checkout path.
9. **`onlyNotBlocked` applies to the caller** of authorization functions. The relayer and `PaymentProcessor` must not be on the token blocklist. `_beforeTokenTransfer` also reverts if `from` is blocked (unless the token owner is the caller).
10. **Transfers to the token contract itself are forbidden:** `to != address(this)` where `this` is the USDT proxy. Transfers to `PaymentProcessor` are allowed.

### 4.3 EIP-712 domain

`__ERC20Permit_init(_name)` sets EIP-712 name to the ERC-20 name and version to `"1"`.

Proposed signing domain, to be re-read from chain at runtime rather than trusted forever:

| Field | Expected value | Confidence |
| --- | --- | --- |
| name | `Tether USD` | High — matches `name()` and permit init |
| version | `1` | High — hardcoded in `ERC20PermitUpgradeable.__ERC20Permit_init` |
| chainId | `1874` | High |
| verifyingContract | `0xcedfB56113143d55b2358b8CFbB0dEB5Ad2f55a7` | High — proxy address, because `address(this)` in a proxy is the proxy |

`DOMAIN_SEPARATOR()` was read onchain. The frontend and relayer must:

1. Read `DOMAIN_SEPARATOR`, `name`, `version` (or reconstruct from docs and compare against the onchain separator).
2. Abort if the separator does not match the local EIP-712 payload.
3. Re-check after any token upgrade.

A live signing round-trip (wallet signature → `transferWithAuthorization` / `receiveWithAuthorization` success) was **not** performed. That is the first Scale implementation test, not a claim in this document.

### 4.4 EIP-2612 permit — also present

`permit` exists with both v,r,s and packed signature overloads. Sequential `nonces(owner)` increment. This is a valid fallback for “approve without gas” followed by `transferFrom`, but it is weaker than EIP-3009 for checkout because a permit is an allowance, not a single exact payment.

WhiteFinance v1 gasless checkout uses EIP-3009 `receiveWithAuthorization`. Permit is documented as a backup only if an implementation issue appears during integration testing.

### 4.5 Admin / compliance surface

The prize USDT is a Tether-style upgradeable token. Privileged functions on the token (not on WhiteFinance) include `mint`, `redeem`, `addToBlockedList`, `removeFromBlockedList`, `destroyBlockedFunds`, `transferOwnership`.

`isTrusted` is retained as an unused storage mapping.

Implications:

- Token owner can mint, burn, block accounts, and destroy blocked balances.
- Token owner can upgrade the implementation, which can change authorization behaviour.
- WhiteFinance cannot override those controls.
- Protocol contracts and the relayer address must be monitored for `BlockPlaced`.

### 4.6 How demo users obtain prize USDT

**Not verified.** The official faucet documents WBT only. No public prize-USDT faucet was found in Whitechain docs. The token `owner` can `mint`. Bridged `USDT.e` from the official token list is a different asset and must not be used for qualifying flows.

This is an open operational risk. See unresolved decisions.

## 5. Solidity, Foundry, and EVM version

| Claim | Source | How WhiteFinance should treat it |
| --- | --- | --- |
| “Latest stable Solidity supported is 0.8.19” | Older Geth-era deployment page | **Stale.** Do not pin 0.8.19 because of this page. |
| Whitechain is EVM-equivalent OP Stack; Ethereum contracts and toolchains work unchanged | Current FAQ and deploy guides | Trusted for architecture |
| Foundry template pins `solc = "0.8.30"` and `evm_version = "prague"` | [Deploy with Foundry](https://docs.whitechain.io/build/deploy/deploy-with-foundry) | **Proposed compile target** |
| Product request: Solidity 0.8.24+ | This repository brief | Compatible: pragma `^0.8.24`, pin `0.8.30` |
| Foundry on Windows requires WSL | Same Foundry guide | Development environment requirement |

Proposed Foundry profile:

```toml
solc = "0.8.30"
evm_version = "prague"
```

`pragma solidity ^0.8.24;` in source, compiler pinned to 0.8.30 so explorer verification matches.

Verification command shape from official docs:

```bash
forge verify-contract <address> <path:Contract> \
  --rpc-url https://rpc.testnet.whitechain.io/ \
  --verifier blockscout \
  --verifier-url https://explorer.testnet.whitechain.io/api/
```

The verifier URL must end with `/api/`.

## 6. Finality and confirmation policy

Official stages:

| Stage | Meaning | Typical time | Product meaning |
| --- | --- | --- | --- |
| Soft confirmation | In an L2 block; sequencer’s word only; can still be reordered or dropped | ~1 second | Fast UX “payment submitted / provisionally paid” |
| Safe | Batch posted and confirmed on Ethereum | up to ~30 minutes | Safer for releasing offchain goods |
| Finalized | Ethereum finality of the batch | ~13 minutes after safe | Irreversible under protocol rules |

Flashblocks are **not enabled** on Whitechain Sepolia.

WhiteFinance must expose confirmation stage in APIs and UI. It must not tell a merchant that a soft confirmation is irreversible.

Proposed product defaults (needs approval):

- Hosted checkout shows **Paid (soft)** after 1 successful L2 receipt and a matching `PaymentSettled` event.
- Merchant dashboard and webhooks include `confirmationStage`: `soft` | `safe` | `finalized`.
- Demo store may release a digital receipt at soft confirmation.
- Documentation states that high-value fulfilment should wait for `safe` or `finalized`.

Reading `safe` / `finalized` heads via standard OP Stack tags (`safe`, `finalized`) is expected to work because Whitechain is OP Stack. **Those tags were not probed in this review.** First implementation task for the indexer is to confirm `eth_getBlockByNumber("safe")` and `"finalized"` on the public RPC.

## 7. Frontend wallet stack

Official Whitechain Reown guide:

- Import `whitechainSepolia` from `@reown/appkit/networks` (chain ID 1874).
- Use `@reown/appkit-adapter-wagmi` with `ssr: true` for Next.js.
- Disable email/social: `features: { email: false, socials: false, analytics: false }`.
- **Embedded wallets / email / social login are not supported on Whitechain.** Login can succeed and then signing fails.
- Reown Blockchain API does not list `eip155:1874`, so AppKit identity, swaps, on-ramp, and in-modal history are unavailable.
- Next + Turbopack may fail on unused `@x402/*` optional deps; install them or alias them.

Scale-track implication:

- Gasless checkout can remove **WBT gas** from the customer.
- It cannot honestly claim “the payer never uses a wallet” if the only supported path is an injected or WalletConnect EOA.
- “Zero crypto steps” in the prize text is therefore only partially achievable with the specified stack. WhiteFinance should show: connect wallet → review exact authorization → sign typed data → wait. No seed phrase writing, no gas token, no chain picker if AppKit is locked to Whitechain Sepolia.

## 8. viem / wagmi

Official docs say viem includes OP Stack support and returns L1 data fee. Use viem for all chain I/O. Do not add a Whitechain-specific SDK.

`useBalance` in wagmi v3 has no `formatted` field; format with `formatUnits`.

## 9. Compatibility issues that would change the stack

None of the following require abandoning the requested stack. They constrain how it is used.

| Issue | Impact | Response |
| --- | --- | --- |
| Prize USDT ≠ token-list USDT.e | Wrong token would fail qualification | Hardcode prize address; reject others in contracts |
| Token is upgradeable and blockable | Authorization or payouts can break | Runtime capability checks; pause; no assumption of immutability |
| `receiveWithAuthorization` payee must be `msg.sender` | Relayer cannot submit that call as itself unless it is the payee | `PaymentProcessor` is the payee and then forwards to the merchant |
| Exclusive time bounds | Off-by-one expiry bugs | Match token inequalities |
| Reown embedded wallets fail | Scale “invisible crypto” is limited | External wallets + EIP-3009; do not enable AppKit email/social |
| No durable database | Webhooks and relayer queues are best-effort | Chain is source of truth; document the gap |
| Public RPC rate limits | Indexer and checkout reads can 429 | Batch, cache, backoff; optional Ankr later |
| Foundry on Windows | This workspace is Windows | Use WSL for `forge` |
| Prize USDT acquisition unknown | Demo accounts may have no USDT | Open operational decision |

No change to Next.js, Tailwind, shadcn/ui, wagmi, viem, Reown AppKit, Foundry, or OpenZeppelin is justified by these findings.

## 10. Claims this document does not make

- It does not claim a successful gasless payment was executed.
- It does not claim `safe` / `finalized` RPC tags were tested.
- It does not claim Reown AppKit was installed and connected.
- It does not claim the WebSocket endpoint works.
- It does not claim a prize-USDT faucet exists.
- It does not claim mainnet parameters.

Those checks belong in implementation phase 0 (preflight) of `docs/development-roadmap.md`.
