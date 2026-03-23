import { NextRequest, NextResponse } from 'next/server';
import { retrieveGuide } from '@/lib/knowledgeBase';
import { checkRateLimit } from '@/lib/requestRateLimit';
import { enrichPayloadForCitizenWasteGuidance } from '@/lib/wasteGuidance';
import type { PartMetadataPayload, RetrieveGuideResponse } from '@/types';

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/retrieve-guide
//
// Accepts: PartMetadataPayload (from identify-part response)
// Returns: RetrieveGuideResponse { success, guide }
//
// Simulates RAG retrieval using seeded JSON knowledge base.
// In production: queries Pinecone/Weaviate with semantic embeddings.
// ─────────────────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest): Promise<NextResponse<RetrieveGuideResponse>> {
    try {
        const rateLimit = checkRateLimit(request, {
            keyPrefix: 'retrieve-guide',
            limit: 30,
            windowMs: 60_000,
        });
        if (!rateLimit.allowed) {
            return NextResponse.json(
                { success: false, error: `Rate limit exceeded. Try again in ${rateLimit.retryAfterSec}s.` },
                { status: 429 },
            );
        }

        const payload = (await request.json()) as PartMetadataPayload;

        if (!payload?.visual_id?.part_class) {
            return NextResponse.json(
                { success: false, error: 'Invalid PartMetadataPayload' },
                { status: 400 }
            );
        }

        const guide = await retrieveGuide(enrichPayloadForCitizenWasteGuidance(payload));

        return NextResponse.json({ success: true, guide });
    } catch (error) {
        console.error('[retrieve-guide] Error:', error);
        return NextResponse.json(
            { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
            { status: 500 }
        );
    }
}
