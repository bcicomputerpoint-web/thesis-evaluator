import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        "app-bg": "#07090F",
        "app-surface": "#0C1018",
        "app-card": "#111827",
        "app-border": "#1C2A3E",
      },
    },
  },
  plugins: [],
};

export default config;
