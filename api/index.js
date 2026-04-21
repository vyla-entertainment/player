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

function fetchUpstream(url, redirects = 0) {
    return new Promise((resolve, reject) => {
        if (redirects > 5) return reject(new Error('redirect loop'));

        (url.startsWith('https') ? https : http).get(url, {
            headers: { Referer: REFERER, Origin: ORIGIN, 'User-Agent': UA }
        }, res => {
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                const next = new URL(res.headers.location, url).href;
                return resolve(fetchUpstream(next, redirects + 1));
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

async function proxy(url, res) {
    const upstream = await fetchUpstream(url);
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
        return res.end(rewriteM3u8(body, url));
    }

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

    if (q.url) {
        try {
            return await proxy(decodeURIComponent(q.url), res);
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
        const [url, meta] = await Promise.all([
            getStream(q.id, q.s, q.e),
            getMetadata(q.id, q.s, q.e)
        ]);

        if (!url) throw new Error('no stream');

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
        res.end(JSON.stringify({ url, meta }));
    } catch (e) {
        res.statusCode = 500;
        res.end(JSON.stringify({ error: e.message }));
    }
};