import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Every page reads the Supabase session cookie, so render dynamically.
  cacheComponents: false,
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
