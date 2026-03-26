import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit } from '@/lib/requestRateLimit';
import { groqWithFallback } from '@/lib/groqClient';
import { toFile } from 'groq-sdk';

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/stt
//
// Accepts: multipart/form-data  { audio: File, lang?: 'en' | 'hi' }
// Returns: { success: true, transcript: string }
//
// Uses Groq Whisper large-v3 — fastest hosted Whisper endpoint available.
// Falls back to a graceful error JSON (never crashes); the client handles it.
// ─────────────────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
    try {
        const rateLimit = checkRateLimit(request, {
            keyPrefix: 'stt',
            limit: 20,
            windowMs: 60_000,
        });
        if (!rateLimit.allowed) {
            return NextResponse.json(
                { success: false, error: `Rate limit exceeded. Try again in ${rateLimit.retryAfterSec}s.` },
                { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfterSec) } },
            );
        }

        const formData = await request.formData();
        const audioBlob = formData.get('audio') as Blob | null;
        const lang = (formData.get('lang') as string | null) ?? 'en';

        if (!audioBlob || audioBlob.size === 0) {
            return NextResponse.json({ success: false, error: 'No audio provided.' }, { status: 400 });
        }

        // Groq Whisper accepts: flac, mp3, mp4, mpeg, mpga, m4a, ogg, wav, webm
        // MediaRecorder in Chrome produces audio/webm;codecs=opus — that's fine.
        const audioFile = await toFile(audioBlob, 'recording.webm', { type: audioBlob.type || 'audio/webm' });

        const transcription = await groqWithFallback((groq) =>
            groq.audio.transcriptions.create({
                file: audioFile,
                model: 'whisper-large-v3',
                language: lang === 'hi' ? 'hi' : 'en',
                response_format: 'json',
                temperature: 0,
            }),
        );

        const transcript = transcription.text?.trim() ?? '';
        if (!transcript) {
            return NextResponse.json({ success: false, error: 'Could not transcribe audio. Please try again.' }, { status: 422 });
        }

        return NextResponse.json({ success: true, transcript });
    } catch (error) {
        console.error('[stt] Error:', error);
        return NextResponse.json(
            { success: false, error: error instanceof Error ? error.message : 'Transcription failed.' },
            { status: 500 },
        );
    }
}
