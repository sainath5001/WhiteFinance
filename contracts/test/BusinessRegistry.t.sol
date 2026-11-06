// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {BaseTest} from "./Base.t.sol";
import {Constants} from "../src/libraries/Constants.sol";
import {Errors} from "../src/libraries/Errors.sol";
import {Types} from "../src/libraries/Types.sol";

contract BusinessRegistryTest is BaseTest {
    function test_registerAndRead() public view {
        Types.Business memory b = registry.getBusiness(merchant);
        assertEq(b.account, merchant);
        assertTrue(b.active);
        assertEq(b.roles, Constants.ROLE_MERCHANT);
        assertEq(b.payoutAddress, merchant);
        assertTrue(registry.hasBusinessRole(merchant, Constants.ROLE_MERCHANT));
        assertFalse(registry.hasBusinessRole(merchant, Constants.ROLE_SELLER));
    }

    function test_registerMultipleRoles() public {
        address multi = makeAddr("multi");
        vm.prank(multi);
        registry.register("Northwind", Constants.ROLE_MERCHANT | Constants.ROLE_SELLER, address(0), "https://example.test/hook");
        assertTrue(registry.hasBusinessRole(multi, Constants.ROLE_MERCHANT));
        assertTrue(registry.hasBusinessRole(multi, Constants.ROLE_SELLER));
        assertEq(registry.payoutAddress(multi), multi);
    }

    function test_revertDuplicateRegister() public {
        vm.prank(merchant);
        vm.expectRevert(Errors.AlreadyRegistered.selector);
        registry.register("x", Constants.ROLE_MERCHANT, merchant, "");
    }

    function test_revertEmptyName() public {
        vm.prank(stranger);
        vm.expectRevert(Errors.DisplayNameEmpty.selector);
        registry.register("", Constants.ROLE_BUYER, stranger, "");
    }

    function test_revertBadRoleMask() public {
        vm.prank(stranger);
        vm.expectRevert(Errors.InvalidRoleMask.selector);
        registry.register("x", 0, stranger, "");
        vm.prank(stranger);
        vm.expectRevert(Errors.InvalidRoleMask.selector);
        registry.register("x", 16, stranger, "");
    }

    function test_updateProfile() public {
        address payout = makeAddr("payout");
        vm.prank(merchant);
        registry.updateProfile("Renamed", Constants.ROLE_MERCHANT | Constants.ROLE_INVESTOR, payout, "");
        Types.Business memory b = registry.getBusiness(merchant);
        assertEq(b.displayName, "Renamed");
        assertEq(b.payoutAddress, payout);
        assertTrue(registry.hasBusinessRole(merchant, Constants.ROLE_INVESTOR));
    }

    function test_adminFreeze() public {
        vm.prank(admin);
        registry.setActive(merchant, false);
        assertFalse(registry.isActive(merchant));
        assertFalse(registry.hasBusinessRole(merchant, Constants.ROLE_MERCHANT));
        vm.prank(merchant);
        vm.expectRevert(Errors.BusinessInactive.selector);
        registry.updateProfile("x", Constants.ROLE_MERCHANT, merchant, "");
    }

    function test_strangerCannotFreeze() public {
        vm.prank(stranger);
        vm.expectRevert();
        registry.setActive(merchant, false);
    }

    function test_pauseBlocksRegister() public {
        vm.prank(admin);
        registry.pause();
        vm.prank(stranger);
        vm.expectRevert();
        registry.register("x", Constants.ROLE_BUYER, stranger, "");
    }

    function test_revertNative() public {
        vm.expectRevert(Errors.NativeTokenNotAccepted.selector);
        payable(address(registry)).transfer(1);
    }

    function testFuzz_registerRoles(uint8 roles) public {
        roles = uint8(bound(roles, 1, Constants.ROLE_ALL));
        address a = makeAddr(string.concat("fuzz-", vm.toString(roles)));
        vm.prank(a);
        registry.register("fuzz", roles, a, "");
        assertTrue(registry.hasBusinessRole(a, roles));
    }
}
