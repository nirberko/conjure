import globalConfig from '@extension/tailwindcss-config';
import deepmerge from 'deepmerge';
import type { Config } from 'tailwindcss';

export const withUI = (tailwindConfig: Config): Config =>
  deepmerge<Config>(
    {
      ...tailwindConfig,
      presets: [globalConfig as Config, ...(tailwindConfig.presets ?? [])],
    },
    {
      content: ['../../packages/ui/lib/**/*.tsx'],
    },
  );
