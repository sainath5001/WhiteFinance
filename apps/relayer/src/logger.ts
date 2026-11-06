type Level = "info" | "warn" | "error" | "debug";

function write(level: Level, msg: string, fields: Record<string, unknown> = {}) {
  const safe = { ...fields };
  for (const key of Object.keys(safe)) {
    const lower = key.toLowerCase();
    if (
      lower.includes("private") ||
      lower.includes("secret") ||
      lower === "signature" ||
      lower === "authorization"
    ) {
      safe[key] = "[redacted]";
    }
  }
  const line = JSON.stringify({
    level,
    msg,
    ts: new Date().toISOString(),
    service: "whitefinance-relayer",
    ...safe,
  });
  if (level === "error" || level === "warn") {
    console.error(line);
  } else {
    console.log(line);
  }
}

export const logger = {
  info: (msg: string, fields?: Record<string, unknown>) => write("info", msg, fields),
  warn: (msg: string, fields?: Record<string, unknown>) => write("warn", msg, fields),
  error: (msg: string, fields?: Record<string, unknown>) => write("error", msg, fields),
  debug: (msg: string, fields?: Record<string, unknown>) => write("debug", msg, fields),
};
