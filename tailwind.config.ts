import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        dasong: {
          green: '#16a34a',
          dark: '#0a0a0a',
          card: '#111827',
        },
      },
      keyframes: {
        pulse_red: {
          '0%, 100%': { opacity: '1', transform: 'scale(1)' },
          '50%': { opacity: '0.7', transform: 'scale(1.15)' },
        },
        wave: {
          '0%, 100%': { transform: 'scaleY(1)' },
          '50%': { transform: 'scaleY(2)' },
        },
      },
      animation: {
        'pulse-red': 'pulse_red 0.8s ease-in-out infinite',
        'wave': 'wave 1s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}

export default config
