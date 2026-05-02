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
    'https://abc-cdn4-optestre.icefy.top',
    'https://streams.icefy.top',
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

    if (res.statusCode === 429) {
        throw new Error('icefy: rate limited');
    }

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

async function proxyKey(keyUrl, res) {
    const upstream = await fetchRaw(keyUrl);

    if (upstream.statusCode >= 400) {
        res.statusCode = upstream.statusCode;
        upstream.resume();
        return res.end('icefy key: upstream ' + upstream.statusCode);
    }

    const chunks = [];
    for await (const c of upstream) chunks.push(c);
    const buf = Buffer.concat(chunks);

    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.end(buf);
}

module.exports = {
    getStream,
    proxyKey,
    ICEFY_HEADERS,
    ICEFY_BASES,
    UA,
};