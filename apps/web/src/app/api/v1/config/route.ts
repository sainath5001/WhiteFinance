import { config } from "@/lib/config";
import { handle, options } from "@/lib/http";

export function OPTIONS(req: Request) {
  return options(req);
}

export function GET(req: Request) {
  return handle(req, async () => ({
    chainId: config.chainId,
    networkName: "Whitechain Sepolia",
    rpcUrl: config.rpcUrl,
    explorerUrl: config.explorerUrl,
    usdt: config.usdt,
    usdtSymbol: config.usdtSymbol,
    usdtDecimals: config.usdtDecimals,
    contracts: {
      businessRegistry: config.contracts.businessRegistry,
      paymentProcessor: config.contracts.paymentProcessor,
      invoiceRegistry: config.contracts.invoiceRegistry,
      escrowVault: config.contracts.escrowVault,
      sellerFinancing: config.contracts.sellerFinancing,
      buyerFinancing: config.contracts.buyerFinancing,
    },
    deploymentBlock: config.deploymentBlock.toString(),
    features: config.features,
  }));
}
