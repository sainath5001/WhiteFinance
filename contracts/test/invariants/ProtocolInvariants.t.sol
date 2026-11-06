// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {Constants} from "../../src/libraries/Constants.sol";
import {Types} from "../../src/libraries/Types.sol";
import {MockPrizeUSDT} from "../../src/mocks/MockPrizeUSDT.sol";
import {BusinessRegistry} from "../../src/BusinessRegistry.sol";
import {InvoiceRegistry} from "../../src/InvoiceRegistry.sol";
import {EscrowVault} from "../../src/EscrowVault.sol";
import {SellerFinancing} from "../../src/SellerFinancing.sol";
import {BuyerFinancing} from "../../src/BuyerFinancing.sol";
import {PaymentProcessor} from "../../src/PaymentProcessor.sol";

contract ProtocolHandler is Test {
    MockPrizeUSDT public usdt;
    PaymentProcessor public processor;

    address public merchant;
    address public customer;

    uint256[] public intentIds;
    uint256 public ghostPaid;
    uint256 public ghostRefunded;

    constructor(MockPrizeUSDT usdt_, PaymentProcessor processor_, address merchant_, address customer_) {
        usdt = usdt_;
        processor = processor_;
        merchant = merchant_;
        customer = customer_;
    }

    function intentCount() external view returns (uint256) {
        return intentIds.length;
    }

    function createIntent(uint256 amount, uint256 ttl) external {
        amount = bound(amount, 1, 5_000e6);
        ttl = bound(ttl, 60, 7 days);
        bytes32 ref = keccak256(abi.encode(intentIds.length, amount, ttl, ghostPaid));
        vm.prank(merchant);
        uint256 id = processor.createIntent(ref, amount, address(0), uint64(block.timestamp + ttl));
        intentIds.push(id);
    }

    function pay(uint256 index) external {
        if (intentIds.length == 0) return;
        index = bound(index, 0, intentIds.length - 1);
        uint256 id = intentIds[index];
        Types.PaymentIntent memory intent = processor.getIntent(id);
        if (intent.status != Types.IntentStatus.Created) return;
        if (block.timestamp >= intent.expiresAt) return;
        usdt.mint(customer, intent.amount);
        vm.startPrank(customer);
        usdt.approve(address(processor), intent.amount);
        processor.pay(id);
        vm.stopPrank();
        ghostPaid += intent.amount;
    }

    function refund(uint256 index, uint256 amount) external {
        if (intentIds.length == 0) return;
        index = bound(index, 0, intentIds.length - 1);
        uint256 id = intentIds[index];
        Types.PaymentIntent memory intent = processor.getIntent(id);
        if (intent.status != Types.IntentStatus.Settled && intent.status != Types.IntentStatus.PartiallyRefunded) {
            return;
        }
        uint256 remaining = intent.paidAmount - intent.refundedAmount;
        if (remaining == 0) return;
        amount = bound(amount, 1, remaining);
        usdt.mint(merchant, amount);
        vm.startPrank(merchant);
        usdt.approve(address(processor), amount);
        processor.refund(id, amount);
        vm.stopPrank();
        ghostRefunded += amount;
    }

    function expire(uint256 index) external {
        if (intentIds.length == 0) return;
        index = bound(index, 0, intentIds.length - 1);
        uint256 id = intentIds[index];
        Types.PaymentIntent memory intent = processor.getIntent(id);
        if (intent.status != Types.IntentStatus.Created) return;
        if (block.timestamp < intent.expiresAt) {
            vm.warp(intent.expiresAt);
        }
        processor.expireIntent(id);
    }

    function warpTime(uint256 secs) external {
        vm.warp(block.timestamp + bound(secs, 1, 3 days));
    }
}

contract ProtocolInvariants is Test {
    ProtocolHandler public handler;
    MockPrizeUSDT public usdt;
    EscrowVault public vault;
    PaymentProcessor public processor;

    function setUp() public {
        usdt = new MockPrizeUSDT();
        address merchant = makeAddr("inv-merchant");
        address customer = makeAddr("inv-customer");

        BusinessRegistry registry = new BusinessRegistry(address(this));
        InvoiceRegistry invoices = new InvoiceRegistry(address(this), address(registry));
        vault = new EscrowVault(address(this), address(usdt));
        SellerFinancing sellerFin =
            new SellerFinancing(address(this), address(registry), address(invoices), address(vault), 14 days);
        BuyerFinancing buyerFin =
            new BuyerFinancing(address(this), address(registry), address(invoices), address(vault), 14 days);
        processor = new PaymentProcessor(address(this), address(registry), address(usdt));

        invoices.grantRole(invoices.PROTOCOL_ROLE(), address(sellerFin));
        invoices.grantRole(invoices.PROTOCOL_ROLE(), address(buyerFin));
        vault.grantRole(vault.OPERATOR_ROLE(), address(sellerFin));
        vault.grantRole(vault.OPERATOR_ROLE(), address(buyerFin));

        vm.prank(merchant);
        registry.register("m", Constants.ROLE_MERCHANT, merchant, "");

        handler = new ProtocolHandler(usdt, processor, merchant, customer);
        targetContract(address(handler));
    }

    function invariant_processorHoldsNoUsdt() public view {
        assertEq(usdt.balanceOf(address(processor)), 0);
    }

    function invariant_vaultHeldMatchesBalance() public view {
        assertEq(usdt.balanceOf(address(vault)), vault.totalHeld());
    }

    function invariant_refundsNeverExceedPayments() public view {
        assertLe(handler.ghostRefunded(), handler.ghostPaid());
    }

    function invariant_intentRefundAccounting() public view {
        uint256 n = handler.intentCount();
        for (uint256 i = 0; i < n; ++i) {
            Types.PaymentIntent memory intent = processor.getIntent(handler.intentIds(i));
            assertLe(intent.refundedAmount, intent.paidAmount);
            if (intent.status == Types.IntentStatus.Refunded) {
                assertEq(intent.refundedAmount, intent.paidAmount);
                assertGt(intent.paidAmount, 0);
            }
        }
    }
}
