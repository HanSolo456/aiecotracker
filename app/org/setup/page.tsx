'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Building2, MapPin, Mail, FileText, ChevronRight, Leaf, CheckCircle, Cpu, Copy } from 'lucide-react';
import { useAuth } from '@/lib/authContext';
import { createOrg, type OrgType } from '@/lib/orgService';

const ORG_TYPES: { value: OrgType; label: string; desc: string }[] = [
    { value: 'recycler', label: '♻️  Recycler', desc: 'Processes waste into reusable materials' },
    { value: 'manufacturer', label: '🏭  Manufacturer', desc: 'Produces goods using recovered materials' },
    { value: 'collection_center', label: '📦  Collection Center', desc: 'Aggregates and sorts waste from sources' },
];

export default function OrgSetupPage() {
    const router = useRouter();
    const { user, refreshProfile } = useAuth();

    const [step, setStep] = useState<1 | 2 | 3>(1);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [setupDone, setSetupDone] = useState(false);

    const [name, setName] = useState('');
    const [type, setType] = useState<OrgType>('recycler');
    const [address, setAddress] = useState('');
    const [gstin, setGstin] = useState('');
    const [contactEmail, setContactEmail] = useState(user?.email ?? '');

    const [deviceId, setDeviceId] = useState('');
    const [deviceName, setDeviceName] = useState('');
    const [deviceType, setDeviceType] = useState<'esp32_gateway' | 'raspberry_pi'>('esp32_gateway');
    const [deviceToken, setDeviceToken] = useState<string | null>(null);
    const [deviceBusy, setDeviceBusy] = useState(false);
    const [deviceMessage, setDeviceMessage] = useState('');

    async function handleCreate() {
        if (!user) return;
        setSubmitting(true);
        setError('');
        try {
            await createOrg(user.uid, { name, type, address, gstin, contactEmail });
            await refreshProfile();
            setSetupDone(true);
            setStep(3);
        } catch (e) {
            console.error('[OrgSetup] create failed:', e);
            setError('Failed to create organisation. Please try again.');
        } finally {
            setSubmitting(false);
        }
    }

    async function registerInitialDevice() {
        if (!user || user.isAnonymous) return;

        const normalizedDeviceId = deviceId.trim().toLowerCase();
        const normalizedName = deviceName.trim();

        if (!normalizedDeviceId || !normalizedName) {
            setDeviceMessage('Enter both DEVICE_ID and display name.');
            return;
        }

        setDeviceBusy(true);
        setDeviceMessage('');
        setDeviceToken(null);
        try {
            const idToken = await user.getIdToken();
            const res = await fetch('/api/org/devices', {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${idToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    deviceId: normalizedDeviceId,
                    displayName: normalizedName,
                    deviceType,
                }),
            });

            const payload = await res.json().catch(() => ({}));
            if (!res.ok) {
                setDeviceMessage(payload?.error ?? 'Failed to register device.');
                return;
            }

            setDeviceToken(payload?.deviceToken ?? null);
            setDeviceMessage('Device registered successfully. Save the token to hardware now.');
        } catch (e) {
            console.error('[OrgSetup] device register failed:', e);
            setDeviceMessage('Failed to register device.');
        } finally {
            setDeviceBusy(false);
        }
    }

    const step1Valid = name.trim().length > 0 && address.trim().length > 0;
    const step2Valid = contactEmail.trim().length > 0;

    return (
        <div className="fixed inset-0 overflow-auto z-50" style={{ background: 'var(--bg-primary)' }}>
        <div className="min-h-full flex items-center justify-center p-5">
            <div className="w-full max-w-lg">

                {/* Logo */}
                <div className="flex items-center gap-2 mb-8">
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center"
                        style={{ background: 'rgba(132,204,22,0.15)', border: '1px solid rgba(132,204,22,0.3)' }}>
                        <Leaf size={15} style={{ color: '#84cc16' }} />
                    </div>
                    <span className="font-bold text-white" style={{ fontFamily: 'Space Grotesk' }}>AI-EcoTrack</span>
                </div>

                {/* Step indicator */}
                <div className="flex items-center gap-2 mb-6">
                    {[1, 2, 3].map((s) => (
                        <div key={s} className="flex items-center gap-2">
                            <div
                                className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all"
                                style={{
                                    background: step >= s ? '#84cc16' : 'var(--border)',
                                    color: step >= s ? 'var(--bg-primary)' : '#4B5563',
                                }}
                            >
                                {step > s ? <CheckCircle size={14} /> : s}
                            </div>
                            {s < 3 && (
                                <div className="h-px w-12 transition-all"
                                    style={{ background: step > s ? '#84cc16' : 'var(--border)' }} />
                            )}
                        </div>
                    ))}
                    <span className="ml-2 text-xs" style={{ color: 'var(--text-dim)' }}>
                        {step === 1 ? 'Organisation details' : step === 2 ? 'Contact & confirm' : 'Optional device setup'}
                    </span>
                </div>

                {/* Card */}
                <div className="rounded-2xl p-6 lg:p-8"
                    style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>

                    <h1 className="text-2xl font-bold text-white mb-1" style={{ fontFamily: 'Space Grotesk' }}>
                        {step === 1 ? 'Register your organisation' : step === 2 ? 'Almost there' : 'Add your first device'}
                    </h1>
                    <p className="text-sm mb-6" style={{ color: 'var(--text-dim)' }}>
                        {step === 1
                            ? 'Set up your org to start tracking scans, workers, and recovery impact.'
                            : step === 2
                                ? 'Review your details and confirm.'
                                : 'Register sold ESP32/Pi hardware now, or skip and add it later in Settings.'}
                    </p>

                    {error && (
                        <div className="mb-4 rounded-xl px-4 py-3 text-sm"
                            style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#FCA5A5' }}>
                            {error}
                        </div>
                    )}

                    {step === 1 ? (
                        <div className="flex flex-col gap-4">
                            {/* Org Name */}
                            <div>
                                <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                                    ORGANISATION NAME *
                                </label>
                                <div className="relative">
                                    <Building2 size={15} className="absolute left-3 top-3.5" style={{ color: 'var(--text-dim)' }} />
                                    <input
                                        className="w-full pl-9 pr-4 py-3 rounded-xl text-sm outline-none text-white"
                                        style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)' }}
                                        placeholder="e.g. GreenCycle Industries"
                                        value={name}
                                        onChange={e => setName(e.target.value)}
                                    />
                                </div>
                            </div>

                            {/* Org Type */}
                            <div>
                                <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                                    TYPE *
                                </label>
                                <div className="flex flex-col gap-2">
                                    {ORG_TYPES.map(({ value, label, desc }) => (
                                        <button
                                            key={value}
                                            onClick={() => setType(value)}
                                            className="flex items-start gap-3 rounded-xl px-4 py-3 text-left transition-all"
                                            style={{
                                                background: type === value ? 'rgba(132,204,22,0.08)' : 'var(--bg-primary)',
                                                border: `1px solid ${type === value ? 'rgba(132,204,22,0.4)' : 'var(--border)'}`,
                                            }}
                                        >
                                            <div className="mt-0.5 w-4 h-4 rounded-full flex-shrink-0 flex items-center justify-center border-2 transition-all"
                                                style={{ borderColor: type === value ? '#84cc16' : '#374151' }}>
                                                {type === value && <div className="w-2 h-2 rounded-full" style={{ background: '#84cc16' }} />}
                                            </div>
                                            <div>
                                                <p className="text-sm font-semibold text-white">{label}</p>
                                                <p className="text-xs" style={{ color: 'var(--text-dim)' }}>{desc}</p>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Address */}
                            <div>
                                <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                                    ADDRESS *
                                </label>
                                <div className="relative">
                                    <MapPin size={15} className="absolute left-3 top-3.5" style={{ color: 'var(--text-dim)' }} />
                                    <input
                                        className="w-full pl-9 pr-4 py-3 rounded-xl text-sm outline-none text-white"
                                        style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)' }}
                                        placeholder="City, State, Country"
                                        value={address}
                                        onChange={e => setAddress(e.target.value)}
                                    />
                                </div>
                            </div>

                            <button
                                disabled={!step1Valid}
                                onClick={() => setStep(2)}
                                className="mt-2 w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm transition-all"
                                style={{
                                    background: step1Valid ? '#84cc16' : 'var(--border)',
                                    color: step1Valid ? 'var(--bg-primary)' : '#4B5563',
                                    cursor: step1Valid ? 'pointer' : 'not-allowed',
                                }}
                            >
                                Continue <ChevronRight size={16} />
                            </button>
                        </div>
                    ) : step === 2 ? (
                        <div className="flex flex-col gap-4">
                            {/* Summary */}
                            <div className="rounded-xl p-4 flex flex-col gap-2"
                                style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)' }}>
                                <Row label="Name" value={name} />
                                <Row label="Type" value={ORG_TYPES.find(t => t.value === type)?.label ?? type} />
                                <Row label="Address" value={address} />
                            </div>

                            {/* GSTIN */}
                            <div>
                                <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                                    GSTIN <span style={{ color: '#4B5563' }}>(optional)</span>
                                </label>
                                <div className="relative">
                                    <FileText size={15} className="absolute left-3 top-3.5" style={{ color: 'var(--text-dim)' }} />
                                    <input
                                        className="w-full pl-9 pr-4 py-3 rounded-xl text-sm outline-none text-white"
                                        style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)' }}
                                        placeholder="e.g. 22AAAAA0000A1Z5"
                                        value={gstin}
                                        onChange={e => setGstin(e.target.value)}
                                    />
                                </div>
                            </div>

                            {/* Contact Email */}
                            <div>
                                <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                                    CONTACT EMAIL *
                                </label>
                                <div className="relative">
                                    <Mail size={15} className="absolute left-3 top-3.5" style={{ color: 'var(--text-dim)' }} />
                                    <input
                                        type="email"
                                        className="w-full pl-9 pr-4 py-3 rounded-xl text-sm outline-none text-white"
                                        style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)' }}
                                        placeholder="org@example.com"
                                        value={contactEmail}
                                        onChange={e => setContactEmail(e.target.value)}
                                    />
                                </div>
                            </div>

                            <div className="flex gap-3">
                                <button
                                    onClick={() => setStep(1)}
                                    className="flex-1 py-3 rounded-xl font-bold text-sm transition-all"
                                    style={{ background: 'var(--border)', color: 'var(--text-secondary)' }}
                                >
                                    Back
                                </button>
                                <button
                                    disabled={!step2Valid || submitting}
                                    onClick={handleCreate}
                                    className="flex-[2] flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm transition-all"
                                    style={{
                                        background: step2Valid && !submitting ? '#84cc16' : 'var(--border)',
                                        color: step2Valid && !submitting ? 'var(--bg-primary)' : '#4B5563',
                                        cursor: step2Valid && !submitting ? 'pointer' : 'not-allowed',
                                    }}
                                >
                                    {submitting ? 'Creating…' : '🚀 Create Organisation'}
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-col gap-4">
                            {!setupDone && (
                                <div className="rounded-xl px-4 py-3 text-sm"
                                    style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)', color: '#FCD34D' }}>
                                    Create the organisation first to register a device.
                                </div>
                            )}

                            <div>
                                <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                                    DEVICE_ID *
                                </label>
                                <div className="relative">
                                    <Cpu size={15} className="absolute left-3 top-3.5" style={{ color: 'var(--text-dim)' }} />
                                    <input
                                        className="w-full pl-9 pr-4 py-3 rounded-xl text-sm outline-none text-white"
                                        style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)' }}
                                        placeholder="e.g. esp-gateway-001"
                                        value={deviceId}
                                        onChange={e => setDeviceId(e.target.value)}
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                                    DEVICE NAME *
                                </label>
                                <input
                                    className="w-full px-4 py-3 rounded-xl text-sm outline-none text-white"
                                    style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)' }}
                                    placeholder="e.g. Main Bin Gateway"
                                    value={deviceName}
                                    onChange={e => setDeviceName(e.target.value)}
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                                    DEVICE TYPE
                                </label>
                                <select
                                    className="w-full px-4 py-3 rounded-xl text-sm outline-none text-white"
                                    style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)' }}
                                    value={deviceType}
                                    onChange={e => setDeviceType(e.target.value as 'esp32_gateway' | 'raspberry_pi')}
                                >
                                    <option value="esp32_gateway">ESP32 Gateway</option>
                                    <option value="raspberry_pi">Raspberry Pi</option>
                                </select>
                            </div>

                            {deviceToken && (
                                <div className="rounded-xl px-4 py-3" style={{ background: 'rgba(132,204,22,0.1)', border: '1px solid rgba(132,204,22,0.25)' }}>
                                    <p className="text-xs font-semibold mb-1" style={{ color: '#84cc16' }}>Device token (shown once)</p>
                                    <p className="text-xs break-all text-white">{deviceToken}</p>
                                    <button
                                        onClick={() => navigator.clipboard.writeText(deviceToken)}
                                        className="mt-2 flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold"
                                        style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}
                                    >
                                        <Copy size={12} /> Copy token
                                    </button>
                                </div>
                            )}

                            {deviceMessage && (
                                <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{deviceMessage}</p>
                            )}

                            <div className="flex gap-3">
                                <button
                                    onClick={() => router.replace('/dashboard')}
                                    className="flex-1 py-3 rounded-xl font-bold text-sm transition-all"
                                    style={{ background: 'var(--border)', color: 'var(--text-secondary)' }}
                                >
                                    Skip for now
                                </button>
                                <button
                                    disabled={!setupDone || deviceBusy}
                                    onClick={registerInitialDevice}
                                    className="flex-[1.6] py-3 rounded-xl font-bold text-sm transition-all"
                                    style={{
                                        background: !setupDone || deviceBusy ? 'var(--border)' : '#84cc16',
                                        color: !setupDone || deviceBusy ? '#4B5563' : 'var(--bg-primary)',
                                    }}
                                >
                                    {deviceBusy ? 'Registering…' : 'Register device'}
                                </button>
                            </div>

                            <button
                                onClick={() => router.replace('/dashboard')}
                                className="w-full py-2 text-xs font-semibold"
                                style={{ color: 'var(--text-secondary)' }}
                            >
                                Continue to dashboard
                            </button>
                        </div>
                    )}
                </div>

                <p className="mt-4 text-center text-xs" style={{ color: '#374151' }}>
                    You can edit these details later in Org Profile.
                </p>
            </div>
        </div>
        </div>
    );
}

function Row({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex items-center justify-between">
            <span className="text-xs" style={{ color: 'var(--text-dim)' }}>{label}</span>
            <span className="text-xs font-semibold text-white">{value}</span>
        </div>
    );
}
