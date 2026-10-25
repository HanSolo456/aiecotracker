import { NextRequest, NextResponse } from 'next/server';
import { classifyImage, VisionUnavailableError } from '@/lib/visionClassifier';
import { applySafetyGatekeeper } from '@/lib/safetyGatekeeper';
import { MOCK_PART_PAYLOAD } from '@/lib/mockData';
import { enrichPayloadForCitizenWasteGuidance } from '@/lib/wasteGuidance';
import { checkRateLimit } from '@/lib/requestRateLimit';
import type { PartMetadataPayload, IdentifyPartResponse } from '@/types';

// Provider cascade is bounded to 55s, leaving time for merging and safety rules.
export const maxDuration = 90;

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/identify-part
//
// Provider priority:
//   1. Gemini (bounded model cascade)
//   2. Groq vision with key rotation
//   3. Retryable 503 if all providers fail; mock only for explicit DEMO/MOCK
// ─────────────────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest): Promise<NextResponse<IdentifyPartResponse>> {
    try {
        const rateLimit = checkRateLimit(request, {
            keyPrefix: 'identify-part',
            limit: 12,
            windowMs: 60_000,
        });
        if (!rateLimit.allowed) {
            return NextResponse.json(
                { success: false, error: `Rate limit exceeded. Try again in ${rateLimit.retryAfterSec}s.` },
                { status: 429 },
            );
        }

        const body = await request.json();
        const { imageBase64, mimeType = 'image/jpeg' } = body as {
            imageBase64: string;
            mimeType: string;
        };

        if (typeof imageBase64 !== 'string' || !imageBase64.trim() ||
            !['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'].includes(mimeType)) {
            return NextResponse.json({ success: false, error: 'Provide a valid image (JPEG, PNG, WebP, HEIC or HEIF).' }, { status: 400 });
        }

        // ── Mock mode ────────────────────────────────────────────────────────
        if (imageBase64 === 'DEMO' || imageBase64 === 'MOCK') {
            const { payload } = applySafetyGatekeeper(MOCK_PART_PAYLOAD);
            return NextResponse.json({ success: true, payload: enrichPayloadForCitizenWasteGuidance(payload), mock: true });
        }

        const cleanBase64 = imageBase64.replace(/^data:image\/[a-z+]+;base64,/, '');

        const rawPayload = await classifyImage(cleanBase64, mimeType);

        const { payload } = applySafetyGatekeeper(rawPayload);
        return NextResponse.json({ success: true, payload: enrichPayloadForCitizenWasteGuidance(payload), mock: false });

    } catch (error) {
        if (error instanceof VisionUnavailableError) {
            return NextResponse.json({ success: false, error: error.message }, { status: 503 });
        }
        console.error('[identify-part] Error:', error);
        return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
        }, { status: 500 });
    }
}
