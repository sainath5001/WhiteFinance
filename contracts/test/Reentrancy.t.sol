// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {Constants} from "../src/libraries/Constants.sol";
import {MockCallbackUSDT} from "../src/mocks/MockCallbackUSDT.sol";
import {BusinessRegistry} from "../src/BusinessRegistry.sol";
import {PaymentProcessor} from "../src/PaymentProcessor.sol";

contract ReentrancyTest is Test {
    MockCallbackUSDT usdt;
    BusinessRegistry registry;
    PaymentProcessor processor;
    address admin = makeAddr("admin");
    address merchant = makeAddr("merchant");
    address customer = makeAddr("customer");

    function setUp() public {
        usdt = new MockCallbackUSDT();
        registry = new BusinessRegistry(admin);
        processor = new PaymentProcessor(admin, address(registry), address(usdt));
        vm.prank(merchant);
        registry.register("m", Constants.ROLE_MERCHANT, merchant, "");
        usdt.mint(customer, 1_000e6);
    }

    function test_reentrantPayFails() public {
        vm.prank(merchant);
        uint256 id = processor.createIntent(bytes32("R"), 25e6, address(0), uint64(block.timestamp + 1 hours));
        usdt.setCallback(address(processor), abi.encodeWithSelector(PaymentProcessor.pay.selector, id));
        vm.startPrank(customer);
        usdt.approve(address(processor), 25e6);
        vm.expectRevert();
        processor.pay(id);
        vm.stopPrank();
    }
}
