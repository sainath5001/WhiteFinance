import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverComponentsExternalPackages: [],
  },
  webpack: (config) => {
    config.externals.push("pino-pretty", "lokijs", "encoding");
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      net: false,
      tls: false,
    };
    // @wagmi/connectors@8 (via AppKit) imports @wagmi/core/tempo; wagmi 2.x has no such export.
    config.resolve.alias = {
      ...config.resolve.alias,
      "@wagmi/core/tempo": path.resolve(__dirname, "src/lib/web3/stubs/wagmi-tempo.ts"),
    };
    return config;
  },
};

export default nextConfig;
