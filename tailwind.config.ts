import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        playfair: ['var(--font-playfair)', 'Georgia', 'serif'],
        inter: ['var(--font-inter)', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
      },
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        parchment: '#f5f0e8',
        cream: '#fdfaf4',
        'stone-white': '#f0ebe0',
        forest: {
          DEFAULT: '#2d5016',
          dark: '#173901',
        },
        terracotta: '#c4622d',
        'warm-stone': '#8c7b6b',
        'dark-bark': '#1c1207',
        'warm-umber': '#5c4a35',
        'sage-mist': '#a8d38a',
      },
      boxShadow: {
        'warm': '0 4px 16px 0 rgba(61,43,31,0.10)',
        'warm-md': '0 8px 24px 0 rgba(61,43,31,0.14)',
      },
    },
  },
  plugins: [],
};
export default config;
