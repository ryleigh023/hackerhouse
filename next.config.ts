import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // this project is self-contained; don't let stray parent lockfiles set the root
  outputFileTracingRoot: import.meta.dirname,
  images: { remotePatterns: [{ protocol: "https", hostname: "**.public.blob.vercel-storage.com" }] },
};

export default nextConfig;
