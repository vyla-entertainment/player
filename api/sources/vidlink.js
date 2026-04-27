'use strict';

const fs = require('fs');
const path = require('path');

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

        eval(fs.readFileSync(path.join(__dirname, '..', 'script.js'), 'utf8'));

        const go = new Dm();
        const wasm = fs.readFileSync(path.join(__dirname, '..', 'fu.wasm'));
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

module.exports = { getStream, REFERER, ORIGIN, UA };