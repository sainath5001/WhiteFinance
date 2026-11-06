import { loadEnvFile } from "./load-env.js";
import { loadConfig } from "./config.js";
import { initClients } from "./clients.js";
import { logger } from "./logger.js";
import { startServer } from "./server.js";
import { assertTokenCompatibility } from "./validate.js";

loadEnvFile();

async function main() {
  const cfg = loadConfig({ requireKey: true });
  initClients(cfg);
  logger.info("relayer_boot", {
    chainId: cfg.chainId,
    paymentProcessor: cfg.paymentProcessor,
    usdt: cfg.usdt,
    paused: cfg.paused,
    host: cfg.host,
    port: cfg.port,
  });

  try {
    const token = await assertTokenCompatibility(cfg);
    logger.info("token_compatible", {
      name: token.name,
      decimals: token.decimals,
      domain: token.domain,
    });
  } catch (err) {
    logger.error("token_compatibility_failed", {
      err: err instanceof Error ? err.message : String(err),
    });
    // Still start so /health can surface the failure; pause effectively via failed quotes.
  }

  startServer(cfg);
}

main().catch((err) => {
  logger.error("fatal", { err: String(err) });
  process.exit(1);
});
