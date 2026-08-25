// Pre-built stylesheet config for pages that never toggle a `dark` class and
// rely on the prefers-color-scheme media query directly (public marketing
// and account pages that shipped without the dashboard's boot script). Paired
// with tailwind.config.class.js. Build with `npm run build:css` in
// marketplace-backend.
module.exports = {
  content: [
    './**/*.html',
    './js/**/*.js',
  ],
  darkMode: 'media',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Satoshi', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
    },
  },
};
