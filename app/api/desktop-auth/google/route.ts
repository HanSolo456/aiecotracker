import { NextRequest, NextResponse } from 'next/server';
import {
    completeDesktopGoogleHandoff,
    consumeDesktopGoogleHandoff,
    createDesktopGoogleHandoff,
    failDesktopGoogleHandoff,
    readDesktopGoogleHandoff,
} from '@/lib/desktopGoogleHandoff';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function badRequest(message: string) {
    return NextResponse.json({ error: message }, { status: 400 });
}

export async function POST() {
    const handoff = await createDesktopGoogleHandoff();
    return NextResponse.json(handoff);
}

export async function GET(request: NextRequest) {
    const requestId = request.nextUrl.searchParams.get('requestId')?.trim();
    if (!requestId) return badRequest('Missing requestId.');

    const handoff = await readDesktopGoogleHandoff(requestId);
    if (!handoff) {
        return NextResponse.json({ status: 'expired' }, { status: 404 });
    }

    if (handoff.status === 'completed' || handoff.status === 'failed') {
        const consumed = await consumeDesktopGoogleHandoff(requestId);
        return NextResponse.json(consumed);
    }

    return NextResponse.json(handoff);
}

export async function PUT(request: NextRequest) {
    const body = (await request.json().catch(() => null)) as
        | { requestId?: string; idToken?: string; error?: string }
        | null;

    const requestId = body?.requestId?.trim();
    if (!requestId) return badRequest('Missing requestId.');

    if (body?.idToken) {
        const handoff = await completeDesktopGoogleHandoff(requestId, body.idToken);
        if (!handoff) {
            return NextResponse.json({ error: 'Desktop sign-in request expired.' }, { status: 404 });
        }
        return NextResponse.json({ ok: true });
    }

    const handoff = await failDesktopGoogleHandoff(
        requestId,
        body?.error?.trim() || 'Google sign-in failed.',
    );
    if (!handoff) {
        return NextResponse.json({ error: 'Desktop sign-in request expired.' }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
}
