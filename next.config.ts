import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  ...(process.env.NEXT_EXPORT === 'true' ? { output: 'export' } : {}),
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
