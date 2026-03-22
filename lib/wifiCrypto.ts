import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';

// ────────────────────────────────────────────────────────────────────────────
// WiFi Credential Encryption/Decryption
// Uses AES-256-GCM with a master key derived from environment variable.
// ────────────────────────────────────────────────────────────────────────────

const WIFI_MASTER_KEY = process.env.WIFI_ENCRYPTION_KEY;

if (!WIFI_MASTER_KEY) {
    console.warn('[wifiCrypto] WIFI_ENCRYPTION_KEY not set. WiFi credentials will not be encrypted.');
}

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const SALT_LENGTH = 16;

interface EncryptedWiFiPayload {
    encrypted: string; // base64: salt + iv + authTag + ciphertext
    algorithm: string;
}

/**
 * Encrypt WiFi SSID and password.
 * Returns a compact encrypted payload.
 */
export function encryptWiFiCredentials(ssid: string, password: string): EncryptedWiFiPayload {
    if (!WIFI_MASTER_KEY) {
        throw new Error('WIFI_ENCRYPTION_KEY not configured');
    }

    const payload = JSON.stringify({ ssid, password });
    const salt = randomBytes(SALT_LENGTH);
    const key = scryptSync(WIFI_MASTER_KEY, salt, 32);
    const iv = randomBytes(IV_LENGTH);

    const cipher = createCipheriv(ALGORITHM, key, iv);
    let encrypted = cipher.update(payload, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag();
    const combined = Buffer.concat([salt, iv, authTag, Buffer.from(encrypted, 'hex')]);

    return {
        encrypted: combined.toString('base64'),
        algorithm: ALGORITHM,
    };
}

/**
 * Decrypt WiFi SSID and password.
 */
export function decryptWiFiCredentials(payload: EncryptedWiFiPayload): { ssid: string; password: string } {
    if (!WIFI_MASTER_KEY) {
        throw new Error('WIFI_ENCRYPTION_KEY not configured');
    }

    const combined = Buffer.from(payload.encrypted, 'base64');
    const salt = combined.slice(0, SALT_LENGTH);
    const iv = combined.slice(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
    const authTag = combined.slice(SALT_LENGTH + IV_LENGTH, SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH);
    const encrypted = combined.slice(SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH).toString('hex');

    const key = scryptSync(WIFI_MASTER_KEY, salt, 32);
    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return JSON.parse(decrypted);
}
