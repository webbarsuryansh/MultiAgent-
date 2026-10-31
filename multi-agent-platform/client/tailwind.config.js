/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#09090B',
        card: '#18181B',
        raised: '#1F1F23',
        line: '#27272A',
        violet: { DEFAULT: '#8B5CF6', soft: '#A78BFA' },
        cyan: { DEFAULT: '#06B6D4', soft: '#22D3EE' },
      },
      fontFamily: {
        display: ['Sora', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        sans: ['Manrope', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      boxShadow: {
        neon: '0 0 0 1px rgba(139,92,246,.55), 0 0 28px -6px rgba(139,92,246,.55)',
        'neon-cyan': '0 0 0 1px rgba(6,182,212,.5), 0 0 28px -6px rgba(6,182,212,.45)',
      },
    },
  },
  plugins: [],
};
