/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  safelist: [
    'font-sans',
    'font-serif',
    'font-mono',
    'antialiased',
    'bg-[var(--color-bg)]',
    'text-[var(--color-text)]'
  ],
  theme: {
    extend: {},
    fontFamily: {
      sans: ['ui-sans-serif', 'system-ui', 'sans-serif'],
      serif: ['ui-serif', 'Georgia', 'serif'],
      mono: ['ui-monospace', 'SFMono-Regular', 'monospace'],
    }
  },
  plugins: [],
}
