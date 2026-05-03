const ALLOWED_ORIGINS = [
    'https://vyla.pages.dev',
    'http://localhost:7860',
    'http://169.254.162.163:7860',
];

const VYLA_API_BASE = 'https://vyla-api.pages.dev';
const VYLA_TIMEOUT = 30000;

function setCors(origin) {
    const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
    return {
        'Access-Control-Allow-Origin': allowed,
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Vary': 'Origin',
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
                return new Response(JSON.stringify(debugResponse(
                    { error: 'vyla error' },
                    { vylaUrl, vylaStatus: r.status, elapsed_ms: elapsed }
                )), { status: 502, headers: { ...cors, 'Content-Type': 'application/json' } });
            }

            const data = await r.json();

            if (!data.sources || !data.sources.length) {
                return new Response(JSON.stringify(debugResponse(
                    { error: 'no sources' },
                    { vylaUrl, elapsed_ms: elapsed, vylaResponse: data }
                )), { status: 502, headers: { ...cors, 'Content-Type': 'application/json' } });
            }

            const sources = data.sources.map(s => ({
                source: s.source,
                label: s.label,
                url: s.url.startsWith('/') ? VYLA_API_BASE + s.url : s.url,
                timeout: 20000,
            }));

            return new Response(JSON.stringify(debugResponse(
                { sources },
                { vylaUrl, elapsed_ms: elapsed, sourceCount: sources.length }
            )), { headers: { ...cors, 'Content-Type': 'application/json' } });

        } catch (err) {
            const elapsed = Date.now() - t0;
            return new Response(JSON.stringify(debugResponse(
                { error: err.message },
                { vylaUrl, elapsed_ms: elapsed, errorName: err.name, timedOut: err.name === 'AbortError' }
            )), { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } });
        }
    }

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
            return new Response(JSON.stringify(debugResponse(
                { error: 'vyla error ' + r.status },
                { vylaUrl, vylaStatus: r.status, elapsed_ms: elapsed }
            )), { status: 502, headers: { ...cors, 'Content-Type': 'application/json' } });
        }

        const data = await r.json();

        if (!data.sources || !data.sources.length) {
            return new Response(JSON.stringify(debugResponse(
                { error: 'no stream' },
                { vylaUrl, elapsed_ms: elapsed, vylaResponse: data }
            )), { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } });
        }

        const first = data.sources[0];
        const finalUrl = first.url.startsWith('/') ? VYLA_API_BASE + first.url : first.url;

        return new Response(JSON.stringify(debugResponse(
            { url: finalUrl, source: first.source, meta: data.meta || null },
            { vylaUrl, elapsed_ms: elapsed, sourceCount: data.sources.length }
        )), { headers: { ...cors, 'Content-Type': 'application/json' } });

    } catch (e) {
        const elapsed = Date.now() - t0;
        return new Response(JSON.stringify(debugResponse(
            { error: e.message },
            { vylaUrl, elapsed_ms: elapsed, errorName: e.name, timedOut: e.name === 'AbortError' }
        )), { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } });
    }
}