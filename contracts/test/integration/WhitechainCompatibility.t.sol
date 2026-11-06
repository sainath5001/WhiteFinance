// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {IPrizeUSDT} from "../../src/interfaces/IPrizeUSDT.sol";
import {Constants} from "../../src/libraries/Constants.sol";

/// @notice Live Whitechain checks. Skipped unless WHITECHAIN_SEPOLIA_RPC_URL is set.
/// @dev Does not send transactions. Read-only verification of prize USDT.
contract WhitechainCompatibilityTest is Test {
    function test_prizeUsdtMetadata() public {
        string memory rpc = vm.envOr("WHITECHAIN_SEPOLIA_RPC_URL", string(""));
        if (bytes(rpc).length == 0) {
            vm.skip(true);
            return;
        }
        vm.createSelectFork(rpc);
        IPrizeUSDT usdt = IPrizeUSDT(Constants.PRIZE_USDT);
        assertEq(usdt.decimals(), 6);
        assertEq(usdt.DOMAIN_SEPARATOR() != bytes32(0), true);
        assertEq(usdt.authorizationState(address(this), bytes32(0)), false);
    }
}
