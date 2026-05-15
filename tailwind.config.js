/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: { blue: "#00A4E0", green: "#00D664" },
        navy: { 900: "#1a1f2e", 800: "#242b3d", 700: "#2d3548", 600: "#3a4256" },
      },
    },
  },
  plugins: [],
};
