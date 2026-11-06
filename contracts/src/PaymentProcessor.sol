// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {WhiteFinanceAccess} from "./internal/WhiteFinanceAccess.sol";
import {Constants} from "./libraries/Constants.sol";
import {Errors} from "./libraries/Errors.sol";
import {Types} from "./libraries/Types.sol";
import {IBusinessRegistry} from "./interfaces/IBusinessRegistry.sol";
import {IPrizeUSDT} from "./interfaces/IPrizeUSDT.sol";

/// @title Merchant payment intents, settlement, receipts, and refunds.
/// @dev Gasless checkout uses prize USDT `receiveWithAuthorization` (EIP-3009).
///      `transferWithAuthorization` is intentionally not an entry point: anyone can submit it,
///      so funds would not be bound to an intent. Checkout authorizations must set `to` to this
///      contract. Token validity uses exclusive bounds: timestamp > validAfter and < validBefore.
contract PaymentProcessor is WhiteFinanceAccess {
    using SafeERC20 for IPrizeUSDT;

    IBusinessRegistry public immutable businessRegistry;
    IPrizeUSDT public immutable usdt;

    uint256 public intentCount;
    mapping(uint256 => Types.PaymentIntent) private _intents;
    mapping(address => mapping(bytes32 => uint256)) public intentByMerchantOrder;

    event PaymentIntentCreated(
        uint256 indexed intentId,
        address indexed merchant,
        bytes32 indexed orderRef,
        uint256 amount,
        address payer,
        uint64 expiresAt,
        address payoutAddress
    );
    event PaymentSettled(
        uint256 indexed intentId, address indexed payer, address indexed merchant, uint256 amount, uint64 settledBlock
    );
    event PaymentRefunded(uint256 indexed intentId, address indexed merchant, address indexed payer, uint256 amount);
    event PaymentCancelled(uint256 indexed intentId);
    event PaymentExpired(uint256 indexed intentId);

    constructor(address admin, address businessRegistry_, address usdt_) WhiteFinanceAccess(admin) {
        if (businessRegistry_ == address(0) || usdt_ == address(0)) revert Errors.ZeroAddress();
        businessRegistry = IBusinessRegistry(businessRegistry_);
        usdt = IPrizeUSDT(usdt_);
    }

    /// @notice Merchant creates a unique payment intent. Token is always the configured USDT.
    function createIntent(bytes32 orderRef, uint256 amount, address payer, uint64 expiresAt)
        external
        whenNotPaused
        returns (uint256 intentId)
    {
        if (!businessRegistry.hasBusinessRole(msg.sender, Constants.ROLE_MERCHANT)) revert Errors.MissingRole();
        if (orderRef == bytes32(0)) revert Errors.InvalidInvoiceNumber();
        if (amount == 0) revert Errors.ZeroAmount();
        if (expiresAt <= block.timestamp) revert Errors.IntentExpired();
        if (intentByMerchantOrder[msg.sender][orderRef] != 0) revert Errors.DuplicateOrderRef();

        address payout = businessRegistry.payoutAddress(msg.sender);
        intentId = ++intentCount;
        _intents[intentId] = Types.PaymentIntent({
            merchant: msg.sender,
            payoutAddress: payout,
            orderRef: orderRef,
            amount: amount,
            payer: payer,
            expiresAt: expiresAt,
            status: Types.IntentStatus.Created,
            paidAmount: 0,
            refundedAmount: 0,
            payerSettled: address(0),
            settledBlock: 0
        });
        intentByMerchantOrder[msg.sender][orderRef] = intentId;

        emit PaymentIntentCreated(intentId, msg.sender, orderRef, amount, payer, expiresAt, payout);
    }

    /// @notice Merchant cancels an unpaid intent.
    function cancelIntent(uint256 intentId) external whenNotPaused {
        Types.PaymentIntent storage intent = _requireIntent(intentId);
        if (msg.sender != intent.merchant) revert Errors.Unauthorized();
        if (intent.status != Types.IntentStatus.Created) revert Errors.IntentNotCreated();
        intent.status = Types.IntentStatus.Cancelled;
        emit PaymentCancelled(intentId);
    }

    /// @notice Permissionless expiry after `expiresAt`.
    function expireIntent(uint256 intentId) external whenNotPaused {
        Types.PaymentIntent storage intent = _requireIntent(intentId);
        if (intent.status != Types.IntentStatus.Created) revert Errors.IntentNotCreated();
        if (block.timestamp < intent.expiresAt) revert Errors.IntentNotExpired();
        intent.status = Types.IntentStatus.Expired;
        emit PaymentExpired(intentId);
    }

    /// @notice Customer pays with WBT gas via `transferFrom` directly to the merchant payout address.
    function pay(uint256 intentId) external nonReentrant whenNotPaused {
        Types.PaymentIntent storage intent = _prepareSettle(intentId, msg.sender);
        usdt.safeTransferFrom(msg.sender, intent.payoutAddress, intent.amount);
        emit PaymentSettled(intentId, msg.sender, intent.merchant, intent.amount, intent.settledBlock);
    }

    /// @notice Settle a gasless EIP-3009 `ReceiveWithAuthorization` into this contract, then pay the merchant.
    /// @dev Permissionless to submit. Relayer is an operational convenience. Customer must still sign.
    function settleWithAuthorization(uint256 intentId, Types.ReceiveAuthorization calldata auth)
        external
        nonReentrant
        whenNotPaused
    {
        _validateAuthorization(intentId, auth);
        Types.PaymentIntent storage intent = _prepareSettle(intentId, auth.from);

        usdt.receiveWithAuthorization(
            auth.from, auth.to, auth.value, auth.validAfter, auth.validBefore, auth.nonce, auth.signature
        );
        usdt.safeTransfer(intent.payoutAddress, intent.amount);
        emit PaymentSettled(intentId, auth.from, intent.merchant, intent.amount, intent.settledBlock);
    }

    /// @notice Merchant-funded full or partial refund to the original payer. Cannot exceed paid amount.
    function refund(uint256 intentId, uint256 amount) external nonReentrant whenNotPaused {
        if (amount == 0) revert Errors.ZeroAmount();
        Types.PaymentIntent storage intent = _requireIntent(intentId);
        if (msg.sender != intent.merchant) revert Errors.Unauthorized();
        if (intent.status != Types.IntentStatus.Settled && intent.status != Types.IntentStatus.PartiallyRefunded) {
            revert Errors.InvalidStatus(uint8(intent.status), uint8(Types.IntentStatus.Settled));
        }
        if (intent.refundedAmount + amount > intent.paidAmount) revert Errors.RefundExceedsPaid();

        intent.refundedAmount += amount;
        intent.status = intent.refundedAmount == intent.paidAmount
            ? Types.IntentStatus.Refunded
            : Types.IntentStatus.PartiallyRefunded;

        address payer = intent.payerSettled;
        usdt.safeTransferFrom(msg.sender, payer, amount);
        emit PaymentRefunded(intentId, msg.sender, payer, amount);
    }

    function getIntent(uint256 intentId) external view returns (Types.PaymentIntent memory) {
        Types.PaymentIntent memory intent = _intents[intentId];
        if (intent.merchant == address(0)) revert Errors.IntentNotFound();
        return intent;
    }

    function _prepareSettle(uint256 intentId, address payer)
        internal
        returns (Types.PaymentIntent storage intent)
    {
        intent = _requireIntent(intentId);
        if (intent.status != Types.IntentStatus.Created) revert Errors.IntentNotCreated();
        if (block.timestamp >= intent.expiresAt) revert Errors.IntentExpired();
        if (intent.payer != address(0) && payer != intent.payer) revert Errors.PayerMismatch();
        if (usdt.isBlocked(payer) || usdt.isBlocked(intent.payoutAddress) || usdt.isBlocked(address(this))) {
            revert Errors.TokenBlocked();
        }

        intent.status = Types.IntentStatus.Settled;
        intent.paidAmount = intent.amount;
        intent.payerSettled = payer;
        intent.settledBlock = uint64(block.number);
    }

    function _validateAuthorization(uint256 intentId, Types.ReceiveAuthorization calldata auth) internal view {
        Types.PaymentIntent storage intent = _intents[intentId];
        if (intent.merchant == address(0)) revert Errors.IntentNotFound();
        if (auth.to != address(this)) revert Errors.WrongTokenRecipient();
        if (auth.value != intent.amount) revert Errors.WrongAuthorizationValue();
        if (auth.from == address(0)) revert Errors.ZeroAddress();
        if (block.timestamp <= auth.validAfter) revert Errors.AuthorizationEarly();
        if (block.timestamp >= auth.validBefore) revert Errors.AuthorizationExpired();
        if (usdt.authorizationState(auth.from, auth.nonce)) revert Errors.AuthorizationNonceUsed();
        if (auth.signature.length != 65) revert Errors.InvalidAuthorization();
    }

    function _requireIntent(uint256 intentId) internal view returns (Types.PaymentIntent storage intent) {
        intent = _intents[intentId];
        if (intent.merchant == address(0)) revert Errors.IntentNotFound();
    }
}
