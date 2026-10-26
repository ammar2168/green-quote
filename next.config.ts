import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  // Development-only output, which `instrumentation.ts` routes through the
  // app's logger so it shares one stream with the app's own lines.
  logging: {
    // `jsonRoute` already logs every API request, with more detail.
    incomingRequests: { ignore: [/^\/api\//] },
    // Client-side warnings and errors show up in the server's log too.
    browserToTerminal: "warn",
  },
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
