import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  /* Security: disable source maps in production */
  productionBrowserSourceMaps: false,
  /* Allow preview URLs from space-z.ai platform */
  allowedDevOrigins: [
    "preview-*.space-z.ai",
    "*.space-z.ai",
  ],
};

export default nextConfig;
