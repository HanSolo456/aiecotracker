/**
 * True when running inside a Tauri WebView (popups are unreliable).
 * Google sign-in: `GoogleSignInTauriButton` — Firebase redirect by default, optional GIS if
 * `NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_ID` is set.
 */
export function isTauriWebview(): boolean {
    if (typeof window === 'undefined') return false;
    return '__TAURI_INTERNALS__' in window || '__TAURI__' in window;
}
