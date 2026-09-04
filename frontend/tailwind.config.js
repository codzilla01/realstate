/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        gold: {
          DEFAULT: "#D4AF37",
          light: "#E9CD6B",
          dark: "#A9862B",
        },
        ink: {
          900: "#0B0C10",
          800: "#14161C",
          700: "#1C1F27",
        },
      },
      fontFamily: {
        sans: ["Tajawal", "Inter", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
