// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {Constants} from "../src/libraries/Constants.sol";
import {Types} from "../src/libraries/Types.sol";
import {MockPrizeUSDT} from "../src/mocks/MockPrizeUSDT.sol";
import {BusinessRegistry} from "../src/BusinessRegistry.sol";
import {InvoiceRegistry} from "../src/InvoiceRegistry.sol";
import {EscrowVault} from "../src/EscrowVault.sol";
import {SellerFinancing} from "../src/SellerFinancing.sol";
import {BuyerFinancing} from "../src/BuyerFinancing.sol";
import {PaymentProcessor} from "../src/PaymentProcessor.sol";

contract BaseTest is Test {
    uint256 internal constant FACE = 100_000e6;
    uint256 internal constant ADVANCE = 95_000e6;
    uint256 internal constant DISCOUNT = 5_000e6;
    uint256 internal constant PRINCIPAL = 30_000e6;
    uint256 internal constant FEE = 1_500e6;
    uint256 internal constant REMAINDER = 70_000e6;
    uint256 internal constant PAY_AMOUNT = 25e6;

    MockPrizeUSDT internal usdt;
    BusinessRegistry internal registry;
    InvoiceRegistry internal invoices;
    EscrowVault internal vault;
    SellerFinancing internal sellerFin;
    BuyerFinancing internal buyerFin;
    PaymentProcessor internal processor;

    address internal admin = makeAddr("admin");
    address internal merchant = makeAddr("merchant");
    address internal seller = makeAddr("seller");
    address internal buyer = makeAddr("buyer");
    address internal investor = makeAddr("investor");
    address internal stranger = makeAddr("stranger");
    uint256 internal customerPk = 0xA11CE;
    address internal customer;

    function setUp() public virtual {
        customer = vm.addr(customerPk);
        usdt = new MockPrizeUSDT();
        registry = new BusinessRegistry(admin);
        invoices = new InvoiceRegistry(admin, address(registry));
        vault = new EscrowVault(admin, address(usdt));
        sellerFin = new SellerFinancing(admin, address(registry), address(invoices), address(vault), 14 days);
        buyerFin = new BuyerFinancing(admin, address(registry), address(invoices), address(vault), 14 days);
        processor = new PaymentProcessor(admin, address(registry), address(usdt));

        vm.startPrank(admin);
        invoices.grantRole(invoices.PROTOCOL_ROLE(), address(sellerFin));
        invoices.grantRole(invoices.PROTOCOL_ROLE(), address(buyerFin));
        vault.grantRole(vault.OPERATOR_ROLE(), address(sellerFin));
        vault.grantRole(vault.OPERATOR_ROLE(), address(buyerFin));
        vm.stopPrank();

        _register(merchant, Constants.ROLE_MERCHANT);
        _register(seller, Constants.ROLE_SELLER);
        _register(buyer, Constants.ROLE_BUYER);
        _register(investor, Constants.ROLE_INVESTOR);

        usdt.mint(customer, 1_000_000e6);
        usdt.mint(investor, 1_000_000e6);
        usdt.mint(buyer, 1_000_000e6);
        usdt.mint(merchant, 1_000_000e6);
        usdt.mint(seller, 1_000_000e6);
    }

    function _register(address account, uint8 roles) internal {
        vm.prank(account);
        registry.register(_name(account), roles, account, "");
    }

    function _name(address account) internal pure returns (string memory) {
        if (account == address(0)) return "x";
        return string.concat("biz-", vm.toString(uint256(uint160(account)) % 100000));
    }

    function _createConfirmedInvoice() internal returns (uint256 invoiceId) {
        invoiceId = _createInvoice(FACE, uint64(block.timestamp + 60 days), keccak256("doc-1"), bytes32("INV-1"));
        vm.prank(buyer);
        invoices.confirmInvoice(invoiceId);
    }

    function _createInvoice(uint256 face, uint64 due, bytes32 doc, bytes32 number)
        internal
        returns (uint256 invoiceId)
    {
        vm.prank(seller);
        invoiceId = invoices.createInvoice(buyer, number, face, due, doc, keccak256("terms"));
    }

    function _signReceive(
        uint256 pk,
        address from,
        address to,
        uint256 value,
        uint256 validAfter,
        uint256 validBefore,
        bytes32 nonce
    ) internal view returns (bytes memory) {
        bytes32 digest = usdt.hashReceiveAuthorization(from, to, value, validAfter, validBefore, nonce);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(pk, digest);
        return abi.encodePacked(r, s, v);
    }
}
