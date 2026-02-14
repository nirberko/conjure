import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'shared',
          environment: 'node',
          root: path.resolve(__dirname, 'packages/shared'),
          setupFiles: ['./lib/__testing__/setup.ts'],
          include: ['lib/**/__tests__/**/*.test.ts'],
        },
      },
      {
        test: {
          name: 'chrome-extension',
          environment: 'node',
          root: path.resolve(__dirname, 'chrome-extension'),
          setupFiles: [path.resolve(__dirname, 'packages/shared/lib/__testing__/setup.ts')],
          include: ['src/**/__tests__/**/*.test.ts'],
        },
        resolve: {
          alias: {
            '@extension/shared': path.resolve(__dirname, 'packages/shared/index.mts'),
          },
        },
      },
    ],
  },
});
