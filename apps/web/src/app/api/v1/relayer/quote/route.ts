import { handle, options, parseJson } from "@/lib/http";
import { idOnlySchema } from "@/lib/schemas";
import { config } from "@/lib/config";
import { getPaymentIntent } from "@/lib/services/payments";

/**
 * Relayer quote stub. Full gasless worker is out of scope for this backend pass.
 * Returns typed-data shape hints when the intent is payable; submit remains unavailable.
 */
export function OPTIONS(req: Request) {
  return options(req);
}

export function POST(req: Request) {
  return handle(
    req,
    async () => {
      const body = await parseJson(req, idOnlySchema);
      const intent = await getPaymentIntent(body.id);
      const available = Boolean(config.relayerUrl) && config.features.relayer;
      return {
        available,
        pauseReason: available ? null : "RELAYER_NOT_DEPLOYED",
        intentId: intent.intentId,
        amountBase: intent.amountBase,
        token: intent.token,
        paymentProcessor: config.contracts.paymentProcessor,
        typedDataHint: {
          domain: {
            name: "Tether USD",
            version: "1",
            chainId: config.chainId,
            verifyingContract: config.usdt,
          },
          primaryType: "ReceiveWithAuthorization",
          note: "Full EIP-712 message is built by the relayer worker (out of scope).",
        },
      };
    },
    "write",
  );
}
