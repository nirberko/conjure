import { resolve } from 'node:path';
import { makeEntryPointPlugin } from '@extension/hmr';
import { getContentScriptEntries, withPageConfig } from '@extension/vite-config';
import { IS_DEV } from '@extension/env';
import { build } from 'vite';

const rootDir = resolve(import.meta.dirname);
const srcDir = resolve(rootDir, 'src');
const matchesDir = resolve(srcDir, 'matches');
const outDir = resolve(rootDir, '..', '..', 'dist', 'content');

const configs = Object.entries(getContentScriptEntries(matchesDir)).map(([name, entry]) =>
  withPageConfig({
    mode: IS_DEV ? 'development' : undefined,
    resolve: {
      alias: {
        '@src': srcDir,
      },
    },
    publicDir: resolve(rootDir, 'public'),
    plugins: [IS_DEV && makeEntryPointPlugin()],
    build: {
      lib: {
        name: name,
        formats: ['iife'],
        entry,
        fileName: name,
      },
      outDir,
    },
  }),
);

// React vendor bundle — exposes React + ReactDOM as page globals for script-tag injection
const reactRuntimeConfig = withPageConfig({
  mode: IS_DEV ? 'development' : undefined,
  resolve: {
    alias: {
      '@src': srcDir,
    },
  },
  plugins: [],
  build: {
    lib: {
      name: 'reactRuntime',
      formats: ['iife'],
      entry: resolve(srcDir, 'react-runtime.ts'),
      fileName: 'react-runtime',
    },
    outDir,
    emptyOutDir: false,
  },
});

// Build content scripts first, then react-runtime (which must not empty outDir)
const contentBuilds = configs.map(async config => {
  //@ts-expect-error This is hidden property into vite's resolveConfig()
  config.configFile = false;
  await build(config);
});

await Promise.all(contentBuilds);

//@ts-expect-error This is hidden property into vite's resolveConfig()
reactRuntimeConfig.configFile = false;
await build(reactRuntimeConfig);
