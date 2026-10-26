import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // Stops `next dev` from writing a generic AGENTS.md into the repo whenever
  // it detects an AI agent; CLAUDE.md already covers this project's Next.js
  // conventions.
  agentRules: false,
  // A self-contained server in `.next/standalone` for the Docker image. Only
  // the Dockerfile asks for it: `next start` (which the e2e suite runs) warns
  // that it does not support standalone builds.
  output: process.env.NEXT_OUTPUT_STANDALONE === "1" ? "standalone" : undefined,
  // `server/quote-pdf.ts` reads the fonts through a runtime path, which the
  // file tracer cannot follow, so they would be missing from the standalone
  // output.
  outputFileTracingIncludes: {
    "/api/quotes/\\[id\\]/pdf": ["./assets/fonts/**/*"],
  },
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
