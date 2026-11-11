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
};

export default nextConfig;
