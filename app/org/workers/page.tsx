'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Users, UserPlus, Link as LinkIcon, Clock, ChevronLeft, Leaf, Copy, Check, X, Search } from 'lucide-react';
import { useAuth } from '@/lib/authContext';
import { getOrg } from '@/lib/orgService';
import { generateInvite } from '@/lib/inviteService';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import BottomNav from '@/components/BottomNav';

interface Worker {
    uid: string;
    displayName: string | null;
    email: string | null;
    role: string;
}

export default function WorkersPage() {
    const router = useRouter();
    const { user, profile, loading } = useAuth();

    const [workers, setWorkers]         = useState<Worker[]>([]);
    const [fetching, setFetching]       = useState(true);
    const [orgName, setOrgName]         = useState('');
    const [showModal, setShowModal]     = useState(false);
    const [inviteCode, setInviteCode]   = useState('');
    const [generating, setGenerating]   = useState(false);
    const [copied, setCopied]           = useState(false);
    const [search, setSearch]           = useState('');

    const isAdmin = profile?.role === 'org_admin';

    useEffect(() => {
        if (loading) return;
        if (!user || user.isAnonymous) { router.replace('/dashboard'); return; }
        if (!profile?.orgId) { router.replace('/org/setup'); return; }
        if (!isAdmin) { router.replace('/dashboard'); return; } // workers can't manage workers

        async function fetchData() {
            if (!profile?.orgId) return;
            try {
                const [org, snap] = await Promise.all([
                    getOrg(profile.orgId),
                    getDocs(query(collection(db, 'users'), where('orgId', '==', profile.orgId))),
                ]);
                setOrgName(org?.name ?? '');
                setWorkers(snap.docs.map(d => d.data() as Worker));
            } catch (e) {
                console.error('[Workers] fetch failed:', e);
            } finally {
                setFetching(false);
            }
        }
        fetchData();
    }, [user, profile, loading, isAdmin, router]);

    async function handleGenerateInvite() {
        if (!profile?.orgId || !user) return;
        setGenerating(true);
        try {
            const code = await generateInvite(profile.orgId, orgName, user.uid);
            setInviteCode(code);
            setShowModal(true);
        } catch (e) {
            console.error('[Workers] invite gen failed:', e);
        } finally {
            setGenerating(false);
        }
    }

    const inviteLink = typeof window !== 'undefined'
        ? `${window.location.origin}/join?code=${inviteCode}`
        : '';

    async function copyLink() {
        await navigator.clipboard.writeText(inviteLink);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    }

    if (loading || fetching) return (
        <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-primary)' }}>
            <div className="w-8 h-8 rounded-full border-2 animate-spin"
                style={{ borderColor: 'var(--border)', borderTopColor: '#84cc16' }} />
        </div>
    );

    return (
        <div className="flex flex-col min-h-screen pb-28 lg:pb-0" style={{ background: 'var(--bg-primary)' }}>

            {/* Header */}
            <div className="safe-top px-5 pt-6 pb-5 lg:px-10 lg:pt-10 lg:pb-8">
                <div className="flex items-center gap-3 mb-4">
                    <button onClick={() => router.back()}
                        className="w-8 h-8 rounded-lg flex items-center justify-center"
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

                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-white" style={{ fontFamily: 'Space Grotesk' }}>Workers</h1>
                        <p className="text-sm mt-1" style={{ color: 'var(--text-dim)' }}>{orgName} · {workers.length} member{workers.length !== 1 ? 's' : ''}</p>
                    </div>
                    <button
                        onClick={handleGenerateInvite}
                        disabled={generating}
                        className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all"
                        style={{ background: '#84cc16', color: 'var(--bg-primary)' }}
                    >
                        <UserPlus size={15} />
                        {generating ? 'Generating…' : 'Invite'}
                    </button>
                </div>
            </div>

            {/* Search bar */}
            <div className="px-5 lg:px-10 mb-4 max-w-2xl">
                <div className="flex items-center gap-2 rounded-xl px-3 py-2.5"
                    style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                    <Search size={14} style={{ color: 'var(--text-dim)', flexShrink: 0 }} />
                    <input
                        type="text"
                        placeholder="Search by name or email…"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="flex-1 bg-transparent outline-none text-sm text-white placeholder:text-[var(--text-dim)]"
                    />
                    {search && (
                        <button onClick={() => setSearch('')}
                            className="p-0.5 rounded"
                            style={{ color: 'var(--text-dim)' }}>
                            <X size={12} />
                        </button>
                    )}
                </div>
            </div>

            {/* Worker list */}
            <div className="px-5 lg:px-10 flex flex-col gap-3 max-w-2xl">
                {(() => {
                    const q = search.toLowerCase();
                    const filtered = workers.filter(w =>
                        (w.displayName ?? '').toLowerCase().includes(q) ||
                        (w.email ?? '').toLowerCase().includes(q)
                    );
                    if (workers.length === 0) return (
                        <div className="rounded-2xl p-8 flex flex-col items-center gap-3 text-center"
                            style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                            <div className="w-12 h-12 rounded-full flex items-center justify-center"
                                style={{ background: 'var(--border)' }}>
                                <Users size={20} style={{ color: '#4B5563' }} />
                            </div>
                            <p className="text-sm font-semibold text-white">No workers yet</p>
                            <p className="text-xs" style={{ color: 'var(--text-dim)' }}>Generate an invite link and share it with your team.</p>
                        </div>
                    );
                    if (filtered.length === 0) return (
                        <div className="rounded-2xl p-8 flex flex-col items-center gap-3 text-center"
                            style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                            <Search size={20} style={{ color: '#4B5563' }} />
                            <p className="text-sm font-semibold text-white">No results</p>
                            <p className="text-xs" style={{ color: 'var(--text-dim)' }}>No workers match &ldquo;{search}&rdquo;</p>
                        </div>
                    );
                    return filtered.map(w => (
                        <div key={w.uid}
                            className="flex items-center gap-4 rounded-xl px-4 py-3"
                            style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                            <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
                                style={{ background: 'rgba(132,204,22,0.12)', color: '#84cc16', border: '1px solid rgba(132,204,22,0.2)' }}>
                                {(w.displayName ?? w.email ?? '?')[0].toUpperCase()}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold text-white truncate">{w.displayName ?? 'Unnamed'}</p>
                                <p className="text-xs truncate" style={{ color: 'var(--text-dim)' }}>{w.email}</p>
                            </div>
                            <span className="text-[10px] font-bold px-2 py-1 rounded-lg capitalize"
                                style={{
                                    background: w.role === 'org_admin' ? 'rgba(132,204,22,0.1)' : 'rgba(96,165,250,0.1)',
                                    color: w.role === 'org_admin' ? '#84cc16' : '#60A5FA',
                                }}>
                                {w.role === 'org_admin' ? 'Admin' : 'Worker'}
                            </span>
                        </div>
                    ));
                })()}
            </div>

            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-5"
                    style={{ background: 'rgba(0,0,0,0.7)' }}>
                    <div className="w-full max-w-sm rounded-2xl p-6"
                        style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>

                        {/* Header */}
                        <div className="flex items-start justify-between mb-4">
                            <div>
                                <h2 className="text-base font-bold text-white" style={{ fontFamily: 'Space Grotesk' }}>
                                    Invite Worker
                                </h2>
                                <p className="text-xs mt-0.5" style={{ color: 'var(--text-dim)' }}>Expires in 7 days · Single use</p>
                            </div>
                            <button onClick={() => { setShowModal(false); setInviteCode(''); }}
                                className="p-1.5 rounded-lg" style={{ color: '#4B5563' }}>
                                <X size={16} />
                            </button>
                        </div>

                        {/* QR Code */}
                        {inviteLink && (
                            <div className="flex flex-col items-center mb-4">
                                <div className="rounded-2xl p-3" style={{ background: '#fff' }}>
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img
                                        src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&margin=4&data=${encodeURIComponent(inviteLink)}`}
                                        alt="QR invite code"
                                        width={180}
                                        height={180}
                                        className="rounded-lg"
                                    />
                                </div>
                                <p className="text-xs mt-2" style={{ color: 'var(--text-dim)' }}>
                                    Scan to join <strong className="text-white">{orgName}</strong>
                                </p>
                            </div>
                        )}

                        {/* Code badge */}
                        <div className="rounded-xl px-4 py-2.5 mb-3 flex items-center justify-between"
                            style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)' }}>
                            <div>
                                <p className="text-[10px] mb-0.5" style={{ color: 'var(--text-dim)' }}>CODE</p>
                                <p className="text-lg font-bold tracking-widest text-white"
                                    style={{ fontFamily: 'Space Grotesk' }}>{inviteCode}</p>
                            </div>
                            <LinkIcon size={16} style={{ color: '#4B5563' }} />
                        </div>

                        {/* Copy button */}
                        <button
                            onClick={copyLink}
                            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all mb-3"
                            style={{
                                background: copied ? 'rgba(132,204,22,0.15)' : '#84cc16',
                                color: copied ? '#84cc16' : 'var(--bg-primary)',
                                border: copied ? '1px solid rgba(132,204,22,0.3)' : 'none',
                            }}
                        >
                            {copied ? <><Check size={14} /> Link Copied!</> : <><Copy size={14} /> Copy Invite Link</>}
                        </button>

                        <div className="flex items-center gap-2 rounded-xl px-3 py-2"
                            style={{ background: 'rgba(96,165,250,0.06)', border: '1px solid rgba(96,165,250,0.15)' }}>
                            <Clock size={12} style={{ color: '#60A5FA', flexShrink: 0 }} />
                            <p className="text-[10px]" style={{ color: '#60A5FA' }}>
                                Worker scans QR or opens the link — they&apos;ll sign in then join automatically.
                            </p>
                        </div>
                    </div>
                </div>
            )}


            <BottomNav />
        </div>
    );
}
