export const prizeUsdtAbi = [
  {
    type: "function",
    name: "name",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "string" }],
  },
  {
    type: "function",
    name: "symbol",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "string" }],
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
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "DOMAIN_SEPARATOR",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "bytes32" }],
  },
  {
    type: "function",
    name: "authorizationState",
    stateMutability: "view",
    inputs: [
      { name: "authorizer", type: "address" },
      { name: "nonce", type: "bytes32" },
    ],
    outputs: [{ type: "bool" }],
  },
  {
    type: "function",
    name: "isBlocked",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ type: "bool" }],
  },
  {
    type: "event",
    name: "AuthorizationUsed",
    inputs: [
      { name: "authorizer", type: "address", indexed: true },
      { name: "nonce", type: "bytes32", indexed: true },
    ],
  },
  {
    type: "event",
    name: "Transfer",
    inputs: [
      { name: "from", type: "address", indexed: true },
      { name: "to", type: "address", indexed: true },
      { name: "value", type: "uint256", indexed: false },
    ],
  },
] as const;

export const paymentProcessorAbi = [
  {
    type: "function",
    name: "usdt",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "address" }],
  },
  {
    type: "function",
    name: "getIntent",
    stateMutability: "view",
    inputs: [{ name: "intentId", type: "uint256" }],
    outputs: [
      {
        type: "tuple",
        components: [
          { name: "merchant", type: "address" },
          { name: "payoutAddress", type: "address" },
          { name: "orderRef", type: "bytes32" },
          { name: "amount", type: "uint256" },
          { name: "payer", type: "address" },
          { name: "expiresAt", type: "uint64" },
          { name: "status", type: "uint8" },
          { name: "paidAmount", type: "uint256" },
          { name: "refundedAmount", type: "uint256" },
          { name: "payerSettled", type: "address" },
          { name: "settledBlock", type: "uint64" },
        ],
      },
    ],
  },
  {
    type: "function",
    name: "settleWithAuthorization",
    stateMutability: "nonpayable",
    inputs: [
      { name: "intentId", type: "uint256" },
      {
        name: "auth",
        type: "tuple",
        components: [
          { name: "from", type: "address" },
          { name: "to", type: "address" },
          { name: "value", type: "uint256" },
          { name: "validAfter", type: "uint256" },
          { name: "validBefore", type: "uint256" },
          { name: "nonce", type: "bytes32" },
          { name: "signature", type: "bytes" },
        ],
      },
    ],
    outputs: [],
  },
  {
    type: "event",
    name: "PaymentSettled",
    inputs: [
      { name: "intentId", type: "uint256", indexed: true },
      { name: "payer", type: "address", indexed: true },
      { name: "merchant", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
      { name: "settledBlock", type: "uint64", indexed: false },
    ],
  },
] as const;

export const businessRegistryAbi = [
  {
    type: "function",
    name: "getBusiness",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [
      {
        type: "tuple",
        components: [
          { name: "account", type: "address" },
          { name: "displayName", type: "string" },
          { name: "roles", type: "uint8" },
          { name: "payoutAddress", type: "address" },
          { name: "active", type: "bool" },
          { name: "webhookUrl", type: "string" },
          { name: "createdAt", type: "uint64" },
          { name: "updatedAt", type: "uint64" },
        ],
      },
    ],
  },
] as const;
