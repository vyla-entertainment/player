'use strict';

const BASE_URL = 'https://vidnest.fun';
const API_BASE_URL = 'https://new.vidnest.fun';

const HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/150 Safari/537.36',
    'Accept': 'application/json, text/javascript, */*; q=0.01',
    'Accept-Language': 'en-US,en;q=0.9',
    'Referer': `${BASE_URL}/`,
    'Origin': BASE_URL,
};

const VIDNEST_ALPHABET = 'RB0fpH8ZEyVLkv7c2i6MAJ5u3IKFDxlS1NTsnGaqmXYdUrtzjwObCgQP94hoeW+/=';

const VIDNEST_REVERSE_MAP = (() => {
    const map = {};
    for (let i = 0; i < VIDNEST_ALPHABET.length; i++) {
        map[VIDNEST_ALPHABET[i]] = i;
    }
    return map;
})();

function decodeVidnestBase64(input) {
    let padded = input;
    const mod = padded.length % 4;
    if (mod !== 0) padded += '='.repeat(4 - mod);

    const bytes = [];
    for (let i = 0; i < padded.length; i += 4) {
        const chunk = padded.slice(i, i + 4);
        const c0 = VIDNEST_REVERSE_MAP[chunk[0]] ?? 64;
        const c1 = VIDNEST_REVERSE_MAP[chunk[1]] ?? 64;
        const c2 = chunk[2] === '=' ? 64 : (VIDNEST_REVERSE_MAP[chunk[2]] ?? 64);
        const c3 = chunk[3] === '=' ? 64 : (VIDNEST_REVERSE_MAP[chunk[3]] ?? 64);

        bytes.push(((c0 << 2) | (c1 >> 4)) & 0xff);
        if (c2 !== 64) bytes.push((((c1 & 0x0f) << 4) | (c2 >> 2)) & 0xff);
        if (c3 !== 64) bytes.push((((c2 & 0x03) << 6) | c3) & 0xff);
    }

    return Buffer.from(bytes).toString('utf8');
}

function decrypt(payload) {
    return JSON.parse(decodeVidnestBase64(payload));
}

const SERVERS = [
    { path: 'klikxxi', query: '' },
    { path: 'allmovies', query: '' },
    { path: 'onehd', query: '?server=upcloud' },
    { path: 'hollymoviehd', query: '' },
    { path: 'vidlink', query: '' },
    { path: 'purstream', query: '' },
];

function extractUrl(server, root) {
    switch (server) {
        case 'klikxxi':
            return root.sources?.[0]?.url || null;
        case 'allmovies':
            return root.streams?.[0]?.url || null;
        case 'onehd':
            return root.url || null;
        case 'hollymoviehd':
            return root.sources?.[0]?.file || null;
        case 'vidlink':
            return root.data?.stream?.playlist || null;
        case 'purstream':
            return root.sources?.[0]?.url || null;
        default:
            return null;
    }
}

async function fetchServer(serverPath, query, id, s, e) {
    const segment = (s && e) ? `tv/${id}/${s}/${e}` : `movie/${id}`;
    const url = `${API_BASE_URL}/${serverPath}/${segment}${query}`;

    const res = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(10000) });
    if (!res.ok) throw new Error(`vidnest/${serverPath}: ${res.status}`);

    const json = await res.json();
    const data = json.encrypted ? decrypt(json.data) : json.data;
    return extractUrl(serverPath, data);
}

async function getStream(id, s, e) {
    for (const { path, query } of SERVERS) {
        try {
            const url = await fetchServer(path, query, id, s, e);
            if (url) return url;
        } catch {
        }
    }
    return null;
}

module.exports = { getStream, HEADERS };