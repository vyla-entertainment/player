'use strict';

const DEC_API = 'https://enc-dec.app/api/dec-videasy';

const HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Accept': 'application/json, */*; q=0.01',
    'Referer': 'https://player.videasy.net/',
    'Origin': 'https://player.videasy.net'
};

const SERVERS = [
    { name: 'cuevana', url: 'https://api2.videasy.net/cuevana/sources-with-title' },
    { name: 'mb-flix', url: 'https://api.videasy.net/mb-flix/sources-with-title' },
    { name: '1movies', url: 'https://api.videasy.net/1movies/sources-with-title' },
    { name: 'cdn', url: 'https://api.videasy.net/cdn/sources-with-title' },
    { name: 'superflix', url: 'https://api.videasy.net/superflix/sources-with-title' },
    { name: 'lamovie', url: 'https://api.videasy.net/lamovie/sources-with-title' },
];

const decCache = new Map();

async function decrypt(blob, tmdbId) {
    if (!blob || blob.length < 10) return null;
    const key = `${tmdbId}:${blob.slice(0, 32)}`;
    if (decCache.has(key)) return decCache.get(key);
    try {
        const res = await fetch(DEC_API, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: blob, id: tmdbId })
        });
        if (!res.ok) return null;
        const json = await res.json();
        if (json.status !== 200 || !json.result?.sources) return null;
        const payload = { sources: json.result.sources ?? [], subtitles: json.result.subtitles ?? [] };
        decCache.set(key, payload);
        return payload;
    } catch {
        return null;
    }
}

async function fetchServer(server, id, s, e, title) {
    try {
        const params = new URLSearchParams({
            title: title ?? '',
            mediaType: s ? 'tv' : 'movie',
            tmdbId: String(id),
            imdbId: '',
            episodeId: String(e ?? 1),
            seasonId: String(s ?? 1),
        });
        const res = await fetch(`${server.url}?${params}`, { headers: HEADERS });
        if (!res.ok) return null;
        const blob = await res.text();
        if (!blob || blob.length < 10) return null;
        const decrypted = await decrypt(blob, String(id));
        if (!decrypted || !decrypted.sources.length) return null;
        return decrypted.sources.filter(s => s?.url).map(s => s.url);
    } catch {
        return null;
    }
}

async function getStream(id, s, e) {
    const results = await Promise.all(SERVERS.map(srv => fetchServer(srv, id, s, e, '')));
    for (const urls of results) {
        if (urls && urls.length) return urls[0];
    }
    return null;
}

async function getSources(id, s, e) {
    const results = await Promise.all(SERVERS.map(srv => fetchServer(srv, id, s, e, '')));
    const urls = [];
    for (const r of results) {
        if (r) urls.push(...r);
    }
    return [...new Set(urls)];
}

module.exports = { getStream, getSources, HEADERS };