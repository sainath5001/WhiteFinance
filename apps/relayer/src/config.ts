import { getAddress, type Address, type Hex, isHex } from "viem";

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
  paymentProcessor: "0xC210Cff48e44edA690E0149C98250e3eb40aaDe5",
  businessRegistry: "0x3d6AEef7160Bf764821dC11F6e1402C86599F768",
};

export type RelayerConfig = {
  chainId: number;
  rpcUrl: string;
  explorerUrl: string;
  usdt: Address;
  paymentProcessor: Address;
  businessRegistry: Address;
  privateKey: Hex | null;
  internalToken: string;
  webhookSigningSecret: string;
  host: string;
  port: number;
  corsOrigins: string[];
  paused: boolean;
  maxAmountBase: bigint;
  maxGasPerTx: bigint;
  maxWbtPerDayWei: bigint;
  minWbtWei: bigint;
  authTtlSeconds: number;
  rateGlobalPerMin: number;
  ratePayerPerMin: number;
  rateIpPerMin: number;
  rateMerchantPerMin: number;
  idemTtlMs: number;
  usdtName: string;
  usdtVersion: string;
  expectedDomainSeparator: Hex;
};

export function loadConfig(opts?: { requireKey?: boolean }): RelayerConfig {
  const requireKey = opts?.requireKey ?? true;
  const pkRaw = process.env.RELAYER_PRIVATE_KEY?.trim() || "";
  let privateKey: Hex | null = null;
  if (pkRaw) {
    if (!isHex(pkRaw) || pkRaw.length !== 66) {
      throw new Error("RELAYER_PRIVATE_KEY must be a 32-byte hex string with 0x prefix");
    }
    privateKey = pkRaw as Hex;
  } else if (requireKey) {
    throw new Error("Missing required env: RELAYER_PRIVATE_KEY");
  }

  return {
    chainId: Number(optional("CHAIN_ID", String(defaults.chainId))),
    rpcUrl: optional("RPC_URL", defaults.rpcUrl),
    explorerUrl: optional("EXPLORER_URL", defaults.explorerUrl),
    usdt: addr("USDT", optional("USDT", defaults.usdt)),
    paymentProcessor: addr(
      "PAYMENT_PROCESSOR",
      optional("PAYMENT_PROCESSOR", defaults.paymentProcessor),
    ),
    businessRegistry: addr(
      "BUSINESS_REGISTRY",
      optional("BUSINESS_REGISTRY", defaults.businessRegistry),
    ),
    privateKey,
    internalToken: optional("RELAYER_INTERNAL_TOKEN", ""),
    webhookSigningSecret: optional("WEBHOOK_SIGNING_SECRET", ""),
    host: optional("HOST", "127.0.0.1"),
    port: Number(optional("PORT", "8787")),
    corsOrigins: optional("CORS_ORIGINS", "http://localhost:3000")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
    paused: optional("RELAYER_PAUSED", "false").toLowerCase() === "true",
    maxAmountBase: BigInt(optional("RELAYER_MAX_AMOUNT_BASE", "100000000000")),
    maxGasPerTx: BigInt(optional("RELAYER_MAX_GAS_PER_TX", "500000")),
    maxWbtPerDayWei: BigInt(optional("RELAYER_MAX_WBT_PER_DAY", "100000000000000000")),
    minWbtWei: BigInt(optional("RELAYER_MIN_WBT_WEI", "5000000000000000")),
    authTtlSeconds: Number(optional("RELAYER_AUTH_TTL_SECONDS", "1800")),
    rateGlobalPerMin: Number(optional("RATE_LIMIT_GLOBAL_PER_MIN", "30")),
    ratePayerPerMin: Number(optional("RATE_LIMIT_PAYER_PER_MIN", "10")),
    rateIpPerMin: Number(optional("RATE_LIMIT_IP_PER_MIN", "60")),
    rateMerchantPerMin: Number(optional("RATE_LIMIT_MERCHANT_PER_MIN", "30")),
    idemTtlMs: Number(optional("IDEM_TTL_MS", "900000")),
    usdtName: "Tether USD",
    usdtVersion: "1",
    // Verified on Whitechain Sepolia 2026-11-06 / reconfirmed 2026-11-07.
    expectedDomainSeparator:
      "0xcdcfacb6b15c8238b4e5fbb47bdb83b7f83f50a531d264bf9763d2bd1d3d2a25",
  };
}
