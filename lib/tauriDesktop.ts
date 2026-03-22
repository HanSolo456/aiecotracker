declare global {
    interface Window {
        __TAURI__?: {
            core?: {
                invoke: <T>(cmd: string, args?: Record<string, unknown>) => Promise<T>;
            };
        };
        __TAURI_INTERNALS__?: {
            invoke: <T>(cmd: string, args?: Record<string, unknown>) => Promise<T>;
        };
    }
}

function getTauriInvoke() {
    return window.__TAURI__?.core?.invoke ?? window.__TAURI_INTERNALS__?.invoke;
}

export async function invokeTauri<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
    if (typeof window === 'undefined') {
        throw new Error('Tauri desktop APIs are unavailable on the server.');
    }

    const invoke = getTauriInvoke();
    if (!invoke) {
        throw new Error('Tauri desktop APIs are unavailable in this window.');
    }

    return invoke<T>(cmd, args);
}

export async function openExternalUrl(url: string): Promise<void> {
    await invokeTauri<void>('open_external_url', { url });
}
