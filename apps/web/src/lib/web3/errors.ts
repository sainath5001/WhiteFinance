export function humanizeWeb3Error(err: unknown): string {
  const raw =
    err instanceof Error
      ? err.message
      : typeof err === "string"
        ? err
        : JSON.stringify(err);
  const msg = raw.toLowerCase();

  if (msg.includes("user rejected") || msg.includes("user denied") || msg.includes("rejected the request")) {
    return "Wallet request was rejected. Nothing was submitted.";
  }
  if (msg.includes("insufficient funds") || msg.includes("insufficient balance")) {
    return "Insufficient WBT for gas on Whitechain Sepolia.";
  }
  if (msg.includes("transfer amount exceeds balance") || msg.includes("erc20: transfer amount exceeds balance")) {
    return "Insufficient prize USDT balance.";
  }
  if (msg.includes("from is blocked") || msg.includes("tokenblocked") || msg.includes("is blocked")) {
    return "This USDT address is blocked by the token issuer.";
  }
  if (msg.includes("intentexpired") || msg.includes("intent expired")) {
    return "This payment intent has expired.";
  }
  if (msg.includes("intentnotcreated") || msg.includes("invalidstatus")) {
    return "Payment intent is not in a payable state.";
  }
  if (msg.includes("payermismatch")) {
    return "Connected wallet is not the bound payer for this intent.";
  }
  if (msg.includes("wrong network") || msg.includes("chain mismatch") || msg.includes("chainid")) {
    return "Wrong network. Switch to Whitechain Sepolia (chain id 1874).";
  }
  if (
    msg.includes("relayer_unavailable") ||
    (msg.includes("relayer") && (msg.includes("unavailable") || msg.includes("paused")))
  ) {
    return "Gasless relayer is unavailable. Use Pay with gas manually, or retry later. Gasless will not silently fall back.";
  }
  if (msg.includes("authorization") && (msg.includes("expired") || msg.includes("auth_expired"))) {
    return "Payment authorization expired. Request a new quote and sign again.";
  }
  if (msg.includes("auth_invalid") || msg.includes("invalid signature")) {
    return "Signature could not be verified. Sign the exact authorization again.";
  }
  if (msg.includes("rpc") || msg.includes("fetch failed") || msg.includes("chain_unavailable")) {
    return "RPC unavailable. Check network connectivity and try again.";
  }
  if (msg.includes("failed to fetch") || msg.includes("backend") || msg.includes("503")) {
    return "Backend unavailable. Ensure the API server is running.";
  }
  if (msg.includes("reown") && msg.includes("project")) {
    return "Reown project id is missing. Set NEXT_PUBLIC_REOWN_PROJECT_ID to enable wallet connect.";
  }

  // Keep short; never dump stacks into UI.
  const short = raw.split("\n")[0]?.slice(0, 220) || "Transaction failed.";
  return short;
}
