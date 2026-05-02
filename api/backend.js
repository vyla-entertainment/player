'use strict';

const https = require('https');
const http = require('http');

const vidlink = require('./sources/vidlink');
const icefy = require('./sources/icefy');
const vidzee = require('./sources/vidzee');
const vidnest = require('./sources/vidnest');
const vidsrc = require('./sources/vidsrc');
const vidrock = require('./sources/vidrock');
const videasy = require('./sources/videasy');

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
    vidnest: 20000,
    vidsrc: 25000,
    vidrock: 20000,
    videasy: 20000,
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
    res.setHeader('Content-Type', ct || 'video/MP2T');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.setHeader('Access-Control-Expose-Headers', 'Content-Length,Content-Range');
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

async function proxyVidnest(url, res) {
    const upstream = await fetchUpstream(url, 0, vidnest.HEADERS);
    const ct = (upstream.headers['content-type'] || '').toLowerCase();
    const isM3u8 = ct.includes('mpegurl') || ct.includes('m3u8') || /\.m3u8?(\?|$)/i.test(url);
    if (isM3u8) {
        const chunks = [];
        for await (const c of upstream) chunks.push(c);
        const body = Buffer.concat(chunks).toString('utf8');
        res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
        res.setHeader('Access-Control-Allow-Origin', '*');
        return res.end(rewriteM3u8(body, url, '&vn=1'));
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
        if (abs.includes('tiktokcdn.com') || abs.includes('p16-sg') || abs.includes('p19-sg')) return '/api?url=' + encodeURIComponent(abs) + '&tt=1';
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

    const isM3u8 = ct.includes('mpegurl') || ct.includes('m3u8') || /\.m3u8(\?|$)/i.test(url);
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
            if (abs.includes('tiktokcdn.com') || abs.includes('p16-sg') || abs.includes('p19-sg')) return `/api?url=${encodeURIComponent(abs)}&tt=1`;
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

async function proxyVidsrc(url, res) {
    const upstream = await fetchUpstream(url, 0, vidsrc.HEADERS);
    const ct = (upstream.headers['content-type'] || '').toLowerCase();
    const isM3u8 = ct.includes('mpegurl') || ct.includes('m3u8') || /\.m3u8?(\?|$)/i.test(url);
    if (isM3u8) {
        const chunks = [];
        for await (const c of upstream) chunks.push(c);
        const body = Buffer.concat(chunks).toString('utf8');
        res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
        res.setHeader('Access-Control-Allow-Origin', '*');
        return res.end(rewriteM3u8(body, url, '&vs=1'));
    }
    res.setHeader('Content-Type', ct || 'application/octet-stream');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    upstream.pipe(res);
}

async function proxyVidrock(url, res) {
    const headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.6884.98 Safari/537.36',
        'Accept': '*/*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Origin': 'https://lok-lok.cc',
        'Referer': 'https://lok-lok.cc/',
        'Sec-Fetch-Dest': 'video',
        'Sec-Fetch-Mode': 'cors',
        'Sec-Fetch-Site': 'cross-site',
        'sec-ch-ua': '"Chromium";v="134", "Google Chrome";v="134", "Not:A-Brand";v="99"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"Windows"',
    };
    const upstream = await fetchUpstream(url, 0, headers);
    const ct = (upstream.headers['content-type'] || '').toLowerCase();
    const isM3u8 = ct.includes('mpegurl') || ct.includes('m3u8') || /\.m3u8?(\?|$)/i.test(url);
    if (isM3u8) {
        const chunks = [];
        for await (const c of upstream) chunks.push(c);
        const body = Buffer.concat(chunks).toString('utf8');
        res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
        res.setHeader('Access-Control-Allow-Origin', '*');
        return res.end(rewriteM3u8(body, url, '&vr=1'));
    }
    res.setHeader('Content-Type', ct || 'application/octet-stream');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    upstream.pipe(res);
}

async function proxyVideasy(url, res) {
    const upstream = await fetchUpstream(url, 0, videasy.HEADERS);
    const ct = (upstream.headers['content-type'] || '').toLowerCase();
    const isM3u8 = ct.includes('mpegurl') || ct.includes('m3u8') || /\.m3u8?(\?|$)/i.test(url);
    if (isM3u8) {
        const chunks = [];
        for await (const c of upstream) chunks.push(c);
        const body = Buffer.concat(chunks).toString('utf8');
        res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
        res.setHeader('Access-Control-Allow-Origin', '*');
        return res.end(rewriteM3u8(body, url, '&vy=1'));
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

function fetchVidnest(cacheKey, id, s, e) {
    return withTimeout(
        jitter(600).then(() =>
            getCached(`vidnest-${cacheKey}`, () => withRetry(() => vidnest.getStream(id, s, e))).catch(() => null)
        ),
        SOURCE_TIMEOUT.vidnest,
        'vidnest'
    );
}

function fetchVidsrc(cacheKey, id, s, e) {
    return withTimeout(
        jitter(700).then(() =>
            getCached(`vidsrc-${cacheKey}`, () => withRetry(() => vidsrc.getStream(id, s, e), 2, 1000)).catch(() => null)
        ),
        SOURCE_TIMEOUT.vidsrc,
        'vidsrc'
    );
}

function fetchVidrock(cacheKey, id, s, e) {
    return withTimeout(
        jitter(800).then(() =>
            getCached(`vidrock-${cacheKey}`, () => withRetry(() => vidrock.getStream(id, s, e))).catch(() => null)
        ),
        SOURCE_TIMEOUT.vidrock,
        'vidrock'
    );
}

function fetchVideasy(cacheKey, id, s, e) {
    return withTimeout(
        jitter(900).then(() =>
            getCached(`videasy-${cacheKey}`, () => withRetry(() => videasy.getStream(id, s, e))).catch(() => null)
        ),
        SOURCE_TIMEOUT.videasy,
        'videasy'
    );
}

function wrapUrl(rawUrl, source) {
    if (!rawUrl) return null;
    const raw = typeof rawUrl === 'object' ? rawUrl.url : rawUrl;
    if (source === 'icefy') return raw;
    if (source === 'vidzee') return '/api?url=' + encodeURIComponent(raw) + '&vz=1';
    if (source === 'vidlink') return '/api?url=' + encodeURIComponent(raw) + '&vl=1';
    if (source === 'vidnest') return '/api?url=' + encodeURIComponent(raw) + '&vn=1';
    if (source === 'vidsrc') return '/api?url=' + encodeURIComponent(raw) + '&vs=1';
    if (source === 'vidrock') return '/api?url=' + encodeURIComponent(raw) + '&vr=1';
    if (source === 'videasy') return '/api?url=' + encodeURIComponent(raw) + '&vy=1';
    return raw;
}

async function verifyStream(rawUrl, source) {
    if (source === 'icefy') return true;
    try {
        const headers = { 'User-Agent': getUA() };
        if (source === 'vidlink') { headers['Referer'] = REFERER; headers['Origin'] = ORIGIN; }
        if (source === 'vidnest') Object.assign(headers, vidnest.HEADERS);
        if (source === 'vidsrc') Object.assign(headers, vidsrc.HEADERS);
        if (source === 'vidzee') Object.assign(headers, VIDZEE_HLS_HEADERS);
        if (source === 'vidrock') Object.assign(headers, vidrock.HEADERS);
        if (source === 'videasy') Object.assign(headers, videasy.HEADERS);
        const upstream = await Promise.race([
            fetchUpstream(rawUrl, 0, headers),
            new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 8000))
        ]);
        if (upstream.statusCode >= 400) return false;
        const chunks = [];
        for await (const c of upstream) {
            chunks.push(c);
            if (Buffer.concat(chunks).length > 512) break;
        }
        const text = Buffer.concat(chunks).toString('utf8');
        return text.trim().startsWith('#EXTM3U');
    } catch {
        return false;
    }
}

async function handleHealth(res) {
    const [vidlinkResult, icefyResult, vidzeeResult, vidnestResult, vidsrcResult, vidrockResult, videasyResult] = await Promise.allSettled([
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
        (async () => {
            const t = Date.now();
            const url = await withTimeout(
                withRetry(() => vidnest.getStream('550', null, null)),
                SOURCE_TIMEOUT.vidnest, 'health:vidnest'
            ).catch(() => null);
            return { ok: !!url, ms: Date.now() - t, url: url ? wrapUrl(url, 'vidnest') : null };
        })(),
        (async () => {
            const t = Date.now();
            const url = await withTimeout(
                withRetry(() => vidsrc.getStream('550', null, null), 2, 1000),
                SOURCE_TIMEOUT.vidsrc, 'health:vidsrc'
            ).catch(() => null);
            return { ok: !!url, ms: Date.now() - t, url: url ? wrapUrl(url, 'vidsrc') : null };
        })(),
        (async () => {
            const t = Date.now();
            const url = await withTimeout(
                withRetry(() => vidrock.getStream('550', null, null), 2, 1000),
                SOURCE_TIMEOUT.vidrock, 'health:vidrock'
            ).catch(() => null);
            return { ok: !!url, ms: Date.now() - t, url: url ? wrapUrl(url, 'vidrock') : null };
        })(),
        (async () => {
            const t = Date.now();
            const url = await withTimeout(
                withRetry(() => videasy.getStream('550', null, null), 2, 1000),
                SOURCE_TIMEOUT.videasy, 'health:videasy'
            ).catch(() => null);
            return { ok: !!url, ms: Date.now() - t, url: url ? wrapUrl(url, 'videasy') : null };
        })(),
    ]);

    function unwrap(r) {
        return r.status === 'fulfilled' ? r.value : { ok: false, ms: null, url: null, error: r.reason?.message };
    }

    const vl = unwrap(vidlinkResult);
    const ic = unwrap(icefyResult);
    const vz = unwrap(vidzeeResult);
    const vn = unwrap(vidnestResult);
    const vs = unwrap(vidsrcResult);
    const vr = unwrap(vidrockResult);
    const vy = unwrap(videasyResult);

    const allOk = vl.ok && ic.ok && vz.ok && vn.ok && vs.ok && vr.ok && vy.ok;

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
            vidnest: vn,
            vidsrc: vs,
            vidrock: vr,
            videasy: vy,
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
        },
        test: {
            '/api?test_vidlink=1&id=<tmdb_id>': 'Test VidLink source only',
            '/api?test_icefy=1&id=<tmdb_id>': 'Test Icefy source only',
            '/api?test_vidzee=1&id=<tmdb_id>': 'Test VidZee source only',
            '/api?test_vidnest=1&id=<tmdb_id>': 'Test VidNest source only',
            '/api?test_vs=1&id=<tmdb_id>': 'Test VidSrc source only',
            '/api?test_vr=1&id=<tmdb_id>': 'Test VidRock source only',
            '/api?test_vy=1&id=<tmdb_id>': 'Test Videasy source only',
        },
        examples: {
            movies: {
                test_vidlink: '/api?test_vidlink=1&id=550',
                test_icefy: '/api?test_icefy=1&id=550',
                test_vidzee: '/api?test_vidzee=1&id=550',
                test_vidnest: '/api?test_vidnest=1&id=550',
                test_vidsrc: '/api?test_vs=1&id=550',
                test_vidrock: '/api?test_vr=1&id=550',
                test_videasy: '/api?test_vy=1&id=550',
            },
            shows: {
                test_vidlink: '/api?test_vidlink=1&id=1396&s=1&e=1',
                test_icefy: '/api?test_icefy=1&id=1396&s=1&e=1',
                test_vidzee: '/api?test_vidzee=1&id=1396&s=1&e=1',
                test_vidnest: '/api?test_vidnest=1&id=1396&s=1&e=1',
                test_vidsrc: '/api?test_vs=1&id=1396&s=1&e=1',
                test_vidrock: '/api?test_vr=1&id=1396&s=1&e=1',
                test_videasy: '/api?test_vy=1&id=1396&s=1&e=1',
            }
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
        else if (source === 'vidnest') rawUrl = await fetchVidnest(cacheKey, id, s, e);
        else if (source === 'vidsrc') rawUrl = await fetchVidsrc(cacheKey, id, s, e);
        else if (source === 'vidrock') rawUrl = await fetchVidrock(cacheKey, id, s, e);
        else if (source === 'videasy') rawUrl = await fetchVideasy(cacheKey, id, s, e);
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
    var origin = req.headers.origin;
    if (origin === 'https://vyla.pages.dev' || origin === 'http://localhost:7860') {
        res.setHeader('Access-Control-Allow-Origin', origin);
    }
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Content-Security-Policy', "frame-ancestors 'self' https://vyla.pages.dev http://localhost:7860 http://localhost");

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

    if (q.test_vidlink || q.test_icefy || q.test_vidzee || q.test_vidnest || q.test_md || q.test_vs || q.test_vr || q.test_vy) {
        const source = q.test_vidlink ? 'vidlink'
            : q.test_icefy ? 'icefy'
                : q.test_vidzee ? 'vidzee'
                    : q.test_vidnest ? 'vidnest'
                        : q.test_md ? 'moviedownloader'
                            : q.test_vs ? 'vidsrc'
                                : q.test_vr ? 'vidrock'
                                    : 'videasy';
        return handleTestSource(res, source, q.id, q.s, q.e);
    }

    if ('sources' in q) {
        try {
            const cacheKey = `${q.id}-${q.s || ''}-${q.e || ''}`;
            const [vidlinkUrl, icefyUrl, vidzeeUrl, vidnestUrl, vidrockUrl, vidsrcUrl, videasyUrl] = await Promise.all([
                fetchVidlink(cacheKey, q.id, q.s, q.e),
                fetchIcefy(cacheKey, q.id, q.s, q.e),
                fetchVidzee(cacheKey, q.id, q.s, q.e, true),
                fetchVidnest(cacheKey, q.id, q.s, q.e),
                fetchVidrock(cacheKey, q.id, q.s, q.e),
                fetchVidsrc(cacheKey, q.id, q.s, q.e),
                fetchVideasy(cacheKey, q.id, q.s, q.e),
            ]);
            const candidates = [
                { raw: vidlinkUrl, source: 'vidlink' },
                { raw: icefyUrl, source: 'icefy' },
                { raw: vidzeeUrl, source: 'vidzee' },
                { raw: vidnestUrl, source: 'vidnest' },
                { raw: vidrockUrl, source: 'vidrock' },
                { raw: vidsrcUrl, source: 'vidsrc' },
                { raw: videasyUrl, source: 'videasy' },
            ].filter(c => c.raw);

            const verified = await Promise.all(
                candidates.map(async c => {
                    const raw = typeof c.raw === 'object' ? c.raw.url : c.raw;
                    const ok = await verifyStream(raw, c.source);
                    return ok ? { url: wrapUrl(c.raw, c.source), source: c.source } : null;
                })
            );

            const sources = verified.filter(Boolean);
            sources.forEach((s, i) => s.label = 'Source: ' + (i + 1) + ' (' + s.source + ')');
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
            const upstream = await fetchUpstream(keyUrl, 0, icefy.ICEFY_HEADERS);
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
            if (q.vz) return await proxyVidzee(rawUrl, res);
            if (q.vl) return await proxyVidlink(rawUrl, res);
            if (q.vn) return await proxyVidnest(rawUrl, res);
            if (q.vs) return await proxyVidsrc(rawUrl, res);
            if (q.vr) return await proxyVidrock(rawUrl, res);
            if (q.vy) return await proxyVideasy(rawUrl, res);
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
        if (!rawUrl) {
            rawUrl = await fetchVidnest(cacheKey, q.id, q.s, q.e);
            if (rawUrl) source = 'vidnest';
        }
        if (!rawUrl) {
            rawUrl = await fetchVidsrc(cacheKey, q.id, q.s, q.e);
            if (rawUrl) source = 'vidsrc';
        }
        if (!rawUrl) {
            rawUrl = await fetchVidrock(cacheKey, q.id, q.s, q.e);
            if (rawUrl) source = 'vidrock';
        }
        if (!rawUrl) {
            rawUrl = await fetchVideasy(cacheKey, q.id, q.s, q.e);
            if (rawUrl) source = 'videasy';
        }

        if (!rawUrl) throw new Error('no stream');

        let finalUrl = wrapUrl(rawUrl, source);
        const primaryRaw = typeof rawUrl === 'object' ? rawUrl.url : rawUrl;
        const primaryOk = await verifyStream(primaryRaw, source);
        if (!primaryOk) {
            const fallbacks = [
                { fetch: () => fetchIcefy(cacheKey, q.id, q.s, q.e), source: 'icefy' },
                { fetch: () => fetchVidzee(cacheKey, q.id, q.s, q.e), source: 'vidzee' },
                { fetch: () => fetchVidnest(cacheKey, q.id, q.s, q.e), source: 'vidnest' },
                { fetch: () => fetchVidsrc(cacheKey, q.id, q.s, q.e), source: 'vidsrc' },
                { fetch: () => fetchVidrock(cacheKey, q.id, q.s, q.e), source: 'vidrock' },
                { fetch: () => fetchVideasy(cacheKey, q.id, q.s, q.e), source: 'videasy' },
                { fetch: () => fetchVidlink(cacheKey, q.id, q.s, q.e), source: 'vidlink' },
            ].filter(f => f.source !== source);
            let found = false;
            for (const fb of fallbacks) {
                const fbRaw = await fb.fetch();
                if (!fbRaw) continue;
                const fbUrl = wrapUrl(fbRaw, fb.source);
                const fbRawStr = typeof fbRaw === 'object' ? fbRaw.url : fbRaw;
                const fbOk = await verifyStream(fbRawStr, fb.source);
                if (fbOk) {
                    rawUrl = fbRaw;
                    source = fb.source;
                    finalUrl = fbUrl;
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