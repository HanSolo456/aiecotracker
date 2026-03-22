'use client';

import { AlertTriangle, CheckCircle2 } from 'lucide-react';

interface HazardBadgeProps {
    label: string;
    active: boolean;
    regulation?: string;
}

export default function HazardBadge({ label, active, regulation }: HazardBadgeProps) {
    return (
        <div
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all ${active ? 'hazard-active' : 'hazard-inactive opacity-40'
                }`}
        >
            {active ? (
                <AlertTriangle size={11} className="shrink-0" />
            ) : (
                <CheckCircle2 size={11} className="shrink-0" />
            )}
            <span>{label}</span>
            {active && regulation && (
                <span className="opacity-70 font-normal">· {regulation}</span>
            )}
        </div>
    );
}
