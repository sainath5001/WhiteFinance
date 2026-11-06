// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {WhiteFinanceAccess} from "./internal/WhiteFinanceAccess.sol";
import {Constants} from "./libraries/Constants.sol";
import {Errors} from "./libraries/Errors.sol";
import {Types} from "./libraries/Types.sol";
import {IBusinessRegistry} from "./interfaces/IBusinessRegistry.sol";
import {IInvoiceRegistry} from "./interfaces/IInvoiceRegistry.sol";
import {IEscrowVault} from "./interfaces/IEscrowVault.sol";

/// @title Seller-side invoice factoring. One investor, all-or-nothing, non-transferable.
/// @dev Advance + discount must equal face value. Positions cannot be transferred.
contract SellerFinancing is WhiteFinanceAccess {
    bytes32 public constant DISPUTE_RESOLVER_ROLE = keccak256("DISPUTE_RESOLVER_ROLE");

    IBusinessRegistry public immutable businessRegistry;
    IInvoiceRegistry public immutable invoiceRegistry;
    IEscrowVault public immutable vault;

    uint256 public gracePeriod;
    uint256 public positionCount;
    mapping(uint256 => Types.SellerPosition) private _positions;

    event FinancingRequested(
        uint256 indexed financingId,
        uint256 indexed invoiceId,
        address indexed seller,
        uint256 advanceAmount,
        uint256 discountAmount,
        uint64 fundingDeadline
    );
    event FinancingCancelled(uint256 indexed financingId);
    event FinancingExpired(uint256 indexed financingId);
    event FinancingFunded(
        uint256 indexed financingId, address indexed investor, uint256 advanceAmount, uint256 faceValue
    );
    event ReceivableAssigned(uint256 indexed invoiceId, address indexed investor, uint256 amount);
    event Repaid(uint256 indexed financingId, address indexed payer, address indexed investor, uint256 amount);
    event MarkedOverdue(uint256 indexed financingId);
    event MarkedDefaulted(uint256 indexed financingId);
    event DisputeRaised(uint256 indexed financingId, address indexed by);
    event DisputeResolved(uint256 indexed financingId, Types.FinancingStatus newStatus);
    event GracePeriodUpdated(uint256 gracePeriod);

    constructor(address admin, address businessRegistry_, address invoiceRegistry_, address vault_, uint256 gracePeriod_)
        WhiteFinanceAccess(admin)
    {
        if (businessRegistry_ == address(0) || invoiceRegistry_ == address(0) || vault_ == address(0)) {
            revert Errors.ZeroAddress();
        }
        _setGrace(gracePeriod_);
        businessRegistry = IBusinessRegistry(businessRegistry_);
        invoiceRegistry = IInvoiceRegistry(invoiceRegistry_);
        vault = IEscrowVault(vault_);
        _grantRole(DISPUTE_RESOLVER_ROLE, admin);
    }

    /// @notice Seller requests full-face factoring. Requires buyer-confirmed invoice.
    function requestFinancing(uint256 invoiceId, uint256 advanceAmount, uint256 discountAmount, uint64 fundingDeadline)
        external
        whenNotPaused
        returns (uint256 financingId)
    {
        if (!businessRegistry.hasBusinessRole(msg.sender, Constants.ROLE_SELLER)) revert Errors.MissingRole();
        Types.Invoice memory inv = invoiceRegistry.getInvoice(invoiceId);
        if (inv.seller != msg.sender) revert Errors.NotSeller();
        if (inv.status != Types.InvoiceStatus.BuyerConfirmed) revert Errors.InvoiceNotConfirmed();
        if (advanceAmount == 0 || advanceAmount > inv.faceValue) revert Errors.InvalidAdvance();
        if (advanceAmount + discountAmount != inv.faceValue) revert Errors.InvalidDiscount();
        if (fundingDeadline <= block.timestamp || fundingDeadline > inv.dueDate) revert Errors.InvalidFundingDeadline();

        financingId = ++positionCount;
        _positions[financingId] = Types.SellerPosition({
            invoiceId: invoiceId,
            seller: inv.seller,
            buyer: inv.buyer,
            investor: address(0),
            faceValue: inv.faceValue,
            advanceAmount: advanceAmount,
            discountAmount: discountAmount,
            dueDate: inv.dueDate,
            fundingDeadline: fundingDeadline,
            gracePeriod: uint64(gracePeriod),
            status: Types.FinancingStatus.Requested,
            statusBeforeDispute: Types.FinancingStatus.None,
            repaid: false
        });

        invoiceRegistry.attachSellerFinancing(invoiceId, financingId);
        emit FinancingRequested(financingId, invoiceId, msg.sender, advanceAmount, discountAmount, fundingDeadline);
    }

    /// @notice Seller cancels an unfunded request.
    function cancelRequest(uint256 financingId) external whenNotPaused {
        Types.SellerPosition storage p = _require(financingId);
        if (msg.sender != p.seller) revert Errors.NotSeller();
        if (p.status != Types.FinancingStatus.Requested) {
            revert Errors.InvalidStatus(uint8(p.status), uint8(Types.FinancingStatus.Requested));
        }
        p.status = Types.FinancingStatus.Cancelled;
        invoiceRegistry.detachFinancing(p.invoiceId, true);
        emit FinancingCancelled(financingId);
    }

    /// @notice Investor funds the full advance through escrow, which releases to the seller in this transaction.
    function fund(uint256 financingId) external nonReentrant whenNotPaused {
        Types.SellerPosition storage p = _require(financingId);
        if (p.status != Types.FinancingStatus.Requested) {
            revert Errors.InvalidStatus(uint8(p.status), uint8(Types.FinancingStatus.Requested));
        }
        if (block.timestamp > p.fundingDeadline) revert Errors.IntentExpired();
        if (!businessRegistry.hasBusinessRole(msg.sender, Constants.ROLE_INVESTOR)) revert Errors.MissingRole();

        p.investor = msg.sender;
        p.status = Types.FinancingStatus.Active;

        bytes32 accountId = _advanceId(financingId);
        vault.openAccount(accountId, msg.sender, p.seller);
        vault.depositFrom(accountId, msg.sender, p.advanceAmount);
        vault.release(accountId);

        invoiceRegistry.onSellerFactoringFunded(p.invoiceId);
        emit FinancingFunded(financingId, msg.sender, p.advanceAmount, p.faceValue);
        emit ReceivableAssigned(p.invoiceId, msg.sender, p.faceValue);
    }

    /// @notice Buyer (or anyone on their behalf) repays face value to the investor via escrow.
    function repay(uint256 financingId) external nonReentrant whenNotPaused {
        Types.SellerPosition storage p = _require(financingId);
        _requireRepayable(p);
        if (p.repaid) revert Errors.InvestorAlreadyRepaid();

        p.repaid = true;
        p.status = Types.FinancingStatus.Repaid;

        bytes32 accountId = _repayId(financingId);
        vault.openAccount(accountId, msg.sender, p.investor);
        vault.depositFrom(accountId, msg.sender, p.faceValue);
        vault.release(accountId);

        invoiceRegistry.onInvestorRepaid(p.invoiceId, p.faceValue);
        emit Repaid(financingId, msg.sender, p.investor, p.faceValue);
    }

    function markExpired(uint256 financingId) external whenNotPaused {
        Types.SellerPosition storage p = _require(financingId);
        if (p.status != Types.FinancingStatus.Requested) {
            revert Errors.InvalidStatus(uint8(p.status), uint8(Types.FinancingStatus.Requested));
        }
        if (block.timestamp <= p.fundingDeadline) revert Errors.StillCurrent();
        p.status = Types.FinancingStatus.Expired;
        invoiceRegistry.detachFinancing(p.invoiceId, true);
        emit FinancingExpired(financingId);
    }

    function markOverdue(uint256 financingId) external whenNotPaused {
        Types.SellerPosition storage p = _require(financingId);
        if (p.status != Types.FinancingStatus.Active) {
            revert Errors.InvalidStatus(uint8(p.status), uint8(Types.FinancingStatus.Active));
        }
        if (block.timestamp <= p.dueDate) revert Errors.StillCurrent();
        p.status = Types.FinancingStatus.Overdue;
        emit MarkedOverdue(financingId);
    }

    function markDefaulted(uint256 financingId) external whenNotPaused {
        Types.SellerPosition storage p = _require(financingId);
        if (p.status != Types.FinancingStatus.Overdue) revert Errors.NotOverdue();
        if (block.timestamp <= uint256(p.dueDate) + p.gracePeriod) revert Errors.GraceNotElapsed();
        p.status = Types.FinancingStatus.Defaulted;
        emit MarkedDefaulted(financingId);
    }

    /// @notice Seller, buyer, or investor may flag a dispute. Does not claw back a released advance.
    function raiseDispute(uint256 financingId) external whenNotPaused {
        Types.SellerPosition storage p = _require(financingId);
        if (msg.sender != p.seller && msg.sender != p.buyer && msg.sender != p.investor) revert Errors.NotParty();
        if (p.status != Types.FinancingStatus.Active && p.status != Types.FinancingStatus.Overdue) {
            revert Errors.InvalidStatus(uint8(p.status), uint8(Types.FinancingStatus.Active));
        }
        p.statusBeforeDispute = p.status;
        p.status = Types.FinancingStatus.Disputed;
        emit DisputeRaised(financingId, msg.sender);
    }

    /// @notice Admin clears a dispute. No token movement.
    function resolveDispute(uint256 financingId) external onlyRole(DISPUTE_RESOLVER_ROLE) {
        Types.SellerPosition storage p = _require(financingId);
        if (p.status != Types.FinancingStatus.Disputed) revert Errors.NotDisputed();
        Types.FinancingStatus restored =
            block.timestamp > p.dueDate ? Types.FinancingStatus.Overdue : Types.FinancingStatus.Active;
        p.status = restored;
        emit DisputeResolved(financingId, restored);
    }

    function setGracePeriod(uint256 gracePeriod_) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _setGrace(gracePeriod_);
    }

    function getPosition(uint256 financingId) external view returns (Types.SellerPosition memory) {
        Types.SellerPosition memory p = _positions[financingId];
        if (p.seller == address(0)) revert Errors.FinancingNotFound();
        return p;
    }

    function _require(uint256 financingId) internal view returns (Types.SellerPosition storage p) {
        p = _positions[financingId];
        if (p.seller == address(0)) revert Errors.FinancingNotFound();
    }

    function _requireRepayable(Types.SellerPosition storage p) internal view {
        if (
            p.status != Types.FinancingStatus.Active && p.status != Types.FinancingStatus.Overdue
                && p.status != Types.FinancingStatus.Defaulted
        ) {
            revert Errors.InvalidStatus(uint8(p.status), uint8(Types.FinancingStatus.Active));
        }
    }

    function _setGrace(uint256 gracePeriod_) internal {
        if (gracePeriod_ < Constants.MIN_GRACE_PERIOD || gracePeriod_ > Constants.MAX_GRACE_PERIOD) {
            revert Errors.InvalidGracePeriod();
        }
        gracePeriod = gracePeriod_;
        emit GracePeriodUpdated(gracePeriod_);
    }

    function _advanceId(uint256 financingId) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked("SF_ADVANCE", financingId));
    }

    function _repayId(uint256 financingId) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked("SF_REPAY", financingId));
    }
}
