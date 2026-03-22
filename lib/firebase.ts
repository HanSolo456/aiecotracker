import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import { getFirestore, type Firestore } from 'firebase/firestore';
import {
    getAuth,
    initializeAuth,
    indexedDBLocalPersistence,
    browserLocalPersistence,
    browserPopupRedirectResolver,
    GoogleAuthProvider,
    signInWithPopup,
    signInWithRedirect,
    signInWithCredential,
    signInWithEmailAndPassword,
    signInWithCustomToken,
    createUserWithEmailAndPassword,
    sendPasswordResetEmail,
    updateProfile,
    signInAnonymously,
    type User,
    type Auth,
} from 'firebase/auth';
import { isTauriWebview } from '@/lib/isTauriWebview';

const GOOGLE_REDIRECT_PENDING_KEY = 'aiecotrack:google-redirect-pending';
const GOOGLE_REDIRECT_ERROR_KEY = 'aiecotrack:google-redirect-error';

const SETUP_MSG =
    'Firebase is not configured or failed to initialize. Copy `.env.local.example` to `.env.local` in the project root, set all `NEXT_PUBLIC_FIREBASE_*` values from the Firebase console, then restart the dev server.';

const firebaseConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const apiKey = typeof firebaseConfig.apiKey === 'string' ? firebaseConfig.apiKey.trim() : '';

/** True when env looks configured (not missing / not the example placeholder). */
export const firebaseClientConfigured =
    apiKey.length > 0 && apiKey !== 'your_firebase_api_key';

let _app: FirebaseApp | undefined;
let _db: Firestore | undefined;
let _auth: Auth | undefined;

if (firebaseClientConfigured) {
    try {
        _app = getApps().length ? getApp() : initializeApp(firebaseConfig);
        _db = getFirestore(_app);
        // Tauri/WebView: initializeAuth with IndexedDB persistence can avoid referrer/storage issues
        // that break getAuth() + signInWithRedirect. See: github.com/tauri-apps/tauri/discussions/4805
        if (typeof window !== 'undefined' && isTauriWebview()) {
            try {
                _auth = initializeAuth(_app, {
                    persistence: [indexedDBLocalPersistence, browserLocalPersistence],
                    popupRedirectResolver: browserPopupRedirectResolver,
                });
            } catch {
                // Hot reload / duplicate init — fall back to default instance
                _auth = getAuth(_app);
            }
        } else {
            _auth = getAuth(_app);
        }
    } catch (err) {
        console.error('[firebase]', err);
        _app = undefined;
        _db = undefined;
        _auth = undefined;
    }
}

/** True when the client SDK initialized successfully (safe to use auth / db). */
export const firebaseReady = Boolean(_app && _db && _auth);

function deadFirestore(): Firestore {
    return new Proxy({} as Firestore, {
        get: () => {
            throw new Error(SETUP_MSG);
        },
    });
}

function deadAuth(): Auth {
    return new Proxy({} as Auth, {
        get: () => {
            throw new Error(SETUP_MSG);
        },
    });
}

export const db: Firestore = _db ?? deadFirestore();
export const auth: Auth = _auth ?? deadAuth();

/** Use with `firebase/messaging` only after checking `firebaseReady`. */
export const firebaseApp: FirebaseApp | undefined = _app;

/** @deprecated Prefer `firebaseApp`; kept for any legacy default imports. */
const app = _app;
export default app;

function assertReady(): void {
    if (!firebaseReady) {
        throw new Error(SETUP_MSG);
    }
}

function canUseSessionStorage(): boolean {
    return typeof window !== 'undefined' && typeof window.sessionStorage !== 'undefined';
}

function setGoogleRedirectPending(v: boolean): void {
    if (!canUseSessionStorage()) return;
    try {
        if (v) window.sessionStorage.setItem(GOOGLE_REDIRECT_PENDING_KEY, '1');
        else window.sessionStorage.removeItem(GOOGLE_REDIRECT_PENDING_KEY);
    } catch {
        // ignore storage errors in restrictive WebViews
    }
}

export function clearGoogleRedirectPending(): void {
    setGoogleRedirectPending(false);
}

export function hasGoogleRedirectPending(): boolean {
    if (!canUseSessionStorage()) return false;
    try {
        return window.sessionStorage.getItem(GOOGLE_REDIRECT_PENDING_KEY) === '1';
    } catch {
        return false;
    }
}

export function saveGoogleRedirectError(code: string): void {
    if (!canUseSessionStorage()) return;
    try {
        window.sessionStorage.setItem(GOOGLE_REDIRECT_ERROR_KEY, code);
    } catch {
        // ignore storage errors in restrictive WebViews
    }
}

export function consumeGoogleRedirectError(): string | null {
    if (!canUseSessionStorage()) return null;
    try {
        const code = window.sessionStorage.getItem(GOOGLE_REDIRECT_ERROR_KEY);
        if (code) window.sessionStorage.removeItem(GOOGLE_REDIRECT_ERROR_KEY);
        return code;
    } catch {
        return null;
    }
}

export function clearGoogleRedirectError(): void {
    if (!canUseSessionStorage()) return;
    try {
        window.sessionStorage.removeItem(GOOGLE_REDIRECT_ERROR_KEY);
    } catch {
        // ignore storage errors in restrictive WebViews
    }
}

export function clearGoogleRedirectState(): void {
    clearGoogleRedirectPending();
    clearGoogleRedirectError();
}

// ── Google Sign-In ────────────────────────────────────────────────────────────

/** Returned when the page is about to navigate away for Google OAuth (browser redirect flow). */
export type GoogleSignInResult = User | 'redirect';

/**
 * Sign in with a Google ID token from Google Identity Services (Tauri / embedded WebView).
 * Use this instead of `signInWithGoogle()` in the desktop app.
 */
export async function signInWithGoogleIdToken(idToken: string): Promise<User> {
    assertReady();
    const credential = GoogleAuthProvider.credential(idToken);
    const cred = await signInWithCredential(auth, credential);
    return cred.user;
}

export async function signInWithGoogleAccessToken(accessToken: string): Promise<User> {
    assertReady();
    const credential = GoogleAuthProvider.credential(null, accessToken);
    const cred = await signInWithCredential(auth, credential);
    return cred.user;
}

export async function signInWithGoogle(): Promise<GoogleSignInResult> {
    assertReady();
    const googleProvider = new GoogleAuthProvider();
    googleProvider.setCustomParameters({ prompt: 'select_account' });

    async function redirect(): Promise<'redirect'> {
        setGoogleRedirectPending(true);
        clearGoogleRedirectError();
        await signInWithRedirect(auth, googleProvider);
        return 'redirect';
    }

    try {
        const cred = await signInWithPopup(auth, googleProvider);
        clearGoogleRedirectState();
        return cred.user;
    } catch (e: unknown) {
        const code = (e as { code?: string })?.code;
        if (code === 'auth/popup-blocked' || code === 'auth/cancelled-popup-request') {
            return redirect();
        }
        // Tauri/WebView often blocks popups — fall through to redirect for other popup failures too
        if (isTauriWebview() && code === 'auth/popup-closed-by-user') {
            throw e;
        }
        if (isTauriWebview()) {
            return redirect();
        }
        throw e;
    }
}

// ── Email / Password ──────────────────────────────────────────────────────────

export async function signInWithEmail(email: string, password: string): Promise<User> {
    assertReady();
    const cred = await signInWithEmailAndPassword(auth, email, password);
    return cred.user;
}

export async function registerWithEmail(
    email: string,
    password: string,
    displayName: string,
): Promise<User> {
    assertReady();
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(cred.user, { displayName });
    return cred.user;
}

export async function resetPassword(email: string): Promise<void> {
    assertReady();
    await sendPasswordResetEmail(auth, email);
}

// ── Anonymous ─────────────────────────────────────────────────────────────────

export async function signInAsGuest(): Promise<User> {
    assertReady();
    const cred = await signInAnonymously(auth);
    return cred.user;
}
