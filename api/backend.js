'use strict';

const https = require('https');
const http = require('http');

const vidlink = require('./sources/vidlink');
const icefy = require('./sources/icefy');
const vidzee = require('./sources/vidzee');

const REFERER = vidlink.REFERER;
const ORIGIN = vidlink.ORIGIN;
const VIDZEE_HLS_HEADERS = vidzee.hlsHeaders;

const UA_LIST = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
    'Mozilla/5.0 (X11; Linux x86_64; rv:125.0) Gecko/20100101 Firefox/125.0',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:124.0) Gecko/20100101 Firefox/124.0',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
];

const getUA = () => UA_LIST[Math.floor(Math.random() * UA_LIST.length)];

const cache = new Map();
const CACHE_TTL = 5 * 60 * 1000;

const SOURCE_TIMEOUT = {
    vidlink: 12000,
    icefy: 8000,
    vidzee: 15000,
    vidzee_sources: 5000,
};

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
        new Promise(resolve => setTimeout(() => {
            resolve(null);
        }, ms))
    ]);
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
    res.setHeader('Content-Type', ct || 'application/octet-stream');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    upstream.pipe(res);
}

async function proxyVidlink(url, res) {
    const upstream = await fetchUpstream(url, 0, {
        'Referer': REFERER,
        'Origin': ORIGIN,
    });
    const ct = (upstream.headers['content-type'] || '').toLowerCase();
    const isM3u8 = ct.includes('mpegurl') || ct.includes('m3u8') || /\.m3u8?(\?|$)/i.test(url);
    if (isM3u8) {
        const chunks = [];
        for await (const c of upstream) chunks.push(c);
        const body = Buffer.concat(chunks).toString('utf8');
        res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
        res.setHeader('Access-Control-Allow-Origin', '*');
        return res.end(rewriteM3u8(body, url, '&vl=1'));
    }
    res.setHeader('Content-Type', ct || 'application/octet-stream');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'public, max-age=3600');
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

function rewriteM3u8(body, url, extraParam = '') {
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
                return `URI="/api?url=${encodeURIComponent(abs)}${extraParam}"`;
            });
        }
        const abs = t.startsWith('http') ? t : t.startsWith('/') ? origin + t : dir + t;
        if (abs.includes('tiktokcdn.com') || abs.includes('p16-sg') || abs.includes('p19-sg')) return abs;
        return '/api?url=' + encodeURIComponent(abs) + extraParam;
    }).join('\n');
}

async function proxyVidzee(url, res) {
    let upstream;
    try {
        upstream = await fetchUpstream(url, 0, VIDZEE_HLS_HEADERS);
    } catch (err) {
        res.statusCode = 502;
        return res.end(JSON.stringify({ error: 'fetchUpstream failed', detail: err.message, url }));
    }

    const ct = (upstream.headers['content-type'] || '').toLowerCase();

    if (upstream.statusCode >= 400) {
        const chunks = [];
        for await (const c of upstream) chunks.push(c);
        const body = Buffer.concat(chunks).toString('utf8').slice(0, 500);
        res.statusCode = 502;
        return res.end(JSON.stringify({ error: 'upstream error', status: upstream.statusCode, body, url }));
    }

    const isM3u8 = ct.includes('mpegurl') || ct.includes('m3u8') || /\.m3u8?(\?|$)/i.test(url);
    if (isM3u8) {
        const chunks = [];
        for await (const c of upstream) chunks.push(c);
        const body = Buffer.concat(chunks).toString('utf8');
        const base = url.split('?')[0];
        const dir = base.slice(0, base.lastIndexOf('/') + 1);
        const origin = new URL(url).origin;

        const rewritten = body.split('\n').map(line => {
            const t = line.trim();
            if (!t) return line;
            if (t.startsWith('#')) {
                return t.replace(/URI="([^"]+)"/g, (_match, uri) => {
                    const abs = uri.startsWith('http') ? uri : uri.startsWith('/') ? origin + uri : dir + uri;
                    return `URI="/api?url=${encodeURIComponent(abs)}&vz=1"`;
                });
            }
            const abs = t.startsWith('http') ? t : t.startsWith('/') ? origin + t : dir + t;
            return `/api?url=${encodeURIComponent(abs)}&vz=1`;
        }).join('\n');

        res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
        res.setHeader('Access-Control-Allow-Origin', '*');
        return res.end(rewritten);
    }

    res.setHeader('Content-Type', ct || 'application/octet-stream');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    upstream.pipe(res);
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

function fetchVidlink(cacheKey, id, s, e) {
    return withTimeout(
        getCached(`vidlink-${cacheKey}`, () => withRetry(() => vidlink.getStream(id, s, e))).catch(() => null),
        SOURCE_TIMEOUT.vidlink,
        'vidlink'
    );
}

function fetchIcefy(cacheKey, id, s, e) {
    const ICEFY_BASES = ['https://streams.icefy.top', 'https://abc-cdn4-optestre.icefy.top'];
    return withTimeout(
        jitter(200).then(async () => {
            for (const base of ICEFY_BASES) {
                const key = `icefy-${base.includes('abc') ? 'abc' : 'streams'}-${cacheKey}`;
                const result = await getCached(key, () => withRetry(() => icefy.getStream(id, s, e, base), 2, 500)).catch(() => null);
                if (result) return result;
            }
            return null;
        }),
        SOURCE_TIMEOUT.icefy,
        'icefy'
    );
}

function fetchVidzee(cacheKey, id, s, e, forSources = false) {
    const timeoutMs = forSources ? SOURCE_TIMEOUT.vidzee_sources : SOURCE_TIMEOUT.vidzee;
    return withTimeout(
        jitter(400).then(() =>
            getCached(`vidzee-${cacheKey}`, () => withRetry(() => vidzee.getStream(id, s, e))).catch(() => null)
        ),
        timeoutMs,
        'vidzee'
    );
}

function wrapUrl(rawUrl, source) {
    if (!rawUrl) return null;
    const raw = typeof rawUrl === 'object' ? rawUrl.url : rawUrl;
    if (source === 'icefy') return '/api?url=' + encodeURIComponent(raw) + '&ix=1';
    if (source === 'vidzee') return '/api?url=' + encodeURIComponent(raw) + '&vz=1';
    if (source === 'vidlink') return '/api?url=' + encodeURIComponent(raw) + '&vl=1';
    return raw;
}

async function handleHealth(res) {
    const cacheKey = 'health-550--';
    const start = { vidlink: Date.now(), icefy: Date.now(), vidzee: Date.now() };

    const [vidlinkResult, icefyResult, vidzeeResult] = await Promise.allSettled([
        (async () => {
            const t = Date.now();
            const url = await withTimeout(
                withRetry(() => vidlink.getStream('550', null, null)),
                SOURCE_TIMEOUT.vidlink, 'health:vidlink'
            );
            return { ok: !!url, ms: Date.now() - t, url: url ? wrapUrl(url, 'vidlink') : null };
        })(),
        (async () => {
            const t = Date.now();
            let url = null;
            for (const base of icefy.ICEFY_BASES) {
                url = await withTimeout(
                    withRetry(() => icefy.getStream('550', null, null, base), 2, 500),
                    SOURCE_TIMEOUT.icefy, 'health:icefy'
                ).catch(() => null);
                if (url) break;
            }
            return { ok: !!url, ms: Date.now() - t, url: url ? wrapUrl(url, 'icefy') : null };
        })(),
        (async () => {
            const t = Date.now();
            const url = await withTimeout(
                withRetry(() => vidzee.getStream('550', null, null)),
                SOURCE_TIMEOUT.vidzee, 'health:vidzee'
            ).catch(() => null);
            return { ok: !!url, ms: Date.now() - t, url: url ? wrapUrl(url, 'vidzee') : null };
        })(),
    ]);

    function unwrap(r) {
        return r.status === 'fulfilled' ? r.value : { ok: false, ms: null, url: null, error: r.reason?.message };
    }

    const vl = unwrap(vidlinkResult);
    const ic = unwrap(icefyResult);
    const vz = unwrap(vidzeeResult);

    const allOk = vl.ok && ic.ok && vz.ok;

    res.setHeader('Content-Type', 'application/json');
    res.statusCode = allOk ? 200 : 207;
    res.end(JSON.stringify({
        status: allOk ? 'ok' : 'degraded',
        uptime: Math.floor(process.uptime()),
        timestamp: new Date().toISOString(),
        tmdb: !!process.env.TMDB_API_KEY,
        cache: cache.size,
        probe_id: 550,
        sources: {
            vidlink: vl,
            icefy: ic,
            vidzee: vz,
        }
    }, null, 2));
}

function handleIndex(res) {
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({
        endpoints: {
            '/api/health': 'Service health check',
            '/api?sources=1&id=<tmdb_id>': 'All sources for a movie',
            '/api?sources=1&id=<tmdb_id>&s=<season>&e=<episode>': 'All sources for a TV episode',
            '/api?id=<tmdb_id>': 'Single best stream URL for a movie',
            '/api?id=<tmdb_id>&s=<season>&e=<episode>': 'Single best stream URL for a TV episode',
            '/api?test_vidlink=1&id=<tmdb_id>': 'Test VidLink source only',
            '/api?test_icefy=1&id=<tmdb_id>': 'Test Icefy source only',
            '/api?test_vidzee=1&id=<tmdb_id>': 'Test VidZee source only',
            '/api?tmdb_movie=1&id=<tmdb_id>': 'TMDB movie metadata',
            '/api?tmdb_show=1&id=<tmdb_id>': 'TMDB show metadata',
            '/api?tmdb_season=1&id=<tmdb_id>&s=<season>': 'TMDB season metadata',
            '/api?url=<encoded_url>': 'Proxy a URL (generic)',
            '/api?url=<encoded_url>&ix=1': 'Proxy an Icefy URL',
            '/api?url=<encoded_url>&vz=1': 'Proxy a VidZee URL',
        },
        examples: {
            fight_club_sources: '/api?sources=1&id=550',
            fight_club_stream: '/api?id=550',
            test_vidlink: '/api?test_vidlink=1&id=550',
            test_icefy: '/api?test_icefy=1&id=550',
            test_vidzee: '/api?test_vidzee=1&id=550',
        }
    }, null, 2));
}

async function handleTestSource(res, source, id, s, e) {
    const start = Date.now();
    const cacheKey = `${id}-${s || ''}-${e || ''}`;
    let rawUrl = null;
    let error = null;
    try {
        if (source === 'vidlink') rawUrl = await fetchVidlink(cacheKey, id, s, e);
        else if (source === 'icefy') rawUrl = await fetchIcefy(cacheKey, id, s, e);
        else if (source === 'vidzee') rawUrl = await fetchVidzee(cacheKey, id, s, e);
    } catch (err) {
        error = err.message;
    }
    const elapsed = Date.now() - start;
    const raw = rawUrl ? (typeof rawUrl === 'object' ? rawUrl.url : rawUrl) : null;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({
        source,
        id,
        s: s || null,
        e: e || null,
        ok: !!raw,
        url: wrapUrl(raw, source),
        raw_url: raw,
        elapsed_ms: elapsed,
        error: error || (raw ? null : 'no stream returned'),
    }, null, 2));
}

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');

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
            const r = await fetch(`https://api.themoviedb.org/3/movie/${q.id}?api_key=${k}`);
            const d = await r.json();
            res.setHeader('Content-Type', 'application/json');
            return res.end(JSON.stringify(d));
        } catch (err) {
            res.statusCode = 500;
            return res.end(JSON.stringify({ error: err.message }));
        }
    }

    if (q.test_vidlink || q.test_icefy || q.test_vidzee) {
        const source = q.test_vidlink ? 'vidlink' : q.test_icefy ? 'icefy' : 'vidzee';
        if (!q.id) { res.statusCode = 400; return res.end(JSON.stringify({ error: 'missing id' })); }
        return handleTestSource(res, source, q.id, q.s, q.e);
    }

    if ('sources' in q) {
        try {
            const cacheKey = `${q.id}-${q.s || ''}-${q.e || ''}`;
            const [vidlinkUrl, icefyUrl, vidzeeUrl] = await Promise.all([
                fetchVidlink(cacheKey, q.id, q.s, q.e),
                fetchIcefy(cacheKey, q.id, q.s, q.e),
                fetchVidzee(cacheKey, q.id, q.s, q.e, true),
            ]);
            const sources = [];
            if (vidlinkUrl) sources.push({ url: wrapUrl(vidlinkUrl, 'vidlink') });
            if (icefyUrl) sources.push({ url: wrapUrl(icefyUrl, 'icefy') });
            if (vidzeeUrl) sources.push({ url: wrapUrl(vidzeeUrl, 'vidzee') });
            sources.forEach((s, i) => s.label = 'Source: ' + (i + 1));
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

    if (q.url || q.proxy) {
        try {
            const rawUrl = decodeURIComponent(q.url || q.proxy);
            if (q.vz) return await proxyVidzee(rawUrl, res);
            if (q.ix) return await icefy.proxyIcefy(rawUrl, res);
            if (q.vl) return await proxyVidlink(rawUrl, res);
            return await proxy(rawUrl, res);
        } catch (e) {
            res.statusCode = 502;
            return res.end(e.message);
        }
    }

    if (!q.id) {
        res.statusCode = 400;
        return res.end(JSON.stringify({ error: 'missing id' }));
    }

    try {
        const cacheKey = `${q.id}-${q.s || ''}-${q.e || ''}`;
        const [primaryUrl, meta] = await Promise.all([
            fetchVidlink(cacheKey, q.id, q.s, q.e),
            getMetadata(q.id, q.s, q.e)
        ]);

        let rawUrl = primaryUrl;
        let source = 'vidlink';

        if (!rawUrl) {
            rawUrl = await fetchIcefy(cacheKey, q.id, q.s, q.e);
            if (rawUrl) source = 'icefy';
        }
        if (!rawUrl) {
            rawUrl = await fetchVidzee(cacheKey, q.id, q.s, q.e);
            if (rawUrl) source = 'vidzee';
        }

        if (!rawUrl) throw new Error('no stream');

        const finalUrl = wrapUrl(rawUrl, source);

        if (req.headers.accept?.includes('text/html')) {
            const title = (meta?.title || meta?.name || 'Watch') + (q.s ? ` S${q.s}E${q.e || 1}` : '');
            const img = 'https://image.tmdb.org/t/p/w780' + (meta?.still_path || meta?.backdrop_path || meta?.poster_path);
            res.setHeader('Content-Type', 'text/html');
            return res.end(`<html><head>
<title>${title}</title>
<meta property="og:title" content="${title}">
<meta property="og:description" content="${meta?.overview || ''}">
<meta property="og:image" content="${img}">
</head></html>`);
        }

        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ url: finalUrl, meta }));
    } catch (e) {
        res.statusCode = 500;
        res.end(JSON.stringify({ error: e.message }));
    }
};