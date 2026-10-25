// Run with: node --test scripts/test-vision-fallback.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import path from 'node:path';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const root = path.resolve(import.meta.dirname, '..');

// Transpile only the modules under test; no Next server, credentials, or network needed.
function loader(overrides = {}, globals = {}) {
    const cache = new Map();
    return function load(file) {
        const filename = path.join(root, file);
        if (cache.has(filename)) return cache.get(filename);
        const module = { exports: {} };
        cache.set(filename, module.exports);
        const code = ts.transpileModule(readFileSync(filename, 'utf8'), {
            compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
        }).outputText;
        vm.runInNewContext(code, {
            module, exports: module.exports,
            require: name => name in overrides ? overrides[name] : name.startsWith('@/') ? load(`${name.slice(2)}.ts`) : require(name),
            process: { env: {} }, console: { log() {}, warn() {}, error() {} },
            AbortSignal, Date, setTimeout, clearTimeout,
            ...globals,
        }, { filename });
        return module.exports;
    };
}

const payload = {
    visual_id: { part_class: 'battery', subtype: 'LiPo', confidence_score: 0.96 },
    material_inference: { primary_material: 'lithium_compound', confidence_score: 0.91 },
    hazard_flags: { asbestos_era_likelihood: false, lead_solder_likelihood: false, pressurized_component: false, residual_fluid_risk: 'battery_electrolyte' },
    geometry_descriptor: { estimated_mass_kg: 0.2 },
    query_intent: 'waste_classification_and_disassembly', fallback_required: false,
};

function harness({ env = { GEMINI_API_KEY: 'test', GROQ_API_KEY_2: 'backup' }, gemini = async () => JSON.stringify(payload), groq = async () => JSON.stringify(payload), signal } = {}) {
    const calls = [];
    class FakeGoogle {
        getGenerativeModel({ model }) {
            return { generateContent: async (content, options) => {
                calls.push({ provider: 'gemini', model, content, options });
                const text = await gemini(options);
                return { response: { text: () => text } };
            } };
        }
    }
    const load = loader({ '@google/generative-ai': { GoogleGenerativeAI: FakeGoogle } }, {
        process: { env }, ...(signal ? { AbortSignal: signal } : {}),
        fetch: async (url, requestOptions) => {
            const apiKey = requestOptions.headers.Authorization.slice('Bearer '.length);
            const options = { apiKey };
            const request = JSON.parse(requestOptions.body);
            calls.push({ provider: 'groq', url, options, request, requestOptions });
            const content = await groq(options);
            return Response.json({ choices: [{ message: { content } }] });
        },
    });
    return { ...load('lib/visionClassifier.ts'), calls };
}

const fail = async () => { throw new Error('Provider unavailable'); };

test('healthy Gemini avoids Groq and preserves the image input', async () => {
    const h = harness();
    assert.equal((await h.classifyImage('photo', 'image/jpeg')).visual_id.part_class, 'battery');
    assert.deepEqual(h.calls.map(c => c.provider), ['gemini']);
    assert.equal(h.calls[0].content[1].inlineData.data, 'photo');
});

test('Gemini failures fall through to independent Groq vision, including a key configured only in slot 2', async () => {
    const h = harness({ gemini: fail });
    assert.equal((await h.classifyImage('photo', 'image/png')).visual_id.part_class, 'battery');
    assert.deepEqual(h.calls.map(c => c.provider), ['gemini', 'gemini', 'groq']);
    assert.equal(h.calls[2].request.messages[1].content[1].image_url.url, 'data:image/png;base64,photo');
    assert.equal(h.calls[2].url, 'https://api.groq.com/openai/v1/chat/completions');
});

test('timeouts abort Gemini requests and leave time for Groq', async () => {
    const timeouts = [];
    const h = harness({
        gemini: ({ signal }) => new Promise((resolve, reject) => {
            signal.addEventListener('abort', () => reject(new Error('Timed out')), { once: true });
        }),
        signal: { timeout(ms) {
            timeouts.push(ms);
            const controller = new AbortController();
            setTimeout(() => controller.abort(), 2);
            return controller.signal;
        } },
    });
    await h.classifyImage('photo', 'image/jpeg');
    assert.deepEqual(timeouts, [20_000, 10_000, 10_000]);
    assert.equal(h.calls.at(-1).provider, 'groq');
});

test('malformed JSON and incomplete classification trigger fallback', async () => {
    for (const text of ['not JSON', '{}', JSON.stringify({ ...payload, hazard_flags: {} }), JSON.stringify({ ...payload, visual_id: { ...payload.visual_id, confidence_score: 3 } })]) {
        const h = harness({ gemini: async () => text });
        assert.equal((await h.classifyImage('photo', 'image/jpeg')).visual_id.part_class, 'battery');
        assert.equal(h.calls.at(-1).provider, 'groq');
    }
});

test('Groq rotates exhausted keys, honoring the configured vision model', async () => {
    const h = harness({
        env: { GROQ_API_KEY_1: 'exhausted', GROQ_API_KEY_2: 'working', GROQ_VISION_MODEL: 'configured-vision-model' },
        groq: async ({ apiKey }) => apiKey === 'working' ? JSON.stringify(payload) : fail(),
    });
    await h.classifyImage('photo', 'image/jpeg');
    assert.deepEqual(h.calls.map(c => c.options.apiKey), ['exhausted', 'working']);
    assert.equal(h.calls[1].request.model, 'configured-vision-model');
});

test('all providers failing or no credentials raises an outage, never a made-up classification', async () => {
    for (const options of [{ gemini: fail, groq: fail }, { env: {} }]) {
        const h = harness(options);
        await assert.rejects(h.classifyImage('photo', 'image/jpeg'), { name: 'VisionUnavailableError' });
    }
});

test('reasoning tags and fenced JSON are accepted, and a genuine unknown stays unknown', () => {
    const h = harness();
    const result = h.parseVisionPayload(`<think>reasoning</think>\n\x60\x60\x60json\n${JSON.stringify({ ...payload, visual_id: { ...payload.visual_id, part_class: 'unknown', subtype: null, confidence_score: 0.2 } })}\n\x60\x60\x60`);
    assert.equal(result.visual_id.part_class, 'unknown');
    assert.equal(result.visual_id.subtype, '');
});

function routeHarness(classifier) {
    return loader({
        'next/server': { NextResponse: { json: (body, options) => Response.json(body, options) } },
        '@/lib/visionClassifier': classifier,
        '@/lib/requestRateLimit': { checkRateLimit: () => ({ allowed: true }) },
    });
}
const request = body => new Request('http://localhost/api/identify', { method: 'POST', body: JSON.stringify(body) });

test('both endpoints return 503 on an outage, including with no credentials', async () => {
    const h = harness({ env: {} });
    const load = routeHarness(h);
    for (const [route, body] of [
        ['identify-part', { imageBase64: 'photo' }],
        ['identify-part-multiview', { images: [{ imageBase64: 'photo' }] }],
    ]) {
        const response = await load(`app/api/${route}/route.ts`).POST(request(body));
        assert.equal(response.status, 503);
        assert.equal((await response.json()).success, false);
    }
});

test('multi-view uses surviving angles and preserves battery electrolyte hazards', async () => {
    const h = harness();
    const load = routeHarness({ ...h, classifyImage: async b64 => {
        if (b64 === 'failed') throw new h.VisionUnavailableError();
        return structuredClone(b64 === 'safe-looking' ? { ...payload, hazard_flags: { ...payload.hazard_flags, residual_fluid_risk: 'none' } } : payload);
    } });
    const response = await load('app/api/identify-part-multiview/route.ts').POST(request({
        images: ['failed', 'battery', 'safe-looking'].map(imageBase64 => ({ imageBase64 })),
    }));
    const data = await response.json();
    assert.equal(response.status, 200);
    assert.equal(data.mock, false);
    assert.equal(data.payload.visual_id.part_class, 'battery');
    assert.equal(data.payload.multi_view.angle_count, 2);
    assert.equal(data.payload.hazard_flags.residual_fluid_risk, 'battery_electrolyte');
});

test('invalid images are rejected before invoking a provider', async () => {
    const h = harness();
    const load = routeHarness(h);
    for (const images of [[], 'bad', [{ imageBase64: 4 }], Array(4).fill({ imageBase64: 'photo' })]) {
        const response = await load('app/api/identify-part-multiview/route.ts').POST(request({ images }));
        assert.equal(response.status, 400);
    }
    assert.equal(h.calls.length, 0);
});
