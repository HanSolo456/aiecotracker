const GSI_SRC = 'https://accounts.google.com/gsi/client';

/** Loads Google Identity Services (required for Tauri / embedded WebView Google sign-in). */
export function loadGoogleIdentityScript(): Promise<void> {
    if (typeof window === 'undefined') return Promise.resolve();
    if (window.google?.accounts?.id) return Promise.resolve();

    return new Promise((resolve, reject) => {
        const existing = document.querySelector(`script[src="${GSI_SRC}"]`);
        if (existing) {
            existing.addEventListener('load', () => resolve());
            existing.addEventListener('error', () => reject(new Error('Failed to load Google Sign-In script')));
            return;
        }
        const s = document.createElement('script');
        s.src = GSI_SRC;
        s.async = true;
        s.defer = true;
        s.onload = () => resolve();
        s.onerror = () => reject(new Error('Failed to load Google Sign-In script'));
        document.head.appendChild(s);
    });
}
