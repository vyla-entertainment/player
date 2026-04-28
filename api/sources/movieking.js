'use strict';

const BLUPHIM_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    'sec-ch-ua': '"Google Chrome";v="147", "Not.A/Brand";v="8", "Chromium";v="147"',
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-platform': '"Windows"',
    'sec-fetch-dest': 'document',
    'sec-fetch-mode': 'navigate',
    'sec-fetch-site': 'none',
};

const MOVIKING_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36',
    'Origin': 'https://moviking.neuronix.sbs',
    'Referer': 'https://moviking.neuronix.sbs/',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    'sec-ch-ua': '"Google Chrome";v="147", "Not.A/Brand";v="8", "Chromium";v="147"',
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-platform': '"Windows"',
    'sec-fetch-dest': 'iframe',
    'sec-fetch-mode': 'navigate',
    'sec-fetch-site': 'cross-site',
    'sec-fetch-storage-access': 'active',
};

async function getEmbedInfo(bluphimUrl) {
    const res = await fetch(bluphimUrl, { headers: BLUPHIM_HEADERS });
    if (!res.ok) throw new Error(`bluphim fetch ${res.status}`);
    const html = await res.text();

    const m = html.match(/moviking\.neuronix\.sbs\/(embed(?:3rd)?)\?id=([a-f0-9A-F]+)/);
    if (!m) {
        const snippet = html.match(/neuronix[\s\S]{0,300}/);
        throw new Error('bluphim: embed id not found');
    }

    const embedType = m[1];
    const videoId = m[2];
    const fullSrcMatch = html.match(/https:\/\/moviking\.neuronix\.sbs\/embed(?:3rd)?\?[^"'\s]*/);
    const fullSrc = fullSrcMatch
        ? fullSrcMatch[0].replace(/&amp;/g, '&')
        : `https://moviking.neuronix.sbs/${embedType}?id=${videoId}&web=bluphim5.com&lang=vi`;

    return { videoId, embedType, fullSrc };
}

async function fetchEmbedPage(fullSrc) {
    const res = await fetch(fullSrc, {
        headers: { ...MOVIKING_HEADERS, 'Referer': 'https://bluphim5.com/' }
    });
    if (!res.ok) throw new Error(`embed page ${res.status}`);
    const html = await res.text();

    const cdnMatch = html.match(/var cdn = ['"]([^'"]+)['"]/);
    const webMatch = html.match(/var web = ['"]([^'"]+)['"]/);
    const subIdMatch = html.match(/var subId = ['"]([^'"]*)['"]/);
    const langMatch = html.match(/var lang = ['"]([^'"]+)['"]/);
    const domainMatch = html.match(/var domain = ['"]([^'"]+)['"]/);

    return {
        cdn: cdnMatch ? cdnMatch[1] : 'https://cdn2.lilune.shop',
        web: webMatch ? webMatch[1] : 'bluphim5.com',
        subId: subIdMatch ? subIdMatch[1] : '',
        lang: langMatch ? langMatch[1] : 'vi',
        domain: domainMatch ? domainMatch[1] : 'https://bluphim5.com/',
    };
}

function generateVisitorId() {
    const chars = '0123456789abcdef';
    let id = '';
    for (let i = 0; i < 32; i++) id += chars[Math.floor(Math.random() * chars.length)];
    return id;
}

async function getTokenQueryString(videoId, embedVars) {
    const visitorId = generateVisitorId();
    const renderer = 'ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 Direct3D11 vs_5_0 ps_5_0, D3D11)';

    const formData = new FormData();
    formData.append('renderer', renderer);
    formData.append('id', visitorId);
    formData.append('videoId', videoId);
    formData.append('domain', embedVars.domain);

    const embedUrl = `https://moviking.neuronix.sbs/embed?id=${videoId}&web=${embedVars.web}&lang=${embedVars.lang}`;

    const res = await fetch('https://moviking.neuronix.sbs/geturl', {
        method: 'POST',
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36',
            'Origin': 'https://moviking.neuronix.sbs',
            'Referer': embedUrl,
            'sec-ch-ua': '"Google Chrome";v="147", "Not.A/Brand";v="8", "Chromium";v="147"',
            'sec-ch-ua-mobile': '?0',
            'sec-ch-ua-platform': '"Windows"',
            'sec-fetch-site': 'same-origin',
            'sec-fetch-mode': 'cors',
            'sec-fetch-dest': 'empty',
            'Accept': '*/*',
            'Accept-Language': 'en-US,en;q=0.9',
        },
        body: formData,
    });

    const raw = await res.text();

    if (!res.ok) throw new Error(`geturl ${res.status}`);
    return raw;
}

async function getStream(bluphimUrl) {
    const { videoId, fullSrc } = await getEmbedInfo(bluphimUrl);
    const embedVars = await fetchEmbedPage(fullSrc);

    const tokenQs = await getTokenQueryString(videoId, embedVars);
    const params = new URLSearchParams(tokenQs);
    const token1 = params.get('token1');
    const token3 = params.get('token3');

    const segmentCdn = embedVars.cdn.replace('cdn2.', 'cdn.').replace('cdn3.', 'cdn.');
    const streamUrl = `${segmentCdn}/segment/${videoId}/?token1=${token1}&token3=${token3}`;
    return streamUrl;
}

module.exports = { getStream, getEmbedId: async (url) => (await getEmbedInfo(url)).videoId };