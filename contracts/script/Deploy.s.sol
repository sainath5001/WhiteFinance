// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {Constants} from "../src/libraries/Constants.sol";
import {BusinessRegistry} from "../src/BusinessRegistry.sol";
import {InvoiceRegistry} from "../src/InvoiceRegistry.sol";
import {EscrowVault} from "../src/EscrowVault.sol";
import {SellerFinancing} from "../src/SellerFinancing.sol";
import {BuyerFinancing} from "../src/BuyerFinancing.sol";
import {PaymentProcessor} from "../src/PaymentProcessor.sol";

/// @notice Deploys the WhiteFinance suite. Does not send transactions unless `--broadcast` is passed.
/// @dev The broadcasting address becomes admin so role grants succeed in the same script.
contract Deploy is Script {
    function run() external {
        address usdt = vm.envOr("USDT_ADDRESS", Constants.PRIZE_USDT);
        uint256 grace = vm.envOr("GRACE_PERIOD", Constants.DEFAULT_GRACE_PERIOD);

        vm.startBroadcast();
        address admin = msg.sender;

        BusinessRegistry registry = new BusinessRegistry(admin);
        InvoiceRegistry invoices = new InvoiceRegistry(admin, address(registry));
        EscrowVault vault = new EscrowVault(admin, usdt);
        SellerFinancing sellerFin = new SellerFinancing(admin, address(registry), address(invoices), address(vault), grace);
        BuyerFinancing buyerFin = new BuyerFinancing(admin, address(registry), address(invoices), address(vault), grace);
        PaymentProcessor processor = new PaymentProcessor(admin, address(registry), usdt);

        invoices.grantRole(invoices.PROTOCOL_ROLE(), address(sellerFin));
        invoices.grantRole(invoices.PROTOCOL_ROLE(), address(buyerFin));
        vault.grantRole(vault.OPERATOR_ROLE(), address(sellerFin));
        vault.grantRole(vault.OPERATOR_ROLE(), address(buyerFin));

        vm.stopBroadcast();

        console2.log("BusinessRegistry", address(registry));
        console2.log("InvoiceRegistry", address(invoices));
        console2.log("EscrowVault", address(vault));
        console2.log("SellerFinancing", address(sellerFin));
        console2.log("BuyerFinancing", address(buyerFin));
        console2.log("PaymentProcessor", address(processor));
        console2.log("USDT", usdt);
        console2.log("Admin", admin);
    }
}
