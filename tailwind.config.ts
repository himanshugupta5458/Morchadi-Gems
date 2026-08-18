import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    container: {
      center: true,
      padding: {
        DEFAULT: "1.25rem",
        sm: "1.5rem",
        lg: "2.5rem",
      },
      screens: {
        sm: "640px",
        md: "768px",
        lg: "1024px",
        xl: "1280px",
        "2xl": "1280px",
      },
    },
    extend: {
      colors: {
        ivory: "#FDFBF7",
        white: "#FFFFFF",
        charcoal: "#1C1C1C",
        ink: "#1C1C1C",
        gold: "#C6A24C",
        "gold-deep": "#A9863A",
        maroon: "#4A1621",
        honey: "#CBA96C",
        amber: "#F5A623",
        muted: "#6B6B6B",
        sale: "#E23A2E",
        line: "#E8E4DC",
        whatsapp: "#25D366",
      },
      fontFamily: {
        display: ["var(--font-display)", "Georgia", "serif"],
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
      },
      fontSize: {
        "eyebrow": ["0.6875rem", { lineHeight: "1rem", letterSpacing: "0.22em" }],
        "label": ["0.75rem", { lineHeight: "1.125rem", letterSpacing: "0.14em" }],
        "body-sm": ["0.8125rem", { lineHeight: "1.375rem" }],
        "body": ["0.9375rem", { lineHeight: "1.625rem" }],
        "body-lg": ["1.0625rem", { lineHeight: "1.75rem" }],
        "heading-sm": ["1.375rem", { lineHeight: "1.75rem", letterSpacing: "-0.01em" }],
        "heading": ["1.875rem", { lineHeight: "2.25rem", letterSpacing: "-0.015em" }],
        "heading-lg": ["2.5rem", { lineHeight: "2.875rem", letterSpacing: "-0.02em" }],
        "display": ["3.25rem", { lineHeight: "3.5rem", letterSpacing: "-0.025em" }],
        "display-lg": ["4.25rem", { lineHeight: "4.5rem", letterSpacing: "-0.03em" }],
      },
      letterSpacing: {
        caps: "0.14em",
        "caps-wide": "0.22em",
      },
      maxWidth: {
        prose: "68ch",
      },
      borderRadius: {
        card: "0.125rem",
      },
      boxShadow: {
        card: "0 1px 2px rgba(28, 28, 28, 0.04)",
        "card-hover": "0 12px 32px -18px rgba(28, 28, 28, 0.28)",
      },
      transitionDuration: {
        250: "250ms",
      },
      keyframes: {
        "toast-in": {
          from: { opacity: "0", transform: "translateY(0.5rem)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "toast-in": "toast-in 250ms ease-out both",
      },
    },
  },
  plugins: [],
};
export default config;
