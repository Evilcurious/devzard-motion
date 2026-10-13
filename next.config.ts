import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // better-sqlite3 + pg are native/node modules: keep them external so Next
  // never tries to bundle them for the server runtime.
  serverExternalPackages: ["better-sqlite3", "pg"],
  logging: {
    fetches: { fullUrl: false },
  },
};

export default nextConfig;
