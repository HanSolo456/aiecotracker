/** @type {import('tailwindcss').Config} */
module.exports = {
    content: [
        './app/**/*.{js,ts,jsx,tsx,mdx}',
        './components/**/*.{js,ts,jsx,tsx,mdx}',
    ],
    theme: {
        extend: {
            fontFamily: {
                sans:    ['DM Sans', 'system-ui', 'sans-serif'],
                heading: ['Space Grotesk', 'system-ui', 'sans-serif'],
                mono:    ['monospace'],
            },
            colors: {
                surface: {
                    DEFAULT: '#0A0E1A',
                    elevated: '#0F1424',
                    card: '#111827',
                    border: '#1F2937',
                    subtle: '#161E2E',
                },
                brand: {
                    lime:       '#84cc16',
                    'lime-dim': '#4d7c0f',
                    'lime-glow':'rgba(132,204,22,0.15)',
                    // kept for backward compat
                    green:      '#84cc16',
                    'green-dim':'#4d7c0f',
                    'green-glow':'rgba(132,204,22,0.15)',
                },
                hazard: {
                    red:        '#EF4444',
                    'red-dim':  '#DC2626',
                    'red-glow': 'rgba(239,68,68,0.15)',
                    amber:      '#F59E0B',
                    'amber-dim':'#D97706',
                    'amber-glow':'rgba(245,158,11,0.15)',
                },
                grade: {
                    A: '#84cc16',
                    B: '#F59E0B',
                    C: '#EF4444',
                },
            },
            borderRadius: {
                '2xl': '1rem',
                '3xl': '1.5rem',
            },
            boxShadow: {
                'lime-glow': '0 0 24px rgba(132,204,22,0.2)',
                'red-glow':  '0 0 24px rgba(239,68,68,0.2)',
                card:        '0 4px 24px rgba(0,0,0,0.5)',
            },
            animation: {
                'pulse-slow':   'pulse 3s cubic-bezier(0.4,0,0.6,1) infinite',
                'fade-up':      'fadeUp 0.4s ease forwards',
                'fade-in':      'fadeIn 0.3s ease forwards',
                shimmer:        'shimmer 1.5s infinite',
                'pulse-ring':   'pulseRing 2s ease-in-out infinite',
                'border-glow':  'borderGlow 3s ease-in-out infinite',
                'scan-line':    'scanLine 2s ease-in-out infinite',
            },
            keyframes: {
                fadeUp: {
                    '0%':   { opacity: '0', transform: 'translateY(16px)' },
                    '100%': { opacity: '1', transform: 'translateY(0)' },
                },
                fadeIn: {
                    '0%':   { opacity: '0' },
                    '100%': { opacity: '1' },
                },
                shimmer: {
                    '0%':   { backgroundPosition: '-200% 0' },
                    '100%': { backgroundPosition: '200% 0' },
                },
                pulseRing: {
                    '0%':   { transform: 'scale(0.95)', boxShadow: '0 0 0 0 rgba(132,204,22,0.4)' },
                    '70%':  {                           boxShadow: '0 0 0 12px rgba(132,204,22,0)' },
                    '100%': { transform: 'scale(0.95)', boxShadow: '0 0 0 0 rgba(132,204,22,0)' },
                },
                borderGlow: {
                    '0%, 100%': { borderColor: 'rgba(132,204,22,0.2)' },
                    '50%':      { borderColor: 'rgba(132,204,22,0.5)', boxShadow: '0 0 20px rgba(132,204,22,0.15)' },
                },
                scanLine: {
                    '0%':   { top: '10%' },
                    '50%':  { top: '85%' },
                    '100%': { top: '10%' },
                },
            },
        },
    },
    plugins: [],
};
