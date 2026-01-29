/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                primary: '#6366f1',
                'primary-light': '#818cf8',
                'primary-dark': '#4f46e5',
                secondary: '#f472b6',
                dark: '#1e293b',
                darker: '#0f172a',
                light: '#f8fafc',
                'gray-med': '#94a3b8',
                success: '#10b981',
                danger: '#ef4444',
            },
            fontFamily: {
                sans: ['Poppins', 'sans-serif'],
            }
        },
    },
    plugins: [],
}
