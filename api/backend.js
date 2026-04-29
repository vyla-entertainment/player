'use strict';

const https = require('https');
const http = require('http');

const vidlink = require('./sources/vidlink');
const icefy = require('./sources/icefy');
const vidzee = require('./sources/vidzee');

const REFERER = vidlink.REFERER;
const ORIGIN = vidlink.ORIGIN;
const ICEFY_HEADERS = icefy.ICEFY_HEADERS;
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

function fetchUpstream(url, redirects = 0, extraHeaders = {}) {
    return new Promise((resolve, reject) => {
        if (redirects > 5) return reject(new Error('redirect loop'));

        const options = {
            headers: {
                Referer: REFERER,
                Origin: ORIGIN,
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

async function proxy(url, res, extraHeaders = {}) {
    const upstream = await fetchUpstream(url, 0, extraHeaders);
    const ct = (upstream.headers['content-type'] || '').toLowerCase();

    const isVideo = ct.includes('video/') || /\.(ts|mp4|m4s)(\?|$)/i.test(url) || url.includes('tiktokcdn.com');
    if (isVideo) {
        res.writeHead(302, { 'Location': url });
        return res.end();
    }

    const isM3u8 = ct.includes('mpegurl') || ct.includes('m3u8') || /\.m3u8?(\?|$)/i.test(url);
    if (isM3u8) {
        const chunks = [];
        for await (const c of upstream) chunks.push(c);
        const body = Buffer.concat(chunks).toString('utf8');
        res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
        res.setHeader('Access-Control-Allow-Origin', '*');
        const isIcefyUrl = url.includes('icefy.top') || url.includes('optestre');
        return res.end(rewriteM3u8(body, url, isIcefyUrl ? '&ix=1' : ''));
    }

    res.setHeader('Content-Type', ct || 'application/octet-stream');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    upstream.pipe(res);
}

async function proxyVidzee(url, res) {
    const upstream = await fetchUpstream(url, 0, VIDZEE_HLS_HEADERS);
    const ct = (upstream.headers['content-type'] || '').toLowerCase();

    const isVideo = ct.includes('video/') || /\.(ts|mp4|m4s)(\?|$)/i.test(url);
    if (isVideo) {
        res.writeHead(302, { 'Location': url });
        return res.end();
    }

    const isM3u8 = ct.includes('mpegurl') || ct.includes('m3u8') || /\.m3u8?(\?|$)/i.test(url);
    if (isM3u8) {
        const chunks = [];
        for await (const c of upstream) chunks.push(c);
        const body = Buffer.concat(chunks).toString('utf8');
        res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
        res.setHeader('Access-Control-Allow-Origin', '*');
        return res.end(rewriteM3u8(body, url, '&vz=1'));
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

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');

    const { searchParams } = new URL(req.url, 'http://x');
    const q = Object.fromEntries(searchParams);

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

    if ('sources' in q) {
        try {
            const cacheKey = `${q.id}-${q.s || ''}-${q.e || ''}`;

            const [vidlinkUrl, icefyUrl, vidzeeUrl] = await Promise.all([
                getCached(`vidlink-${cacheKey}`, () => withRetry(() => vidlink.getStream(q.id, q.s, q.e))).catch(() => null),
                jitter(200).then(() => getCached(`icefy1-${cacheKey}`, () => withRetry(() => icefy.getStream(q.id, q.s, q.e, 'https://streams.icefy.top'))).catch(() => null)),
                jitter(400).then(() => getCached(`vidzee-${cacheKey}`, () => withRetry(() => vidzee.getStream(q.id, q.s, q.e))).catch(() => null)),
            ]);

            const sources = [];
            if (vidlinkUrl) sources.push({ url: typeof vidlinkUrl === 'object' ? vidlinkUrl.url : vidlinkUrl });
            if (icefyUrl) sources.push({ url: '/api?url=' + encodeURIComponent(typeof icefyUrl === 'object' ? icefyUrl.url : icefyUrl) + '&ix=1' });
            if (vidzeeUrl) sources.push({ url: '/api?url=' + encodeURIComponent(typeof vidzeeUrl === 'object' ? vidzeeUrl.url : vidzeeUrl) + '&vz=1' });

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
            const extraHeaders = q.ix ? ICEFY_HEADERS : {};
            return await proxy(rawUrl, res, extraHeaders);
        } catch (e) {
            res.statusCode = 502;
            return res.end(e.message);
        }
    }

    if (!q.id && !q.tmdb_season && !q.tmdb_show) {
        res.statusCode = 400;
        return res.end(JSON.stringify({ error: 'missing id' }));
    }

    try {
        const cacheKey = `${q.id}-${q.s || ''}-${q.e || ''}`;

        const [primaryUrl, meta] = await Promise.all([
            getCached(`vidlink-${cacheKey}`, () => withRetry(() => vidlink.getStream(q.id, q.s, q.e))).catch(() => null),
            getMetadata(q.id, q.s, q.e)
        ]);

        let url;
        let isVidzee = false;

        if (primaryUrl) {
            url = primaryUrl;
        } else {
            url = await jitter(200).then(() => getCached(`icefy1-${cacheKey}`, () => withRetry(() => icefy.getStream(q.id, q.s, q.e, 'https://streams.icefy.top'))).catch(() => null))
                || await jitter(200).then(() => getCached(`vidzee-${cacheKey}`, () => withRetry(() => vidzee.getStream(q.id, q.s, q.e))).catch(() => null));

            if (url) isVidzee = true;
        }

        if (!url) throw new Error('no stream');

        const isIcefyUrl = url.includes('icefy.top') || url.includes('optestre');
        let finalUrl;

        if (isVidzee) {
            finalUrl = '/api?url=' + encodeURIComponent(url) + '&vz=1';
        } else if (isIcefyUrl) {
            finalUrl = '/api?url=' + encodeURIComponent(url) + '&ix=1';
        } else {
            finalUrl = url;
        }

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
