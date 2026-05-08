const VYLA_API_BASE = 'https://missourimonster-vyla-api.hf.space';
const VYLA_TIMEOUT = 30000;

function setCors(origin) {
    return {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
    };
}

function vylaFetch(url) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), VYLA_TIMEOUT);
    return fetch(url, { signal: controller.signal }).finally(() => clearTimeout(timer));
}

function debugResponse(data, extra = {}) {
    return { _debug: { timestamp: new Date().toISOString(), ...extra }, ...data };
}

export async function onRequest(context) {
    const { request, env } = context;
    const url = new URL(request.url);
    const q = Object.fromEntries(url.searchParams.entries());
    const origin = request.headers.get('origin') || '';
    const cors = setCors(origin);
    const TMDB_KEY = env.TMDB_API_KEY || '';
    const workerOrigin = url.origin;

    if (request.method === 'OPTIONS') {
        return new Response(null, { status: 204, headers: cors });
    }

    if ('tmdb_season' in q || 'tmdb_show' in q || 'tmdb_movie' in q || 'tmdb_tv' in q) {
        if (!TMDB_KEY) {
            return new Response(JSON.stringify({ error: 'no key' }), { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } });
        }
        let tmdbUrl;
        if ('tmdb_season' in q) {
            tmdbUrl = `https://api.themoviedb.org/3/tv/${q.id}/season/${q.s}?api_key=${TMDB_KEY}`;
        } else if ('tmdb_show' in q || 'tmdb_tv' in q) {
            const append = q.append_to_response ? `&append_to_response=${q.append_to_response}` : '';
            tmdbUrl = `https://api.themoviedb.org/3/tv/${q.id}?api_key=${TMDB_KEY}${append}`;
        } else {
            const append = q.append_to_response ? `&append_to_response=${q.append_to_response}` : '';
            tmdbUrl = `https://api.themoviedb.org/3/movie/${q.id}?api_key=${TMDB_KEY}${append}`;
        }
        try {
            const r = await fetch(tmdbUrl);
            const d = await r.json();
            return new Response(JSON.stringify(d), { headers: { ...cors, 'Content-Type': 'application/json' } });
        } catch (err) {
            return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } });
        }
    }

    if ('sources' in q) {
        if (!q.id) {
            return new Response(JSON.stringify({ error: 'missing id' }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } });
        }
        const vylaUrl = q.s
            ? `${VYLA_API_BASE}/api/tv?id=${q.id}&season=${q.s}&episode=${q.e || 1}`
            : `${VYLA_API_BASE}/api/movie?id=${q.id}`;

        const t0 = Date.now();
        try {
            const r = await vylaFetch(vylaUrl);
            const elapsed = Date.now() - t0;

            if (!r.ok) {
                return new Response(JSON.stringify(debugResponse({ error: 'vyla error' }, { vylaUrl, vylaStatus: r.status, elapsed_ms: elapsed })), { status: 502, headers: { ...cors, 'Content-Type': 'application/json' } });
            }

            const data = await r.json();
            if (data.sources?.length) {
            }

            if (!data.sources || !data.sources.length) {
                return new Response(JSON.stringify(debugResponse({ error: 'no sources' }, { vylaUrl, elapsed_ms: elapsed, vylaResponse: data })), { status: 502, headers: { ...cors, 'Content-Type': 'application/json' } });
            }

            const sources = data.sources.map(s => {
                const abs = (s.url.startsWith('/') ? VYLA_API_BASE + s.url : s.url).replace('http://', 'https://');
                return { source: s.source, label: s.label, url: abs, timeout: 20000 };
            });

            return new Response(JSON.stringify(debugResponse({ sources }, { vylaUrl, elapsed_ms: elapsed, sourceCount: sources.length })), { headers: { ...cors, 'Content-Type': 'application/json' } });

        } catch (err) {
            const elapsed = Date.now() - t0;
            return new Response(JSON.stringify(debugResponse({ error: err.message }, { vylaUrl, elapsed_ms: elapsed, errorName: err.name, timedOut: err.name === 'AbortError' })), { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } });
        }
    }

    if ('url' in q) {
        const target = q.url;
        if (!target) {
            return new Response(JSON.stringify({ error: 'missing url' }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } });
        }
        let targetOrigin;
        try {
            targetOrigin = new URL(target).origin;
        } catch {
            return new Response(JSON.stringify({ error: 'invalid url' }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } });
        }
        const proxyHeaders = {
            'Referer': targetOrigin + '/',
            'Origin': targetOrigin,
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        };
        try {
            const upstream = await fetch(target, { headers: proxyHeaders });
            const ct = upstream.headers.get('Content-Type') || 'application/octet-stream';
            const isM3u8 = ct.includes('mpegurl') || ct.includes('m3u8') || target.includes('.m3u8');
            const responseHeaders = { ...cors, 'Content-Type': ct };
            const cd = upstream.headers.get('Content-Disposition');
            if (cd) responseHeaders['Content-Disposition'] = cd;
            if (isM3u8) {
                let text = await upstream.text();
                text = text.replaceAll('http://missourimonster-vyla-api.hf.space', 'https://missourimonster-vyla-api.hf.space');
                return new Response(text, { status: upstream.status, headers: responseHeaders });
            }
            const cl = upstream.headers.get('Content-Length');
            if (cl) responseHeaders['Content-Length'] = cl;
            const cr = upstream.headers.get('Content-Range');
            if (cr) responseHeaders['Content-Range'] = cr;
            return new Response(upstream.body, { status: upstream.status, headers: responseHeaders });
        } catch (err) {
            return new Response(JSON.stringify({ error: err.message }), { status: 502, headers: { ...cors, 'Content-Type': 'application/json' } });
        }
    }

    const vylaUrl = q.s
        ? `${VYLA_API_BASE}/api/tv?id=${q.id}&season=${q.s}&episode=${q.e || 1}`
        : `${VYLA_API_BASE}/api/movie?id=${q.id}`;

    const t0 = Date.now();
    try {
        const r = await vylaFetch(vylaUrl);
        const elapsed = Date.now() - t0;

        if (!r.ok) {
            return new Response(JSON.stringify(debugResponse({ error: 'vyla error ' + r.status }, { vylaUrl, vylaStatus: r.status, elapsed_ms: elapsed })), { status: 502, headers: { ...cors, 'Content-Type': 'application/json' } });
        }

        const data = await r.json();

        if (!data.sources || !data.sources.length) {
            return new Response(JSON.stringify(debugResponse({ error: 'no stream' }, { vylaUrl, elapsed_ms: elapsed, vylaResponse: data })), { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } });
        }

        const first = data.sources[0];
        const absUrl = (first.url.startsWith('/') ? VYLA_API_BASE + first.url : first.url).replace('http://', 'https://');
        const finalUrl = absUrl;

        let title = 'Unknown';
        if (TMDB_KEY && q.id) {
            try {
                const tmdbUrl = q.s
                    ? `https://api.themoviedb.org/3/tv/${q.id}/season/${q.s}/episode/${q.e || 1}?api_key=${TMDB_KEY}`
                    : `https://api.themoviedb.org/3/movie/${q.id}?api_key=${TMDB_KEY}`;
                const tr = await fetch(tmdbUrl);
                const td = await tr.json();
                title = td.title || td.name || td.original_title || td.original_name || 'Unknown';
            } catch (err) {
            }
        }

        return new Response(JSON.stringify(debugResponse(
            { url: finalUrl, source: first.source, meta: data.meta || null, title },
            { vylaUrl, elapsed_ms: elapsed, sourceCount: data.sources.length }
        )), { headers: { ...cors, 'Content-Type': 'application/json' } });

    } catch (e) {
        const elapsed = Date.now() - t0;
        return new Response(JSON.stringify(debugResponse({ error: e.message }, { vylaUrl, elapsed_ms: elapsed, errorName: e.name, timedOut: e.name === 'AbortError' })), { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } });
    }
}
