// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title Protocol constants
library Constants {
    uint256 internal constant DEFAULT_GRACE_PERIOD = 14 days;
    uint256 internal constant MIN_GRACE_PERIOD = 1 days;
    uint256 internal constant MAX_GRACE_PERIOD = 90 days;
    uint256 internal constant MAX_DISPLAY_NAME = 64;
    uint256 internal constant MAX_WEBHOOK_URL = 256;

    uint8 internal constant ROLE_MERCHANT = 1;
    uint8 internal constant ROLE_SELLER = 2;
    uint8 internal constant ROLE_BUYER = 4;
    uint8 internal constant ROLE_INVESTOR = 8;
    uint8 internal constant ROLE_ALL = 15;

    /// @notice Official prize USDT on Whitechain Sepolia. Deploy scripts pass this address.
    address internal constant PRIZE_USDT = 0xcedfB56113143d55b2358b8CFbB0dEB5Ad2f55a7;
    uint256 internal constant WHITECHAIN_SEPOLIA_CHAIN_ID = 1874;
}
