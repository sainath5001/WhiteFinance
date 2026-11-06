import { getAddress, type Address, type Hex } from "viem";

function required(name: string, value: string | undefined): string {
  if (!value || value.trim() === "") {
    throw new Error(`Missing required env: ${name}`);
  }
  return value.trim();
}

function optional(name: string, fallback: string): string {
  const v = process.env[name];
  return v && v.trim() !== "" ? v.trim() : fallback;
}

function addr(name: string, value: string): Address {
  try {
    return getAddress(value);
  } catch {
    throw new Error(`Invalid address for ${name}: ${value}`);
  }
}

const defaults = {
  chainId: 1874,
  rpcUrl: "https://rpc.testnet.whitechain.io",
  explorerUrl: "https://explorer.testnet.whitechain.io",
  usdt: "0xcedfB56113143d55b2358b8CFbB0dEB5Ad2f55a7",
  businessRegistry: "0x3d6AEef7160Bf764821dC11F6e1402C86599F768",
  invoiceRegistry: "0x3d70e6469529e40731e5AC751D2F60169a5429eF",
  escrowVault: "0x823d09040C793e0b24528ef0D80aE645bDBa6405",
  sellerFinancing: "0xfDe6391bB81FD9a04722DBb3d0Dd56311E4eE796",
  buyerFinancing: "0x302aA4646F94927AAd59dAfFe65DA271ddFF6B8d",
  paymentProcessor: "0xC210Cff48e44edA690E0149C98250e3eb40aaDe5",
  deploymentBlock: 12397652,
};

export const config = {
  chainId: Number(optional("NEXT_PUBLIC_CHAIN_ID", String(defaults.chainId))),
  rpcUrl: optional("RPC_URL", optional("NEXT_PUBLIC_RPC_URL", defaults.rpcUrl)),
  explorerUrl: optional("NEXT_PUBLIC_EXPLORER_URL", defaults.explorerUrl),
  appUrl: optional("NEXT_PUBLIC_APP_URL", "http://localhost:3000"),
  usdt: addr("USDT", optional("NEXT_PUBLIC_USDT", defaults.usdt)),
  usdtSymbol: "USDT",
  usdtDecimals: 6,
  contracts: {
    businessRegistry: addr(
      "BUSINESS_REGISTRY",
      optional("NEXT_PUBLIC_BUSINESS_REGISTRY", defaults.businessRegistry),
    ),
    invoiceRegistry: addr(
      "INVOICE_REGISTRY",
      optional("NEXT_PUBLIC_INVOICE_REGISTRY", defaults.invoiceRegistry),
    ),
    escrowVault: addr("ESCROW_VAULT", optional("NEXT_PUBLIC_ESCROW_VAULT", defaults.escrowVault)),
    sellerFinancing: addr(
      "SELLER_FINANCING",
      optional("NEXT_PUBLIC_SELLER_FINANCING", defaults.sellerFinancing),
    ),
    buyerFinancing: addr(
      "BUYER_FINANCING",
      optional("NEXT_PUBLIC_BUYER_FINANCING", defaults.buyerFinancing),
    ),
    paymentProcessor: addr(
      "PAYMENT_PROCESSOR",
      optional("NEXT_PUBLIC_PAYMENT_PROCESSOR", defaults.paymentProcessor),
    ),
  },
  deploymentBlock: BigInt(optional("DEPLOYMENT_BLOCK", String(defaults.deploymentBlock))),
  webhookSigningSecret: process.env.WEBHOOK_SIGNING_SECRET?.trim() || "",
  checkpointFile: optional("CHECKPOINT_FILE", ".data/checkpoint.json"),
  corsOrigins: optional("CORS_ORIGINS", "http://localhost:3000")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
  rateLimitReadPerMin: Number(optional("RATE_LIMIT_READ_PER_MIN", "120")),
  rateLimitWritePerMin: Number(optional("RATE_LIMIT_WRITE_PER_MIN", "60")),
  relayerUrl: process.env.RELAYER_URL?.trim() || "",
  relayerInternalToken: process.env.RELAYER_INTERNAL_TOKEN?.trim() || "",
  features: {
    gaslessCheckout: true,
    escrowVault: true,
    transferPolicy: false,
    relayer: false,
  },
} as const;

export type ContractName = keyof typeof config.contracts;

export function explorerTx(txHash: Hex): string {
  return `${config.explorerUrl}/tx/${txHash}`;
}

export function explorerAddress(address: Address): string {
  return `${config.explorerUrl}/address/${address}`;
}

export function requireWebhookSecret(): string {
  return required("WEBHOOK_SIGNING_SECRET", config.webhookSigningSecret || undefined);
}
