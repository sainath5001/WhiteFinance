import type { Address } from "viem";
import { businessRegistryAbi } from "../abis";
import { getPublicClient, withRpcRetry } from "../blockchain/client";
import { config } from "../config";
import { ApiError } from "../errors";
import { encodeRegister, zeroAddress } from "./encode";

export async function getBusiness(account: Address) {
  const client = getPublicClient();
  const business = await withRpcRetry("getBusiness", () =>
    client.readContract({
      address: config.contracts.businessRegistry,
      abi: businessRegistryAbi,
      functionName: "getBusiness",
      args: [account],
    }),
  );

  const b = business as {
    account: Address;
    displayName: string;
    roles: number;
    payoutAddress: Address;
    active: boolean;
    webhookUrl: string;
    createdAt: bigint;
    updatedAt: bigint;
  };

  if (!b.account || b.account === zeroAddress()) {
    throw new ApiError("BUSINESS_NOT_FOUND", `No business registered for ${account}`);
  }

  return {
    account: b.account,
    displayName: b.displayName,
    roles: b.roles,
    payoutAddress: b.payoutAddress,
    active: b.active,
    webhookUrl: b.webhookUrl,
    createdAt: Number(b.createdAt),
    updatedAt: Number(b.updatedAt),
    registered: true,
  };
}

export async function getBusinessOrNull(account: Address) {
  try {
    return await getBusiness(account);
  } catch (err) {
    if (err instanceof ApiError && err.code === "BUSINESS_NOT_FOUND") return null;
    throw err;
  }
}

export function prepareRegister(input: {
  displayName: string;
  roles: number;
  payoutAddress?: Address | null;
  webhookUrl?: string;
}) {
  return {
    ...encodeRegister({
      displayName: input.displayName,
      roles: input.roles,
      payoutAddress: input.payoutAddress || zeroAddress(),
      webhookUrl: input.webhookUrl || "",
    }),
    note: "Wallet must send this transaction. API does not broadcast or hold keys.",
  };
}
