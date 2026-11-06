// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {BaseTest} from "./Base.t.sol";
import {Errors} from "../src/libraries/Errors.sol";
import {Types} from "../src/libraries/Types.sol";

contract SellerFinancingTest is BaseTest {
    function test_factoringHappyPathAccounting() public {
        uint256 invoiceId = _createConfirmedInvoice();
        uint64 deadline = uint64(block.timestamp + 7 days);
        vm.prank(seller);
        uint256 fid = sellerFin.requestFinancing(invoiceId, ADVANCE, DISCOUNT, deadline);

        uint256 sellerBefore = usdt.balanceOf(seller);
        uint256 invBefore = usdt.balanceOf(investor);
        vm.startPrank(investor);
        usdt.approve(address(vault), ADVANCE);
        sellerFin.fund(fid);
        vm.stopPrank();

        assertEq(usdt.balanceOf(seller), sellerBefore + ADVANCE);
        assertEq(usdt.balanceOf(investor), invBefore - ADVANCE);
        assertEq(invoices.getInvoice(invoiceId).outstandingToSeller, 0);
        assertEq(uint8(sellerFin.getPosition(fid).status), uint8(Types.FinancingStatus.Active));

        uint256 buyerBefore = usdt.balanceOf(buyer);
        vm.startPrank(buyer);
        usdt.approve(address(vault), FACE);
        sellerFin.repay(fid);
        vm.stopPrank();

        assertEq(usdt.balanceOf(buyer), buyerBefore - FACE);
        assertEq(usdt.balanceOf(investor), invBefore - ADVANCE + FACE);
        assertEq(usdt.balanceOf(address(vault)), 0);
        assertEq(uint8(invoices.getInvoice(invoiceId).status), uint8(Types.InvoiceStatus.Settled));
        assertEq(uint8(sellerFin.getPosition(fid).status), uint8(Types.FinancingStatus.Repaid));
        // Investor profit = 5,000
        assertEq(usdt.balanceOf(investor), invBefore + DISCOUNT);
    }

    function test_requiresBuyerConfirmation() public {
        uint256 id = _createInvoice(FACE, uint64(block.timestamp + 30 days), keccak256("d"), bytes32("N"));
        vm.prank(seller);
        vm.expectRevert(Errors.InvoiceNotConfirmed.selector);
        sellerFin.requestFinancing(id, ADVANCE, DISCOUNT, uint64(block.timestamp + 7 days));
    }

    function test_advancePlusDiscountMustEqualFace() public {
        uint256 id = _createConfirmedInvoice();
        vm.prank(seller);
        vm.expectRevert(Errors.InvalidDiscount.selector);
        sellerFin.requestFinancing(id, ADVANCE, 1, uint64(block.timestamp + 7 days));
    }

    function test_onlyInvestorWithRoleCanFund() public {
        uint256 id = _createConfirmedInvoice();
        vm.prank(seller);
        uint256 fid = sellerFin.requestFinancing(id, ADVANCE, DISCOUNT, uint64(block.timestamp + 7 days));
        vm.prank(stranger);
        vm.expectRevert(Errors.MissingRole.selector);
        sellerFin.fund(fid);
    }

    function test_doubleFundReverts() public {
        uint256 id = _createConfirmedInvoice();
        vm.prank(seller);
        uint256 fid = sellerFin.requestFinancing(id, ADVANCE, DISCOUNT, uint64(block.timestamp + 7 days));
        vm.startPrank(investor);
        usdt.approve(address(vault), ADVANCE * 2);
        sellerFin.fund(fid);
        vm.expectRevert(abi.encodeWithSelector(Errors.InvalidStatus.selector, uint8(Types.FinancingStatus.Active), uint8(Types.FinancingStatus.Requested)));
        sellerFin.fund(fid);
        vm.stopPrank();
    }

    function test_doubleRepayReverts() public {
        uint256 fid = _funded();
        vm.startPrank(buyer);
        usdt.approve(address(vault), FACE * 2);
        sellerFin.repay(fid);
        vm.expectRevert(abi.encodeWithSelector(Errors.InvalidStatus.selector, uint8(Types.FinancingStatus.Repaid), uint8(Types.FinancingStatus.Active)));
        sellerFin.repay(fid);
        vm.stopPrank();
    }

    function test_overdueDefaultThenRepay() public {
        uint256 fid = _funded();
        vm.warp(block.timestamp + 61 days);
        sellerFin.markOverdue(fid);
        vm.expectRevert(Errors.GraceNotElapsed.selector);
        sellerFin.markDefaulted(fid);
        vm.warp(block.timestamp + 14 days + 1);
        sellerFin.markDefaulted(fid);
        assertEq(uint8(sellerFin.getPosition(fid).status), uint8(Types.FinancingStatus.Defaulted));
        vm.startPrank(buyer);
        usdt.approve(address(vault), FACE);
        sellerFin.repay(fid);
        vm.stopPrank();
        assertEq(uint8(sellerFin.getPosition(fid).status), uint8(Types.FinancingStatus.Repaid));
    }

    function test_disputeBlocksRepay() public {
        uint256 fid = _funded();
        vm.prank(seller);
        sellerFin.raiseDispute(fid);
        vm.startPrank(buyer);
        usdt.approve(address(vault), FACE);
        vm.expectRevert(abi.encodeWithSelector(Errors.InvalidStatus.selector, uint8(Types.FinancingStatus.Disputed), uint8(Types.FinancingStatus.Active)));
        sellerFin.repay(fid);
        vm.stopPrank();
        vm.prank(admin);
        sellerFin.resolveDispute(fid);
        vm.startPrank(buyer);
        sellerFin.repay(fid);
        vm.stopPrank();
    }

    function test_strangerCannotDispute() public {
        uint256 fid = _funded();
        vm.prank(stranger);
        vm.expectRevert(Errors.NotParty.selector);
        sellerFin.raiseDispute(fid);
    }

    function test_expireUnfunded() public {
        uint256 id = _createConfirmedInvoice();
        vm.prank(seller);
        uint256 fid = sellerFin.requestFinancing(id, ADVANCE, DISCOUNT, uint64(block.timestamp + 1 days));
        vm.warp(block.timestamp + 2 days);
        sellerFin.markExpired(fid);
        assertEq(invoices.getInvoice(id).sellerFinancingId, 0);
    }

    function test_cancelBeforeFund() public {
        uint256 id = _createConfirmedInvoice();
        vm.prank(seller);
        uint256 fid = sellerFin.requestFinancing(id, ADVANCE, DISCOUNT, uint64(block.timestamp + 7 days));
        vm.prank(seller);
        sellerFin.cancelRequest(fid);
        vm.prank(investor);
        vm.expectRevert();
        sellerFin.fund(fid);
    }

    function _funded() internal returns (uint256 fid) {
        uint256 id = _createConfirmedInvoice();
        vm.prank(seller);
        fid = sellerFin.requestFinancing(id, ADVANCE, DISCOUNT, uint64(block.timestamp + 7 days));
        vm.startPrank(investor);
        usdt.approve(address(vault), ADVANCE);
        sellerFin.fund(fid);
        vm.stopPrank();
    }
}
