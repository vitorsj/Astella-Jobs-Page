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
        hand:  ["'Kalam'", "'Caveat'", "'Architects Daughter'", "cursive"],
        hand2: ["'Caveat'", "cursive"],
        body:  ["'Architects Daughter'", "'Kalam'", "cursive"],
      },
      borderWidth: { '1.5': '1.5px' },
    },
  },
  plugins: [],
}
