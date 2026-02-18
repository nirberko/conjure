import { defineConfig } from '@playwright/test';
import { config } from 'dotenv';
import path from 'node:path';

config({ path: path.resolve(import.meta.dirname, '../../.env') });

export default defineConfig({
  testDir: './specs',
  timeout: 180_000,
  expect: {
    timeout: 90_000,
  },
  retries: 0,
  workers: 1,
  reporter: [['html', { open: 'never' }]],
  use: {
    video: 'retain-on-failure',
    trace: 'retain-on-failure',
  },
});
