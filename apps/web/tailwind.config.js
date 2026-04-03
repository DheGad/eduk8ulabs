/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "Menlo", "monospace"],
      },
      colors: {
        surface: {
          50:  "#f8f8f8",
          100: "#efefef",
          800: "#1a1a1a",
          900: "#111111",
          950: "#0a0a0a",
        },
        accent: {
          DEFAULT: "#7c3aed",
          hover:   "#6d28d9",
          light:   "#8b5cf6",
          glow:    "rgba(124, 58, 237, 0.25)",
        },
        border: {
          subtle: "rgba(255,255,255,0.07)",
          default: "rgba(255,255,255,0.12)",
        },
      },
      backgroundImage: {
        "grid-pattern":
          "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.08) 1px, transparent 0)",
      },
      backgroundSize: {
        "grid-sm": "24px 24px",
      },
      animation: {
        "fade-in":    "fadeIn 0.4s ease forwards",
        "slide-up":   "slideUp 0.35s ease forwards",
        "pulse-glow": "pulseGlow 2.5s ease-in-out infinite",
      },
      keyframes: {
        fadeIn: {
          from: { opacity: "0" },
          to:   { opacity: "1" },
        },
        slideUp: {
          from: { opacity: "0", transform: "translateY(12px)" },
          to:   { opacity: "1", transform: "translateY(0)" },
        },
        pulseGlow: {
          "0%, 100%": { boxShadow: "0 0 0px rgba(124,58,237,0)" },
          "50%":       { boxShadow: "0 0 24px rgba(124,58,237,0.4)" },
        },
      },
    },
  },
  plugins: [],
};
