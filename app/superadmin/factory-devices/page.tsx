'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, Wrench, Copy, Check } from 'lucide-react';
import { useAuth } from '@/lib/authContext';

type DeviceType = 'esp32_gateway' | 'raspberry_pi';

export default function SuperadminFactoryDevicesPage() {
  const router = useRouter();
  const { user, profile, loading } = useAuth();
  const [deviceId, setDeviceId] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [batchId, setBatchId] = useState('');
  const [deviceType, setDeviceType] = useState<DeviceType>('esp32_gateway');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [latestBootstrapToken, setLatestBootstrapToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!loading && (!user || profile?.role !== 'superadmin')) {
      router.replace('/auth');
    }
  }, [loading, user, profile, router]);

  if (loading || !user || profile?.role !== 'superadmin') {
    return null;
  }

  async function createFactoryDevice() {
    if (!user) return;

    const cleanDeviceId = deviceId.trim().toLowerCase();
    const cleanDisplayName = displayName.trim();
    const cleanBatchId = batchId.trim();

    if (!cleanDeviceId || !cleanDisplayName) {
      setMessage('Please enter both device ID and display name.');
      return;
    }

    setBusy(true);
    setMessage(null);
    setLatestBootstrapToken(null);
    setCopied(false);

    try {
      const token = await user.getIdToken();
      const res = await fetch('/api/superadmin/factory-devices', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          deviceId: cleanDeviceId,
          displayName: cleanDisplayName,
          deviceType,
          batchId: cleanBatchId || undefined,
        }),
      });

      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage(payload?.error || 'Failed to create factory device.');
        return;
      }

      setLatestBootstrapToken(payload.bootstrapToken || null);
      setMessage('Factory device created. Copy bootstrap token into DEVICE_TOKEN_BOOTSTRAP.');
      setDeviceId('');
      setDisplayName('');
      setBatchId('');
    } catch {
      setMessage('Failed to create factory device.');
    } finally {
      setBusy(false);
    }
  }

  async function copyToken() {
    if (!latestBootstrapToken) return;
    await navigator.clipboard.writeText(latestBootstrapToken);
    setCopied(true);
    setTimeout(() => setCopied(false), 1400);
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-primary)' }}>
      <div className="safe-top px-5 pt-6 pb-5 lg:px-10 lg:pt-10 lg:pb-8 bg-grid">
        <div className="flex items-center gap-3 mb-4">
          <button
            onClick={() => router.replace('/settings')}
            className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}
          >
            <ChevronLeft size={16} style={{ color: 'var(--text-secondary)' }} />
          </button>
        </div>

        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background: 'var(--lime-glow)', border: '1px solid var(--lime-border)' }}
          >
            <Wrench size={16} style={{ color: 'var(--lime)' }} />
          </div>
          <div>
            <h1 className="page-title text-3xl lg:text-4xl text-white">Superadmin Factory Console</h1>
            <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>
              Isolated tool for factory inventory and bootstrap token generation.
            </p>
          </div>
        </div>
      </div>

      <div className="px-5 lg:px-10 mt-4 pb-10 flex flex-col gap-4">
        <div className="card p-4">
          <p className="text-sm font-semibold text-white mb-3">Create Factory Device</p>

          <div className="grid grid-cols-1 gap-3">
            <input
              value={deviceId}
              onChange={(e) => setDeviceId(e.target.value)}
              placeholder="deviceId (e.g. acme-batch-2025-unit-1)"
              className="rounded-xl px-3 py-2 text-sm"
              style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
            />

            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="displayName (e.g. ACME Unit 1)"
              className="rounded-xl px-3 py-2 text-sm"
              style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
            />

            <input
              value={batchId}
              onChange={(e) => setBatchId(e.target.value)}
              placeholder="batchId (optional, e.g. acme-batch-2025)"
              className="rounded-xl px-3 py-2 text-sm"
              style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
            />

            <select
              value={deviceType}
              onChange={(e) => setDeviceType(e.target.value as DeviceType)}
              className="rounded-xl px-3 py-2 text-sm"
              style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
            >
              <option value="esp32_gateway">ESP32 Gateway</option>
              <option value="raspberry_pi">Raspberry Pi</option>
            </select>

            <button
              onClick={createFactoryDevice}
              disabled={busy}
              className="rounded-xl px-4 py-2 text-sm font-semibold disabled:opacity-50"
              style={{ background: 'var(--lime-glow)', border: '1px solid var(--lime-border)', color: 'var(--lime)' }}
            >
              {busy ? 'Creating...' : 'Create Device + Bootstrap Token'}
            </button>
          </div>
        </div>

        {latestBootstrapToken && (
          <div className="card p-4" style={{ borderColor: 'rgba(132,204,22,0.35)' }}>
            <p className="text-xs font-semibold mb-2" style={{ color: 'var(--lime)' }}>
              Bootstrap Token
            </p>
            <p className="text-xs break-all" style={{ color: 'var(--text-primary)' }}>
              {latestBootstrapToken}
            </p>
            <button
              onClick={copyToken}
              className="mt-3 inline-flex items-center gap-1 rounded-xl px-3 py-2 text-xs font-semibold"
              style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}
            >
              {copied ? <Check size={13} /> : <Copy size={13} />}
              {copied ? 'Copied' : 'Copy Token'}
            </button>
          </div>
        )}

        {message && (
          <div className="card p-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
            {message}
          </div>
        )}
      </div>
    </div>
  );
}
