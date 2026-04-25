const PLAYER_URL = 'https://player.vidzee.wtf';

const STREAM_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150 Safari/537.36',
    'Accept': '*/*',
    'Accept-Language': 'en-US,en;q=0.9',
    'Referer': PLAYER_URL,
    'Origin': PLAYER_URL,
};

export async function onRequestGet(context) {
    const { searchParams } = new URL(context.request.url);
    const target = searchParams.get('url');

    if (!target) {
        return new Response(JSON.stringify({ error: 'missing ?url= param' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
    }

    let targetUrl;
    try {
        targetUrl = new URL(target);
    } catch {
        return new Response(JSON.stringify({ error: 'invalid url' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
    }

    const upstream = await fetch(targetUrl.toString(), { headers: STREAM_HEADERS });

    const contentType = upstream.headers.get('Content-Type') || 'application/octet-stream';
    const isM3U8 = contentType.includes('mpegurl') || target.includes('.m3u8');

    if (!isM3U8) {
        return new Response(upstream.body, {
            status: upstream.status,
            headers: {
                'Content-Type': contentType,
                'Access-Control-Allow-Origin': '*',
                'Cache-Control': 'public, max-age=10',
            }
        });
    }

    const text = await upstream.text();
    const base = new URL(targetUrl.href.substring(0, targetUrl.href.lastIndexOf('/') + 1));

    const rewritten = text.split('\n').map(line => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) return line;

        let absoluteUrl;
        try {
            absoluteUrl = new URL(trimmed, base).toString();
        } catch {
            return line;
        }

        return `/api/proxy?url=${encodeURIComponent(absoluteUrl)}`;
    }).join('\n');

    return new Response(rewritten, {
        status: upstream.status,
        headers: {
            'Content-Type': 'application/vnd.apple.mpegurl',
            'Access-Control-Allow-Origin': '*',
            'Cache-Control': 'no-cache',
        }
    });
}

export async function onRequestOptions() {
    return new Response(null, {
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
        }
    });
}