'use strict';

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

const REFERER = 'https://vidlink.pro/';
const ORIGIN = 'https://vidlink.pro';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124';

let bootPromise = null;

function bootWasm() {
    if (bootPromise) return bootPromise;
    bootPromise = (async () => {
        globalThis.window = globalThis;
        globalThis.self = globalThis;
        globalThis.document = { createElement: () => ({}), body: { appendChild: () => { } } };

        const sodium = require('libsodium-wrappers');
        await sodium.ready;
        globalThis.sodium = sodium;

        eval(fs.readFileSync(path.join(__dirname, 'script.js'), 'utf8'));

        const go = new Dm();
        const wasm = fs.readFileSync(path.join(__dirname, 'fu.wasm'));
        const { instance } = await WebAssembly.instantiate(wasm, go.importObject);
        go.run(instance);

        await new Promise(r => setTimeout(r, 300));
        if (typeof globalThis.getAdv !== 'function') throw new Error('WASM init failed');
    })();
    return bootPromise;
}

async function getStream(id, s, e) {
    await bootWasm();
    bootWasm().catch(() => { });
    await new Promise(r => setTimeout(r, 1000 + Math.random() * 1000));

    const token = globalThis.getAdv(String(id));
    if (!token) throw new Error('token failed');

    const url = s
        ? `https://vidlink.pro/api/b/tv/${token}/${s}/${e || 1}?multiLang=0`
        : `https://vidlink.pro/api/b/movie/${token}?multiLang=0`;

    const res = await fetch(url, {
        headers: { Referer: REFERER, Origin: ORIGIN, 'User-Agent': UA }
    });

    if (!res.ok) throw new Error(`API ${res.status}`);
    const json = await res.json();
    return json?.stream?.playlist || null;
}

async function getStreamVyla(id, s, e) {
    const endpoint = s
        ? `https://vidzee-scraper.pages.dev/api/stream?id=${id}&type=tv&season=${s}&episode=${e || 1}`
        : `https://vidzee-scraper.pages.dev/api/stream?id=${id}&type=movie`;

    const res = await fetch(endpoint, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150 Safari/537.36',
            'Accept': '*/*',
            'Accept-Language': 'en-US,en;q=0.9',
            'Referer': 'https://player.vidzee.wtf',
            'Origin': 'https://player.vidzee.wtf'
        }
    });

    if (!res.ok) throw new Error(`VidZee ${res.status}`);

    const text = await res.text();
    const trimmed = text.trim();

    if (!trimmed || trimmed.startsWith('{') || trimmed.startsWith('[')) {
        throw new Error('vidzee no stream');
    }

    return { m3u8: trimmed, sourceUrl: endpoint };
}

function fetchUpstream(url, redirects = 0, extraHeaders = {}) {
    return new Promise((resolve, reject) => {
        if (redirects > 5) return reject(new Error('redirect loop'));

        (url.startsWith('https') ? https : http).get(url, {
            headers: { Referer: REFERER, Origin: ORIGIN, 'User-Agent': UA, ...extraHeaders }
        }, res => {
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                const next = new URL(res.headers.location, url).href;
                return resolve(fetchUpstream(next, redirects + 1, extraHeaders));
            }
            resolve(res);
        }).on('error', reject);
    });
}

function rewriteM3u8(body, url) {
    const base = url.split('?')[0];
    const dir = base.slice(0, base.lastIndexOf('/') + 1);
    const origin = new URL(url).origin;

    return body.split('\n').map(line => {
        const t = line.trim();
        if (!t || t.startsWith('#')) return line;

        const abs = t.startsWith('http')
            ? t
            : t.startsWith('/')
                ? origin + t
                : dir + t;

        return '/api?url=' + encodeURIComponent(abs);
    }).join('\n');
}

async function proxy(url, res, extraHeaders = {}) {
    const upstream = await fetchUpstream(url, 0, extraHeaders);
    const ct = (upstream.headers['content-type'] || '').toLowerCase();

    const isVideo = ct.includes('video/') || /\.(ts|mp4|m4s)(\?|$)/i.test(url);

    const isVidZee = extraHeaders.Referer?.includes('vidzee.wtf');
    if (isVideo && !isVidZee) {
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
        return res.end(rewriteM3u8(body, url));
    }

    res.setHeader('Content-Type', ct || 'application/octet-stream');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    upstream.pipe(res);
}

async function getMetadata(id, s, e) {
    try {
        const k = process.env.TMDB_API_KEY;

        if (!k) {
            return null;
        }

        const url = s
            ? `https://api.themoviedb.org/3/tv/${id}/season/${s}/episode/${e || 1}?api_key=${k}`
            : `https://api.themoviedb.org/3/movie/${id}?api_key=${k}`;


        const res = await fetch(url);

        if (!res.ok) {
            const errorText = await res.text();
            return null;
        }

        const data = await res.json();
        return data;
    } catch (error) {
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

    if (q.sources) {
        try {
            const [primaryUrl, vyla] = await Promise.all([
                getStream(q.id, q.s, q.e).catch(() => null),
                getStreamVyla(q.id, q.s, q.e).catch(() => null)
            ]);

            const sources = [];

            if (primaryUrl) {
                sources.push({ label: 'Source 1', url: primaryUrl });
            }

            if (vyla?.m3u8) {
                const base = vyla.sourceUrl.substring(0, vyla.sourceUrl.lastIndexOf('/') + 1);
                const rewritten = vyla.m3u8.split('\n').map(line => {
                    const t = line.trim();
                    if (!t || t.startsWith('#')) return line;
                    let abs;
                    try { abs = new URL(t, base).toString(); } catch { return line; }
                    return '/api?url=' + encodeURIComponent(abs) + '&vz=1';
                }).join('\n');
                const encoded = Buffer.from(rewritten).toString('base64');
                sources.push({ label: primaryUrl ? 'Source 2' : 'Source 1', url: '/api?vyla_inline=' + encodeURIComponent(encoded) });
            }

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

    if (q.vyla_inline) {
        try {
            const decoded = Buffer.from(decodeURIComponent(q.vyla_inline), 'base64').toString('utf8');
            res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
            res.setHeader('Access-Control-Allow-Origin', '*');
            return res.end(decoded);
        } catch (err) {
            res.statusCode = 500;
            return res.end('decode error');
        }
    }

    if (q.url || q.proxy) {
        try {
            const targetUrl = q.url || q.proxy;
            const extraHeaders = q.vz ? {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150 Safari/537.36',
                'Accept': '*/*',
                'Accept-Language': 'en-US,en;q=0.9',
                'Referer': 'https://player.vidzee.wtf',
                'Origin': 'https://player.vidzee.wtf'
            } : {};
            return await proxy(decodeURIComponent(targetUrl), res, extraHeaders);
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
        const [primaryUrl, meta] = await Promise.all([
            getStream(q.id, q.s, q.e).catch(() => null),
            getMetadata(q.id, q.s, q.e)
        ]);

        let url, vylaHeaders, vidzeeM3u8, vidzeeSourceUrl;
        if (primaryUrl) {
            url = primaryUrl;
        } else {
            const vyla = await getStreamVyla(q.id, q.s, q.e);
            vidzeeM3u8 = vyla.m3u8;
            vidzeeSourceUrl = vyla.sourceUrl;
        }
        if (!primaryUrl && !vidzeeM3u8) throw new Error('no stream');
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
        if (vidzeeM3u8) {
            const base = vidzeeSourceUrl.substring(0, vidzeeSourceUrl.lastIndexOf('/') + 1);
            const rewritten = vidzeeM3u8.split('\n').map(line => {
                const t = line.trim();
                if (!t || t.startsWith('#')) return line;
                let abs;
                try { abs = new URL(t, base).toString(); } catch { return line; }
                return '/api/proxy?url=' + encodeURIComponent(abs) + '&vz=1';
            }).join('\n');

            res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
            res.setHeader('Access-Control-Allow-Origin', '*');
            return res.end(rewritten);
        }

        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ url, meta }));
    } catch (e) {
        res.statusCode = 500;
        res.end(JSON.stringify({ error: e.message }));
    }
};