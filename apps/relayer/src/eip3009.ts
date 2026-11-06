import {
  type Address,
  type Hex,
  encodeAbiParameters,
  getAddress,
  keccak256,
  recoverTypedDataAddress,
  stringToBytes,
} from "viem";
import type { RelayerConfig } from "./config.js";

export const receiveWithAuthorizationTypes = {
  ReceiveWithAuthorization: [
    { name: "from", type: "address" },
    { name: "to", type: "address" },
    { name: "value", type: "uint256" },
    { name: "validAfter", type: "uint256" },
    { name: "validBefore", type: "uint256" },
    { name: "nonce", type: "bytes32" },
  ],
} as const;

export type ReceiveAuthMessage = {
  from: Address;
  to: Address;
  value: bigint;
  validAfter: bigint;
  validBefore: bigint;
  nonce: Hex;
};

export type ReceiveAuthorization = ReceiveAuthMessage & {
  signature: Hex;
};

export function eip712Domain(cfg: RelayerConfig) {
  return {
    name: cfg.usdtName,
    version: cfg.usdtVersion,
    chainId: cfg.chainId,
    verifyingContract: cfg.usdt,
  } as const;
}

export function buildTypedData(cfg: RelayerConfig, message: ReceiveAuthMessage) {
  return {
    domain: eip712Domain(cfg),
    types: receiveWithAuthorizationTypes,
    primaryType: "ReceiveWithAuthorization" as const,
    message: {
      from: getAddress(message.from),
      to: getAddress(message.to),
      value: message.value,
      validAfter: message.validAfter,
      validBefore: message.validBefore,
      nonce: message.nonce,
    },
  };
}

const EIP712_DOMAIN_TYPEHASH = keccak256(
  stringToBytes(
    "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)",
  ),
);

/** Local EIP-712 domain separator; must equal onchain DOMAIN_SEPARATOR(). */
export function localDomainSeparator(cfg: RelayerConfig): Hex {
  const domain = eip712Domain(cfg);
  return keccak256(
    encodeAbiParameters(
      [
        { type: "bytes32" },
        { type: "bytes32" },
        { type: "bytes32" },
        { type: "uint256" },
        { type: "address" },
      ],
      [
        EIP712_DOMAIN_TYPEHASH,
        keccak256(stringToBytes(domain.name)),
        keccak256(stringToBytes(domain.version)),
        BigInt(domain.chainId),
        domain.verifyingContract,
      ],
    ),
  );
}

export async function recoverAuthorizationSigner(
  cfg: RelayerConfig,
  auth: ReceiveAuthorization,
): Promise<Address> {
  const typed = buildTypedData(cfg, auth);
  return recoverTypedDataAddress({
    ...typed,
    signature: auth.signature,
  });
}

/**
 * Prize USDT exclusive time bounds (verified source):
 * block.timestamp > validAfter && block.timestamp < validBefore
 */
export function authorizationWindowStatus(
  nowSec: number,
  validAfter: bigint,
  validBefore: bigint,
): "ok" | "early" | "expired" {
  if (BigInt(nowSec) <= validAfter) return "early";
  if (BigInt(nowSec) >= validBefore) return "expired";
  return "ok";
}

export function assertPackedEoaSignature(signature: Hex) {
  // 65-byte r||s||v
  if (signature.length !== 132) {
    throw new Error("signature must be 65-byte hex (r||s||v)");
  }
}
