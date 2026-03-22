'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Building2, MapPin, Mail, FileText, Users, ScanLine, Edit2, Check, X, Leaf, ChevronLeft, ChevronRight, BarChart2, Settings, CircleDot } from 'lucide-react';

import { useAuth } from '@/lib/authContext';
import { getOrg, updateOrg, type OrgProfile, type OrgType } from '@/lib/orgService';
import { collection, query, where, getCountFromServer } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import BottomNav from '@/components/BottomNav';

const ORG_TYPE_LABELS: Record<OrgType, string> = {
    recycler:           '♻️  Recycler',
    manufacturer:       '🏭  Manufacturer',
    collection_center:  '📦  Collection Center',
};

export default function OrgProfilePage() {
    const router = useRouter();
    const { user, profile, loading } = useAuth();

    const [org, setOrg]             = useState<OrgProfile | null>(null);
    const [fetching, setFetching]   = useState(true);
    const [editing, setEditing]     = useState(false);
    const [saving, setSaving]       = useState(false);
    const [error, setError]         = useState('');

    // Stats
    const [workerCount, setWorkerCount] = useState<number | null>(null);
    const [scanCount, setScanCount]     = useState<number | null>(null);

    // Edit form state
    const [editName, setEditName]           = useState('');
    const [editAddress, setEditAddress]     = useState('');
    const [editGstin, setEditGstin]         = useState('');
    const [editEmail, setEditEmail]         = useState('');

    const isAdmin = profile?.role === 'org_admin';

    useEffect(() => {
        if (loading) return;
        if (!user || user.isAnonymous) { router.replace('/dashboard'); return; }
        if (!profile?.orgId) { router.replace('/org/setup'); return; }

        async function fetchData() {
            if (!profile?.orgId) return;
            try {
                const orgPromise = getOrg(profile.orgId);
                const workersPromise = getCountFromServer(query(collection(db, 'users'), where('orgId', '==', profile.orgId)));
                const scansPromise = getCountFromServer(query(collection(db, 'scans'), where('orgId', '==', profile.orgId)));

                // Unblock first paint as soon as org profile is ready.
                const orgData = await orgPromise;
                setOrg(orgData);
                setFetching(false);

                // Stats can load independently after initial render.
                workersPromise
                    .then(wSnap => setWorkerCount(wSnap.data().count))
                    .catch(e => console.error('[OrgProfile] worker count failed:', e));
                scansPromise
                    .then(sSnap => setScanCount(sSnap.data().count))
                    .catch(e => console.error('[OrgProfile] scan count failed:', e));
            } catch (e) {
                console.error('[OrgProfile] fetch failed:', e);
                setFetching(false);
            }
        }
        fetchData();
    }, [user, profile, loading, router]);

    function startEdit() {
        if (!org) return;
        setEditName(org.name);
        setEditAddress(org.address);
        setEditGstin(org.gstin ?? '');
        setEditEmail(org.contactEmail);
        setEditing(true);
        setError('');
    }

    async function saveEdit() {
        if (!org) return;
        setSaving(true);
        setError('');
        try {
            await updateOrg(org.orgId, {
                name: editName,
                address: editAddress,
                gstin: editGstin,
                contactEmail: editEmail,
            });
            setOrg(prev => prev ? { ...prev, name: editName, address: editAddress, gstin: editGstin, contactEmail: editEmail } : prev);
            setEditing(false);
        } catch (e) {
            console.error('[OrgProfile] save failed:', e);
            setError('Failed to save. Please try again.');
        } finally {
            setSaving(false);
        }
    }

    if (loading || (fetching && !org)) {
        return (
            <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-primary)' }}>
                <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: '#84cc16', borderTopColor: 'transparent' }} />
            </div>
        );
    }

    if (!org) {
        return (
            <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-primary)' }}>
                <p className="text-sm" style={{ color: 'var(--text-dim)' }}>Organisation not found.</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col min-h-screen pb-28 lg:pb-0" style={{ background: 'var(--bg-primary)' }}>

            {/* Header */}
            <div className="safe-top px-5 pt-6 pb-5 lg:px-10 lg:pt-10 lg:pb-8">
                <div className="flex items-center gap-3 mb-2">
                    <button onClick={() => router.back()}
                        className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
                        style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                        <ChevronLeft size={16} style={{ color: 'var(--text-secondary)' }} />
                    </button>
                    <div className="flex items-center gap-2 lg:hidden">
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center"
                            style={{ background: 'rgba(132,204,22,0.15)', border: '1px solid rgba(132,204,22,0.3)' }}>
                            <Leaf size={13} style={{ color: '#84cc16' }} />
                        </div>
                    </div>
                </div>
                <div className="flex items-start justify-between">
                    <div>
                        <h1 className="text-2xl lg:text-3xl font-bold text-white" style={{ fontFamily: 'Space Grotesk' }}>
                            {org.name}
                        </h1>
                        <p className="text-sm mt-1" style={{ color: 'var(--text-dim)' }}>
                            {ORG_TYPE_LABELS[org.type]}
                        </p>
                    </div>
                    {isAdmin && !editing && (
                        <button
                            onClick={startEdit}
                            className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold transition-all"
                            style={{ background: 'var(--border)', color: 'var(--text-secondary)', border: '1px solid #374151' }}
                        >
                            <Edit2 size={13} /> Edit
                        </button>
                    )}
                </div>
            </div>

            <div className="px-5 lg:px-10 pb-8 flex flex-col gap-4 max-w-2xl">

                {/* Stats row */}
                <div className="grid grid-cols-2 gap-3">
                    <StatCard icon={<Users size={16} style={{ color: '#84cc16' }} />} label="Workers" value={workerCount ?? '—'} />
                    <StatCard icon={<ScanLine size={16} style={{ color: '#60A5FA' }} />} label="Total Scans" value={scanCount ?? '—'} />
                </div>

                {error && (
                    <div className="rounded-xl px-4 py-3 text-sm"
                        style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#FCA5A5' }}>
                        {error}
                    </div>
                )}

                {/* Details card */}
                <div className="rounded-2xl p-5 flex flex-col gap-4"
                    style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                    <h2 className="text-sm font-bold text-white" style={{ fontFamily: 'Space Grotesk' }}>Organisation Details</h2>

                    {editing ? (
                        <div className="flex flex-col gap-3">
                            <EditField icon={<Building2 size={14} />} label="Name" value={editName} onChange={setEditName} />
                            <EditField icon={<MapPin size={14} />} label="Address" value={editAddress} onChange={setEditAddress} />
                            <EditField icon={<FileText size={14} />} label="GSTIN (optional)" value={editGstin} onChange={setEditGstin} />
                            <EditField icon={<Mail size={14} />} label="Contact Email" value={editEmail} onChange={setEditEmail} type="email" />

                            <div className="flex gap-2 pt-1">
                                <button
                                    onClick={() => setEditing(false)}
                                    className="flex-1 flex items-center justify-center gap-1 py-2.5 rounded-xl text-sm font-semibold"
                                    style={{ background: 'var(--border)', color: 'var(--text-secondary)' }}
                                >
                                    <X size={14} /> Cancel
                                </button>
                                <button
                                    onClick={saveEdit}
                                    disabled={saving}
                                    className="flex-[2] flex items-center justify-center gap-1 py-2.5 rounded-xl text-sm font-bold transition-all"
                                    style={{ background: '#84cc16', color: 'var(--bg-primary)' }}
                                >
                                    <Check size={14} /> {saving ? 'Saving…' : 'Save Changes'}
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-col gap-3">
                            <DetailRow icon={<Building2 size={14} />} label="Name" value={org.name} />
                            <DetailRow icon={<MapPin size={14} />} label="Address" value={org.address} />
                            {org.gstin && <DetailRow icon={<FileText size={14} />} label="GSTIN" value={org.gstin} />}
                            <DetailRow icon={<Mail size={14} />} label="Contact" value={org.contactEmail} />
                        </div>
                    )}
                </div>

                {/* Role badge */}
                <div className="flex items-center gap-2 rounded-xl px-4 py-3"
                    style={{ background: isAdmin ? 'rgba(132,204,22,0.06)' : 'rgba(96,165,250,0.06)', border: `1px solid ${isAdmin ? 'rgba(132,204,22,0.2)' : 'rgba(96,165,250,0.2)'}` }}>
                    <span className="text-xs font-semibold" style={{ color: isAdmin ? '#84cc16' : '#60A5FA' }}>
                        {isAdmin ? '🛡 Org Admin' : '👷 Worker'}
                    </span>
                    <span className="text-xs" style={{ color: '#4B5563' }}>
                        — {isAdmin ? 'You manage this organisation' : 'You are a member of this organisation'}
                    </span>
                </div>

                {/* Quick Actions */}
                <div className="lg:hidden flex flex-col gap-2">
                    <p className="text-xs font-semibold uppercase tracking-wider px-1" style={{ color: 'var(--text-muted)' }}>Quick Actions</p>

                    {/* Manage Workers — admin only */}
                    {isAdmin && (
                        <button
                            onClick={() => router.push('/org/workers')}
                            className="flex items-center gap-3 rounded-xl px-4 py-3 w-full text-left"
                            style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
                        >
                            <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                                style={{ background: 'rgba(96,165,250,0.1)' }}>
                                <Users size={16} style={{ color: '#60A5FA' }} />
                            </div>
                            <div className="flex-1">
                                <p className="text-sm font-semibold text-white">Manage Workers</p>
                                <p className="text-xs" style={{ color: 'var(--text-dim)' }}>Invite team members via QR or link</p>
                            </div>
                            <ChevronRight size={16} style={{ color: '#374151' }} />
                        </button>
                    )}
                </div>



            </div>


            <BottomNav />
        </div>
    );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | number }) {
    return (
        <div className="rounded-xl p-4 flex flex-col gap-1"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
            <div className="flex items-center gap-1.5 mb-1">{icon}<span className="text-xs" style={{ color: 'var(--text-dim)' }}>{label}</span></div>
            <span className="text-2xl font-bold text-white" style={{ fontFamily: 'Space Grotesk' }}>{value}</span>
        </div>
    );
}

function DetailRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
    return (
        <div className="flex items-start gap-3">
            <div className="mt-0.5 shrink-0" style={{ color: '#4B5563' }}>{icon}</div>
            <div>
                <p className="text-xs mb-0.5" style={{ color: 'var(--text-dim)' }}>{label}</p>
                <p className="text-sm text-white">{value}</p>
            </div>
        </div>
    );
}

function EditField({ icon, label, value, onChange, type = 'text' }: {
    icon: React.ReactNode; label: string; value: string; onChange: (v: string) => void; type?: string;
}) {
    return (
        <div>
            <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--text-secondary)' }}>{label.toUpperCase()}</label>
            <div className="relative flex items-center">
                <span className="absolute left-3" style={{ color: 'var(--text-dim)' }}>{icon}</span>
                <input
                    type={type}
                    value={value}
                    onChange={e => onChange(e.target.value)}
                    className="w-full pl-9 pr-4 py-2.5 rounded-xl text-sm outline-none text-white"
                    style={{ background: 'var(--bg-primary)', border: '1px solid #374151' }}
                />
            </div>
        </div>
    );
}
