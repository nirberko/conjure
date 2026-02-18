import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'shared',
          environment: 'node',
          root: path.resolve(import.meta.dirname, 'packages/shared'),
          include: ['lib/**/__tests__/**/*.test.ts'],
        },
      },
      {
        test: {
          name: 'chrome-extension',
          environment: 'node',
          root: path.resolve(import.meta.dirname, 'chrome-extension'),
          include: ['src/**/__tests__/**/*.test.ts'],
        },
        resolve: {
          alias: {
            '@extension/shared': path.resolve(import.meta.dirname, 'packages/shared/index.mts'),
          },
        },
      },
    ],
  },
});
