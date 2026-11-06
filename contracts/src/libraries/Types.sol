// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

library Types {
    enum InvoiceStatus {
        None,
        Created,
        BuyerConfirmed,
        Cancelled,
        Settled,
        Expired
    }

    enum FinancingStatus {
        None,
        Requested,
        Active,
        Repaid,
        Overdue,
        Defaulted,
        Disputed,
        Cancelled,
        Expired
    }

    enum IntentStatus {
        None,
        Created,
        Settled,
        PartiallyRefunded,
        Refunded,
        Expired,
        Cancelled
    }

    struct Business {
        address account;
        string displayName;
        uint8 roles;
        address payoutAddress;
        bool active;
        string webhookUrl;
        uint64 createdAt;
        uint64 updatedAt;
    }

    struct Invoice {
        address seller;
        address buyer;
        bytes32 invoiceNumber;
        uint256 faceValue;
        uint64 dueDate;
        bytes32 documentHash;
        bytes32 termsHash;
        InvoiceStatus status;
        uint256 sellerFinancingId;
        uint256 buyerFinancingId;
        uint256 outstandingToSeller;
        uint256 remainderPaidToSeller;
        uint256 financedPaidToInvestor;
        uint256 investorReceivable;
    }

    struct SellerPosition {
        uint256 invoiceId;
        address seller;
        address buyer;
        address investor;
        uint256 faceValue;
        uint256 advanceAmount;
        uint256 discountAmount;
        uint64 dueDate;
        uint64 fundingDeadline;
        uint64 gracePeriod;
        FinancingStatus status;
        FinancingStatus statusBeforeDispute;
        bool repaid;
    }

    struct BuyerPosition {
        uint256 invoiceId;
        address seller;
        address buyer;
        address investor;
        uint256 faceValue;
        uint256 principal;
        uint256 fee;
        uint256 sellerRemainder;
        uint64 dueDate;
        uint64 fundingDeadline;
        uint64 gracePeriod;
        FinancingStatus status;
        FinancingStatus statusBeforeDispute;
        bool investorRepaid;
        bool remainderPaid;
    }

    struct PaymentIntent {
        address merchant;
        address payoutAddress;
        bytes32 orderRef;
        uint256 amount;
        address payer;
        uint64 expiresAt;
        IntentStatus status;
        uint256 paidAmount;
        uint256 refundedAmount;
        address payerSettled;
        uint64 settledBlock;
    }

    /// @dev EIP-3009 ReceiveWithAuthorization payload. Signature is 65-byte r||s||v for EOAs.
    struct ReceiveAuthorization {
        address from;
        address to;
        uint256 value;
        uint256 validAfter;
        uint256 validBefore;
        bytes32 nonce;
        bytes signature;
    }
}
