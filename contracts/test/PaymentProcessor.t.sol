// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {BaseTest} from "./Base.t.sol";
import {Errors} from "../src/libraries/Errors.sol";
import {Types} from "../src/libraries/Types.sol";

contract PaymentProcessorTest is BaseTest {
    function test_createPayRefundPartialThenFull() public {
        vm.prank(merchant);
        uint256 id = processor.createIntent(bytes32("PO-1042"), PAY_AMOUNT, address(0), uint64(block.timestamp + 30 minutes));

        vm.startPrank(customer);
        usdt.approve(address(processor), PAY_AMOUNT);
        processor.pay(id);
        vm.stopPrank();

        assertEq(usdt.balanceOf(merchant), 1_000_000e6 + PAY_AMOUNT);
        assertEq(usdt.balanceOf(address(processor)), 0);
        Types.PaymentIntent memory intent = processor.getIntent(id);
        assertEq(uint8(intent.status), uint8(Types.IntentStatus.Settled));
        assertEq(intent.paidAmount, PAY_AMOUNT);

        vm.startPrank(merchant);
        usdt.approve(address(processor), PAY_AMOUNT);
        processor.refund(id, 10e6);
        intent = processor.getIntent(id);
        assertEq(uint8(intent.status), uint8(Types.IntentStatus.PartiallyRefunded));
        processor.refund(id, 15e6);
        vm.stopPrank();
        intent = processor.getIntent(id);
        assertEq(uint8(intent.status), uint8(Types.IntentStatus.Refunded));
        assertEq(intent.refundedAmount, PAY_AMOUNT);
        assertEq(usdt.balanceOf(address(processor)), 0);
    }

    function test_duplicateOrderRef() public {
        vm.startPrank(merchant);
        processor.createIntent(bytes32("PO-1"), PAY_AMOUNT, address(0), uint64(block.timestamp + 1 hours));
        vm.expectRevert(Errors.DuplicateOrderRef.selector);
        processor.createIntent(bytes32("PO-1"), PAY_AMOUNT, address(0), uint64(block.timestamp + 1 hours));
        vm.stopPrank();
    }

    function test_boundPayer() public {
        vm.prank(merchant);
        uint256 id = processor.createIntent(bytes32("PO-2"), PAY_AMOUNT, customer, uint64(block.timestamp + 1 hours));
        vm.startPrank(stranger);
        usdt.mint(stranger, PAY_AMOUNT);
        usdt.approve(address(processor), PAY_AMOUNT);
        vm.expectRevert(Errors.PayerMismatch.selector);
        processor.pay(id);
        vm.stopPrank();
    }

    function test_doublePayReverts() public {
        uint256 id = _paid();
        vm.startPrank(customer);
        usdt.approve(address(processor), PAY_AMOUNT);
        vm.expectRevert(Errors.IntentNotCreated.selector);
        processor.pay(id);
        vm.stopPrank();
    }

    function test_refundExceedsPaid() public {
        uint256 id = _paid();
        vm.startPrank(merchant);
        usdt.approve(address(processor), PAY_AMOUNT + 1);
        vm.expectRevert(Errors.RefundExceedsPaid.selector);
        processor.refund(id, PAY_AMOUNT + 1);
        vm.stopPrank();
    }

    function test_nonMerchantCannotRefund() public {
        uint256 id = _paid();
        vm.prank(stranger);
        vm.expectRevert(Errors.Unauthorized.selector);
        processor.refund(id, 1);
    }

    function test_cancelAndExpire() public {
        vm.prank(merchant);
        uint256 id = processor.createIntent(bytes32("PO-3"), PAY_AMOUNT, address(0), uint64(block.timestamp + 10));
        vm.prank(merchant);
        processor.cancelIntent(id);
        vm.prank(customer);
        vm.expectRevert(Errors.IntentNotCreated.selector);
        processor.pay(id);

        vm.prank(merchant);
        uint256 id2 = processor.createIntent(bytes32("PO-4"), PAY_AMOUNT, address(0), uint64(block.timestamp + 10));
        vm.warp(block.timestamp + 11);
        processor.expireIntent(id2);
        vm.expectRevert(Errors.IntentNotCreated.selector);
        vm.prank(customer);
        processor.pay(id2);
    }

    function test_gaslessSettle() public {
        vm.prank(merchant);
        uint256 id = processor.createIntent(bytes32("PO-G"), PAY_AMOUNT, address(0), uint64(block.timestamp + 1 hours));
        bytes32 nonce = keccak256("nonce-1");
        uint256 validBefore = block.timestamp + 10 minutes;
        bytes memory sig = _signReceive(customerPk, customer, address(processor), PAY_AMOUNT, 0, validBefore, nonce);

        Types.ReceiveAuthorization memory auth = Types.ReceiveAuthorization({
            from: customer,
            to: address(processor),
            value: PAY_AMOUNT,
            validAfter: 0,
            validBefore: validBefore,
            nonce: nonce,
            signature: sig
        });

        uint256 merchantBefore = usdt.balanceOf(merchant);
        vm.prank(stranger);
        processor.settleWithAuthorization(id, auth);
        assertEq(usdt.balanceOf(merchant), merchantBefore + PAY_AMOUNT);
        assertEq(usdt.balanceOf(address(processor)), 0);
        assertTrue(usdt.authorizationState(customer, nonce));
    }

    function test_gaslessReplayReverts() public {
        vm.prank(merchant);
        uint256 id = processor.createIntent(bytes32("PO-G2"), PAY_AMOUNT, address(0), uint64(block.timestamp + 1 hours));
        bytes32 nonce = keccak256("nonce-2");
        uint256 validBefore = block.timestamp + 10 minutes;
        bytes memory sig = _signReceive(customerPk, customer, address(processor), PAY_AMOUNT, 0, validBefore, nonce);
        Types.ReceiveAuthorization memory auth = Types.ReceiveAuthorization({
            from: customer,
            to: address(processor),
            value: PAY_AMOUNT,
            validAfter: 0,
            validBefore: validBefore,
            nonce: nonce,
            signature: sig
        });
        processor.settleWithAuthorization(id, auth);
        vm.prank(merchant);
        uint256 id2 = processor.createIntent(bytes32("PO-G3"), PAY_AMOUNT, address(0), uint64(block.timestamp + 1 hours));
        vm.expectRevert(Errors.AuthorizationNonceUsed.selector);
        processor.settleWithAuthorization(id2, auth);
    }

    function test_wrongRecipientAuth() public {
        vm.prank(merchant);
        uint256 id = processor.createIntent(bytes32("PO-G4"), PAY_AMOUNT, address(0), uint64(block.timestamp + 1 hours));
        bytes32 nonce = keccak256("nonce-3");
        uint256 validBefore = block.timestamp + 10 minutes;
        bytes memory sig = _signReceive(customerPk, customer, merchant, PAY_AMOUNT, 0, validBefore, nonce);
        Types.ReceiveAuthorization memory auth = Types.ReceiveAuthorization({
            from: customer,
            to: merchant,
            value: PAY_AMOUNT,
            validAfter: 0,
            validBefore: validBefore,
            nonce: nonce,
            signature: sig
        });
        vm.expectRevert(Errors.WrongTokenRecipient.selector);
        processor.settleWithAuthorization(id, auth);
    }

    function test_wrongAmountAuth() public {
        vm.prank(merchant);
        uint256 id = processor.createIntent(bytes32("PO-G5"), PAY_AMOUNT, address(0), uint64(block.timestamp + 1 hours));
        bytes32 nonce = keccak256("nonce-4");
        uint256 validBefore = block.timestamp + 10 minutes;
        bytes memory sig = _signReceive(customerPk, customer, address(processor), PAY_AMOUNT - 1, 0, validBefore, nonce);
        Types.ReceiveAuthorization memory auth = Types.ReceiveAuthorization({
            from: customer,
            to: address(processor),
            value: PAY_AMOUNT - 1,
            validAfter: 0,
            validBefore: validBefore,
            nonce: nonce,
            signature: sig
        });
        vm.expectRevert(Errors.WrongAuthorizationValue.selector);
        processor.settleWithAuthorization(id, auth);
    }

    function test_expiredAuth() public {
        vm.prank(merchant);
        uint256 id = processor.createIntent(bytes32("PO-G6"), PAY_AMOUNT, address(0), uint64(block.timestamp + 1 hours));
        bytes32 nonce = keccak256("nonce-5");
        uint256 validBefore = block.timestamp + 1;
        bytes memory sig = _signReceive(customerPk, customer, address(processor), PAY_AMOUNT, 0, validBefore, nonce);
        Types.ReceiveAuthorization memory auth = Types.ReceiveAuthorization({
            from: customer,
            to: address(processor),
            value: PAY_AMOUNT,
            validAfter: 0,
            validBefore: validBefore,
            nonce: nonce,
            signature: sig
        });
        vm.warp(validBefore);
        vm.expectRevert(Errors.AuthorizationExpired.selector);
        processor.settleWithAuthorization(id, auth);
    }

    function test_pauseStopsPay() public {
        vm.prank(merchant);
        uint256 id = processor.createIntent(bytes32("PO-P"), PAY_AMOUNT, address(0), uint64(block.timestamp + 1 hours));
        vm.prank(admin);
        processor.pause();
        vm.prank(customer);
        vm.expectRevert();
        processor.pay(id);
    }

    function test_blockedPayer() public {
        vm.prank(merchant);
        uint256 id = processor.createIntent(bytes32("PO-B"), PAY_AMOUNT, address(0), uint64(block.timestamp + 1 hours));
        usdt.setBlocked(customer, true);
        vm.startPrank(customer);
        usdt.approve(address(processor), PAY_AMOUNT);
        vm.expectRevert(Errors.TokenBlocked.selector);
        processor.pay(id);
        vm.stopPrank();
    }

    function test_nonMerchantCannotCreate() public {
        vm.prank(stranger);
        vm.expectRevert(Errors.MissingRole.selector);
        processor.createIntent(bytes32("X"), 1, address(0), uint64(block.timestamp + 1 hours));
    }

    function testFuzz_refundsNeverExceedPaid(uint256 first, uint256 second) public {
        first = bound(first, 1, PAY_AMOUNT);
        uint256 id = _paid();
        vm.startPrank(merchant);
        usdt.approve(address(processor), PAY_AMOUNT);
        processor.refund(id, first);
        uint256 remaining = PAY_AMOUNT - first;
        if (remaining == 0) {
            vm.expectRevert(
                abi.encodeWithSelector(
                    Errors.InvalidStatus.selector, uint8(Types.IntentStatus.Refunded), uint8(Types.IntentStatus.Settled)
                )
            );
            processor.refund(id, 1);
        } else {
            second = bound(second, 1, remaining);
            processor.refund(id, second);
            assertLe(processor.getIntent(id).refundedAmount, PAY_AMOUNT);
        }
        vm.stopPrank();
        assertEq(usdt.balanceOf(address(processor)), 0);
    }

    function _paid() internal returns (uint256 id) {
        vm.prank(merchant);
        id = processor.createIntent(keccak256(abi.encode(block.number, msg.sender, gasleft())), PAY_AMOUNT, address(0), uint64(block.timestamp + 1 hours));
        vm.startPrank(customer);
        usdt.approve(address(processor), PAY_AMOUNT);
        processor.pay(id);
        vm.stopPrank();
    }
}
