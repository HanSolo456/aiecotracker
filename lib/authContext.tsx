'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import {
    getRedirectResult,
    onAuthStateChanged,
    signOut as firebaseSignOut,
    type User,
} from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db, firebaseReady } from '@/lib/firebase';
import {
    clearGoogleRedirectPending,
    clearGoogleRedirectState,
    hasGoogleRedirectPending,
    saveGoogleRedirectError,
} from '@/lib/firebase';

// ─── Types ────────────────────────────────────────────────────────────────────

export type UserRole = 'worker' | 'org_admin' | 'superadmin';

export interface UserProfile {
    uid: string;
    email: string | null;
    displayName: string | null;
    photoURL: string | null;
    role: UserRole;
    orgId: string | null;
}

interface AuthContextValue {
    user: User | null;
    profile: UserProfile | null;
    loading: boolean;
    signOut: () => Promise<void>;
    refreshProfile: () => Promise<void>;
}

// ─── Context ──────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextValue>({
    user: null,
    profile: null,
    loading: true,
    signOut: async () => {},
    refreshProfile: async () => {},
});

export function useAuth() {
    return useContext(AuthContext);
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function AuthContextProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [loading, setLoading] = useState(true);

    async function fetchOrCreateProfile(firebaseUser: User): Promise<UserProfile> {
        const ref = doc(db, 'users', firebaseUser.uid);
        const snap = await getDoc(ref);

        if (snap.exists()) {
            const data = snap.data() as UserProfile;
            // Firestore may be missing displayName/photoURL (e.g. created before Google link) while
            // Firebase Auth has them — merge so UI and sidebar stay in sync with Google sign-in.
            const hasDisplay =
                typeof data.displayName === 'string' && data.displayName.trim().length > 0;
            const displayName = hasDisplay ? data.displayName : (firebaseUser.displayName ?? null);
            const photoURL = data.photoURL || firebaseUser.photoURL || null;
            const email = data.email ?? firebaseUser.email ?? null;

            const merged: UserProfile = {
                ...data,
                uid: firebaseUser.uid,
                email,
                displayName,
                photoURL,
            };

            const patch: Partial<UserProfile> = {};
            if (displayName !== data.displayName) patch.displayName = displayName;
            if (photoURL !== data.photoURL) patch.photoURL = photoURL;
            if (email !== data.email) patch.email = email;

            if (Object.keys(patch).length > 0) {
                await setDoc(ref, patch, { merge: true });
            }

            return merged;
        }

        const newProfile: UserProfile = {
            uid: firebaseUser.uid,
            email: firebaseUser.email,
            displayName: firebaseUser.displayName,
            photoURL: firebaseUser.photoURL,
            role: 'worker',
            orgId: null,
        };

        await setDoc(ref, { ...newProfile, createdAt: serverTimestamp() });
        return newProfile;
    }

    async function refreshProfile() {
        if (!user) return;
        const p = await fetchOrCreateProfile(user);
        setProfile(p);
    }

    async function signOut() {
        if (!firebaseReady) return;
        await firebaseSignOut(auth);
        setUser(null);
        setProfile(null);
    }

    useEffect(() => {
        if (!firebaseReady) {
            setLoading(false);
            return;
        }

        let cancelled = false;
        const unsubRef: { current: (() => void) | undefined } = { current: undefined };

        const applyAuthUser = async (firebaseUser: User | null) => {
            if (cancelled) return;
            try {
                if (firebaseUser) {
                    setUser(firebaseUser);
                    if (!firebaseUser.isAnonymous) {
                        try {
                            const p = await fetchOrCreateProfile(firebaseUser);
                            if (!cancelled) setProfile(p);
                        } catch (err) {
                            console.warn('[AuthContext] profile fetch failed:', err);
                            if (!cancelled) setProfile(null);
                        }
                    } else {
                        setProfile(null);
                    }
                } else {
                    setUser(null);
                    setProfile(null);
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        };

        void (async () => {
            let redirectUser: User | null = null;
            try {
                const redirectCred = await getRedirectResult(auth);
                redirectUser = redirectCred?.user ?? null;
                if (redirectUser) {
                    clearGoogleRedirectState();
                    if (redirectCred) {
                        (window as any).__googleRedirectCredential = redirectCred;
                    }
                }
            } catch (err) {
                const code = (err as { code?: string })?.code ?? 'auth/redirect-failed';
                saveGoogleRedirectError(code);
                clearGoogleRedirectPending();
                console.warn('[AuthContext] getRedirectResult:', err);
            }

            if (cancelled) return;

            // If we just returned from Google redirect, apply immediately (WebView can race with
            // onAuthStateChanged — subscribing after redirect may miss the first emission).
            if (redirectUser) {
                await applyAuthUser(redirectUser);
            }

            // WebView/Tauri: wait until persisted session + redirect are fully applied before
            // we trust onAuthStateChanged. Otherwise the first emission can be null and AuthGuard
            // sends the user back to /auth while the session is still restoring.
            try {
                await auth.authStateReady();
            } catch {
                /* ignore */
            }

            // If we initiated redirect, came back, and still have no user, surface a concrete
            // error code for the auth page instead of silently showing login again.
            if (!redirectUser && !auth.currentUser && hasGoogleRedirectPending()) {
                saveGoogleRedirectError('auth/redirect-no-user');
                clearGoogleRedirectPending();
            }

            if (cancelled) return;

            // If redirect already applied, we still subscribe for future changes (sign out, etc.)
            unsubRef.current = onAuthStateChanged(auth, (firebaseUser) => {
                void (async () => {
                    let u = firebaseUser;
                    if (u === null && auth.currentUser) {
                        u = auth.currentUser;
                    }
                    if (u) {
                        clearGoogleRedirectState();
                    }
                    await applyAuthUser(u);
                })();
            });
        })();

        return () => {
            cancelled = true;
            unsubRef.current?.();
        };
    }, []);

    return (
        <AuthContext.Provider value={{ user, profile, loading, signOut, refreshProfile }}>
            {children}
        </AuthContext.Provider>
    );
}
