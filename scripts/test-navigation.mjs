// Run with: node --test scripts/test-navigation.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const root = path.resolve(import.meta.dirname, '..');
function loadModule(file, overrides = {}, globals = {}) {
    const module = { exports: {} };
    const code = ts.transpileModule(readFileSync(path.join(root, file), 'utf8'), {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
    }).outputText;
    vm.runInNewContext(code, {
        module, exports: module.exports,
        require: name => overrides[name] ?? require(name),
        ...globals,
    });
    return module.exports;
}
const { THEME_INIT_SCRIPT } = loadModule('lib/themeBootstrap.ts');
function initialTheme(stored, cookie = '', storageDisabled = false) {
    const document = { cookie, documentElement: { dataset: { theme: 'dark' } } };
    vm.runInNewContext(THEME_INIT_SCRIPT, {
        document,
        localStorage: { getItem: () => { if (storageDisabled) throw new Error('Storage disabled'); return stored; } },
    });
    return document.documentElement.dataset.theme;
}

test('saved light theme is applied before paint and takes precedence over the cookie', () => {
    assert.equal(initialTheme('light', 'aiecotrack-theme=dark'), 'light');
});
test('cookie-only preferences survive static page rendering', () => {
    assert.equal(initialTheme(null, 'other=1; aiecotrack-theme=light; next=2'), 'light');
});
test('blocked storage still allows a saved theme cookie', () => {
    assert.equal(initialTheme(null, 'aiecotrack-theme=light', true), 'light');
});
test('missing or invalid preferences default to dark', () => {
    assert.equal(initialTheme(null), 'dark');
    assert.equal(initialTheme('invalid', 'aiecotrack-theme=invalid'), 'dark');
});

function scansHarness(uid = 'worker-a') {
    let subscribedQuery;
    let savedRecord;
    let listenerError;
    const noop = () => {};
    const sdk = {
        collection: (db, name) => name,
        where: (field, op, value) => ({ field, op, value }),
        orderBy: (field, direction) => ({ orderBy: field, direction }),
        limit: value => ({ limit: value }),
        query: (collection, ...constraints) => ({ collection, constraints }),
        onSnapshot: (query, onData, onError) => { subscribedQuery = query; listenerError = onError; return noop; },
        addDoc: async (collection, record) => { savedRecord = record; return { id: 'new-scan' }; },
        Timestamp: { now: () => 1 },
    };
    const service = loadModule('lib/scanService.ts', {
        'firebase/firestore': sdk,
        '@/lib/firebase': { db: {}, auth: { currentUser: uid ? { uid } : null } },
        '@/lib/sessionState': {},
    }, {
        console: { warn() {}, error() {} },
    });
    return { service, query: () => subscribedQuery, record: () => savedRecord, fail: error => listenerError(error) };
}

test('personal scans query both the owner and a null organization, matching existing read rules', () => {
    const h = scansHarness();
    h.service.subscribeToRecentScans(100, () => {}, { workerId: 'worker-a' });
    const filters = h.query().constraints.filter(c => c.field);
    assert.equal(filters.length, 2);
    assert.ok(filters.some(c => c.field === 'workerId' && c.value === 'worker-a'));
    assert.ok(filters.some(c => c.field === 'orgId' && c.value === null));
});

test('organization scans retain their organization filter', () => {
    const h = scansHarness();
    h.service.subscribeToOrgScans('org-a', 50, () => {});
    assert.ok(h.query().constraints.some(c => c.field === 'orgId' && c.value === 'org-a'));
});

test('new personal scans persist a queryable null orgId while organization scans retain theirs', async () => {
    const h = scansHarness();
    const payload = {
        visual_id: { part_class: 'battery', subtype: 'LiPo', confidence_score: 0.95 },
        material_inference: { primary_material: 'lithium_compound', confidence_score: 0.9 },
        geometry_descriptor: {}, hazard_flags: {},
    };
    await h.service.saveScan(payload, 'image', 'single', {}, {}, 'web', undefined, { workerId: 'worker-a' });
    assert.equal(h.record().orgId, null);
    assert.equal(h.record().workerId, 'worker-a');
    await h.service.saveScan(payload, 'image', 'single', {}, {}, 'web', undefined, { workerId: 'worker-a', orgId: 'org-a' });
    assert.equal(h.record().orgId, 'org-a');
});


test('a signed-out session does not subscribe to the global scans collection', () => {
    const h = scansHarness(null);
    let delivered;
    h.service.subscribeToRecentScans(50, data => { delivered = data; });
    assert.equal(h.query(), undefined);
    assert.equal(delivered.length, 0);
});

test('snapshot errors always release loading, including missing indexes and permission failures', () => {
    for (const code of ['permission-denied', 'failed-precondition', 'unavailable']) {
        const h = scansHarness();
        let delivered;
        h.service.subscribeToRecentScans(100, data => { delivered = data; });
        h.fail({ code, message: 'Test failure' });
        assert.equal(delivered.length, 0);
    }
});

test('scan saves reject expired or switched sessions before writing data', async () => {
    for (const uid of [null, 'another-worker']) {
        const h = scansHarness(uid);
        await assert.rejects(h.service.saveScan({}, '', 'single', {}, {}, 'web', undefined, { workerId: 'worker-a' }), /session changed/);
        assert.equal(h.record(), undefined);
    }
});

test('optional passport IDs are omitted rather than sent to Firestore as undefined', async () => {
    const h = scansHarness();
    await h.service.saveScan({ visual_id: { part_class: 'battery', confidence_score: 0.9 }, material_inference: { primary_material: 'lithium_compound', confidence_score: 0.9 }, geometry_descriptor: {}, hazard_flags: {} }, '', 'single');
    assert.equal(Object.hasOwn(h.record(), 'passportId'), false);
    assert.equal(h.record().workerId, 'worker-a');
});
