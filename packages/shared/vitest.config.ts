import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: ['./lib/__testing__/setup.ts'],
    include: ['lib/**/__tests__/**/*.test.ts'],
  },
});
