import type { Address, Hash, PublicClient } from "viem";
import { maxUint256 } from "viem";
import { contracts } from "@/lib/web3/contracts";
import { waitSoftReceipt } from "@/lib/web3/tx";

type WriteFn = (args: {
  address: typeof contracts.usdt.address;
  abi: typeof contracts.usdt.abi;
  functionName: "approve";
  args: [Address, bigint];
}) => Promise<Hash>;

/** Approve USDT spender when allowance is below `amount`. Returns approve tx hash or null. */
export async function ensureUsdtAllowance(params: {
  publicClient: PublicClient;
  owner: Address;
  spender: Address;
  amount: bigint;
  writeContractAsync: WriteFn;
}): Promise<Hash | null> {
  const allowance = (await params.publicClient.readContract({
    address: contracts.usdt.address,
    abi: contracts.usdt.abi,
    functionName: "allowance",
    args: [params.owner, params.spender],
  })) as bigint;
  if (allowance >= params.amount) return null;
  const hash = await params.writeContractAsync({
    address: contracts.usdt.address,
    abi: contracts.usdt.abi,
    functionName: "approve",
    args: [params.spender, maxUint256],
  });
  await waitSoftReceipt(hash);
  return hash;
}
