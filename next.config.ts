import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Tesseract.js uses Node.js features — exclude from server bundle
  serverExternalPackages: ["tesseract.js"],
  // Next.js 16 uses Turbopack by default
  turbopack: {},
};

export default nextConfig;
