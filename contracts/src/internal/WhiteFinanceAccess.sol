// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Errors} from "../libraries/Errors.sol";

/// @dev Shared admin, pause, reentrancy, and native-token rejection.
abstract contract WhiteFinanceAccess is AccessControl, Pausable, ReentrancyGuard {
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");

    constructor(address admin) {
        if (admin == address(0)) revert Errors.ZeroAddress();
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(PAUSER_ROLE, admin);
    }

    /// @notice Pause user-facing state changes.
    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }

    /// @notice Resume user-facing state changes.
    function unpause() external onlyRole(PAUSER_ROLE) {
        _unpause();
    }

    receive() external payable {
        revert Errors.NativeTokenNotAccepted();
    }

    fallback() external payable {
        revert Errors.NativeTokenNotAccepted();
    }
}
