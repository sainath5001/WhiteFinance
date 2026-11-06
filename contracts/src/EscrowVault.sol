// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {WhiteFinanceAccess} from "./internal/WhiteFinanceAccess.sol";
import {Errors} from "./libraries/Errors.sol";
import {IEscrowVault} from "./interfaces/IEscrowVault.sol";

/// @title USDT escrow with fixed beneficiaries and protocol-only operations.
/// @dev There is no admin withdrawal. Residual token balance besides `totalHeld` cannot be swept.
contract EscrowVault is WhiteFinanceAccess, IEscrowVault {
    using SafeERC20 for IERC20;

    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");

    struct Account {
        address opener;
        address depositor;
        address beneficiary;
        uint256 deposited;
        uint256 released;
        uint256 refunded;
        bool opened;
        bool closed;
    }

    IERC20 public immutable usdt;
    mapping(bytes32 => Account) public accounts;
    uint256 public totalHeld;

    event AccountOpened(bytes32 indexed accountId, address indexed depositor, address indexed beneficiary);
    event Deposited(bytes32 indexed accountId, address indexed from, uint256 amount);
    event Released(bytes32 indexed accountId, address indexed to, uint256 amount);
    event Refunded(bytes32 indexed accountId, address indexed to, uint256 amount);

    constructor(address admin, address usdt_) WhiteFinanceAccess(admin) {
        if (usdt_ == address(0)) revert Errors.ZeroAddress();
        usdt = IERC20(usdt_);
    }

    /// @notice Open a custody account with an immutable depositor and beneficiary.
    function openAccount(bytes32 accountId, address depositor, address beneficiary)
        external
        onlyRole(OPERATOR_ROLE)
        whenNotPaused
    {
        if (accountId == bytes32(0)) revert Errors.AccountNotFound();
        if (depositor == address(0) || beneficiary == address(0)) revert Errors.ZeroAddress();
        if (depositor == beneficiary) revert Errors.InvalidBeneficiary();
        Account storage a = accounts[accountId];
        if (a.opened) revert Errors.AccountExists();
        a.opener = msg.sender;
        a.depositor = depositor;
        a.beneficiary = beneficiary;
        a.opened = true;
        emit AccountOpened(accountId, depositor, beneficiary);
    }

    /// @notice Pull USDT from the fixed depositor into this account.
    function depositFrom(bytes32 accountId, address from, uint256 amount)
        external
        onlyRole(OPERATOR_ROLE)
        nonReentrant
        whenNotPaused
    {
        if (amount == 0) revert Errors.ZeroAmount();
        Account storage a = _live(accountId);
        if (from != a.depositor) revert Errors.InvalidDepositor();
        if (msg.sender != a.opener) revert Errors.Unauthorized();

        a.deposited += amount;
        totalHeld += amount;
        emit Deposited(accountId, from, amount);
        usdt.safeTransferFrom(from, address(this), amount);
    }

    /// @notice Send the entire held balance to the fixed beneficiary. Not callable twice.
    function release(bytes32 accountId)
        external
        onlyRole(OPERATOR_ROLE)
        nonReentrant
        whenNotPaused
        returns (uint256 amount)
    {
        Account storage a = _live(accountId);
        if (msg.sender != a.opener) revert Errors.Unauthorized();
        amount = _held(a);
        if (amount == 0) revert Errors.InsufficientEscrowBalance();

        a.released += amount;
        a.closed = true;
        totalHeld -= amount;
        emit Released(accountId, a.beneficiary, amount);
        usdt.safeTransfer(a.beneficiary, amount);
    }

    /// @notice Return remaining funds to the depositor. Cannot run after a full release.
    function refund(bytes32 accountId)
        external
        onlyRole(OPERATOR_ROLE)
        nonReentrant
        whenNotPaused
        returns (uint256 amount)
    {
        Account storage a = _live(accountId);
        if (msg.sender != a.opener) revert Errors.Unauthorized();
        amount = _held(a);
        if (amount == 0) revert Errors.InsufficientEscrowBalance();

        a.refunded += amount;
        a.closed = true;
        totalHeld -= amount;
        emit Refunded(accountId, a.depositor, amount);
        usdt.safeTransfer(a.depositor, amount);
    }

    function held(bytes32 accountId) external view returns (uint256) {
        Account storage a = accounts[accountId];
        if (!a.opened) revert Errors.AccountNotFound();
        return _held(a);
    }

    function _live(bytes32 accountId) internal view returns (Account storage a) {
        a = accounts[accountId];
        if (!a.opened) revert Errors.AccountNotFound();
        if (a.closed) revert Errors.AccountClosed();
    }

    function _held(Account storage a) internal view returns (uint256) {
        return a.deposited - a.released - a.refunded;
    }
}
