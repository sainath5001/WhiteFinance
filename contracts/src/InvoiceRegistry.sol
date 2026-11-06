// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {WhiteFinanceAccess} from "./internal/WhiteFinanceAccess.sol";
import {Constants} from "./libraries/Constants.sol";
import {Errors} from "./libraries/Errors.sol";
import {Types} from "./libraries/Types.sol";
import {IBusinessRegistry} from "./interfaces/IBusinessRegistry.sol";
import {IInvoiceRegistry} from "./interfaces/IInvoiceRegistry.sol";

/// @title Commercial invoice registry.
/// @dev A document hash is tamper evidence only. It does not prove authenticity.
contract InvoiceRegistry is WhiteFinanceAccess, IInvoiceRegistry {
    bytes32 public constant PROTOCOL_ROLE = keccak256("PROTOCOL_ROLE");

    IBusinessRegistry public immutable businessRegistry;

    uint256 public invoiceCount;
    mapping(uint256 => Types.Invoice) private _invoices;
    mapping(address => mapping(bytes32 => uint256)) public invoiceBySellerNumber;
    mapping(bytes32 => uint256) public invoiceByDocumentHash;

    event InvoiceCreated(
        uint256 indexed invoiceId,
        address indexed seller,
        address indexed buyer,
        bytes32 invoiceNumber,
        uint256 faceValue,
        uint64 dueDate,
        bytes32 documentHash
    );
    event InvoiceConfirmed(uint256 indexed invoiceId, address indexed buyer);
    event InvoiceCancelled(uint256 indexed invoiceId);
    event InvoiceExpired(uint256 indexed invoiceId);
    event InvoiceSettled(uint256 indexed invoiceId);
    event FinancingAttached(uint256 indexed invoiceId, uint256 financingId, bool sellerSide);
    event FinancingDetached(uint256 indexed invoiceId, bool sellerSide);
    event OutstandingUpdated(
        uint256 indexed invoiceId, uint256 outstandingToSeller, uint256 remainderPaid, uint256 financedPaidToInvestor
    );

    constructor(address admin, address businessRegistry_) WhiteFinanceAccess(admin) {
        if (businessRegistry_ == address(0)) revert Errors.ZeroAddress();
        businessRegistry = IBusinessRegistry(businessRegistry_);
    }

    /// @notice Seller creates an invoice. `documentHash` is not an authenticity proof.
    function createInvoice(
        address buyer,
        bytes32 invoiceNumber,
        uint256 faceValue,
        uint64 dueDate,
        bytes32 documentHash,
        bytes32 termsHash
    ) external whenNotPaused returns (uint256 invoiceId) {
        if (!businessRegistry.hasBusinessRole(msg.sender, Constants.ROLE_SELLER)) revert Errors.MissingRole();
        if (buyer == address(0) || buyer == msg.sender) revert Errors.InvalidBuyer();
        if (invoiceNumber == bytes32(0)) revert Errors.InvalidInvoiceNumber();
        if (documentHash == bytes32(0)) revert Errors.InvalidDocumentHash();
        if (faceValue == 0) revert Errors.InvalidFaceValue();
        if (dueDate <= block.timestamp) revert Errors.InvalidDueDate();
        if (invoiceBySellerNumber[msg.sender][invoiceNumber] != 0) revert Errors.DuplicateInvoiceNumber();
        if (invoiceByDocumentHash[documentHash] != 0) revert Errors.DuplicateDocumentHash();

        invoiceId = ++invoiceCount;
        _invoices[invoiceId] = Types.Invoice({
            seller: msg.sender,
            buyer: buyer,
            invoiceNumber: invoiceNumber,
            faceValue: faceValue,
            dueDate: dueDate,
            documentHash: documentHash,
            termsHash: termsHash,
            status: Types.InvoiceStatus.Created,
            sellerFinancingId: 0,
            buyerFinancingId: 0,
            outstandingToSeller: faceValue,
            remainderPaidToSeller: 0,
            financedPaidToInvestor: 0,
            investorReceivable: 0
        });
        invoiceBySellerNumber[msg.sender][invoiceNumber] = invoiceId;
        invoiceByDocumentHash[documentHash] = invoiceId;

        emit InvoiceCreated(invoiceId, msg.sender, buyer, invoiceNumber, faceValue, dueDate, documentHash);
    }

    /// @notice Named buyer acknowledges the invoice. This is technical notice, not legal authenticity.
    function confirmInvoice(uint256 invoiceId) external whenNotPaused {
        Types.Invoice storage inv = _requireInvoice(invoiceId);
        if (msg.sender != inv.buyer) revert Errors.NotBuyer();
        if (inv.status != Types.InvoiceStatus.Created) {
            revert Errors.InvalidStatus(uint8(inv.status), uint8(Types.InvoiceStatus.Created));
        }
        if (block.timestamp > inv.dueDate) revert Errors.InvalidDueDate();
        inv.status = Types.InvoiceStatus.BuyerConfirmed;
        emit InvoiceConfirmed(invoiceId, msg.sender);
    }

    /// @notice Seller cancels before any live financing is attached.
    function cancelInvoice(uint256 invoiceId) external whenNotPaused {
        Types.Invoice storage inv = _requireInvoice(invoiceId);
        if (msg.sender != inv.seller) revert Errors.NotSeller();
        if (inv.status != Types.InvoiceStatus.Created && inv.status != Types.InvoiceStatus.BuyerConfirmed) {
            revert Errors.InvalidStatus(uint8(inv.status), uint8(Types.InvoiceStatus.Created));
        }
        if (inv.sellerFinancingId != 0 || inv.buyerFinancingId != 0) revert Errors.FinancingAttached();
        inv.status = Types.InvoiceStatus.Cancelled;
        delete invoiceByDocumentHash[inv.documentHash];
        emit InvoiceCancelled(invoiceId);
    }

    /// @notice Permissionless expiry of an unconfirmed invoice past due date.
    function expireInvoice(uint256 invoiceId) external whenNotPaused {
        Types.Invoice storage inv = _requireInvoice(invoiceId);
        if (inv.status != Types.InvoiceStatus.Created) {
            revert Errors.InvalidStatus(uint8(inv.status), uint8(Types.InvoiceStatus.Created));
        }
        if (block.timestamp <= inv.dueDate) revert Errors.StillCurrent();
        inv.status = Types.InvoiceStatus.Expired;
        delete invoiceByDocumentHash[inv.documentHash];
        emit InvoiceExpired(invoiceId);
    }

    function attachSellerFinancing(uint256 invoiceId, uint256 financingId)
        external
        onlyRole(PROTOCOL_ROLE)
        whenNotPaused
    {
        Types.Invoice storage inv = _requireConfirmed(invoiceId);
        if (inv.sellerFinancingId != 0) revert Errors.FinancingAlreadyAttached();
        if (inv.buyerFinancingId != 0) revert Errors.FinancingConflict();
        inv.sellerFinancingId = financingId;
        emit FinancingAttached(invoiceId, financingId, true);
    }

    function attachBuyerFinancing(uint256 invoiceId, uint256 financingId)
        external
        onlyRole(PROTOCOL_ROLE)
        whenNotPaused
    {
        Types.Invoice storage inv = _requireConfirmed(invoiceId);
        if (inv.buyerFinancingId != 0) revert Errors.FinancingAlreadyAttached();
        if (inv.sellerFinancingId != 0) revert Errors.FinancingConflict();
        inv.buyerFinancingId = financingId;
        emit FinancingAttached(invoiceId, financingId, false);
    }

    function detachFinancing(uint256 invoiceId, bool sellerSide) external onlyRole(PROTOCOL_ROLE) whenNotPaused {
        Types.Invoice storage inv = _requireInvoice(invoiceId);
        if (sellerSide) {
            if (inv.sellerFinancingId == 0) revert Errors.FinancingNotFound();
            inv.sellerFinancingId = 0;
        } else {
            if (inv.buyerFinancingId == 0) revert Errors.FinancingNotFound();
            inv.buyerFinancingId = 0;
        }
        emit FinancingDetached(invoiceId, sellerSide);
    }

    /// @notice Full-face assignment: seller outstanding becomes 0.
    function onSellerFactoringFunded(uint256 invoiceId) external onlyRole(PROTOCOL_ROLE) {
        Types.Invoice storage inv = _requireInvoice(invoiceId);
        inv.outstandingToSeller = 0;
        inv.investorReceivable = inv.faceValue;
        emit OutstandingUpdated(invoiceId, 0, inv.remainderPaidToSeller, inv.financedPaidToInvestor);
    }

    /// @notice Investor principal extinguishes that slice of the seller claim.
    function onBuyerFinancingFunded(uint256 invoiceId, uint256 principal, uint256 investorReceivable)
        external
        onlyRole(PROTOCOL_ROLE)
    {
        Types.Invoice storage inv = _requireInvoice(invoiceId);
        if (principal == 0 || principal > inv.outstandingToSeller) revert Errors.OverAllocation();
        inv.outstandingToSeller -= principal;
        inv.investorReceivable = investorReceivable;
        emit OutstandingUpdated(invoiceId, inv.outstandingToSeller, inv.remainderPaidToSeller, inv.financedPaidToInvestor);
    }

    function onRemainderPaid(uint256 invoiceId, uint256 amount) external onlyRole(PROTOCOL_ROLE) {
        Types.Invoice storage inv = _requireInvoice(invoiceId);
        if (amount == 0 || amount != inv.outstandingToSeller) revert Errors.OverAllocation();
        inv.remainderPaidToSeller += amount;
        inv.outstandingToSeller = 0;
        emit OutstandingUpdated(invoiceId, 0, inv.remainderPaidToSeller, inv.financedPaidToInvestor);
        _trySettle(invoiceId, inv);
    }

    function onInvestorRepaid(uint256 invoiceId, uint256 amount) external onlyRole(PROTOCOL_ROLE) {
        Types.Invoice storage inv = _requireInvoice(invoiceId);
        if (amount == 0) revert Errors.ZeroAmount();
        inv.financedPaidToInvestor += amount;
        emit OutstandingUpdated(invoiceId, inv.outstandingToSeller, inv.remainderPaidToSeller, inv.financedPaidToInvestor);
        _trySettle(invoiceId, inv);
    }

    function getInvoice(uint256 invoiceId) external view returns (Types.Invoice memory) {
        Types.Invoice memory inv = _invoices[invoiceId];
        if (inv.seller == address(0)) revert Errors.InvoiceNotFound();
        return inv;
    }

    function _trySettle(uint256 invoiceId, Types.Invoice storage inv) internal {
        if (inv.status == Types.InvoiceStatus.Settled) return;
        if (inv.outstandingToSeller != 0) return;
        if (inv.investorReceivable != 0 && inv.financedPaidToInvestor < inv.investorReceivable) return;
        inv.status = Types.InvoiceStatus.Settled;
        emit InvoiceSettled(invoiceId);
    }

    function _requireInvoice(uint256 invoiceId) internal view returns (Types.Invoice storage inv) {
        inv = _invoices[invoiceId];
        if (inv.seller == address(0)) revert Errors.InvoiceNotFound();
    }

    function _requireConfirmed(uint256 invoiceId) internal view returns (Types.Invoice storage inv) {
        inv = _requireInvoice(invoiceId);
        if (inv.status != Types.InvoiceStatus.BuyerConfirmed) revert Errors.InvoiceNotConfirmed();
    }
}
