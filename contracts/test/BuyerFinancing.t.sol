// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {BaseTest} from "./Base.t.sol";
import {Errors} from "../src/libraries/Errors.sol";
import {Types} from "../src/libraries/Types.sol";

contract BuyerFinancingTest is BaseTest {
    function test_noDoubleCountOfPrincipal() public {
        uint256 id = _createConfirmedInvoice();
        vm.prank(buyer);
        uint256 fid = buyerFin.requestFinancing(id, PRINCIPAL, FEE, uint64(block.timestamp + 7 days));

        uint256 sellerBefore = usdt.balanceOf(seller);
        vm.startPrank(investor);
        usdt.approve(address(vault), PRINCIPAL);
        buyerFin.fund(fid);
        vm.stopPrank();

        Types.Invoice memory inv = invoices.getInvoice(id);
        assertEq(usdt.balanceOf(seller), sellerBefore + PRINCIPAL);
        assertEq(inv.outstandingToSeller, REMAINDER);
        assertEq(inv.investorReceivable, PRINCIPAL + FEE);
        // Seller is NOT still owed 100,000
        assertEq(inv.outstandingToSeller + PRINCIPAL, FACE);

        vm.startPrank(buyer);
        usdt.approve(address(vault), REMAINDER + PRINCIPAL + FEE);
        buyerFin.payRemainder(fid);
        buyerFin.repay(fid);
        vm.stopPrank();

        inv = invoices.getInvoice(id);
        assertEq(inv.outstandingToSeller, 0);
        assertEq(inv.remainderPaidToSeller, REMAINDER);
        assertEq(inv.financedPaidToInvestor, PRINCIPAL + FEE);
        assertEq(uint8(inv.status), uint8(Types.InvoiceStatus.Settled));
        assertEq(usdt.balanceOf(address(vault)), 0);
        // Buyer total outflow = 70k + 31.5k = 101.5k
        // Seller total inflow = 30k + 70k = 100k
        assertEq(usdt.balanceOf(seller), sellerBefore + FACE);
    }

    function test_repayAndRemainderOrderIndependent() public {
        uint256 fid = _funded();
        uint256 sellerBefore = usdt.balanceOf(seller);
        uint256 investorBefore = usdt.balanceOf(investor);
        vm.startPrank(buyer);
        usdt.approve(address(vault), REMAINDER + PRINCIPAL + FEE);
        buyerFin.repay(fid);
        buyerFin.payRemainder(fid);
        vm.stopPrank();
        assertEq(usdt.balanceOf(investor), investorBefore + PRINCIPAL + FEE);
        assertEq(usdt.balanceOf(seller), sellerBefore + REMAINDER);
    }

    function test_onlyBuyerRequests() public {
        uint256 id = _createConfirmedInvoice();
        vm.prank(seller);
        vm.expectRevert(Errors.MissingRole.selector);
        buyerFin.requestFinancing(id, PRINCIPAL, FEE, uint64(block.timestamp + 7 days));
    }

    function test_principalOverFaceReverts() public {
        uint256 id = _createConfirmedInvoice();
        vm.prank(buyer);
        vm.expectRevert(Errors.InvalidPrincipal.selector);
        buyerFin.requestFinancing(id, FACE + 1, 0, uint64(block.timestamp + 7 days));
    }

    function test_doubleRemainderReverts() public {
        uint256 fid = _funded();
        vm.startPrank(buyer);
        usdt.approve(address(vault), REMAINDER * 2);
        buyerFin.payRemainder(fid);
        vm.expectRevert(Errors.RemainderAlreadyPaid.selector);
        buyerFin.payRemainder(fid);
        vm.stopPrank();
    }

    function test_doubleInvestorRepayReverts() public {
        uint256 fid = _funded();
        vm.startPrank(buyer);
        usdt.approve(address(vault), (PRINCIPAL + FEE) * 2);
        buyerFin.repay(fid);
        vm.expectRevert(Errors.InvestorAlreadyRepaid.selector);
        buyerFin.repay(fid);
        vm.stopPrank();
    }

    function test_conflictWithSellerFinancing() public {
        uint256 id = _createConfirmedInvoice();
        vm.prank(buyer);
        buyerFin.requestFinancing(id, PRINCIPAL, FEE, uint64(block.timestamp + 7 days));
        vm.prank(seller);
        vm.expectRevert(Errors.FinancingConflict.selector);
        sellerFin.requestFinancing(id, ADVANCE, DISCOUNT, uint64(block.timestamp + 7 days));
    }

    function test_fundPaysSellerNotBuyer() public {
        uint256 fid;
        uint256 id = _createConfirmedInvoice();
        vm.prank(buyer);
        fid = buyerFin.requestFinancing(id, PRINCIPAL, FEE, uint64(block.timestamp + 7 days));
        uint256 buyerBefore = usdt.balanceOf(buyer);
        vm.startPrank(investor);
        usdt.approve(address(vault), PRINCIPAL);
        buyerFin.fund(fid);
        vm.stopPrank();
        assertEq(usdt.balanceOf(buyer), buyerBefore);
        Types.BuyerPosition memory p = buyerFin.getPosition(fid);
        assertEq(p.sellerRemainder, REMAINDER);
        assertEq(p.principal + p.sellerRemainder, FACE);
        assertEq(p.principal + p.fee, PRINCIPAL + FEE);
    }

    function _funded() internal returns (uint256 fid) {
        uint256 id = _createConfirmedInvoice();
        vm.prank(buyer);
        fid = buyerFin.requestFinancing(id, PRINCIPAL, FEE, uint64(block.timestamp + 7 days));
        vm.startPrank(investor);
        usdt.approve(address(vault), PRINCIPAL);
        buyerFin.fund(fid);
        vm.stopPrank();
    }
}
