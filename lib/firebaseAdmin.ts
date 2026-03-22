import { initializeApp, getApps, cert, type App } from 'firebase-admin/app';

// ─────────────────────────────────────────────────────────────────────────────
// Firebase Admin SDK initialisation — singleton, safe to call multiple times.
//
// Required env vars (set in .env.local):
//   FIREBASE_ADMIN_PROJECT_ID
//   FIREBASE_ADMIN_CLIENT_EMAIL
//   FIREBASE_ADMIN_PRIVATE_KEY   (include the \n newlines)
// ─────────────────────────────────────────────────────────────────────────────

let adminApp: App | null = null;

export function initializeAdmin(): App {
    if (adminApp) return adminApp;

    // Re-use if already initialised (hot-reload safety)
    if (getApps().length > 0) {
        adminApp = getApps()[0];
        return adminApp;
    }

    const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n');

    if (!projectId || !clientEmail || !privateKey) {
        throw new Error(
            'Firebase Admin SDK not configured. Set FIREBASE_ADMIN_PROJECT_ID, ' +
            'FIREBASE_ADMIN_CLIENT_EMAIL, and FIREBASE_ADMIN_PRIVATE_KEY in .env.local'
        );
    }

    adminApp = initializeApp({
        credential: cert({ projectId, clientEmail, privateKey }),
        projectId,
    });

    return adminApp;
}
