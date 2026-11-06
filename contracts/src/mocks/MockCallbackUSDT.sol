// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {MockPrizeUSDT} from "./MockPrizeUSDT.sol";

/// @notice ERC-20 that attempts a call back into the protocol during transfers (reentrancy probe).
contract MockCallbackUSDT is MockPrizeUSDT {
    address public callbackTarget;
    bytes public callbackData;
    bool private _inCallback;

    function setCallback(address target, bytes calldata data) external {
        callbackTarget = target;
        callbackData = data;
    }

    function _update(address from, address to, uint256 value) internal override {
        super._update(from, to, value);
        if (!_inCallback && callbackTarget != address(0) && from != address(0) && to != address(0)) {
            _inCallback = true;
            (bool ok,) = callbackTarget.call(callbackData);
            _inCallback = false;
            require(ok, "callback failed");
        }
    }
}
