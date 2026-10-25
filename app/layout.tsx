import type { Metadata, Viewport } from 'next';
import { cookies } from 'next/headers';
import 'lenis/dist/lenis.css';
import './globals.css';
import AuthProvider from '@/components/AuthProvider';
import RoutePrefetcher from '@/components/RoutePrefetcher';
import ThemeProvider from '@/components/ThemeProvider';
import LanguageProvider from '@/components/LanguageProvider';
import NotificationBootstrap from '@/components/NotificationBootstrap';
import AppShell from '@/components/AppShell';
import SmoothScroll from '@/components/SmoothScroll';
import EcoCursorFollower from '@/components/EcoCursorFollower';

export const metadata: Metadata = {
    title: 'AI-EcoTrack | Circular Waste Intelligence',
    description:
        'AI-vision waste classification and IoT-enabled tracking platform for PCBs, e-waste, industrial parts, and general waste. Promotes circular economy through data-driven insights.',
    manifest: '/manifest.json',
    icons: {
        icon: { url: '/icons/icon-192.png', type: 'image/png', sizes: '192x192' },
        shortcut: '/icons/icon-192.png',
        apple: '/icons/icon-192.png',
    },
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
            suppressHydrationWarning
        >
            <body className="antialiased" style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)' }}>
                <SmoothScroll>
                    <EcoCursorFollower />
                    <ThemeProvider>
                        <LanguageProvider>
                            <AuthProvider>
                                <RoutePrefetcher />
                                <NotificationBootstrap />
                                <AppShell>{children}</AppShell>
                            </AuthProvider>
                        </LanguageProvider>
                    </ThemeProvider>
                </SmoothScroll>
            </body>
        </html>
    );
}
