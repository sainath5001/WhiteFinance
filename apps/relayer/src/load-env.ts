import { readFileSync, existsSync } from "node:fs";
import path from "node:path";

/** Minimal .env loader (no dependency). Does not override already-set process.env. */
export function loadEnvFile(file = ".env") {
  const full = path.resolve(process.cwd(), file);
  if (!existsSync(full)) return;
  const text = readFileSync(full, "utf8");
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}
