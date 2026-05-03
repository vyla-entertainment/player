'use strict';

const https = require('https');
const http = require('http');

const { SOURCES, SOURCE_MAP, ALLOWED_ORIGINS, HEALTH_PROBE_ID, CACHE_TTL } = require('./config');

const SOURCE_MODULES = Object.fromEntries(
    SOURCES.map(cfg => [cfg.key, require(`./sources/${cfg.key}`)])
);

const UA_LIST = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
    'Mozilla/5.0 (X11; Linux x86_64; rv:125.0) Gecko/20100101 Firefox/125.0',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:124.0) Gecko/20100101 Firefox/124.0',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
];

const getUA = () => UA_LIST[Math.floor(Math.random() * UA_LIST.length)];

const cache = new Map();

function getCached(key, fn) {
    const hit = cache.get(key);
    if (hit && Date.now() - hit.ts < CACHE_TTL) return Promise.resolve(hit.val);
    return fn().then(val => {
        if (val) cache.set(key, { val, ts: Date.now() });
        return val;
    });
}

const jitter = (ms) => new Promise(r => setTimeout(r, Math.random() * ms));

async function withRetry(fn, attempts = 3, delay = 1000) {
    for (let i = 0; i < attempts; i++) {
        try {
            const result = await fn();
            if (result) return result;
        } catch {
            if (i === attempts - 1) return null;
            await new Promise(r => setTimeout(r, delay * (i + 1)));
        }
    }
    return null;
}

function withTimeout(promise, ms, label) {
    return Promise.race([
        promise,
        new Promise(resolve => setTimeout(() => { resolve(null); }, ms))
    ]);
}

function fetchSource(cfg, cacheKey, id, s, e, forSources = false) {
    const mod = SOURCE_MODULES[cfg.key];
    if (cfg.multiBase) {
        return withTimeout(
            jitter(cfg.jitter).then(async () => {
                for (const base of mod.BASES) {
                    const key = `${cfg.key}-${base}-${cacheKey}`;
                    const result = await getCached(key, () => withRetry(() => mod.getStream(id, s, e, base), cfg.retries, 500)).catch(() => null);
                    if (result) return result;
                }
                return null;
            }),
            cfg.timeout,
            cfg.key
        );
    }
    const timeoutMs = (forSources && cfg.sourcesTimeout) ? cfg.sourcesTimeout : cfg.timeout;
    return withTimeout(
        jitter(cfg.jitter).then(() =>
            getCached(`${cfg.key}-${cacheKey}`, () => withRetry(() => mod.getStream(id, s, e), cfg.retries, 1000)).catch(() => null)
        ),
        timeoutMs,
        cfg.key
    );
}

async function proxy(url, res) {
    const upstream = await fetchUpstream(url);
    const ct = (upstream.headers['content-type'] || '').toLowerCase();
    const isM3u8 = ct.includes('mpegurl') || ct.includes('m3u8') || /\.m3u8?(\?|$)/i.test(url);
    if (isM3u8) {
        const chunks = [];
        for await (const c of upstream) chunks.push(c);
        const body = Buffer.concat(chunks).toString('utf8');
        res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
        res.setHeader('Access-Control-Allow-Origin', '*');
        return res.end(rewriteM3u8(body, url));
    }
    res.setHeader('Content-Type', ct || 'video/MP2T');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.setHeader('Access-Control-Expose-Headers', 'Content-Length,Content-Range');
    upstream.pipe(res);
}

function fetchUpstream(url, redirects = 0, extraHeaders = {}) {
    return new Promise((resolve, reject) => {
        if (redirects > 5) return reject(new Error('redirect loop'));
        const options = {
            headers: {
                'User-Agent': getUA(),
                ...extraHeaders
            },
            timeout: 10000,
        };
        const req = (url.startsWith('https') ? https : http).get(url, options, res => {
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                const next = new URL(res.headers.location, url).href;
                return resolve(fetchUpstream(next, redirects + 1, extraHeaders));
            }
            resolve(res);
        });
        req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
        req.on('error', reject);
    });
}

function rewriteM3u8(body, url, extraParam = '', absoluteBase = '') {
    const base = url.split('?')[0];
    const dir = base.slice(0, base.lastIndexOf('/') + 1);
    const origin = new URL(url).origin;
    return body.split('\n').map(line => {
        const t = line.trim();
        if (!t) return line;
        if (t.startsWith('#')) {
            return t.replace(/URI="([^"]+)"/g, (match, uri) => {
                const abs = uri.startsWith('http') ? uri : uri.startsWith('/') ? origin + uri : dir + uri;
                if (abs.includes('tiktokcdn.com')) return `URI="${abs}"`;
                return `URI="${absoluteBase}/api?url=${encodeURIComponent(abs)}${extraParam}"`;
            });
        }
        const abs = t.startsWith('http') ? t : t.startsWith('/') ? origin + t : dir + t;
        if (abs.includes('tiktokcdn.com') || abs.includes('p16-sg') || abs.includes('p19-sg')) return (absoluteBase || '') + '/api?url=' + encodeURIComponent(abs) + '&tt=1';
        return (absoluteBase || '') + '/api?url=' + encodeURIComponent(abs) + extraParam;
    }).join('\n');
}

async function getMetadata(id, s, e) {
    try {
        const k = process.env.TMDB_API_KEY;
        if (!k) return null;
        const url = s
            ? `https://api.themoviedb.org/3/tv/${id}/season/${s}/episode/${e || 1}?api_key=${k}`
            : `https://api.themoviedb.org/3/movie/${id}?api_key=${k}`;
        const res = await fetch(url);
        if (!res.ok) return null;
        return await res.json();
    } catch {
        return null;
    }
}

function wrapUrl(rawUrl, sourceKey) {
    if (!rawUrl) return null;
    const raw = typeof rawUrl === 'object' ? rawUrl.url : rawUrl;
    const cfg = SOURCE_MAP[sourceKey];
    if (!cfg || cfg.skipProxy) return raw;
    return '/api?url=' + encodeURIComponent(raw) + '&' + cfg.proxyParam + '=1';
}

async function verifyStream(rawUrl, sourceKey) {
    const mod = SOURCE_MODULES[sourceKey];
    if (!mod.VERIFY_HEADERS) return true;
    try {
        const upstream = await Promise.race([
            fetchUpstream(rawUrl, 0, { 'User-Agent': getUA(), ...mod.VERIFY_HEADERS }),
            new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 8000))
        ]);
        if (upstream.statusCode >= 400) return false;
        const chunks = [];
        for await (const c of upstream) {
            chunks.push(c);
            if (Buffer.concat(chunks).length > 512) break;
        }
        return Buffer.concat(chunks).toString('utf8').trim().startsWith('#EXTM3U');
    } catch {
        return false;
    }
}

async function handleHealth(res) {
    const results = await Promise.allSettled(
        SOURCES.map(cfg => (async () => {
            const t = Date.now();
            const mod = SOURCE_MODULES[cfg.key];
            let url = null;
            if (cfg.multiBase) {
                for (const base of mod.BASES) {
                    url = await withTimeout(withRetry(() => mod.getStream(HEALTH_PROBE_ID, null, null, base), 2, 500), cfg.timeout, 'health:' + cfg.key).catch(() => null);
                    if (url) break;
                }
            } else {
                url = await withTimeout(withRetry(() => mod.getStream(HEALTH_PROBE_ID, null, null), cfg.retries, 1000), cfg.timeout, 'health:' + cfg.key).catch(() => null);
            }
            return { ok: !!url, ms: Date.now() - t, url: url ? wrapUrl(url, cfg.key) : null };
        })())
    );

    function unwrap(r) {
        return r.status === 'fulfilled' ? r.value : { ok: false, ms: null, url: null, error: r.reason?.message };
    }

    const byKey = Object.fromEntries(SOURCES.map((cfg, i) => [cfg.key, unwrap(results[i])]));
    const allOk = Object.values(byKey).every(v => v.ok);

    res.setHeader('Content-Type', 'application/json');
    res.statusCode = allOk ? 200 : 207;
    res.end(JSON.stringify({
        status: allOk ? 'ok' : 'degraded',
        uptime: Math.floor(process.uptime()),
        timestamp: new Date().toISOString(),
        tmdb: !!process.env.TMDB_API_KEY,
        cache: cache.size,
        probe_id: HEALTH_PROBE_ID,
        sources: byKey,
    }, null, 2));
}

function handleIndex(res) {
    const testEntries = Object.fromEntries(
        SOURCES.map(cfg => [`/api?test_${cfg.key}=1&id=<tmdb_id>`, `Test ${cfg.label} source only`])
    );
    const exampleBase = SOURCES.reduce((acc, cfg) => {
        acc[`test_${cfg.key}`] = `/api?test_${cfg.key}=1&id=550`;
        return acc;
    }, {});
    const exampleShows = SOURCES.reduce((acc, cfg) => {
        acc[`test_${cfg.key}`] = `/api?test_${cfg.key}=1&id=1396&s=1&e=1`;
        return acc;
    }, {});
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({
        endpoints: {
            '/api/health': 'Service health check',
            '/api?sources=1&id=<tmdb_id>': 'All sources for a movie',
            '/api?sources=1&id=<tmdb_id>&s=<season>&e=<episode>': 'All sources for a TV episode',
            '/api?id=<tmdb_id>': 'Single best stream URL for a movie',
            '/api?id=<tmdb_id>&s=<season>&e=<episode>': 'Single best stream URL for a TV episode',
        },
        test: testEntries,
        examples: { movies: exampleBase, shows: exampleShows },
    }, null, 2));
}

async function handleTestSource(res, sourceKey, id, s, e) {
    const start = Date.now();
    const cacheKey = `${id}-${s || ''}-${e || ''}`;
    const cfg = SOURCE_MAP[sourceKey];
    let rawUrl = null;
    let error = null;
    try {
        rawUrl = await fetchSource(cfg, cacheKey, id, s, e);
    } catch (err) {
        error = err.message;
    }
    const elapsed = Date.now() - start;
    const raw = rawUrl ? (typeof rawUrl === 'object' ? rawUrl.url : rawUrl) : null;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({
        source: sourceKey,
        id,
        s: s || null,
        e: e || null,
        ok: !!raw,
        url: wrapUrl(raw, sourceKey),
        raw_url: raw,
        elapsed_ms: elapsed,
        error: error || (raw ? null : 'no stream returned'),
    }, null, 2));
}

module.exports = async (req, res) => {
    const origin = req.headers.origin;
    if (ALLOWED_ORIGINS.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
    }
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Content-Security-Policy', `frame-ancestors 'self' ${ALLOWED_ORIGINS.join(' ')}`);

    const reqBase = (req.headers['x-forwarded-proto'] || 'http') + '://' + (req.headers['x-forwarded-host'] || req.headers.host || 'localhost:7860') || 'http://169.254.162.163';

    const { pathname, searchParams } = new URL(req.url, 'http://x');
    const q = Object.fromEntries(searchParams);
    const isApiRoot = pathname === '/api' || pathname === '/api/';

    if (pathname === '/health' || pathname === '/api/health') {
        return handleHealth(res);
    }

    if (isApiRoot && !searchParams.size) {
        return handleIndex(res);
    }

    if (q.tmdb_season) {
        try {
            const k = process.env.TMDB_API_KEY;
            if (!k) { res.statusCode = 500; return res.end(JSON.stringify({ error: 'no key' })); }
            const r = await fetch(`https://api.themoviedb.org/3/tv/${q.id}/season/${q.s}?api_key=${k}`);
            const d = await r.json();
            res.setHeader('Content-Type', 'application/json');
            return res.end(JSON.stringify(d));
        } catch (err) {
            res.statusCode = 500;
            return res.end(JSON.stringify({ error: err.message }));
        }
    }

    if (q.tmdb_show) {
        try {
            const k = process.env.TMDB_API_KEY;
            if (!k) { res.statusCode = 500; return res.end(JSON.stringify({ error: 'no key' })); }
            const r = await fetch(`https://api.themoviedb.org/3/tv/${q.id}?api_key=${k}`);
            const d = await r.json();
            res.setHeader('Content-Type', 'application/json');
            return res.end(JSON.stringify(d));
        } catch (err) {
            res.statusCode = 500;
            return res.end(JSON.stringify({ error: err.message }));
        }
    }

    if (q.tmdb_movie) {
        try {
            const k = process.env.TMDB_API_KEY;
            if (!k) { res.statusCode = 500; return res.end(JSON.stringify({ error: 'no key' })); }
            const appendToResponse = q.append_to_response ? `&append_to_response=${q.append_to_response}` : '';
            const r = await fetch(`https://api.themoviedb.org/3/movie/${q.id}?api_key=${k}${appendToResponse}`);
            const d = await r.json();
            res.setHeader('Content-Type', 'application/json');
            return res.end(JSON.stringify(d));
        } catch (err) {
            res.statusCode = 500;
            return res.end(JSON.stringify({ error: err.message }));
        }
    }

    if (q.tmdb_tv) {
        try {
            const k = process.env.TMDB_API_KEY;
            if (!k) { res.statusCode = 500; return res.end(JSON.stringify({ error: 'no key' })); }
            const r = await fetch(`https://api.themoviedb.org/3/tv/${q.id}?api_key=${k}`);
            const d = await r.json();
            res.setHeader('Content-Type', 'application/json');
            return res.end(JSON.stringify(d));
        } catch (err) {
            res.statusCode = 500;
            return res.end(JSON.stringify({ error: err.message }));
        }
    }

    const testKey = SOURCES.map(cfg => cfg.key).find(k => q['test_' + k]);
    if (testKey) {
        return handleTestSource(res, testKey, q.id, q.s, q.e);
    }

    if ('sources' in q) {
        try {
            const cacheKey = `${q.id}-${q.s || ''}-${q.e || ''}`;
            const fetched = await Promise.all(
                SOURCES.map(cfg => fetchSource(cfg, cacheKey, q.id, q.s, q.e, cfg.key === 'vidzee').then(r => ({ raw: r, source: cfg.key })))
            );
            const candidates = fetched.filter(c => c.raw);

            const verified = await Promise.all(
                candidates.map(async c => {
                    const raw = typeof c.raw === 'object' ? c.raw.url : c.raw;
                    const ok = await verifyStream(raw, c.source);
                    return ok ? { url: wrapUrl(c.raw, c.source), source: c.source } : null;
                })
            );

            const sources = verified.filter(Boolean);
            sources.forEach((s, i) => {
                const cfg = SOURCE_MAP[s.source];
                s.label = cfg ? cfg.label : s.source;
                s.timeout = cfg ? cfg.timeout : 20000;
            });
            if (!sources.length) {
                res.statusCode = 502;
                return res.end(JSON.stringify({ error: 'no sources' }));
            }
            res.setHeader('Content-Type', 'application/json');
            return res.end(JSON.stringify({ sources }));
        } catch (err) {
            res.statusCode = 500;
            return res.end(JSON.stringify({ error: err.message }));
        }
    }

    if (q.icefy_key) {
        try {
            const keyUrl = decodeURIComponent(q.icefy_key);
            const icefyCfg = SOURCES.find(cfg => cfg.multiBase);
            const icefyMod = icefyCfg ? SOURCE_MODULES[icefyCfg.key] : null;
            if (!icefyMod) { res.statusCode = 500; return res.end('no multiBase source'); }
            const upstream = await fetchUpstream(keyUrl, 0, icefyMod.KEY_HEADERS);
            const buf = [];
            for await (const c of upstream) buf.push(c);
            res.setHeader('Content-Type', 'application/octet-stream');
            res.setHeader('Access-Control-Allow-Origin', '*');
            return res.end(Buffer.concat(buf));
        } catch (e) {
            res.statusCode = 502;
            return res.end(e.message);
        }
    }

    if (q.url || q.proxy) {
        try {
            const rawUrl = decodeURIComponent(q.url || q.proxy);
            if (q.tt) {
                const upstream = await fetchUpstream(rawUrl);
                const chunks = [];
                for await (const c of upstream) chunks.push(c);
                const full = Buffer.concat(chunks);
                const stripped = full[0] === 0x89 ? full.slice(120) : full;
                res.setHeader('Content-Type', 'video/MP2T');
                res.setHeader('Access-Control-Allow-Origin', '*');
                res.setHeader('Cache-Control', 'public, max-age=3600');
                return res.end(stripped);
            }
            const matchedSource = SOURCES.find(cfg => q[cfg.proxyParam]);
            if (matchedSource) return await SOURCE_MODULES[matchedSource.key].proxyStream(rawUrl, res, { fetchUpstream, rewriteM3u8, reqBase });
            return await proxy(rawUrl, res);
        } catch (e) {
            res.statusCode = 502;
            return res.end(e.message);
        }
    }

    if (q.sources_meta) {
        res.setHeader('Content-Type', 'application/json');
        return res.end(JSON.stringify({
            sources: SOURCES.map(cfg => ({ key: cfg.key, label: cfg.label, timeout: cfg.timeout }))
        }));
    }

    if (!q.id) {
        res.statusCode = 400;
        return res.end(JSON.stringify({ error: 'missing id' }));
    }

    try {
        const cacheKey = `${q.id}-${q.s || ''}-${q.e || ''}`;
        const meta = await getMetadata(q.id, q.s, q.e);

        let rawUrl = null;
        let source = null;

        for (const cfg of SOURCES) {
            rawUrl = await fetchSource(cfg, cacheKey, q.id, q.s, q.e);
            if (rawUrl) { source = cfg.key; break; }
        }

        if (!rawUrl) throw new Error('no stream');

        let finalUrl = wrapUrl(rawUrl, source);
        const primaryRaw = typeof rawUrl === 'object' ? rawUrl.url : rawUrl;
        const primaryOk = await verifyStream(primaryRaw, source);
        if (!primaryOk) {
            let found = false;
            for (const cfg of SOURCES) {
                if (cfg.key === source) continue;
                const fbRaw = await fetchSource(cfg, cacheKey, q.id, q.s, q.e);
                if (!fbRaw) continue;
                const fbRawStr = typeof fbRaw === 'object' ? fbRaw.url : fbRaw;
                if (await verifyStream(fbRawStr, cfg.key)) {
                    rawUrl = fbRaw;
                    source = cfg.key;
                    finalUrl = wrapUrl(fbRaw, cfg.key);
                    found = true;
                    break;
                }
            }
            if (!found) throw new Error('no playable stream');
        }

        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ url: finalUrl, source, meta }));
    } catch (e) {
        res.statusCode = 500;
        res.end(JSON.stringify({ error: e.message }));
    }
};