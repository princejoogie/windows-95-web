module.exports = {
  mode: "jit",
  purge: ["./index.html", "./src/**/*.{vue,js,ts,jsx,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        primary: "#008080",
        secondary: "#c0c0c0",
        blueAccent: "#000080",
      },
    },
  },
  variants: {
    extend: {},
  },
  plugins: [],
};
