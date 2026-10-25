import { loadEnvConfig } from "@next/env";

// Scripts run outside the Next.js runtime, so they have to load .env* files
// themselves — same as drizzle.config.ts. Import this for its side effect, and
// before anything that reads process.env at module scope (such as ../db).
loadEnvConfig(process.cwd());
