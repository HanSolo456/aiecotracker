'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { useParams, useRouter } from 'next/navigation';
import {
    Camera,
    Check,
    ChevronLeft,
    CircleDot,
    Copy,
    ExternalLink,
    Gauge,
    Loader2,
    MonitorSmartphone,
    Power,
    RadioTower,
    RefreshCcw,
    ScanSearch,
    ShieldCheck,
    Sparkles,
    TimerReset,
    Wifi,
} from 'lucide-react';
import { useAuth } from '@/lib/authContext';

const LazyBottomNav = dynamic(() => import('@/components/BottomNav'), {
    ssr: false,
    loading: () => null,
});

type DeviceType = 'esp32_gateway' | 'raspberry_pi';
type DeviceStatus = 'factory_pending' | 'claim_pending' | 'claim_verified' | 'claim_confirmed' | 'active' | 'inactive';
type StationPreviewState =
    | 'off'
    | 'armed_waiting'
    | 'item_detected'
    | 'capturing_angle_1'
    | 'capturing_angle_2'
    | 'capturing_angle_3'
    | 'analysing'
    | 'result_ready';

interface PiRemoteState {
    state?: string;
    runtimeReady?: boolean;
    captureCountTarget?: number;
    capturedCount?: number;
    scanId?: string | null;
    lastError?: string | null;
    resultUrl?: string | null;
    bootstrap?: {
        status?: string | null;
        message?: string | null;
        nextStep?: string | null;
        lastError?: string | null;
    };
}

interface Device {
    deviceId: string;
    orgId?: string | null;
    displayName: string;
    deviceType?: DeviceType;
    status: DeviceStatus;
    batchId?: string;
    claimConfirmedAt?: string;
    wifiProvisionedAt?: string;
    lastSeenAt?: string | null;
}

function SkeletonBlock({ className }: { className: string }) {
    return <div className={`shimmer rounded-xl ${className}`} />;
}

function PiStationSkeleton() {
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
                <div className="card p-4">
                    <SkeletonBlock className="h-5 w-48 mb-3" />
                    <SkeletonBlock className="h-4 w-full mb-2" />
                    <SkeletonBlock className="h-4 w-3/4" />
                </div>
                <div className="grid grid-cols-1 xl:grid-cols-[1.2fr_0.8fr] gap-4">
                    <div className="card p-4">
                        <SkeletonBlock className="h-72 w-full" />
                    </div>
                    <div className="flex flex-col gap-4">
                        <div className="card p-4">
                            <SkeletonBlock className="h-5 w-40 mb-3" />
                            <SkeletonBlock className="h-10 w-full mb-3" />
                            <SkeletonBlock className="h-10 w-full" />
                        </div>
                        <div className="card p-4">
                            <SkeletonBlock className="h-5 w-32 mb-3" />
                            <SkeletonBlock className="h-24 w-full" />
                        </div>
                    </div>
                </div>
            </div>

            <LazyBottomNav />
        </div>
    );
}

const PREVIEW_STEPS: { key: StationPreviewState; title: string; body: string }[] = [
    { key: 'off', title: 'Station Off', body: 'Pressure triggers are ignored until the operator explicitly enables the station.' },
    { key: 'armed_waiting', title: 'Armed', body: 'The Pi is ready and waiting for stable pressure from the plate or load cell.' },
    { key: 'item_detected', title: 'Item Detected', body: 'The station has seen a valid item and is ready to start the three-angle capture flow.' },
    { key: 'capturing_angle_1', title: 'Capture Angle 1', body: 'Show the first face of the item under the external camera and capture the opening angle.' },
    { key: 'capturing_angle_2', title: 'Capture Angle 2', body: 'Rotate the item and capture the second angle from the same operator console.' },
    { key: 'capturing_angle_3', title: 'Capture Angle 3', body: 'Rotate once more and capture the final angle before analysis begins.' },
    { key: 'analysing', title: 'Analysing', body: 'The Pi uploads the three captured images to the AI pipeline and waits for classification results.' },
    { key: 'result_ready', title: 'Result Ready', body: 'The scan is complete. Open the saved AI-EcoTrack result using the returned scan link.' },
];

const FLOW_CARDS = [
    { key: 'detect', eyebrow: 'Detect', title: 'Pressure' },
    { key: 'angle_1', eyebrow: 'Angle 1', title: 'Capture' },
    { key: 'angle_2', eyebrow: 'Angle 2', title: 'Rotate' },
    { key: 'angle_3', eyebrow: 'Angle 3', title: 'Final' },
] as const;

function statusTone(status: DeviceStatus) {
    if (status === 'active') return { bg: 'rgba(132,204,22,0.12)', border: 'rgba(132,204,22,0.24)', color: 'var(--lime)' };
    if (status === 'claim_confirmed') return { bg: 'rgba(59,130,246,0.12)', border: 'rgba(59,130,246,0.24)', color: '#60a5fa' };
    if (status === 'claim_pending' || status === 'claim_verified') return { bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.24)', color: '#f59e0b' };
    return { bg: 'rgba(148,163,184,0.12)', border: 'rgba(148,163,184,0.2)', color: 'var(--text-secondary)' };
}

export default function OrgPiStationPage() {
    const params = useParams<{ deviceId: string }>();
    const router = useRouter();
    const { user, profile, loading } = useAuth();
    const deviceId = Array.isArray(params?.deviceId) ? params.deviceId[0] : params?.deviceId ?? '';

    const [pageLoading, setPageLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [device, setDevice] = useState<Device | null>(null);
    const [copied, setCopied] = useState(false);
    const [stationEnabled, setStationEnabled] = useState(false);
    const [previewState, setPreviewState] = useState<StationPreviewState>('off');
    const [remoteState, setRemoteState] = useState<PiRemoteState | null>(null);
    const [remoteBusy, setRemoteBusy] = useState<string | null>(null);
    const [remoteReachable, setRemoteReachable] = useState(false);
    const [remoteMessage, setRemoteMessage] = useState<string | null>(null);

    useEffect(() => {
        if (!loading && (!user || !profile?.orgId)) {
            router.replace('/auth');
        }
    }, [loading, profile?.orgId, router, user]);

    const authHeaders = useCallback(async () => {
        if (!user) return null;
        const token = await user.getIdToken();
        return { Authorization: `Bearer ${token}` };
    }, [user]);

    useEffect(() => {
        let active = true;

        const loadDevice = async () => {
            if (!profile?.orgId || !user || !deviceId) return;

            try {
                setPageLoading(true);
                const headers = await authHeaders();
                if (!headers) return;

                const res = await fetch('/api/org/devices', { headers });
                const data = await res.json().catch(() => ({}));
                if (!res.ok) throw new Error(data?.error || 'Failed to load devices.');

                const match = (data.devices || []).find((item: Device) => item.deviceId === deviceId);
                if (!match) {
                    throw new Error('Station device not found in your organization.');
                }
                if (match.deviceType !== 'raspberry_pi') {
                    throw new Error('This device is not a Raspberry Pi station.');
                }

                if (active) {
                    setDevice(match);
                    setError(null);
                }
            } catch (err) {
                if (active) {
                    const msg = err instanceof Error ? err.message : String(err);
                    setError(msg.replace(/^Error:\s*/, ''));
                }
            } finally {
                if (active) setPageLoading(false);
            }
        };

        void loadDevice();
        return () => {
            active = false;
        };
    }, [authHeaders, deviceId, profile?.orgId, user]);

    const stationUrl = useMemo(
        () => (device ? `http://${device.deviceId}.local:8080` : ''),
        [device],
    );

    const readyForConsole = device?.status === 'active' || device?.status === 'claim_confirmed';
    const activeStepIndex = PREVIEW_STEPS.findIndex((step) => step.key === previewState);
    const activeStep = PREVIEW_STEPS[activeStepIndex] ?? PREVIEW_STEPS[0];

    const syncFromRemote = useCallback((payload: PiRemoteState) => {
        setRemoteState(payload);
        setRemoteReachable(true);

        const stateMap: Record<string, StationPreviewState> = {
            off: 'off',
            armed_waiting_for_item: 'armed_waiting',
            item_detected: 'item_detected',
            capturing_angle_2: 'capturing_angle_2',
            capturing_angle_3: 'capturing_angle_3',
            analysing: 'analysing',
            complete: 'result_ready',
            error: 'armed_waiting',
        };

        const remoteCurrent = payload.state ?? 'off';
        const captureCount = payload.capturedCount ?? 0;
        let mapped = stateMap[remoteCurrent] ?? 'off';
        if (remoteCurrent === 'item_detected' && captureCount >= 1) {
            mapped = 'capturing_angle_1';
        }

        setStationEnabled(remoteCurrent !== 'off');
        setPreviewState(mapped);
    }, []);

    const fetchRemoteState = useCallback(async () => {
        if (!readyForConsole || !stationUrl) return;

        try {
            const res = await fetch(`${stationUrl}/api/state`, { method: 'GET' });
            const payload = (await res.json().catch(() => ({}))) as PiRemoteState & { error?: string };
            if (!res.ok) {
                throw new Error(payload.error || 'Station did not respond.');
            }
            syncFromRemote(payload);
        } catch (err) {
            setRemoteReachable(false);
            const msg = err instanceof Error ? err.message : 'Unable to reach Raspberry Pi on the local network.';
            setRemoteMessage(msg);
        }
    }, [readyForConsole, stationUrl, syncFromRemote]);

    useEffect(() => {
        if (!readyForConsole || !stationUrl) return;

        void fetchRemoteState();
        const timer = window.setInterval(() => {
            void fetchRemoteState();
        }, 4000);

        return () => window.clearInterval(timer);
    }, [fetchRemoteState, readyForConsole, stationUrl]);

    const flowCardState = (key: (typeof FLOW_CARDS)[number]['key']) => {
        const currentByState: Partial<Record<StationPreviewState, (typeof FLOW_CARDS)[number]['key']>> = {
            armed_waiting: 'detect',
            item_detected: 'detect',
            capturing_angle_1: 'angle_1',
            capturing_angle_2: 'angle_2',
            capturing_angle_3: 'angle_3',
            analysing: 'angle_3',
            result_ready: 'angle_3',
        };

        const completedByState: Partial<Record<StationPreviewState, Array<(typeof FLOW_CARDS)[number]['key']>>> = {
            capturing_angle_1: ['detect'],
            capturing_angle_2: ['detect', 'angle_1'],
            capturing_angle_3: ['detect', 'angle_1', 'angle_2'],
            analysing: ['detect', 'angle_1', 'angle_2', 'angle_3'],
            result_ready: ['detect', 'angle_1', 'angle_2', 'angle_3'],
        };

        if (completedByState[previewState]?.includes(key)) return 'complete';
        if (currentByState[previewState] === key) return 'current';
        return 'idle';
    };

    const runRemoteAction = useCallback(
        async (path: string, successMessage: string) => {
            if (!stationUrl) return;

            setRemoteBusy(path);
            setRemoteMessage(null);
            try {
                const res = await fetch(`${stationUrl}${path}`, { method: 'POST' });
                const payload = (await res.json().catch(() => ({}))) as PiRemoteState & { error?: string };
                if (!res.ok) {
                    throw new Error(payload.error || 'Station request failed.');
                }
                syncFromRemote(payload);
                setRemoteMessage(successMessage);
            } catch (err) {
                setRemoteReachable(false);
                const msg = err instanceof Error ? err.message : 'Station request failed.';
                setRemoteMessage(msg);
            } finally {
                setRemoteBusy(null);
            }
        },
        [stationUrl, syncFromRemote],
    );

    const toggleStation = () => {
        void runRemoteAction(
            stationEnabled ? '/api/disarm' : '/api/arm',
            stationEnabled ? 'Station disabled on the Raspberry Pi.' : 'Station enabled on the Raspberry Pi.',
        );
    };

    const triggerManualDetect = () => {
        void runRemoteAction('/api/manual-trigger', 'Manual trigger sent to the Raspberry Pi.');
    };

    const captureNextAngle = () => {
        void runRemoteAction('/api/capture', 'Capture request sent to the Raspberry Pi.');
    };

    const resetPreview = () => {
        void runRemoteAction('/api/reset', 'Station reset on the Raspberry Pi.');
    };

    const copyStationUrl = async () => {
        if (!stationUrl) return;
        try {
            await navigator.clipboard.writeText(stationUrl);
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1600);
        } catch {
            setCopied(false);
        }
    };

    if (loading || pageLoading) return <PiStationSkeleton />;

    if (error || !device) {
        return (
            <div className="min-h-screen pb-28 lg:pb-10" style={{ background: 'var(--bg-primary)' }}>
                <div className="safe-top px-5 pt-6 pb-5 lg:px-10 lg:pt-10 lg:pb-8 bg-grid">
                    <div className="flex items-center gap-3 mb-4">
                        <button
                            onClick={() => router.replace('/org/devices')}
                            className="w-9 h-9 rounded-xl flex items-center justify-center"
                            style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}
                        >
                            <ChevronLeft size={16} style={{ color: 'var(--text-secondary)' }} />
                        </button>
                    </div>
                </div>

                <div className="px-5 lg:px-10">
                    <div className="card p-5 max-w-xl">
                        <p className="text-lg font-semibold text-white mb-2">Station unavailable</p>
                        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{error || 'Device not found.'}</p>
                    </div>
                </div>

                <LazyBottomNav />
            </div>
        );
    }

    const deviceTone = statusTone(device.status);

    return (
        <div className="min-h-screen pb-28 lg:pb-10" style={{ background: 'var(--bg-primary)' }}>
            <div className="safe-top px-5 pt-6 pb-5 lg:px-10 lg:pt-10 lg:pb-8 bg-grid">
                <div className="flex items-center gap-3 mb-4">
                    <button
                        onClick={() => router.replace('/org/devices')}
                        className="w-9 h-9 rounded-xl flex items-center justify-center"
                        style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}
                    >
                        <ChevronLeft size={16} style={{ color: 'var(--text-secondary)' }} />
                    </button>
                </div>

                <div className="flex items-start gap-3 sm:items-center">
                    <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                        style={{ background: 'rgba(96,165,250,0.12)', border: '1px solid rgba(96,165,250,0.24)' }}
                    >
                        <Camera size={17} style={{ color: '#60a5fa' }} />
                    </div>
                    <div className="min-w-0">
                        <p className="text-xs font-semibold uppercase tracking-[0.22em]" style={{ color: '#60a5fa' }}>
                            Raspberry Pi Station
                        </p>
                        <h1 className="page-title text-3xl lg:text-4xl text-white">{device.displayName}</h1>
                        <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                            Dedicated launcher for the Pi-hosted operator console, manual arming, manual trigger, and the three-angle capture flow.
                        </p>
                    </div>
                </div>
            </div>

            <div className="px-5 lg:px-10 mt-4 flex flex-col gap-4 lg:gap-5">
                <div
                    className="rounded-2xl p-4 flex items-start justify-between gap-3"
                    style={{ background: 'rgba(96,165,250,0.08)', border: '1px solid rgba(96,165,250,0.18)' }}
                >
                    <div>
                        <p className="text-sm font-semibold text-white mb-1">Remote Control</p>
                        <p className="text-xs leading-6" style={{ color: 'var(--text-secondary)' }}>
                            This page can now call the Raspberry Pi local service directly. Until the pressure sensor hardware is installed, use the manual trigger button to simulate item detection.
                        </p>
                    </div>
                    <Sparkles size={18} style={{ color: '#60a5fa' }} />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_0.8fr] gap-4">
                    <div className="card p-5">
                        <div className="flex items-start justify-between gap-3 mb-4">
                            <div>
                                <p className="text-lg font-semibold text-white">Station Launcher</p>
                                <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
                                    Operators stay inside the app until they intentionally launch the Pi console on the local network.
                                </p>
                            </div>
                            <span
                                className="px-3 py-1 rounded-full text-xs font-semibold"
                                style={{ background: deviceTone.bg, border: `1px solid ${deviceTone.border}`, color: deviceTone.color }}
                            >
                                {device.status.replace(/_/g, ' ')}
                            </span>
                        </div>

                            <div className="rounded-2xl p-4 mb-4" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
                                <div className="flex items-start justify-between gap-3 mb-3">
                                    <div>
                                        <p className="text-xs uppercase tracking-wide mb-1" style={{ color: 'var(--text-secondary)' }}>Local Console Address</p>
                                        <p className="text-sm font-mono break-all text-white">{stationUrl}</p>
                                </div>
                                <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'rgba(96,165,250,0.12)' }}>
                                    <MonitorSmartphone size={17} style={{ color: '#60a5fa' }} />
                                </div>
                            </div>
                            <p className="text-xs leading-6" style={{ color: 'var(--text-secondary)' }}>
                                The live camera preview and capture buttons will run from the Pi itself. Phone or desktop must be on the same LAN and able to resolve the Pi hostname over mDNS.
                            </p>
                        </div>

                            <div className="flex flex-col sm:flex-row gap-2">
                                <a
                                    href={readyForConsole ? stationUrl : undefined}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="rounded-xl px-4 py-3 text-sm font-semibold inline-flex items-center justify-center gap-2"
                                    style={
                                        readyForConsole
                                            ? { background: 'rgba(96,165,250,0.12)', border: '1px solid rgba(96,165,250,0.24)', color: '#60a5fa' }
                                            : { background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-muted)', pointerEvents: 'none' }
                                    }
                                >
                                    <ExternalLink size={15} />
                                    Open Station Console
                                </a>
                                <button
                                    onClick={copyStationUrl}
                                    className="rounded-xl px-4 py-3 text-sm font-semibold inline-flex items-center justify-center gap-2"
                                    style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}
                                >
                                {copied ? <Check size={15} style={{ color: 'var(--lime)' }} /> : <Copy size={15} />}
                                {copied ? 'Copied' : 'Copy Address'}
                            </button>
                        </div>

                        {!readyForConsole && (
                            <p className="text-xs mt-3" style={{ color: '#f59e0b' }}>
                                Claim and activate this Raspberry Pi first. The dedicated console is intended for `claim_confirmed` or `active` station devices.
                            </p>
                        )}
                        {remoteMessage && (
                            <p className="text-xs mt-3" style={{ color: remoteReachable ? '#60a5fa' : '#f59e0b' }}>
                                {remoteMessage}
                            </p>
                        )}
                    </div>

                    <div className="card p-5">
                        <div className="flex items-start justify-between gap-3 mb-4">
                            <div>
                                <p className="text-lg font-semibold text-white">Cloud Pairing</p>
                                <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
                                    Mirrors the same hardware ownership flow already used for ESP32 devices.
                                </p>
                            </div>
                            <ShieldCheck size={18} style={{ color: 'var(--lime)' }} />
                        </div>

                        <div className="space-y-3 text-sm">
                            <div className="rounded-2xl p-3" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
                                <p className="text-xs uppercase tracking-wide mb-1" style={{ color: 'var(--text-secondary)' }}>Device ID</p>
                                <p className="text-white font-mono break-all">{device.deviceId}</p>
                            </div>
                            <div className="rounded-2xl p-3" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
                                <p className="text-xs uppercase tracking-wide mb-1" style={{ color: 'var(--text-secondary)' }}>Device Type</p>
                                <p className="text-white">{device.deviceType === 'raspberry_pi' ? 'Raspberry Pi station' : 'ESP32 gateway'}</p>
                            </div>
                            <div className="rounded-2xl p-3" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
                                <p className="text-xs uppercase tracking-wide mb-1" style={{ color: 'var(--text-secondary)' }}>Ready State</p>
                                <p className="text-white">
                                    {readyForConsole
                                        ? remoteReachable
                                            ? 'Pi reachable on the local network'
                                            : 'Ready for local console launch'
                                        : 'Waiting for claim and activation'}
                                </p>
                            </div>
                            <div className="rounded-2xl p-3" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
                                <p className="text-xs uppercase tracking-wide mb-1" style={{ color: 'var(--text-secondary)' }}>Remote State</p>
                                <p className="text-white">{remoteState?.state?.replace(/_/g, ' ') || 'Not connected yet'}</p>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-[1.15fr_0.85fr] gap-4">
                    <div className="card p-5">
                        <div className="flex items-start justify-between gap-3 mb-4">
                            <div>
                                <p className="text-lg font-semibold text-white">Operator Preview Flow</p>
                                <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
                                    This panel mirrors the Pi station state while you use website controls to arm, trigger, and capture.
                                </p>
                            </div>
                            <Gauge size={18} className="shrink-0" style={{ color: '#60a5fa' }} />
                        </div>

                        <div
                            className="rounded-[28px] p-4 sm:p-5 mb-4 relative overflow-hidden min-h-[250px] sm:min-h-[290px]"
                            style={{
                                background: 'linear-gradient(180deg, rgba(18,28,48,0.92) 0%, rgba(10,16,30,0.96) 100%)',
                                border: '1px solid rgba(96,165,250,0.18)',
                            }}
                        >
                            <div
                                className="absolute inset-0"
                                style={{ background: 'radial-gradient(circle at top right, rgba(96,165,250,0.14), transparent 34%)' }}
                            />
                            <div className="relative z-10 flex flex-col h-full">
                                <div className="flex items-start sm:items-center justify-between gap-3 mb-4">
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'rgba(96,165,250,0.12)' }}>
                                            <Camera size={16} style={{ color: '#60a5fa' }} />
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-xs uppercase tracking-[0.22em]" style={{ color: '#60a5fa' }}>Live Console</p>
                                            <p className="text-sm font-semibold text-white">External Camera Preview</p>
                                        </div>
                                    </div>
                                    <span
                                        className="px-2.5 py-1 rounded-full text-[11px] font-semibold shrink-0"
                                        style={{
                                            background: stationEnabled ? 'rgba(132,204,22,0.12)' : 'rgba(148,163,184,0.12)',
                                            border: `1px solid ${stationEnabled ? 'rgba(132,204,22,0.24)' : 'rgba(148,163,184,0.2)'}`,
                                            color: stationEnabled ? 'var(--lime)' : 'var(--text-secondary)',
                                        }}
                                    >
                                        {stationEnabled ? 'Station armed' : 'Station off'}
                                    </span>
                                </div>

                                <div
                                    className="rounded-[24px] border relative overflow-hidden mb-4 min-h-[120px] sm:min-h-[150px]"
                                    style={{ borderColor: 'rgba(96,165,250,0.16)', background: 'linear-gradient(180deg, rgba(15,23,42,0.96), rgba(17,24,39,0.96))' }}
                                >
                                    <div className="absolute inset-0 opacity-60" style={{ backgroundImage: 'linear-gradient(rgba(148,163,184,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,0.06) 1px, transparent 1px)', backgroundSize: '28px 28px' }} />
                                    <div className="absolute inset-x-0 top-0 h-16" style={{ background: 'linear-gradient(180deg, rgba(96,165,250,0.14), transparent)' }} />
                                    <div className="absolute inset-0 p-4 sm:p-5 flex flex-col justify-between">
                                        <div className="flex items-center justify-between gap-3">
                                            <span
                                                className="px-2.5 py-1 rounded-full text-[11px] font-semibold"
                                                style={{ background: 'rgba(96,165,250,0.12)', border: '1px solid rgba(96,165,250,0.2)', color: '#93c5fd' }}
                                            >
                                                {stationEnabled ? 'Operator armed' : 'Awaiting enable'}
                                            </span>
                                            <p className="text-[11px] font-medium" style={{ color: 'var(--text-secondary)' }}>
                                                Step {Math.min(Math.max(activeStepIndex, 0), 6)} of 7
                                            </p>
                                        </div>
                                        <div className="max-w-sm">
                                            <p className="text-sm font-semibold text-white mb-2">{activeStep.title}</p>
                                            <p className="text-xs leading-6" style={{ color: 'var(--text-secondary)' }}>
                                                {activeStep.body}
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <div className="h-2 flex-1 rounded-full" style={{ background: 'rgba(148,163,184,0.14)' }}>
                                                <div
                                                    className="h-full rounded-full"
                                                    style={{
                                                        width: `${((Math.min(Math.max(activeStepIndex, 0), 6) + 1) / 7) * 100}%`,
                                                        background: 'linear-gradient(90deg, #60a5fa, var(--lime))',
                                                    }}
                                                />
                                            </div>
                                            <CircleDot size={14} style={{ color: stationEnabled ? 'var(--lime)' : '#60a5fa' }} />
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                    {FLOW_CARDS.map((slot) => {
                                        const state = flowCardState(slot.key);
                                        const isCurrent = state === 'current';
                                        const isComplete = state === 'complete';

                                        return (
                                        <div
                                            key={slot.key}
                                            className="rounded-2xl p-3"
                                            style={{
                                                background: isComplete
                                                    ? 'rgba(132,204,22,0.12)'
                                                    : isCurrent
                                                        ? 'rgba(96,165,250,0.12)'
                                                        : 'var(--bg-elevated)',
                                                border: `1px solid ${isComplete ? 'rgba(132,204,22,0.24)' : isCurrent ? 'rgba(96,165,250,0.24)' : 'var(--border)'}`,
                                            }}
                                        >
                                            <p
                                                className="text-[11px] uppercase tracking-wide mb-1"
                                                style={{ color: isComplete ? 'var(--lime)' : isCurrent ? '#93c5fd' : 'var(--text-secondary)' }}
                                            >
                                                {slot.eyebrow}
                                            </p>
                                            <p className="text-sm font-semibold text-white">{slot.title}</p>
                                        </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-col gap-4">
                        <div className="card p-5">
                            <div className="flex items-start justify-between gap-3 mb-4">
                                <div>
                                    <p className="text-lg font-semibold text-white">Station Controls</p>
                                    <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
                                        Manual arming prevents the Pi from hijacking the app while operators are on other pages.
                                    </p>
                                </div>
                                <Power size={18} style={{ color: 'var(--lime)' }} />
                            </div>

                            <div className="rounded-2xl p-4 mb-3" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
                                <div className="flex items-center justify-between gap-3 mb-2">
                                    <p className="text-sm font-semibold text-white">{stationEnabled ? 'Station Enabled' : 'Station Disabled'}</p>
                                    <CircleDot size={14} style={{ color: stationEnabled ? 'var(--lime)' : 'var(--text-secondary)' }} />
                                </div>
                                <p className="text-xs leading-6" style={{ color: 'var(--text-secondary)' }}>
                                    Enable station mode only when an operator is ready. Until the pressure sensor is installed, use the manual trigger button below to simulate item detection.
                                </p>
                            </div>

                            <div className="flex flex-col gap-2">
                                <button
                                    onClick={toggleStation}
                                    disabled={!readyForConsole || !!remoteBusy}
                                    className="rounded-xl px-4 py-3 text-sm font-semibold inline-flex items-center justify-center gap-2"
                                    style={
                                        stationEnabled
                                            ? { background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.24)', color: '#f87171' }
                                            : { background: 'var(--lime-glow)', border: '1px solid var(--lime-border)', color: 'var(--lime)' }
                                    }
                                >
                                    <Power size={15} />
                                    {remoteBusy === '/api/arm' || remoteBusy === '/api/disarm'
                                        ? 'Updating...'
                                        : stationEnabled
                                            ? 'Disable Station'
                                            : 'Enable Station'}
                                </button>
                                <button
                                    onClick={triggerManualDetect}
                                    disabled={!stationEnabled || !!remoteBusy}
                                    className="rounded-xl px-4 py-3 text-sm font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-50"
                                    style={{ background: 'rgba(96,165,250,0.12)', border: '1px solid rgba(96,165,250,0.24)', color: '#60a5fa' }}
                                >
                                    {remoteBusy === '/api/manual-trigger' ? <Loader2 size={15} /> : <ScanSearch size={15} />}
                                    Manual Trigger
                                </button>
                                <button
                                    onClick={captureNextAngle}
                                    disabled={!stationEnabled || !!remoteBusy}
                                    className="rounded-xl px-4 py-3 text-sm font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-50"
                                    style={{ background: 'rgba(96,165,250,0.08)', border: '1px solid rgba(96,165,250,0.18)', color: '#93c5fd' }}
                                >
                                    {remoteBusy === '/api/capture' ? <Loader2 size={15} /> : <Camera size={15} />}
                                    Capture Next Angle
                                </button>
                                <button
                                    onClick={resetPreview}
                                    disabled={!!remoteBusy}
                                    className="rounded-xl px-4 py-3 text-sm font-semibold inline-flex items-center justify-center gap-2"
                                    style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}
                                >
                                    <TimerReset size={15} />
                                    Reset Station
                                </button>
                                <button
                                    onClick={() => void fetchRemoteState()}
                                    disabled={!readyForConsole || !!remoteBusy}
                                    className="rounded-xl px-4 py-3 text-sm font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-50"
                                    style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}
                                >
                                    <RefreshCcw size={15} />
                                    Refresh Status
                                </button>
                            </div>
                        </div>

                        <div className="card p-5">
                            <div className="flex items-start justify-between gap-3 mb-4">
                                <div>
                                    <p className="text-lg font-semibold text-white">Connection Checklist</p>
                                    <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
                                        The website can control the Pi directly now, but both devices must be on the same local network.
                                    </p>
                                </div>
                                <Wifi size={18} style={{ color: '#60a5fa' }} />
                            </div>

                            <div className="space-y-3">
                                {[
                                    { icon: <ShieldCheck size={15} />, title: 'Claim in Org Devices', body: 'Use the existing factory claim flow exactly like the ESP32 hardware.' },
                                    { icon: <RadioTower size={15} />, title: 'Reachable on LAN', body: 'The org website sends arm, trigger, and capture requests to the Pi local service over the LAN.' },
                                    { icon: <Power size={15} />, title: 'Manual Trigger', body: 'Until the pressure sensor is installed, use the website trigger button to simulate item detection.' },
                                    { icon: <Camera size={15} />, title: 'Three-Angle Capture', body: 'Capture angle 1, rotate, capture angle 2, rotate again, then capture angle 3 before AI analysis.' },
                                ].map((item) => (
                                    <div key={item.title} className="rounded-2xl p-3" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
                                        <div className="flex items-start gap-3">
                                            <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'rgba(96,165,250,0.12)' }}>
                                                <span style={{ color: '#60a5fa' }}>{item.icon}</span>
                                            </div>
                                            <div>
                                                <p className="text-sm font-semibold text-white">{item.title}</p>
                                                <p className="text-xs leading-6 mt-1" style={{ color: 'var(--text-secondary)' }}>{item.body}</p>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <LazyBottomNav />
        </div>
    );
}
