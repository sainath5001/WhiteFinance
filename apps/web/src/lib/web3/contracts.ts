import type { Address } from "viem";
import {
  businessRegistryAbi,
  buyerFinancingAbi,
  erc20Abi,
  escrowVaultAbi,
  invoiceRegistryAbi,
  paymentProcessorAbi,
  sellerFinancingAbi,
} from "@/lib/abis";
import { config } from "@/lib/config";

/** Central contract + token map. Pages must import from here, not hardcode addresses. */
export const contracts = {
  usdt: {
    address: config.usdt,
    abi: [
      ...erc20Abi,
      {
        type: "function",
        name: "approve",
        stateMutability: "nonpayable",
        inputs: [
          { name: "spender", type: "address" },
          { name: "amount", type: "uint256" },
        ],
        outputs: [{ type: "bool" }],
      },
      {
        type: "function",
        name: "allowance",
        stateMutability: "view",
        inputs: [
          { name: "owner", type: "address" },
          { name: "spender", type: "address" },
        ],
        outputs: [{ type: "uint256" }],
      },
      {
        type: "function",
        name: "balanceOf",
        stateMutability: "view",
        inputs: [{ name: "account", type: "address" }],
        outputs: [{ type: "uint256" }],
      },
    ] as const,
    symbol: config.usdtSymbol,
    decimals: config.usdtDecimals,
  },
  businessRegistry: {
    address: config.contracts.businessRegistry,
    abi: businessRegistryAbi,
  },
  invoiceRegistry: {
    address: config.contracts.invoiceRegistry,
    abi: invoiceRegistryAbi,
  },
  escrowVault: {
    address: config.contracts.escrowVault,
    abi: escrowVaultAbi,
  },
  sellerFinancing: {
    address: config.contracts.sellerFinancing,
    abi: sellerFinancingAbi,
  },
  buyerFinancing: {
    address: config.contracts.buyerFinancing,
    abi: buyerFinancingAbi,
  },
  paymentProcessor: {
    address: config.contracts.paymentProcessor,
    abi: paymentProcessorAbi,
  },
} as const;

export type ProtocolContract = keyof typeof contracts;

export function assertPrizeUsdt(token: Address) {
  return token.toLowerCase() === config.usdt.toLowerCase();
}

export const FORBIDDEN_USDT_E = "0xaa7962d073935D387e8d442DA1D7149C81388f46" as const;
