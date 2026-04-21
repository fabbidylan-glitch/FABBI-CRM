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
        // Flat, crisp cards — a single hairline ring + an almost-invisible lift.
        card: "0 0 0 1px rgb(7 24 58 / 0.04), 0 1px 2px 0 rgb(7 24 58 / 0.04)",
        "card-hover":
          "0 0 0 1px rgb(7 24 58 / 0.06), 0 4px 12px -2px rgb(7 24 58 / 0.08), 0 10px 30px -12px rgb(7 24 58 / 0.12)",
        // Inner highlight for primary buttons (top-edge shine).
        "btn-primary":
          "inset 0 1px 0 0 rgb(255 255 255 / 0.16), 0 1px 2px 0 rgb(7 24 58 / 0.12)",
        // Soft glow behind elevated focal elements (hero header, active nav item).
        glow: "0 0 0 1px rgb(0 91 247 / 0.12), 0 8px 24px -12px rgb(0 91 247 / 0.35)",
      },
      backgroundImage: {
        "gradient-sidebar":
          "linear-gradient(180deg, #07183a 0%, #0b2251 55%, #07183a 100%)",
        "gradient-surface":
          "radial-gradient(1200px 600px at 10% -20%, rgb(0 91 247 / 0.06), transparent 60%)",
      },
    },
  },
  plugins: [],
};

export default config;
