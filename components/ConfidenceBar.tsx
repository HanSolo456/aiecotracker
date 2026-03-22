'use client';

interface ConfidenceBarProps {
    label: string;
    value: number; // 0–1
    className?: string;
}

export default function ConfidenceBar({ label, value, className = '' }: ConfidenceBarProps) {
    const pct = Math.round(value * 100);
    const fillClass =
        value >= 0.92
            ? 'confidence-fill-high'
            : value >= 0.80
                ? 'confidence-fill-med'
                : 'confidence-fill-low';

    const textColor =
        value >= 0.92
            ? 'text-brand-green'
            : value >= 0.80
                ? 'text-amber-400'
                : 'text-red-400';

    return (
        <div className={`flex flex-col gap-1.5 ${className}`}>
            <div className="flex justify-between items-center">
                <span className="text-xs text-secondary font-medium">{label}</span>
                <span className={`text-xs font-bold ${textColor}`}>{pct}%</span>
            </div>
            <div className="confidence-bar">
                <div className={fillClass} style={{ width: `${pct}%` }} />
            </div>
        </div>
    );
}
