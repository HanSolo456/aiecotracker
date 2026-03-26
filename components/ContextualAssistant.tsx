'use client';

import { FormEvent, useCallback, useMemo, useRef, useState } from 'react';
import { Loader2, MessageSquare, Mic, MicOff, Send } from 'lucide-react';
import type {
    ChatAssistantResponse,
    GuideResult,
    PartMetadataPayload,
    SourceCitation,
} from '@/types';

type AssistantMessage = {
    role: 'user' | 'assistant';
    content: string;
    citations?: SourceCitation[];
};

type ContextualAssistantProps = {
    payload?: PartMetadataPayload | null;
    guide?: GuideResult | null;
    surface: 'scan_result' | 'guide';
    title?: string;
    description?: string;
};

export default function ContextualAssistant({
    payload = null,
    guide = null,
    surface,
    title = 'Ask AI Assistant',
    description = 'Questions only. It explains the current result and guide, but does not replace scanning.',
}: ContextualAssistantProps) {
    const [draft, setDraft] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [messages, setMessages] = useState<AssistantMessage[]>([
        {
            role: 'assistant',
            content: 'Ask about hazards, material reasoning, guide steps, PPE, or why the item was classified this way.',
        },
    ]);
    const [suggestions, setSuggestions] = useState<string[]>([]);

    // ── Voice recording state ─────────────────────────────────────────────────
    const [isRecording, setIsRecording] = useState(false);
    const [isTranscribing, setIsTranscribing] = useState(false);
    const [micError, setMicError] = useState<string | null>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);

    const initialSuggestions = useMemo(() => {
        const next = new Set<string>();

        if (surface === 'scan_result') {
            next.add('Why did AI classify it this way?');
            next.add('What hazards matter most here?');
        }

        if (surface === 'guide' || guide) {
            next.add('What are the first three steps I should follow?');
            next.add('What PPE or tools are required?');
        }

        if (payload?.material_inference.primary_material) {
            next.add(`What does the ${payload.material_inference.primary_material.replace(/_/g, ' ')} result imply?`);
        }

        next.add('Give me a concise safety summary.');
        return Array.from(next).slice(0, 4);
    }, [guide, payload, surface]);

    const visibleSuggestions = suggestions.length > 0 ? suggestions : initialSuggestions;

    async function submitQuestion(question: string, currentMessages: AssistantMessage[]) {
        const trimmed = question.trim();
        if (!trimmed || loading) return;

        setLoading(true);
        setError(null);
        const nextMessages: AssistantMessage[] = [...currentMessages, { role: 'user', content: trimmed }];
        setMessages(nextMessages);
        setDraft('');

        // Build history: exclude the initial bot greeting (index 0)
        const history = currentMessages
            .slice(1)
            .map(m => ({ role: m.role, content: m.content }));

        try {
            const res = await fetch('/api/chat-assistant', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    question: trimmed,
                    payload,
                    guide,
                    surface,
                    history,
                }),
            });

            const data = (await res.json()) as ChatAssistantResponse;
            if (!res.ok || !data.success || !data.answer) {
                throw new Error(data.error ?? 'Assistant request failed.');
            }

            setMessages((current) => [
                ...current,
                {
                    role: 'assistant',
                    content: data.answer!,
                    citations: data.citations,
                },
            ]);
            setSuggestions(data.suggested_questions ?? []);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Assistant request failed.');
        } finally {
            setLoading(false);
        }
    }

    function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        void submitQuestion(draft, messages);
    }

    // ── Voice recording handlers ──────────────────────────────────────────────

    const startRecording = useCallback(async () => {
        setMicError(null);
        audioChunksRef.current = [];

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

            // Prefer webm/opus (Chrome) then ogg/opus (Firefox)
            const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
                ? 'audio/webm;codecs=opus'
                : MediaRecorder.isTypeSupported('audio/ogg;codecs=opus')
                    ? 'audio/ogg;codecs=opus'
                    : 'audio/webm';

            const recorder = new MediaRecorder(stream, { mimeType });
            mediaRecorderRef.current = recorder;

            recorder.ondataavailable = (e) => {
                if (e.data.size > 0) audioChunksRef.current.push(e.data);
            };

            recorder.onstop = async () => {
                // Stop all mic tracks so the browser stops showing the red mic indicator
                stream.getTracks().forEach(t => t.stop());

                const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
                if (audioBlob.size < 1000) {
                    setMicError('Recording too short. Please hold and speak clearly.');
                    setIsTranscribing(false);
                    return;
                }

                setIsTranscribing(true);
                try {
                    const fd = new FormData();
                    fd.append('audio', audioBlob, 'recording.webm');
                    fd.append('lang', 'en');

                    const res = await fetch('/api/stt', { method: 'POST', body: fd });
                    const data = await res.json() as { success: boolean; transcript?: string; error?: string };

                    if (!data.success || !data.transcript) {
                        throw new Error(data.error ?? 'Could not transcribe audio.');
                    }

                    // Auto-fill and submit the transcribed text
                    setDraft(data.transcript);
                    // Use functional form to get latest messages snapshot
                    setMessages(current => {
                        void submitQuestion(data.transcript!, current);
                        return current;
                    });
                } catch (err) {
                    setMicError(err instanceof Error ? err.message : 'Transcription failed.');
                } finally {
                    setIsTranscribing(false);
                }
            };

            recorder.start();
            setIsRecording(true);
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'Mic access denied.';
            setMicError(msg.includes('Permission') || msg.includes('denied')
                ? 'Microphone access denied. Allow mic in browser settings.'
                : msg);
        }
    }, []);

    const stopRecording = useCallback(() => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
            mediaRecorderRef.current.stop();
        }
        setIsRecording(false);
    }, []);

    const toggleRecording = useCallback(() => {
        if (isRecording) {
            stopRecording();
        } else {
            void startRecording();
        }
    }, [isRecording, startRecording, stopRecording]);

    const isMicBusy = isTranscribing;

    return (
        <div className="card p-4">
            <div className="flex items-start gap-3 mb-4">
                <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: 'rgba(96,165,250,0.12)', border: '1px solid rgba(96,165,250,0.28)' }}
                >
                    <MessageSquare size={18} className="text-blue-400" />
                </div>
                <div className="min-w-0">
                    <p className="text-sm font-semibold text-white">{title}</p>
                    <p className="text-xs text-secondary mt-1">{description}</p>
                </div>
            </div>

            <div className="flex flex-wrap gap-2 mb-4">
                {visibleSuggestions.map((suggestion) => (
                    <button
                        key={suggestion}
                        type="button"
                        onClick={() => void submitQuestion(suggestion, messages)}
                        disabled={loading}
                        className="text-xs px-3 py-1.5 rounded-full transition-colors"
                        style={{
                            background: 'rgba(148,163,184,0.08)',
                            border: '1px solid rgba(148,163,184,0.18)',
                            color: 'var(--text-secondary)',
                            opacity: loading ? 0.6 : 1,
                        }}
                    >
                        {suggestion}
                    </button>
                ))}
            </div>

            <div className="flex flex-col gap-3 mb-4">
                {messages.map((message, index) => (
                    <div
                        key={`${message.role}-${index}`}
                        className="rounded-2xl px-4 py-3"
                        style={{
                            background: message.role === 'assistant' ? 'var(--bg-elevated)' : 'rgba(132,204,22,0.12)',
                            border: message.role === 'assistant'
                                ? '1px solid var(--border)'
                                : '1px solid rgba(132,204,22,0.24)',
                            marginLeft: message.role === 'user' ? '2rem' : 0,
                        }}
                    >
                        <p className="text-[11px] uppercase tracking-wide font-semibold mb-1.5" style={{ color: message.role === 'assistant' ? 'var(--text-muted)' : '#a3e635' }}>
                            {message.role === 'assistant' ? 'Assistant' : 'You'}
                        </p>
                        <p className="text-sm leading-relaxed text-white whitespace-pre-wrap">{message.content}</p>
                        {message.citations && message.citations.length > 0 && (
                            <div className="flex flex-wrap gap-2 mt-3">
                                {message.citations.map((citation) => (
                                    <span
                                        key={`${citation.namespace}-${citation.title}`}
                                        className="text-[11px] px-2 py-1 rounded-full"
                                        style={{
                                            background: 'rgba(96,165,250,0.12)',
                                            border: '1px solid rgba(96,165,250,0.22)',
                                            color: '#bfdbfe',
                                        }}
                                    >
                                        {citation.title}
                                    </span>
                                ))}
                            </div>
                        )}
                    </div>
                ))}

                {/* Transcribing indicator */}
                {isTranscribing && (
                    <div
                        className="rounded-2xl px-4 py-3 flex items-center gap-2"
                        style={{ background: 'rgba(168,85,247,0.08)', border: '1px solid rgba(168,85,247,0.22)' }}
                    >
                        <Loader2 size={14} className="animate-spin text-purple-400" />
                        <span className="text-xs text-purple-300">Transcribing with Whisper…</span>
                    </div>
                )}
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-3">
                <label className="sr-only" htmlFor={`assistant-question-${surface}`}>
                    Ask a question
                </label>
                <textarea
                    id={`assistant-question-${surface}`}
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    placeholder={isRecording ? '🎙 Listening… release mic when done' : 'Ask about safety, classification, tools, or guide steps…'}
                    rows={3}
                    className="w-full rounded-2xl px-4 py-3 text-sm resize-none outline-none transition-all"
                    style={{
                        background: isRecording ? 'rgba(239,68,68,0.06)' : 'var(--bg-elevated)',
                        border: isRecording
                            ? '1px solid rgba(239,68,68,0.4)'
                            : '1px solid var(--border)',
                        color: 'var(--text-primary)',
                    }}
                />

                <div className="flex items-center justify-between gap-3">
                    <p className="text-[11px] text-muted">
                        This assistant answers questions from the current context only.
                    </p>

                    <div className="flex items-center gap-2">
                        {/* Mic toggle button */}
                        <button
                            type="button"
                            onClick={toggleRecording}
                            disabled={loading || isTranscribing}
                            title={isRecording ? 'Stop recording' : 'Start voice input'}
                            aria-label={isRecording ? 'Stop recording' : 'Start voice input'}
                            className="inline-flex items-center justify-center w-9 h-9 rounded-xl transition-all"
                            style={{
                                background: isRecording
                                    ? 'rgba(239,68,68,0.18)'
                                    : 'rgba(148,163,184,0.10)',
                                border: isRecording
                                    ? '1px solid rgba(239,68,68,0.5)'
                                    : '1px solid rgba(148,163,184,0.22)',
                                color: isRecording ? '#f87171' : 'var(--text-muted)',
                                opacity: loading || isTranscribing ? 0.5 : 1,
                                boxShadow: isRecording ? '0 0 0 3px rgba(239,68,68,0.12)' : 'none',
                                animation: isRecording ? 'pulse 1.5s ease-in-out infinite' : 'none',
                            }}
                        >
                            {isRecording ? <MicOff size={15} /> : <Mic size={15} />}
                        </button>

                        {/* Send button */}
                        <button
                            type="submit"
                            disabled={loading || isMicBusy || !draft.trim()}
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-opacity"
                            style={{
                                background: '#60A5FA',
                                color: '#08111f',
                                opacity: loading || isMicBusy || !draft.trim() ? 0.65 : 1,
                            }}
                        >
                            {loading ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
                            Ask
                        </button>
                    </div>
                </div>

                {/* Mic error */}
                {micError && (
                    <div
                        className="rounded-xl px-3 py-2 text-xs"
                        style={{ background: 'rgba(168,85,247,0.08)', border: '1px solid rgba(168,85,247,0.2)', color: '#d8b4fe' }}
                    >
                        🎙 {micError}
                    </div>
                )}

                {error && (
                    <div
                        className="rounded-xl px-3 py-2 text-xs"
                        style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#fca5a5' }}
                    >
                        {error}
                    </div>
                )}
            </form>
        </div>
    );
}
