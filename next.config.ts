import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // AGENTS.md is hand-written for this project; stop `next dev` from rewriting it.
  agentRules: false,
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
