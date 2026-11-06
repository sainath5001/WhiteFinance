import type { Abi } from "viem";
import BusinessRegistry from "./BusinessRegistry.json";
import InvoiceRegistry from "./InvoiceRegistry.json";
import EscrowVault from "./EscrowVault.json";
import SellerFinancing from "./SellerFinancing.json";
import BuyerFinancing from "./BuyerFinancing.json";
import PaymentProcessor from "./PaymentProcessor.json";

export const businessRegistryAbi = BusinessRegistry as Abi;
export const invoiceRegistryAbi = InvoiceRegistry as Abi;
export const escrowVaultAbi = EscrowVault as Abi;
export const sellerFinancingAbi = SellerFinancing as Abi;
export const buyerFinancingAbi = BuyerFinancing as Abi;
export const paymentProcessorAbi = PaymentProcessor as Abi;

/** Minimal ERC-20 + Transfer event for receipt verification. */
export const erc20Abi = [
  {
    type: "event",
    name: "Transfer",
    inputs: [
      { indexed: true, name: "from", type: "address" },
      { indexed: true, name: "to", type: "address" },
      { indexed: false, name: "value", type: "uint256" },
    ],
  },
  {
    type: "function",
    name: "decimals",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint8" }],
  },
  {
    type: "function",
    name: "symbol",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "string" }],
  },
] as const;
