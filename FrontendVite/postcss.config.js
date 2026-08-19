export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
    // Auto-generates [dir="rtl"] overrides for every direction-sensitive rule
    // (margins, padding, position, text-align, etc.) so the whole UI mirrors
    // under <html dir="rtl"> without editing physical Tailwind classes.
    "postcss-rtlcss": {},
  },
};
