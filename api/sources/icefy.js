'use strict';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124';

const ICEFY_HEADERS = {
    'User-Agent': UA,
    'Referer': 'https://icefy.top',
    'Origin': 'https://icefy.top'
};

async function getStream(id, s, e, base) {
    const endpoint = s
        ? `${base}/tv/${id}/${s}/${e || 1}`
        : `${base}/movie/${id}`;

    const res = await fetch(endpoint, { headers: ICEFY_HEADERS });

    if (!res.ok) throw new Error(`cdn ${res.status}`);
    const json = await res.json();
    if (!json?.stream) throw new Error('no stream');
    return json.stream;
}

module.exports = { getStream, ICEFY_HEADERS, UA };