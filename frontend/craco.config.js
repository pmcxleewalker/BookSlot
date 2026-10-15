// craco.config.js
const path = require("path");

module.exports = {
  // Linting is not run during builds so hosting providers that set CI=true
  // (Netlify, Vercel, Render...) don't fail the build on lint warnings.
  eslint: { enable: false },
  webpack: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
};
