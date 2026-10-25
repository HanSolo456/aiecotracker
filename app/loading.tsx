import BottomNav from '@/components/BottomNav';

export default function Loading() {
    return (
        <div className="min-h-screen px-5 pt-10 pb-28 lg:px-10">
            <div role="status" className="flex items-center gap-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
                <span aria-hidden="true" className="h-4 w-4 animate-spin rounded-full border-2 border-lime-400 border-t-transparent" />
                Loading page…
            </div>
            <div aria-hidden="true" className="mt-6 space-y-4 motion-reduce:animate-none">
                <div className="shimmer h-8 w-40 rounded-lg" />
                <div className="shimmer h-40 rounded-2xl" />
                <div className="shimmer h-24 rounded-2xl" />
            </div>
            <BottomNav />
        </div>
    );
}
