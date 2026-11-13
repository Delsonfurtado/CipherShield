import type { Config } from "tailwindcss";
import { fontFamily } from "tailwindcss/defaultTheme";

const config: Config = {
  // ----------------------------------------------------------------
  // Dark mode — controlled by a class on <html> element
  // ----------------------------------------------------------------
  darkMode: ["class"],

  // ----------------------------------------------------------------
  // Content paths — Tailwind purges unused classes in production
  // ----------------------------------------------------------------
  content: [
    "./index.html",
    "./src/**/*.{ts,tsx}",
  ],

  theme: {
    extend: {
      // --------------------------------------------------------------
      // CipherShield Brand Colors
      // Primary: deep purple (violet-700 family)
      // Surface: slate-900 dark, slate-50 light
      // Accent: cyan for highlights/actions
      // Danger: rose for security warnings
      // --------------------------------------------------------------
      colors: {
        // --- shadcn/ui CSS variable convention ---
        border:      "hsl(var(--border))",
        input:       "hsl(var(--input))",
        ring:        "hsl(var(--ring))",
        background:  "hsl(var(--background))",
        foreground:  "hsl(var(--foreground))",

        primary: {
          DEFAULT:    "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT:    "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT:    "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT:    "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT:    "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT:    "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT:    "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },

        // --- CipherShield semantic tokens ---
        cipher: {
          50:   "#f5f3ff",
          100:  "#ede9fe",
          200:  "#ddd6fe",
          300:  "#c4b5fd",
          400:  "#a78bfa",
          500:  "#8b5cf6",
          600:  "#7c3aed",   // primary brand purple
          700:  "#6d28d9",
          800:  "#5b21b6",
          900:  "#4c1d95",
          950:  "#2e1065",
        },
        surface: {
          50:   "#f8fafc",
          100:  "#f1f5f9",
          200:  "#e2e8f0",
          700:  "#334155",
          800:  "#1e293b",
          900:  "#0f172a",   // dark background
          950:  "#020617",
        },
        shield: {
          cyan:   "#06b6d4",   // accent / active
          rose:   "#f43f5e",   // danger / breach
          amber:  "#f59e0b",   // warning
          emerald:"#10b981",   // success / strong password
        },
      },

      // --------------------------------------------------------------
      // Typography
      // --------------------------------------------------------------
      fontFamily: {
        sans: ["Inter", "Inter fallback", ...fontFamily.sans],
        mono: ["JetBrains Mono", "JetBrains Mono fallback", ...fontFamily.mono],
      },

      // --------------------------------------------------------------
      // Border radius (shadcn/ui convention)
      // --------------------------------------------------------------
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },

      // --------------------------------------------------------------
      // Animation (used by framer-motion + tailwind utilities)
      // --------------------------------------------------------------
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to:   { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to:   { height: "0" },
        },
        "fade-in": {
          from: { opacity: "0", transform: "translateY(4px)" },
          to:   { opacity: "1", transform: "translateY(0)" },
        },
        shimmer: {
          "0%":   { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up":   "accordion-up 0.2s ease-out",
        "fade-in":        "fade-in 0.25s ease-out",
        shimmer:          "shimmer 1.5s infinite linear",
      },

      // --------------------------------------------------------------
      // Box Shadows — glass-morphism style
      // --------------------------------------------------------------
      boxShadow: {
        "cipher-sm": "0 0 0 1px rgba(124, 58, 237, 0.2)",
        "cipher-md": "0 0 0 2px rgba(124, 58, 237, 0.4), 0 4px 24px rgba(124, 58, 237, 0.15)",
        "cipher-lg": "0 0 0 2px rgba(124, 58, 237, 0.6), 0 8px 48px rgba(124, 58, 237, 0.25)",
        glow:        "0 0 24px rgba(124, 58, 237, 0.5)",
      },
    },
  },

  plugins: [
    // Tailwind plugins for typography, forms, animations
    // Install separately: npm i @tailwindcss/typography @tailwindcss/forms tailwindcss-animate
    // require("@tailwindcss/typography"),
    // require("@tailwindcss/forms"),
    // require("tailwindcss-animate"),
  ],
};

export default config;
