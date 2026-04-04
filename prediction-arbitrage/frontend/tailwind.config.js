/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        "pa-bg": "#0F172A",
        "pa-card": "#1E293B",
        "pa-muted": "#94A3B8",
        "pa-text": "#F1F5F9",
        "pa-blue": "#3B82F6",
        "pa-green": "#10B981",
        "pa-red": "#EF4444",
        "pa-gold": "#F59E0B",
        "pa-purple": "#A855F7",
      },
      fontFamily: {
        sans: ["'DM Sans'", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["'DM Mono'", "Monaco", "ui-monospace", "monospace"],
      },
      animation: {
        marquee: "marquee 30s linear infinite",
      },
      keyframes: {
        marquee: {
          "0%": { transform: "translateX(0)" },
          "100%": { transform: "translateX(-50%)" },
        },
      },
    },
  },
  plugins: [],
};
