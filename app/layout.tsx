import type { Metadata, Viewport } from 'next';
import { cookies } from 'next/headers';
import './globals.css';
import AuthProvider from '@/components/AuthProvider';
import RoutePrefetcher from '@/components/RoutePrefetcher';
import ThemeProvider from '@/components/ThemeProvider';
import LanguageProvider from '@/components/LanguageProvider';
import NotificationBootstrap from '@/components/NotificationBootstrap';
import AppShell from '@/components/AppShell';

export const metadata: Metadata = {
    title: 'AI-EcoTrack | Circular Waste Intelligence',
    description:
        'AI-vision waste classification and IoT-enabled tracking platform for PCBs, e-waste, industrial parts, and general waste. Promotes circular economy through data-driven insights.',
    manifest: '/manifest.json',
    appleWebApp: {
        capable: true,
        statusBarStyle: 'black-translucent',
        title: 'AI-EcoTrack',
    },
};

export const viewport: Viewport = {
    themeColor: '#0A0E1A',
    width: 'device-width',
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
    const cookieStore = await cookies();
    const themeCookie = cookieStore.get('aiecotrack-theme')?.value;
    const initialTheme = themeCookie === 'light' || themeCookie === 'dark' ? themeCookie : 'dark';

    return (
        <html
            lang="en"
            data-theme={initialTheme}
            data-scroll-behavior="smooth"
            suppressHydrationWarning
        >
            <head>
                <link rel="apple-touch-icon" href="/icons/icon-192.png" />
            </head>
            <body className="antialiased" style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)' }}>
                <ThemeProvider>
                    <LanguageProvider>
                        <AuthProvider>
                            <RoutePrefetcher />
                            <NotificationBootstrap />
                            <AppShell>{children}</AppShell>
                        </AuthProvider>
                    </LanguageProvider>
                </ThemeProvider>
            </body>
        </html>
    );
}
