import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  // Production chunks live on the primary domain. The standalone demo
  // subdomain serves its own HTML/data but consumes this exact versioned build.
  assetPrefix: process.env.NODE_ENV === "production" ? "https://bypcms.ru" : undefined,
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
