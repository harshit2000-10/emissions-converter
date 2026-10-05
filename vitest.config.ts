import { defineConfig } from 'vitest/config';

// `npm test` runs the quick checks. Source verification needs the network and has its own config (vitest.sources.config.ts).
export default defineConfig({ test: { include: ['src/**/*.test.ts'] } });
