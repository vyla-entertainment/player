'use strict';

const https = require('https');
const http = require('http');

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124';

const ICEFY_HEADERS = {
    'User-Agent': UA,
    'Referer': 'https://icefy.top',
    'Origin': 'https://icefy.top',
};

const ICEFY_BASES = [
    'https://streams.icefy.top',
    'https://abc-cdn4-optestre.icefy.top',
];

function fetchRaw(url, redirects = 0) {
    return new Promise((resolve, reject) => {
        if (redirects > 5) return reject(new Error('icefy: redirect loop'));

        const req = (url.startsWith('https') ? https : http).get(
            url,
            { headers: ICEFY_HEADERS, timeout: 10000 },
            res => {
                if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                    const next = new URL(res.headers.location, url).href;
                    return resolve(fetchRaw(next, redirects + 1));
                }
                resolve(res);
            }
        );

        req.on('timeout', () => {
            req.destroy();
            reject(new Error('icefy: fetch timeout'));
        });

        req.on('error', reject);
    });
}

async function fetchFromBase(id, s, e, base) {
    const endpoint = s
        ? `${base}/tv/${id}/${s}/${e || 1}`
        : `${base}/movie/${id}`;

    const res = await fetchRaw(endpoint);

    if (res.statusCode >= 400) {
        throw new Error(`icefy: cdn returned ${res.statusCode}`);
    }

    const ct = res.headers['content-type'] || '';
    if (!ct.includes('application/json')) {
        throw new Error(`icefy: expected JSON but got ${ct}`);
    }

    const chunks = [];
    for await (const c of res) chunks.push(c);
    const text = Buffer.concat(chunks).toString('utf8');

    let json;
    try {
        json = JSON.parse(text);
    } catch {
        throw new Error('icefy: invalid JSON response');
    }

    if (!json?.stream) {
        throw new Error('icefy: missing stream field');
    }

    return json.stream;
}

async function getStream(id, s, e) {
    for (const base of ICEFY_BASES) {
        try {
            return await fetchFromBase(id, s, e, base);
        } catch (_) {
            continue;
        }
    }
    throw new Error('icefy: all bases failed');
}

function resolveUrl(uri, origin, dir) {
    if (uri.startsWith('http://') || uri.startsWith('https://')) return uri;
    if (uri.startsWith('//')) return 'https:' + uri;
    if (uri.startsWith('/')) return origin + uri;
    return new URL(uri, dir).href;
}

function rewriteM3u8(body, sourceUrl, extraParam = '') {
    const base = sourceUrl.split('?')[0];
    const dir = base.slice(0, base.lastIndexOf('/') + 1);
    const origin = new URL(sourceUrl).origin;

    return body.split('\n').map(line => {
        const t = line.trim();
        if (!t) return line;

        if (t.startsWith('#')) {
            return t.replace(/URI="([^"]+)"/g, (_match, uri) => {
                const abs = resolveUrl(uri, origin, dir);
                return `URI="/api?url=${encodeURIComponent(abs)}${extraParam}"`;
            });
        }

        const abs = resolveUrl(t, origin, dir);
        return '/api?url=' + encodeURIComponent(abs) + extraParam;
    }).join('\n');
}

async function proxyIcefy(url, res) {
    const upstream = await fetchRaw(url);
    const ct = (upstream.headers['content-type'] || '').toLowerCase();

    const isM3u8 =
        ct.includes('mpegurl') ||
        ct.includes('m3u8') ||
        /\.m3u8?(\?|$)/i.test(url);

    if (isM3u8) {
        const chunks = [];
        for await (const c of upstream) chunks.push(c);
        const body = Buffer.concat(chunks).toString('utf8');

        res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
        res.setHeader('Access-Control-Allow-Origin', '*');
        return res.end(rewriteM3u8(body, url, '&ix=1'));
    }

    res.setHeader('Content-Type', ct || 'application/octet-stream');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'public, max-age=3600');

    upstream.pipe(res);
}

module.exports = {
    getStream,
    proxyIcefy,
    rewriteM3u8,
    resolveUrl,
    ICEFY_HEADERS,
    ICEFY_BASES,
    UA,
};