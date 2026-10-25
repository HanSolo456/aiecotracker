import { NextRequest, NextResponse } from 'next/server';
import { classifyImage, VisionUnavailableError } from '@/lib/visionClassifier';
import { applySafetyGatekeeper } from '@/lib/safetyGatekeeper';
import { mergeVLMResults } from '@/lib/mergeVLMResults';
import { MOCK_PART_PAYLOAD } from '@/lib/mockData';
import { enrichPayloadForCitizenWasteGuidance } from '@/lib/wasteGuidance';
import { checkRateLimit } from '@/lib/requestRateLimit';
import type { PartMetadataPayload, IdentifyPartResponse } from '@/types';

// Provider cascade is bounded to 55s, leaving time for merging and safety rules.
export const maxDuration = 90;

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/identify-part-multiview
//
// Accepts: { images: [{ imageBase64: string, mimeType: string }] }  (1–3 images)
// Returns: IdentifyPartResponse with merged payload + multi_view annotation
//
// Covers: Industrial parts, PCBs, e-waste, and general waste categories
// ─────────────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse<IdentifyPartResponse>> {
    try {
        const rateLimit = checkRateLimit(req, {
            keyPrefix: 'identify-part-multiview',
            limit: 10,
            windowMs: 60_000,
        });
        if (!rateLimit.allowed) {
            return NextResponse.json(
                { success: false, error: `Rate limit exceeded. Try again in ${rateLimit.retryAfterSec}s.` } as IdentifyPartResponse,
                { status: 429 },
            );
        }

        const body = await req.json() as {
            images: { imageBase64: string; mimeType?: string }[];
        };

        const images = body.images ?? [];

        if (!Array.isArray(images) || images.length < 1 || images.length > 3 || images.some(img =>
            !img || typeof img.imageBase64 !== 'string' || !img.imageBase64.trim() ||
            (img.mimeType != null && !['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'].includes(img.mimeType)))) {
            return NextResponse.json({ success: false, error: 'Provide 1–3 valid images (JPEG, PNG, WebP, HEIC or HEIF).' } as IdentifyPartResponse, { status: 400 });
        }

        const isAllDemo = images.every(i => i.imageBase64 === 'DEMO' || i.imageBase64 === 'MOCK');

        if (isAllDemo) {
            const { payload } = applySafetyGatekeeper({
                ...MOCK_PART_PAYLOAD,
                multi_view: { angle_count: images.length, avg_visual_confidence: 0.96, avg_material_confidence: 0.91, part_class_agreement: true, material_agreement: true },
            } as PartMetadataPayload);
            return NextResponse.json({ success: true, payload: enrichPayloadForCitizenWasteGuidance(payload), mock: true });
        }

        const cleanImages = images.slice(0, 3).map(img => ({
            b64: img.imageBase64.replace(/^data:image\/[a-z+]+;base64,/, ''),
            mimeType: img.mimeType ?? 'image/jpeg',
        }));

        console.log(`[multiview] Classifying ${cleanImages.length} angle(s) in parallel…`);
        const outcomes = await Promise.allSettled(
            cleanImages.map(({ b64, mimeType }) => classifyImage(b64, mimeType))
        );
        const individualResults = outcomes.flatMap(result => result.status === 'fulfilled' ? [result.value] : []);
        if (individualResults.length === 0) throw new VisionUnavailableError();

        const merged = mergeVLMResults(individualResults);
        const { payload } = applySafetyGatekeeper(merged);

        console.log(`[multiview] Classified: ${payload.visual_id.part_class} @ ${payload.visual_id.confidence_score}`);

        return NextResponse.json({ success: true, payload: enrichPayloadForCitizenWasteGuidance(payload), mock: false });
    } catch (err) {
        if (err instanceof VisionUnavailableError) {
            return NextResponse.json({ success: false, error: err.message }, { status: 503 });
        }
        console.error('[multiview] Error:', err);
        return NextResponse.json(
            { success: false, error: err instanceof Error ? err.message : 'Unknown error' } as IdentifyPartResponse,
            { status: 500 },
        );
    }
}
