import type { Config } from "tailwindcss";

// FABBI brand palette — lifted from fabbi.co Webflow custom properties.
// Keep these tokens centralized; reach for them via `brand.*` classes everywhere.
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "#005bf7",
          blue: "#005bf7",
          navy: "#07183a",
          "blue-dark": "#123b96",
          ink: "#060b1c",
          "blue-soft": "#b2ceff",
          "blue-mist": "#cddfff",
          "blue-tint": "#f2f7ff",
          mint: "#ecf6da",
          hairline: "#e5ecf5",
          muted: "#758696",
          slate: "#353c4a",
        },
      },
      fontFamily: {
        sans: ["var(--font-barlow)", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      boxShadow: {
        card: "0 1px 2px 0 rgb(7 24 58 / 0.03), 0 1px 2px -1px rgb(7 24 58 / 0.03)",
        "card-hover":
          "0 2px 4px -1px rgb(7 24 58 / 0.06), 0 8px 20px -6px rgb(7 24 58 / 0.08)",
      },
    },
  },
  plugins: [],
};

export default config;
