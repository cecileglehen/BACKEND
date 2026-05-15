/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        delt: {
          bg: "#ffffff",
          surface: "#f8fafc",
          panel: "#f1f5f9",
          border: "#e2e8f0",
          accent: "#6366f1",
          accent2: "#0891b2",
          text: "#0f172a",
          muted: "#64748b",
          danger: "#ef4444",
          gold: "#f59e0b",
          green: "#10b981"
        }
      },
      fontFamily: {
        sans: ["Plus Jakarta Sans", "Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "monospace"]
      },
      boxShadow: {
        card: "0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04)",
        cardHover: "0 4px 12px rgba(0,0,0,0.10), 0 2px 4px rgba(0,0,0,0.06)",
        pop: "0 8px 24px rgba(0,0,0,0.12)"
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0", transform: "translateY(4px)" },
          "100%": { opacity: "1", transform: "translateY(0)" }
        },
        pulse: {
          "0%,100%": { opacity: "1" },
          "50%": { opacity: "0.4" }
        },
        slideInLeft: {
          "0%":   { opacity: "0", transform: "translateX(-100%)" },
          "100%": { opacity: "1", transform: "translateX(0)" }
        },
        slideUp: {
          "0%":   { opacity: "0", transform: "translateY(12px)" },
          "100%": { opacity: "1", transform: "translateY(0)" }
        },
        backdropFade: {
          "0%":   { opacity: "0" },
          "100%": { opacity: "1" }
        }
      },
      animation: {
        fadeIn: "fadeIn 0.2s ease-out",
        pulse: "pulse 1.5s ease-in-out infinite",
        slideInLeft: "slideInLeft 0.28s cubic-bezier(0.32, 0.72, 0, 1)",
        slideUp: "slideUp 0.25s cubic-bezier(0.32, 0.72, 0, 1)",
        backdropFade: "backdropFade 0.2s ease-out"
      }
    }
  },
  plugins: []
};
