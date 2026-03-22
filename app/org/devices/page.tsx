'use client';

import { useCallback, useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { useAuth } from '@/lib/authContext';
import { useRouter } from 'next/navigation';
import { Camera, ChevronLeft, Cpu, ExternalLink, Link2, Wifi } from 'lucide-react';

const LazyBottomNav = dynamic(() => import('@/components/BottomNav'), {
    ssr: false,
    loading: () => null,
});

interface Device {
    deviceId: string;
    displayName: string;
    status: string;
    deviceType?: 'esp32_gateway' | 'raspberry_pi';
    batchId?: string;
    claimNonce?: string;
    claimNonceExpiry?: string;
    claimVerifiedAt?: string;
    claimConfirmedAt?: string;
    wifiProvisionedAt?: string;
    createdAt?: string;
}

interface BatchStatus {
    batchId: string;
    statuses: {
        factory_pending: number;
        claim_pending: number;
        claim_verified: number;
        claim_confirmed: number;
        active: number;
        inactive: number;
        total: number;
    };
}

type DeviceFilter = 'all' | 'factory_pending' | 'claim_pending' | 'claim_verified' | 'claim_confirmed' | 'active' | 'inactive';

function SkeletonBlock({ className }: { className: string }) {
    return <div className={`shimmer rounded-xl ${className}`} />;
}

function OrgDevicesSkeleton() {
    return (
        <div className="min-h-screen pb-28 lg:pb-10" style={{ background: 'var(--bg-primary)' }}>
            <div className="safe-top px-5 pt-6 pb-5 lg:px-10 lg:pt-10 lg:pb-8 bg-grid">
                <div className="flex items-center gap-3 mb-4">
                    <SkeletonBlock className="h-9 w-9" />
                </div>

                <div className="flex items-center gap-3">
                    <SkeletonBlock className="h-9 w-9" />
                    <div className="min-w-0 flex-1 max-w-md">
                        <SkeletonBlock className="h-10 w-56 max-w-full" />
                        <SkeletonBlock className="h-4 w-full mt-2" />
                    </div>
                </div>
            </div>

            <div className="px-5 lg:px-10 mt-4 flex flex-col gap-4">
                <div className="grid grid-cols-3 gap-2.5">
                    {Array.from({ length: 3 }).map((_, index) => (
                        <div key={index} className="card p-4">
                            <SkeletonBlock className="h-4 w-20 mb-4" />
                            <SkeletonBlock className="h-10 w-12" />
                        </div>
                    ))}
                </div>

                <div className="card p-4">
                    <SkeletonBlock className="h-5 w-44 mb-2" />
                    <SkeletonBlock className="h-4 w-72 max-w-full mb-4" />
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                        <SkeletonBlock className="h-10 w-full" />
                        <SkeletonBlock className="h-10 w-full" />
                    </div>
                    <div className="flex gap-2">
                        <SkeletonBlock className="h-10 w-28" />
                        <SkeletonBlock className="h-10 w-24" />
                    </div>
                </div>

                <div className="card p-4">
                    <SkeletonBlock className="h-5 w-36 mb-2" />
                    <SkeletonBlock className="h-4 w-80 max-w-full mb-4" />
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                        <SkeletonBlock className="h-10 w-full" />
                        <SkeletonBlock className="h-10 w-full" />
                    </div>
                    <SkeletonBlock className="h-10 w-32" />
                </div>

                <div className="card p-4">
                    <div className="flex items-center justify-between gap-3">
                        <SkeletonBlock className="h-5 w-52" />
                        <SkeletonBlock className="h-7 w-28" />
                    </div>
                </div>

                <div className="card p-4">
                    <SkeletonBlock className="h-10 w-full" />
                </div>

                <div className="flex flex-col gap-3 lg:hidden">
                    {Array.from({ length: 3 }).map((_, index) => (
                        <div key={index} className="card p-4 flex flex-col gap-3">
                            <div className="flex items-start justify-between gap-3">
                                <div className="flex-1">
                                    <SkeletonBlock className="h-3 w-16 mb-2" />
                                    <SkeletonBlock className="h-5 w-36 max-w-full" />
                                </div>
                                <SkeletonBlock className="h-7 w-20" />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <SkeletonBlock className="h-3 w-20 mb-2" />
                                    <SkeletonBlock className="h-4 w-24" />
                                </div>
                                <div>
                                    <SkeletonBlock className="h-3 w-12 mb-2" />
                                    <SkeletonBlock className="h-4 w-16" />
                                </div>
                            </div>

                            <SkeletonBlock className="h-9 w-28" />
                        </div>
                    ))}
                </div>

                <div className="hidden lg:block card p-4">
                    <SkeletonBlock className="h-5 w-full mb-3" />
                    {Array.from({ length: 4 }).map((_, index) => (
                        <SkeletonBlock key={index} className="h-12 w-full mb-2 last:mb-0" />
                    ))}
                </div>
            </div>

            <LazyBottomNav />
        </div>
    );
}

export default function OrgDevicesPage() {
    const { user, profile, loading } = useAuth();
    const router = useRouter();
    const [devices, setDevices] = useState<Device[]>([]);
    const [filter, setFilter] = useState<DeviceFilter>('all');
    const [pageLoading, setPageLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [claimingDeviceId, setClaimingDeviceId] = useState<string | null>(null);
    const [confirmingDeviceId, setConfirmingDeviceId] = useState<string | null>(null);
    const [displayNameInput, setDisplayNameInput] = useState('');
    const [claimModal, setClaimModal] = useState(false);
    const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);
    const [wifiConfigured, setWifiConfigured] = useState(false);
    const [wifiSsid, setWifiSsid] = useState('');
    const [wifiPassword, setWifiPassword] = useState('');
    const [wifiSaving, setWifiSaving] = useState(false);
    const [wifiMessage, setWifiMessage] = useState<string | null>(null);

    // Claim new device by ID
    const [claimNewDeviceId, setClaimNewDeviceId] = useState('');
    const [claimNewDisplayName, setClaimNewDisplayName] = useState('');
    const [claimNewBusy, setClaimNewBusy] = useState(false);
    const [claimNewMessage, setClaimNewMessage] = useState<string | null>(null);

    // Device WiFi Setup URL generator
    const [setupPassword, setSetupPassword] = useState('');
    const [configUrl, setConfigUrl] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);

    const handleGenerateConfigUrl = () => {
        if (!wifiSsid.trim() || !setupPassword.trim()) return;
        const url = `http://192.168.4.1/configure?ssid=${encodeURIComponent(wifiSsid.trim())}&pass=${encodeURIComponent(setupPassword.trim())}`;
        setConfigUrl(url);
    };

    const handleCopyUrl = () => {
        if (!configUrl) return;
        navigator.clipboard.writeText(configUrl).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        });
    };

    // Check auth
    useEffect(() => {
        if (!loading && (!user || !profile || profile.role !== 'org_admin')) {
            router.push('/auth');
        }
    }, [user, profile, loading, router]);

    const authHeaders = useCallback(async () => {
        if (!user) return null;
        const token = await user.getIdToken();
        return { Authorization: `Bearer ${token}` };
    }, [user]);

    const refreshDevices = useCallback(async () => {
        if (!profile?.orgId || !user) return;
        const headers = await authHeaders();
        if (!headers) return;

        const res = await fetch('/api/org/devices', { headers });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
            throw new Error(data?.error || 'Failed to fetch devices');
        }
        setDevices(data.devices || []);
    }, [authHeaders, profile?.orgId, user]);

    const refreshWifi = useCallback(async () => {
        if (!profile?.orgId || !user) return;
        const headers = await authHeaders();
        if (!headers) return;

        const res = await fetch(`/api/org/wifi-settings?orgId=${encodeURIComponent(profile.orgId)}`, {
            headers,
        });

        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
            throw new Error(data?.error || 'Failed to load WiFi settings');
        }
        setWifiConfigured(!!data.configured);
        setWifiSsid(data.ssid || '');
    }, [authHeaders, profile?.orgId, user]);

    // Fetch devices and org WiFi settings
    useEffect(() => {
        if (!profile?.orgId || !user || loading) return;

        const fetchAll = async () => {
            try {
                setPageLoading(true);
                await Promise.all([refreshDevices(), refreshWifi()]);
                setError(null);
            } catch (err) {
                const msg = err instanceof Error ? err.message : String(err);
                setError(msg.replace(/^Error:\s*/, ''));
            } finally {
                setPageLoading(false);
            }
        };

        fetchAll();
    }, [loading, profile?.orgId, refreshDevices, refreshWifi, user]);

    const handleSaveWifi = async () => {
        if (!profile?.orgId) return;
        if (!wifiSsid.trim()) {
            setWifiMessage('SSID is required.');
            return;
        }

        const headers = await authHeaders();
        if (!headers) return;

        setWifiSaving(true);
        setWifiMessage(null);
        try {
            const body: Record<string, string> = { orgId: profile.orgId, ssid: wifiSsid.trim() };
            if (wifiPassword.trim()) body.password = wifiPassword.trim();

            const res = await fetch('/api/org/wifi-settings', {
                method: wifiConfigured ? 'PATCH' : 'POST',
                headers: {
                    ...headers,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(body),
            });

            const payload = await res.json().catch(() => ({}));
            if (!res.ok) {
                setWifiMessage(payload?.error || 'Failed to save WiFi settings.');
                return;
            }

            setWifiConfigured(true);
            setWifiPassword('');
            setWifiMessage('WiFi settings saved.');
        } catch {
            setWifiMessage('Failed to save WiFi settings.');
        } finally {
            setWifiSaving(false);
        }
    };

    const handleClearWifi = async () => {
        if (!profile?.orgId) return;

        const headers = await authHeaders();
        if (!headers) return;

        setWifiSaving(true);
        setWifiMessage(null);
        try {
            const res = await fetch('/api/org/wifi-settings', {
                method: 'DELETE',
                headers: {
                    ...headers,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ orgId: profile.orgId }),
            });

            const payload = await res.json().catch(() => ({}));
            if (!res.ok) {
                setWifiMessage(payload?.error || 'Failed to clear WiFi settings.');
                return;
            }

            setWifiConfigured(false);
            setWifiSsid('');
            setWifiPassword('');
            setWifiMessage('WiFi settings cleared.');
        } catch {
            setWifiMessage('Failed to clear WiFi settings.');
        } finally {
            setWifiSaving(false);
        }
    };

    const handleClaimNewDevice = async () => {
        const deviceId = claimNewDeviceId.trim().toLowerCase();
        const displayName = claimNewDisplayName.trim();
        if (!deviceId || !displayName) return;

        setClaimNewBusy(true);
        setClaimNewMessage(null);
        try {
            const res = await fetch('/api/org/devices/claim', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${await user!.getIdToken()}`,
                },
                body: JSON.stringify({ deviceId, displayName }),
            });
            const payload = await res.json().catch(() => ({}));
            if (!res.ok) {
                setClaimNewMessage(payload?.error || 'Failed to initiate claim.');
                return;
            }
            setClaimNewMessage('Claim initiated! Device will appear below as claim_pending. Wait for the ESP32 to verify, then click Confirm.');
            setClaimNewDeviceId('');
            setClaimNewDisplayName('');
            await refreshDevices();
        } catch {
            setClaimNewMessage('Failed to initiate claim.');
        } finally {
            setClaimNewBusy(false);
        }
    };

    const handleInitiateClaim = async () => {
        if (!displayNameInput.trim() || !selectedDevice) return;

        try {
            setClaimingDeviceId(selectedDevice.deviceId);
            const res = await fetch('/api/org/devices/claim', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${await user!.getIdToken()}`,
                },
                body: JSON.stringify({
                    deviceId: selectedDevice.deviceId,
                    displayName: displayNameInput.trim(),
                }),
            });

            if (!res.ok) throw new Error('Failed to initiate claim');
            await res.json().catch(() => ({}));
            await refreshDevices();

            setClaimModal(false);
            setDisplayNameInput('');
            setSelectedDevice(null);
        } catch (err) {
            setError(String(err));
        } finally {
            setClaimingDeviceId(null);
        }
    };

    const handleConfirmClaim = async (deviceId: string) => {
        if (!profile?.orgId) return;

        try {
            setConfirmingDeviceId(deviceId);
            const res = await fetch(`/api/org/devices/${deviceId}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${await user!.getIdToken()}`,
                },
                body: JSON.stringify({ action: 'confirm_claim' }),
            });

            if (!res.ok) throw new Error('Failed to confirm claim');

            // Refresh device list
            await refreshDevices();
        } catch (err) {
            setError(String(err));
        } finally {
            setConfirmingDeviceId(null);
        }
    };

    const handleToggleActive = async (deviceId: string, shouldActivate: boolean) => {
        if (!profile?.orgId) return;

        try {
            const res = await fetch(`/api/org/devices/${deviceId}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${await user!.getIdToken()}`,
                },
                body: JSON.stringify({ action: shouldActivate ? 'activate' : 'deactivate' }),
            });

            if (!res.ok) throw new Error('Failed to update device status');

            // Refresh device list
            await refreshDevices();
        } catch (err) {
            setError(String(err));
        }
    };

    if (loading || pageLoading) return <OrgDevicesSkeleton />;

    const filteredDevices = filter === 'all' ? devices : devices.filter(d => d.status === filter);

    const statusColors: Record<string, string> = {
        factory_pending: 'rgba(148,163,184,0.12)',
        claim_pending: 'rgba(245,158,11,0.12)',
        claim_verified: 'rgba(59,130,246,0.12)',
        claim_confirmed: 'rgba(132,204,22,0.12)',
        active: 'rgba(132,204,22,0.12)',
        inactive: 'rgba(148,163,184,0.12)',
    };
    const filterOptions: DeviceFilter[] = ['all', 'factory_pending', 'claim_pending', 'claim_verified', 'claim_confirmed', 'active', 'inactive'];

    const formatStatusLabel = (status: string) => status.replace(/_/g, ' ');
    const formatDeviceType = (deviceType?: Device['deviceType']) =>
        deviceType === 'raspberry_pi' ? 'Raspberry Pi' : 'ESP32 Gateway';
    const formatClaimedAt = (claimConfirmedAt?: string) =>
        claimConfirmedAt ? new Date(claimConfirmedAt).toLocaleDateString() : '-';
    const hasPiStations = devices.some((device) => device.deviceType === 'raspberry_pi');

    const renderDeviceTypeBadge = (deviceType?: Device['deviceType']) => (
        <span
            className="px-2.5 py-1 rounded-full text-[11px] font-semibold inline-flex items-center gap-1.5"
            style={
                deviceType === 'raspberry_pi'
                    ? { background: 'rgba(96,165,250,0.12)', border: '1px solid rgba(96,165,250,0.24)', color: '#60a5fa' }
                    : { background: 'var(--lime-glow)', border: '1px solid var(--lime-border)', color: 'var(--lime)' }
            }
        >
            {deviceType === 'raspberry_pi' ? <Camera size={12} /> : <Cpu size={12} />}
            {formatDeviceType(deviceType)}
        </span>
    );

    const renderDeviceActions = (device: Device) => (
        <div className="flex flex-wrap gap-2">
            {device.deviceType === 'raspberry_pi' && (
                <button
                    onClick={() => router.push(`/org/stations/${device.deviceId}`)}
                    disabled={device.status !== 'active' && device.status !== 'claim_confirmed'}
                    className="inline-flex items-center justify-center min-h-9 px-3.5 py-2 rounded-xl text-xs font-semibold disabled:opacity-50"
                    style={{
                        background: 'rgba(96,165,250,0.12)',
                        border: '1px solid rgba(96,165,250,0.24)',
                        color: '#60a5fa',
                    }}
                >
                    <ExternalLink size={13} className="mr-1.5" />
                    Station UI
                </button>
            )}
            {device.status === 'factory_pending' && (
                <button
                    onClick={() => {
                        setSelectedDevice(device);
                        setClaimModal(true);
                    }}
                    className="inline-flex items-center justify-center min-h-9 px-3.5 py-2 rounded-xl text-xs font-semibold"
                    style={{ background: 'var(--lime-glow)', border: '1px solid var(--lime-border)', color: 'var(--lime)' }}
                >
                    Claim
                </button>
            )}
            {device.status === 'claim_verified' && (
                <button
                    onClick={() => handleConfirmClaim(device.deviceId)}
                    disabled={confirmingDeviceId === device.deviceId}
                    className="inline-flex items-center justify-center min-h-9 px-3.5 py-2 rounded-xl text-xs font-semibold disabled:opacity-50"
                    style={{ background: 'var(--lime-glow)', border: '1px solid var(--lime-border)', color: 'var(--lime)' }}
                >
                    {confirmingDeviceId === device.deviceId ? 'Confirming...' : 'Confirm'}
                </button>
            )}
            {(device.status === 'active' || device.status === 'claim_confirmed') && (
                <button
                    onClick={() => handleToggleActive(device.deviceId, false)}
                    className="inline-flex items-center justify-center min-h-9 px-3.5 py-2 rounded-xl text-xs font-semibold"
                    style={{ background: 'rgba(148,163,184,0.14)', border: '1px solid rgba(148,163,184,0.28)', color: 'var(--text-primary)' }}
                >
                    Deactivate
                </button>
            )}
            {device.status === 'inactive' && (
                <button
                    onClick={() => handleToggleActive(device.deviceId, true)}
                    className="inline-flex items-center justify-center min-h-9 px-3.5 py-2 rounded-xl text-xs font-semibold"
                    style={{ background: 'var(--lime-glow)', border: '1px solid var(--lime-border)', color: 'var(--lime)' }}
                >
                    Activate
                </button>
            )}
        </div>
    );

    return (
        <div className="min-h-screen pb-28 lg:pb-10" style={{ background: 'var(--bg-primary)' }}>
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
                        <Cpu size={16} style={{ color: 'var(--lime)' }} />
                    </div>
                    <div>
                        <h1 className="page-title text-3xl lg:text-4xl text-white">Organization Devices</h1>
                        <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                            Claims, activation, and one-time WiFi provisioning for factory devices.
                        </p>
                    </div>
                </div>
            </div>

            <div className="px-5 lg:px-10 mt-4 flex flex-col gap-4 lg:gap-5">

            {error && (
                <div className="card p-3 text-sm" style={{ color: '#fca5a5', borderColor: 'rgba(239,68,68,0.35)' }}>
                    {error}
                </div>
            )}

            {/* Statistics */}
            <div className="grid grid-cols-3 gap-2.5">
                <div className="card p-4">
                    <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Total Devices</p>
                    <p className="text-2xl font-bold text-white">{devices.length}</p>
                </div>
                <div className="card p-4">
                    <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Pending Claims</p>
                    <p className="text-2xl font-bold text-white">{devices.filter(d => d.status === 'claim_pending').length}</p>
                </div>
                <div className="card p-4">
                    <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Active Devices</p>
                    <p className="text-2xl font-bold text-white">{devices.filter(d => d.status === 'active').length}</p>
                </div>
            </div>

            {/* WiFi Provisioning Settings */}
            <div className="card p-4">
                <h2 className="text-lg font-semibold mb-2 text-white flex items-center gap-2">
                    <Wifi size={16} style={{ color: 'var(--lime)' }} /> Organization WiFi Settings
                </h2>
                <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>
                    Devices fetch these credentials once after claim confirmation.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                    <input
                        value={wifiSsid}
                        onChange={(e) => setWifiSsid(e.target.value)}
                        placeholder="WiFi SSID"
                        className="rounded-xl px-3 py-2 text-sm"
                        style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                    />
                    <input
                        type="password"
                        value={wifiPassword}
                        onChange={(e) => setWifiPassword(e.target.value)}
                        placeholder={wifiConfigured ? 'New password (optional)' : 'WiFi password'}
                        className="rounded-xl px-3 py-2 text-sm"
                        style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                    />
                </div>

                <div className="flex flex-col sm:flex-row gap-2">
                    <button
                        onClick={handleSaveWifi}
                        disabled={wifiSaving}
                        className="rounded-xl px-4 py-2 text-sm font-semibold disabled:opacity-50 w-full sm:w-auto"
                        style={{ background: 'var(--lime-glow)', border: '1px solid var(--lime-border)', color: 'var(--lime)' }}
                    >
                        {wifiSaving ? 'Saving...' : wifiConfigured ? 'Update WiFi' : 'Save WiFi'}
                    </button>
                    <button
                        onClick={handleClearWifi}
                        disabled={wifiSaving || !wifiConfigured}
                        className="rounded-xl px-4 py-2 text-sm font-semibold disabled:opacity-50 w-full sm:w-auto"
                        style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}
                    >
                        Clear
                    </button>
                </div>

                {wifiMessage && <p className="text-sm mt-3" style={{ color: 'var(--text-secondary)' }}>{wifiMessage}</p>}
            </div>

            {/* Claim New Device */}
            <div className="card p-4">
                <h2 className="text-lg font-semibold mb-1 text-white">Claim New Device</h2>
                <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>
                    Enter the factory Device ID (burned into firmware) to start the provisioning claim.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                    <input
                        value={claimNewDeviceId}
                        onChange={(e) => setClaimNewDeviceId(e.target.value)}
                        placeholder="Device ID (e.g. bin_1_green)"
                        className="rounded-xl px-3 py-2 text-sm font-mono"
                        style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                    />
                    <input
                        value={claimNewDisplayName}
                        onChange={(e) => setClaimNewDisplayName(e.target.value)}
                        placeholder="Display Name (e.g. Warehouse Bin 1)"
                        className="rounded-xl px-3 py-2 text-sm"
                        style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                    />
                </div>
                <button
                    onClick={handleClaimNewDevice}
                    disabled={claimNewBusy || !claimNewDeviceId.trim() || !claimNewDisplayName.trim()}
                    className="rounded-xl px-4 py-2 text-sm font-semibold disabled:opacity-50 w-full sm:w-auto"
                    style={{ background: 'var(--lime-glow)', border: '1px solid var(--lime-border)', color: 'var(--lime)' }}
                >
                    {claimNewBusy ? 'Claiming...' : 'Claim Device'}
                </button>
                {claimNewMessage && (
                    <p className="text-sm mt-3" style={{ color: claimNewMessage.startsWith('Claim initiated') ? 'var(--lime)' : '#fca5a5' }}>
                        {claimNewMessage}
                    </p>
                )}
            </div>

            {/* Advanced Manual Setup (collapsed by default) */}
            <details className="card p-4">
                <summary className="list-none cursor-pointer flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-start gap-3 min-w-0">
                        <Link2 size={16} style={{ color: 'var(--lime)' }} />
                        <h2 className="text-base sm:text-lg font-semibold text-white leading-snug">Advanced: Manual Device WiFi Setup</h2>
                    </div>
                    <span
                        className="text-xs px-2.5 py-1 rounded-full"
                        style={{ color: 'var(--text-secondary)', background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}
                    >
                        Tap to expand
                    </span>
                </summary>

                <p className="text-sm mt-3 mb-4" style={{ color: 'var(--text-secondary)' }}>
                    Use this only if you need hotspot-based setup. Normal claim flow works without this section.
                </p>

                <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] gap-3 mb-3">
                    <input
                        readOnly
                        value={wifiSsid || '(Save org WiFi SSID first ↑)'}
                        className="rounded-xl px-3 py-2 text-sm min-w-0 opacity-60 cursor-not-allowed"
                        style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                    />
                    <input
                        type="password"
                        value={setupPassword}
                        onChange={(e) => setSetupPassword(e.target.value)}
                        placeholder="WiFi password"
                        className="rounded-xl px-3 py-2 text-sm min-w-0"
                        style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                    />
                    <button
                        onClick={handleGenerateConfigUrl}
                        disabled={!wifiSsid.trim() || !setupPassword.trim()}
                        className="rounded-xl px-4 py-2 text-sm font-semibold disabled:opacity-50 whitespace-nowrap w-full lg:w-auto"
                        style={{ background: 'var(--lime-glow)', border: '1px solid var(--lime-border)', color: 'var(--lime)' }}
                    >
                        Generate Link
                    </button>
                </div>

                {configUrl && (
                    <div className="rounded-xl p-3 flex flex-col sm:flex-row sm:items-center gap-3" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
                        <span className="text-xs font-mono break-all flex-1" style={{ color: 'var(--lime)' }}>{configUrl}</span>
                        <div className="flex gap-2 w-full sm:w-auto">
                            <button
                                onClick={handleCopyUrl}
                                className="rounded-lg px-3 py-1 text-xs font-semibold whitespace-nowrap flex-1 sm:flex-none"
                                style={{ background: 'var(--lime-glow)', border: '1px solid var(--lime-border)', color: 'var(--lime)' }}
                            >
                                {copied ? '✓ Copied' : 'Copy'}
                            </button>
                            <a
                                href={configUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="rounded-lg px-3 py-1 text-xs font-semibold whitespace-nowrap flex-1 sm:flex-none text-center"
                                style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}
                            >
                                Open ↗
                            </a>
                        </div>
                    </div>
                )}
            </details>

            {/* Filters */}
            <div className="card p-4">
                {hasPiStations && (
                    <div
                        className="rounded-2xl p-3 mb-4 flex items-start justify-between gap-3"
                        style={{ background: 'rgba(96,165,250,0.08)', border: '1px solid rgba(96,165,250,0.18)' }}
                    >
                        <div>
                            <p className="text-sm font-semibold text-white mb-1">Raspberry Pi Station Console</p>
                            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                                Pi scanners now open from a dedicated launcher page. Use the `Station UI` action on any Raspberry Pi device below.
                            </p>
                        </div>
                        <Camera size={18} style={{ color: '#60a5fa' }} />
                    </div>
                )}
                <div className="lg:hidden">
                    <label className="text-sm mb-2 block" style={{ color: 'var(--text-secondary)' }}>Filter</label>
                    <select
                        value={filter}
                        onChange={(e) => setFilter(e.target.value as DeviceFilter)}
                        className="w-full rounded-xl px-4 py-3 text-base"
                        style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                    >
                        {filterOptions.map(f => (
                            <option key={f} value={f}>{formatStatusLabel(f)}</option>
                        ))}
                    </select>
                </div>

                <div className="hidden lg:flex gap-2 flex-wrap">
                    {filterOptions.map(f => (
                        <button
                            key={f}
                            onClick={() => setFilter(f)}
                            className="px-3 py-2 rounded-xl text-sm"
                            style={
                                filter === f
                                    ? { background: 'var(--lime-glow)', border: '1px solid var(--lime-border)', color: 'var(--lime)' }
                                    : { background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }
                            }
                        >
                            {formatStatusLabel(f)}
                        </button>
                    ))}
                </div>
            </div>

            {/* Devices List */}
            <div className="flex flex-col gap-3 lg:hidden">
                {filteredDevices.length === 0 && (
                    <div className="card p-4" style={{ color: 'var(--text-secondary)' }}>
                        No devices found for this filter.
                    </div>
                )}
                {filteredDevices.map(device => (
                    <div key={device.deviceId} className="card p-4 flex flex-col gap-3">
                        <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                                <p className="text-xs uppercase tracking-wide mb-1" style={{ color: 'var(--text-secondary)' }}>Device ID</p>
                                <p className="font-mono text-sm text-white break-all">{device.deviceId}</p>
                            </div>
                            <div className="flex flex-col items-end gap-2 shrink-0">
                                {renderDeviceTypeBadge(device.deviceType)}
                                <span
                                    className="px-3 py-1 rounded-lg text-xs font-semibold"
                                    style={{ background: statusColors[device.status] || 'rgba(148,163,184,0.12)', color: 'var(--text-primary)' }}
                                >
                                    {formatStatusLabel(device.status)}
                                </span>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3 text-sm">
                            <div className="min-w-0">
                                <p className="text-xs uppercase tracking-wide mb-1" style={{ color: 'var(--text-secondary)' }}>Display Name</p>
                                <p className="text-white break-words">{device.displayName}</p>
                            </div>
                            <div>
                                <p className="text-xs uppercase tracking-wide mb-1" style={{ color: 'var(--text-secondary)' }}>Batch</p>
                                <p style={{ color: 'var(--text-primary)' }}>{device.batchId || '-'}</p>
                            </div>
                            <div>
                                <p className="text-xs uppercase tracking-wide mb-1" style={{ color: 'var(--text-secondary)' }}>Type</p>
                                <p style={{ color: 'var(--text-primary)' }}>{formatDeviceType(device.deviceType)}</p>
                            </div>
                            <div className="col-span-2">
                                <p className="text-xs uppercase tracking-wide mb-1" style={{ color: 'var(--text-secondary)' }}>Claimed At</p>
                                <p style={{ color: 'var(--text-primary)' }}>{formatClaimedAt(device.claimConfirmedAt)}</p>
                            </div>
                        </div>

                        {renderDeviceActions(device)}
                    </div>
                ))}
            </div>

            <div className="hidden lg:block card p-0 overflow-x-auto">
                <table className="w-full min-w-[860px] border-collapse text-sm">
                    <thead>
                        <tr style={{ background: 'var(--bg-elevated)' }}>
                            <th className="p-3 text-left" style={{ color: 'var(--text-secondary)', borderBottom: '1px solid var(--border)' }}>Device ID</th>
                            <th className="p-3 text-left" style={{ color: 'var(--text-secondary)', borderBottom: '1px solid var(--border)' }}>Display Name</th>
                            <th className="p-3 text-left" style={{ color: 'var(--text-secondary)', borderBottom: '1px solid var(--border)' }}>Type</th>
                            <th className="p-3 text-left" style={{ color: 'var(--text-secondary)', borderBottom: '1px solid var(--border)' }}>Status</th>
                            <th className="p-3 text-left" style={{ color: 'var(--text-secondary)', borderBottom: '1px solid var(--border)' }}>Batch</th>
                            <th className="p-3 text-left" style={{ color: 'var(--text-secondary)', borderBottom: '1px solid var(--border)' }}>Claimed At</th>
                            <th className="p-3 text-left" style={{ color: 'var(--text-secondary)', borderBottom: '1px solid var(--border)' }}>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredDevices.length === 0 && (
                            <tr>
                                <td colSpan={7} className="p-4" style={{ color: 'var(--text-secondary)' }}>
                                    No devices found for this filter.
                                </td>
                            </tr>
                        )}
                        {filteredDevices.map(device => (
                            <tr key={device.deviceId} style={{ borderBottom: '1px solid var(--border)' }}>
                                <td className="p-3 font-mono text-xs text-white">{device.deviceId}</td>
                                <td className="p-3 text-white">{device.displayName}</td>
                                <td className="p-3">{renderDeviceTypeBadge(device.deviceType)}</td>
                                <td className="p-3">
                                    <span
                                        className="px-3 py-1 rounded-lg text-xs font-semibold"
                                        style={{ background: statusColors[device.status] || 'rgba(148,163,184,0.12)', color: 'var(--text-primary)' }}
                                    >
                                        {formatStatusLabel(device.status)}
                                    </span>
                                </td>
                                <td className="p-3" style={{ color: 'var(--text-secondary)' }}>{device.batchId || '-'}</td>
                                <td className="p-3" style={{ color: 'var(--text-secondary)' }}>
                                    {formatClaimedAt(device.claimConfirmedAt)}
                                </td>
                                <td className="p-3">
                                    {renderDeviceActions(device)}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Claim Modal */}
            {claimModal && selectedDevice && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
                    <div className="card p-5 max-w-md w-full">
                        <h2 className="text-xl font-bold mb-3 text-white">Claim Device</h2>
                        <p className="mb-4" style={{ color: 'var(--text-secondary)' }}>Device ID: <span className="font-mono">{selectedDevice.deviceId}</span></p>
                        <input
                            type="text"
                            placeholder="Display Name (e.g., 'Warehouse Unit 1')"
                            value={displayNameInput}
                            onChange={e => setDisplayNameInput(e.target.value)}
                            className="w-full rounded-xl px-3 py-2 mb-4"
                            style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                        />
                        <div className="flex gap-2">
                            <button
                                onClick={handleInitiateClaim}
                                disabled={claimingDeviceId === selectedDevice.deviceId || !displayNameInput.trim()}
                                className="flex-1 rounded-xl px-4 py-2 text-sm font-semibold disabled:opacity-50"
                                style={{ background: 'var(--lime-glow)', border: '1px solid var(--lime-border)', color: 'var(--lime)' }}
                            >
                                {claimingDeviceId === selectedDevice.deviceId ? 'Initiating...' : 'Initiate Claim'}
                            </button>
                            <button
                                onClick={() => {
                                    setClaimModal(false);
                                    setSelectedDevice(null);
                                    setDisplayNameInput('');
                                }}
                                className="flex-1 rounded-xl px-4 py-2 text-sm font-semibold"
                                style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <LazyBottomNav />
            </div>
        </div>
    );
}
