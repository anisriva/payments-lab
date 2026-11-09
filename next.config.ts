import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // *.md imports resolve to the file's source string (adapter onboarding guides)
  webpack(config) {
    config.module.rules.push({ test: /\.md$/, type: "asset/source" });
    return config;
  },
  turbopack: {
    rules: {
      "*.md": { loaders: ["raw-loader"], as: "*.js" },
    },
  },
};

export default nextConfig;
