import { defineConfig } from 'vitest/config';

// Re-checks the reference tables against the original IPCC and CEA documents. Needs the network and pdftotext.
export default defineConfig({ test: { include: ['scripts/*.check.ts'], testTimeout: 180_000, hookTimeout: 180_000 } });
