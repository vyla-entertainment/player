'use strict';

const { webcrypto } = require('crypto');
const crypto = webcrypto;

const PLAYER_URL = 'https://player.vidzee.wtf';
const CORE_URL = 'https://core.vidzee.wtf';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150 Safari/537.36';

function makeHeaders(clientIp) {
    return {
        'User-Agent': UA,
        'Accept': 'application/json, text/javascript, */*; q=0.01',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer': PLAYER_URL,
        'Origin': PLAYER_URL,
        ...(clientIp && { 'X-Forwarded-For': clientIp, 'X-Real-IP': clientIp }),
    };
}

const hlsHeaders = {
    'User-Agent': UA,
    'Accept': '*/*',
    'Accept-Language': 'en-US,en;q=0.9',
    'Referer': PLAYER_URL,
    'Origin': PLAYER_URL,
};

async function deriveKey(e) {
    if (!e) return '';
    const base64ToBytes = (s) => {
        const t = Buffer.from(s.replace(/\s+/g, ''), 'base64');
        return new Uint8Array(t);
    };
    const t = base64ToBytes(e);
    if (t.length <= 28) return '';
    const n = t.slice(0, 12);
    const r = t.slice(12, 28);
    const a = t.slice(28);
    const i = new Uint8Array(a.length + r.length);
    i.set(a, 0);
    i.set(r, a.length);
    const encoder = new TextEncoder();
    const l = await crypto.subtle.digest('SHA-256', encoder.encode('4f2a9c7d1e8b3a6f0d5c2e9a7b1f4d8c'));
    const o = await crypto.subtle.importKey('raw', l, { name: 'AES-GCM' }, false, ['decrypt']);
    const c = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: n, tagLength: 128 }, o, i);
    return new TextDecoder().decode(c);
}

async function decrypt(encryptedData, decryptionKey) {
    if (!encryptedData || !decryptionKey) return '';
    const decoded = Buffer.from(encryptedData, 'base64').toString('utf8');
    const [ivBase64, cipherBase64] = decoded.split(':');
    if (!ivBase64 || !cipherBase64) return '';
    const iv = Uint8Array.from(Buffer.from(ivBase64, 'base64'));
    const cipherBytes = Uint8Array.from(Buffer.from(cipherBase64, 'base64'));
    const encoded = new TextEncoder().encode(decryptionKey);
    const keyBytes = new Uint8Array(32);
    keyBytes.set(encoded.slice(0, 32));
    const cryptoKey = await crypto.subtle.importKey('raw', keyBytes, { name: 'AES-CBC' }, false, ['decrypt']);
    const decrypted = await crypto.subtle.decrypt({ name: 'AES-CBC', iv }, cryptoKey, cipherBytes);
    return new TextDecoder().decode(decrypted);
}

function fetchWithTimeout(url, headers, ms) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), ms);
    return fetch(url, { headers, signal: controller.signal })
        .finally(() => clearTimeout(timer));
}

async function getStream(id, s, e) {
    const type = s ? 'tv' : 'movie';
    const season = s || '1';
    const episode = e || '1';
    const headers = makeHeaders(null);

    const apiKeyResponse = await fetchWithTimeout(`${CORE_URL}/api-key`, headers, 5000);
    if (!apiKeyResponse.ok) throw new Error(`VidZee API key failed: ${apiKeyResponse.status}`);
    const apiKeyText = await apiKeyResponse.text();

    const decKey = await deriveKey(apiKeyText);
    if (!decKey) throw new Error('VidZee: failed to derive key');

    for (let sr = 0; sr < 14; sr++) {
        let data;
        try {
            let url = `${PLAYER_URL}/api/server?id=${id}&sr=${sr}`;
            if (type === 'tv') url += `&ss=${season}&ep=${episode}`;
            const res = await fetchWithTimeout(url, headers, 6000);
            if (!res.ok) continue;
            data = await res.json();
        } catch {
            continue;
        }

        if (!data || data.error || !Array.isArray(data.url) || !data.url.length) continue;

        for (const entry of data.url) {
            if (!entry.link) continue;
            try {
                const decrypted = await decrypt(entry.link, decKey);
                if (decrypted && decrypted.startsWith('http')) {
                    const check = await fetchWithTimeout(decrypted, hlsHeaders, 5000);
                    if (check.ok) return decrypted;
                }
            } catch {
                continue;
            }
        }
    }

    throw new Error('VidZee: no valid stream found');
}

module.exports = { getStream, hlsHeaders, PLAYER_URL };