import type { NextConfig } from "next";
import { readFileSync } from "node:fs";

const { version } = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8")) as { version: string };

const nextConfig: NextConfig = {
  ...(process.env.NEXT_EXPORT === 'true' ? { output: 'export' } : {}),
  env: { NEXT_PUBLIC_APP_VERSION: version },
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
