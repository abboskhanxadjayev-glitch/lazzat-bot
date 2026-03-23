/** @type {import("tailwindcss").Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        lazzat: {
          cream: "#FFF7EF",
          gold: "#D1A13E",
          red: "#8F0E12",
          maroon: "#5A0707",
          ink: "#2C1713"
        }
      },
      boxShadow: {
        lazzat: "0 18px 45px rgba(90, 7, 7, 0.16)",
        insetGold: "inset 0 1px 0 rgba(255, 224, 164, 0.65)"
      },
      backgroundImage: {
        hero: "linear-gradient(135deg, rgba(90,7,7,0.96), rgba(143,14,18,0.9) 52%, rgba(209,161,62,0.8))",
        surface: "linear-gradient(180deg, rgba(255,255,255,0.95), rgba(255,247,239,0.92))"
      },
      animation: {
        floatUp: "floatUp 0.7s ease-out both"
      },
      keyframes: {
        floatUp: {
          "0%": {
            opacity: "0",
            transform: "translateY(16px)"
          },
          "100%": {
            opacity: "1",
            transform: "translateY(0)"
          }
        }
      }
    }
  },
  plugins: []
};
