import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      perspective: {
        "1000": "1000px",
      },
      colors: {
        brand: {
          // Secondary — warm coral (CTAs / highlights)
          pink:        "#E8805C",
          "pink-hover": "#D66A45",
          "pink-text":  "#B85A3A", // WCAG AA on white (4.7:1)
          "pink-soft":  "#FBE2D5",
          "pink-border":"#F0BBA5",
          // Primary — muted taupe (subtle UI)
          aqua:        "#9C9481",
          "aqua-hover": "#8A8271",
          "aqua-text":  "#5F5849", // WCAG AA on white (5.1:1)
          "aqua-soft":  "#F0EEE7",
          "aqua-border":"#C7C0AE",
        },
      },
    },
  },
  plugins: [],
};

export default config;
