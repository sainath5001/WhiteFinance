// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {BaseTest} from "./Base.t.sol";
import {Errors} from "../src/libraries/Errors.sol";
import {Types} from "../src/libraries/Types.sol";

contract InvoiceRegistryTest is BaseTest {
    function test_createAndConfirm() public {
        uint256 id = _createConfirmedInvoice();
        Types.Invoice memory inv = invoices.getInvoice(id);
        assertEq(inv.seller, seller);
        assertEq(inv.buyer, buyer);
        assertEq(inv.faceValue, FACE);
        assertEq(inv.outstandingToSeller, FACE);
        assertEq(uint8(inv.status), uint8(Types.InvoiceStatus.BuyerConfirmed));
    }

    function test_revertDuplicateNumber() public {
        _createInvoice(FACE, uint64(block.timestamp + 10 days), keccak256("a"), bytes32("N1"));
        vm.prank(seller);
        vm.expectRevert(Errors.DuplicateInvoiceNumber.selector);
        invoices.createInvoice(buyer, bytes32("N1"), FACE, uint64(block.timestamp + 10 days), keccak256("b"), 0);
    }

    function test_revertDuplicateDocumentHash() public {
        bytes32 doc = keccak256("same");
        _createInvoice(FACE, uint64(block.timestamp + 10 days), doc, bytes32("N1"));
        vm.prank(seller);
        vm.expectRevert(Errors.DuplicateDocumentHash.selector);
        invoices.createInvoice(buyer, bytes32("N2"), FACE, uint64(block.timestamp + 10 days), doc, 0);
    }

    function test_onlyBuyerConfirms() public {
        uint256 id = _createInvoice(FACE, uint64(block.timestamp + 10 days), keccak256("d"), bytes32("N"));
        vm.prank(seller);
        vm.expectRevert(Errors.NotBuyer.selector);
        invoices.confirmInvoice(id);
        vm.prank(buyer);
        invoices.confirmInvoice(id);
    }

    function test_sellerCancelsBeforeConfirm() public {
        uint256 id = _createInvoice(FACE, uint64(block.timestamp + 10 days), keccak256("d"), bytes32("N"));
        vm.prank(seller);
        invoices.cancelInvoice(id);
        assertEq(uint8(invoices.getInvoice(id).status), uint8(Types.InvoiceStatus.Cancelled));
    }

    function test_expireUnconfirmed() public {
        uint256 id = _createInvoice(FACE, uint64(block.timestamp + 1 days), keccak256("d"), bytes32("N"));
        vm.prank(stranger);
        vm.expectRevert(Errors.StillCurrent.selector);
        invoices.expireInvoice(id);
        vm.warp(block.timestamp + 2 days);
        vm.prank(stranger);
        invoices.expireInvoice(id);
        assertEq(uint8(invoices.getInvoice(id).status), uint8(Types.InvoiceStatus.Expired));
    }

    function test_nonSellerCannotCreate() public {
        vm.prank(stranger);
        vm.expectRevert(Errors.MissingRole.selector);
        invoices.createInvoice(buyer, bytes32("N"), FACE, uint64(block.timestamp + 1), keccak256("d"), 0);
    }

    function test_cannotCancelWithFinancing() public {
        uint256 id = _createConfirmedInvoice();
        vm.prank(seller);
        sellerFin.requestFinancing(id, ADVANCE, DISCOUNT, uint64(block.timestamp + 7 days));
        vm.prank(seller);
        vm.expectRevert(Errors.FinancingAttached.selector);
        invoices.cancelInvoice(id);
    }

    function test_protocolOnlyAttach() public {
        uint256 id = _createConfirmedInvoice();
        vm.prank(stranger);
        vm.expectRevert();
        invoices.attachSellerFinancing(id, 1);
    }

    function test_mutuallyExclusiveFinancing() public {
        uint256 id = _createConfirmedInvoice();
        vm.prank(seller);
        sellerFin.requestFinancing(id, ADVANCE, DISCOUNT, uint64(block.timestamp + 7 days));
        vm.prank(buyer);
        vm.expectRevert(Errors.FinancingConflict.selector);
        buyerFin.requestFinancing(id, PRINCIPAL, FEE, uint64(block.timestamp + 7 days));
    }

    function test_cancelRequestAllowsOtherWorkflow() public {
        uint256 id = _createConfirmedInvoice();
        vm.prank(seller);
        uint256 fid = sellerFin.requestFinancing(id, ADVANCE, DISCOUNT, uint64(block.timestamp + 7 days));
        vm.prank(seller);
        sellerFin.cancelRequest(fid);
        vm.prank(buyer);
        buyerFin.requestFinancing(id, PRINCIPAL, FEE, uint64(block.timestamp + 7 days));
        assertEq(invoices.getInvoice(id).buyerFinancingId, 1);
    }

    function test_zeroFaceReverts() public {
        vm.prank(seller);
        vm.expectRevert(Errors.InvalidFaceValue.selector);
        invoices.createInvoice(buyer, bytes32("N"), 0, uint64(block.timestamp + 1), keccak256("d"), 0);
    }
}
