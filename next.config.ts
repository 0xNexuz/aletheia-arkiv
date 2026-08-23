import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // This project is deployed as a static export, so public images must be
  // served directly instead of through a runtime /_next/image endpoint.
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
