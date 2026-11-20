import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin the Turbopack workspace root explicitly: without this, the stray
  // package-lock.json in the PARENT directory (D:\Web Designs) makes Next
  // infer the wrong root, which breaks next/font/google module resolution
  // in dev and produces a startup warning.
  turbopack: {
    root: path.join(import.meta.dirname),
  },
};

export default nextConfig;
