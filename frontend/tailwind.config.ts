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
          // Primary — pink
          pink:        "#FF8FA3",
          "pink-hover": "#F07088",
          "pink-text":  "#B5354F", // WCAG AA on white (5.7:1)
          "pink-soft":  "#FFF0F3",
          "pink-border":"#FFBDCA",
          // Secondary — aquamarine
          aqua:        "#5CE6D5",
          "aqua-hover": "#4ACDC4",
          "aqua-text":  "#1A7A72", // WCAG AA on white (4.9:1)
          "aqua-soft":  "#E8FDFB",
          "aqua-border":"#9EF0E8",
        },
      },
    },
  },
  plugins: [],
};

export default config;
