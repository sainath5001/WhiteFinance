// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {WhiteFinanceAccess} from "./internal/WhiteFinanceAccess.sol";
import {Constants} from "./libraries/Constants.sol";
import {Errors} from "./libraries/Errors.sol";
import {Types} from "./libraries/Types.sol";
import {IBusinessRegistry} from "./interfaces/IBusinessRegistry.sol";

/// @title Business identity registry for merchants, sellers, buyers, and investors.
/// @dev Self-registration of public demo profiles. Admin may freeze accounts, not seize funds.
contract BusinessRegistry is WhiteFinanceAccess, IBusinessRegistry {
    mapping(address => Types.Business) private _businesses;

    event BusinessRegistered(
        address indexed account, string displayName, uint8 roles, address payoutAddress, string webhookUrl
    );
    event BusinessUpdated(
        address indexed account, string displayName, uint8 roles, address payoutAddress, string webhookUrl
    );
    event BusinessStatusChanged(address indexed account, bool active);

    constructor(address admin) WhiteFinanceAccess(admin) {}

    /// @notice Register the caller as a business with one or more roles.
    function register(string calldata displayName, uint8 roles, address payoutAddress_, string calldata webhookUrl)
        external
        whenNotPaused
    {
        if (_businesses[msg.sender].account != address(0)) revert Errors.AlreadyRegistered();
        _validateProfile(displayName, roles, payoutAddress_, webhookUrl);

        address payout = payoutAddress_ == address(0) ? msg.sender : payoutAddress_;
        _businesses[msg.sender] = Types.Business({
            account: msg.sender,
            displayName: displayName,
            roles: roles,
            payoutAddress: payout,
            active: true,
            webhookUrl: webhookUrl,
            createdAt: uint64(block.timestamp),
            updatedAt: uint64(block.timestamp)
        });

        emit BusinessRegistered(msg.sender, displayName, roles, payout, webhookUrl);
    }

    /// @notice Update the caller's public profile. Cannot un-freeze a frozen account.
    function updateProfile(
        string calldata displayName,
        uint8 roles,
        address payoutAddress_,
        string calldata webhookUrl
    ) external whenNotPaused {
        Types.Business storage b = _requireRegistered(msg.sender);
        if (!b.active) revert Errors.BusinessInactive();
        _validateProfile(displayName, roles, payoutAddress_, webhookUrl);

        address payout = payoutAddress_ == address(0) ? msg.sender : payoutAddress_;
        b.displayName = displayName;
        b.roles = roles;
        b.payoutAddress = payout;
        b.webhookUrl = webhookUrl;
        b.updatedAt = uint64(block.timestamp);

        emit BusinessUpdated(msg.sender, displayName, roles, payout, webhookUrl);
    }

    /// @notice Freeze or unfreeze an account. Does not move tokens.
    function setActive(address account, bool active) external onlyRole(DEFAULT_ADMIN_ROLE) {
        Types.Business storage b = _requireRegistered(account);
        b.active = active;
        b.updatedAt = uint64(block.timestamp);
        emit BusinessStatusChanged(account, active);
    }

    function getBusiness(address account) external view returns (Types.Business memory) {
        return _businesses[account];
    }

    function isActive(address account) public view returns (bool) {
        return _businesses[account].active;
    }

    function hasBusinessRole(address account, uint8 role) public view returns (bool) {
        Types.Business storage b = _businesses[account];
        return b.active && role != 0 && (b.roles & role) == role;
    }

    function payoutAddress(address account) external view returns (address) {
        Types.Business storage b = _businesses[account];
        if (b.account == address(0) || !b.active) revert Errors.BusinessInactive();
        return b.payoutAddress;
    }

    function _requireRegistered(address account) internal view returns (Types.Business storage b) {
        b = _businesses[account];
        if (b.account == address(0)) revert Errors.BusinessNotRegistered();
    }

    function _validateProfile(
        string calldata displayName,
        uint8 roles,
        address payoutAddress_,
        string calldata webhookUrl
    ) internal view {
        uint256 nameLen = bytes(displayName).length;
        if (nameLen == 0) revert Errors.DisplayNameEmpty();
        if (nameLen > Constants.MAX_DISPLAY_NAME) revert Errors.DisplayNameTooLong();
        if (roles == 0 || roles > Constants.ROLE_ALL) revert Errors.InvalidRoleMask();
        if (payoutAddress_ == address(this)) revert Errors.ZeroAddress();
        if (bytes(webhookUrl).length > Constants.MAX_WEBHOOK_URL) revert Errors.WebhookUrlTooLong();
    }
}
