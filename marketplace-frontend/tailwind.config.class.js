// Pre-built stylesheet config for pages that toggle dark mode via a `dark`
// class on <html> (the authenticated dashboard, login, register — see the
// boot script in dashboard.html that mirrors prefers-color-scheme into that
// class). Paired with tailwind.config.media.js, which serves the pages that
// rely on the media query directly. Build with `npm run build:css` in
// marketplace-backend.
module.exports = {
  content: [
    './**/*.html',
    './js/**/*.js',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Satoshi', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
    },
  },
};
