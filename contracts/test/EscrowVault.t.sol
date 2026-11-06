// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {BaseTest} from "./Base.t.sol";
import {Errors} from "../src/libraries/Errors.sol";

contract EscrowVaultTest is BaseTest {
    bytes32 internal id = keccak256("acct");

    function setUp() public override {
        super.setUp();
        bytes32 operatorRole = vault.OPERATOR_ROLE();
        vm.prank(admin);
        vault.grantRole(operatorRole, address(this));
    }

    function test_depositRelease() public {
        usdt.mint(address(this), 1_000e6);
        usdt.approve(address(vault), 1_000e6);
        vault.openAccount(id, address(this), seller);
        vault.depositFrom(id, address(this), 400e6);
        assertEq(vault.held(id), 400e6);
        assertEq(vault.totalHeld(), 400e6);
        uint256 before = usdt.balanceOf(seller);
        uint256 released = vault.release(id);
        assertEq(released, 400e6);
        assertEq(usdt.balanceOf(seller), before + 400e6);
        assertEq(vault.totalHeld(), 0);
    }

    function test_doubleReleaseReverts() public {
        usdt.mint(address(this), 100e6);
        usdt.approve(address(vault), 100e6);
        vault.openAccount(id, address(this), seller);
        vault.depositFrom(id, address(this), 100e6);
        vault.release(id);
        vm.expectRevert(Errors.AccountClosed.selector);
        vault.release(id);
    }

    function test_refundToDepositor() public {
        usdt.mint(address(this), 50e6);
        usdt.approve(address(vault), 50e6);
        vault.openAccount(id, address(this), seller);
        vault.depositFrom(id, address(this), 50e6);
        uint256 before = usdt.balanceOf(address(this));
        vault.refund(id);
        assertEq(usdt.balanceOf(address(this)), before + 50e6);
    }

    function test_unauthorizedOperator() public {
        vm.prank(stranger);
        vm.expectRevert();
        vault.openAccount(id, investor, seller);
    }

    function test_wrongDepositor() public {
        vault.openAccount(id, investor, seller);
        vm.expectRevert(Errors.InvalidDepositor.selector);
        vault.depositFrom(id, stranger, 1);
    }

    function test_noAdminWithdraw() public {
        // There is no withdraw function. Admin pause cannot pull tokens.
        usdt.mint(address(this), 10e6);
        usdt.approve(address(vault), 10e6);
        vault.openAccount(id, address(this), seller);
        vault.depositFrom(id, address(this), 10e6);
        vm.prank(admin);
        vault.pause();
        vm.expectRevert();
        vault.release(id);
        assertEq(usdt.balanceOf(address(vault)), 10e6);
    }

    function test_sameDepositorBeneficiaryReverts() public {
        vm.expectRevert(Errors.InvalidBeneficiary.selector);
        vault.openAccount(id, seller, seller);
    }

    function test_duplicateAccount() public {
        vault.openAccount(id, investor, seller);
        vm.expectRevert(Errors.AccountExists.selector);
        vault.openAccount(id, investor, seller);
    }

    function testFuzz_depositRelease(uint256 amount) public {
        amount = bound(amount, 1, 1_000_000e6);
        usdt.mint(address(this), amount);
        usdt.approve(address(vault), amount);
        bytes32 fuzzId = keccak256(abi.encode("fuzz", amount));
        vault.openAccount(fuzzId, address(this), seller);
        vault.depositFrom(fuzzId, address(this), amount);
        assertEq(vault.held(fuzzId), amount);
        vault.release(fuzzId);
        assertEq(vault.totalHeld(), 0);
    }
}
