/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        navy:   "#225379",
        teal:   "#56BBC2",
        ink:    "#1A1A1A",
        paper:  "#FBFAF6",
        paper2: "#F2F0E8",
      },
      fontFamily: {
        hand:  ["'Intelo'", "system-ui", "sans-serif"],
        hand2: ["'Intelo'", "system-ui", "sans-serif"],
        body:  ["'Intelo'", "system-ui", "sans-serif"],
      },
      borderWidth: { '1.5': '1.5px' },
    },
  },
  plugins: [],
}
