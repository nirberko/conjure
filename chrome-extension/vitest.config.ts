import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: ['../packages/shared/lib/__testing__/setup.ts'],
    include: ['src/**/__tests__/**/*.test.ts'],
  },
  resolve: {
    alias: {
      '@extension/shared': path.resolve(__dirname, '../packages/shared/index.mts'),
    },
  },
});
