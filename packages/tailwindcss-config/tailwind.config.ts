import type { Config } from 'tailwindcss';

export default {
  theme: {
    extend: {
      colors: {
        primary: '#00f2ff',
        'background-dark': '#0a0c10',
        'card-dark': '#12151c',
        'terminal-border': '#1e293b',
      },
      fontFamily: {
        display: ['Inter', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
    },
  },
  plugins: [],
} as Omit<Config, 'content'>;
