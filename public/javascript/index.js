var TMDB_KEY = '338a47b75eab45d9e64e67088f910f93';
var baseURL = "https://missourimonster-vyla.hf.space";

var alive = true;
var shouldHideLoader = false;

function initLoaderBackdrop() {
    var loaderBg = document.getElementById('loader-bg');
    if (!loaderBg) return;

    var p = new URLSearchParams(location.search);
    var id = p.get('id');
    if (!id) return;

    var isTv = !!p.get('season');
    var tmdbUrl = isTv ? 'https://api.themoviedb.org/3/tv/' + id + '?api_key=' + TMDB_KEY : 'https://api.themoviedb.org/3/movie/' + id + '?api_key=' + TMDB_KEY;

    fetch(tmdbUrl)
        .then(function (response) {
            if (!response.ok) throw new Error('TMDB fetch failed');
            return response.json();
        })
        .then(function (data) {
            if (data.success === false) {
                return;
            }

            var backdropPath = data.backdrop_path;
            if (backdropPath) {
                var backdropUrl = 'https://image.tmdb.org/t/p/original' + backdropPath;
                loaderBg.style.backgroundImage = 'url(' + backdropUrl + ')';
            } else {
                var posterPath = data.poster_path;
                if (posterPath) {
                    var posterUrl = 'https://image.tmdb.org/t/p/w1280' + posterPath;
                    loaderBg.style.backgroundImage = 'url(' + posterUrl + ')';
                }
            }
        })
}

function setTitleWithTmdbImage(titleText, meta) {
    var titleElement = document.getElementById('title-text');
    var logos = meta && meta.images && meta.images.logos;
    var logo = null;
    if (logos && logos.length > 0) {
        logo = logos.find(function (l) { return l.iso_639_1 === 'en'; });
        if (!logo) logo = logos.find(function (l) { return !l.iso_639_1 || l.iso_639_1 === 'xx'; });
        if (!logo) logo = logos[0];
    }
    if (!logo && meta && meta.logo_object && meta.logo_object.file_path) {
        logo = meta.logo_object;
    }
    if (logo && logo.file_path) {
        var logoUrl = 'https://image.tmdb.org/t/p/w300' + logo.file_path;
        titleElement.innerHTML = '<img src="' + logoUrl + '" alt="' + titleText + '" style="max-height:24px;max-width:200px;object-fit:contain;">';
    } else {
        titleElement.textContent = titleText;
    }
}

function isMobile() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

document.addEventListener('DOMContentLoaded', function () {
    initLoaderBackdrop();

    if (isMobile()) {
        var mainVideo = document.getElementById('v');
        if (mainVideo) {
            mainVideo.removeAttribute('controls');
        }
    }
});

function hideLoader() {
    var loader = document.getElementById('loader');
    loader.classList.add('out');
    setTimeout(function () {
        alive = false;
        loader.style.display = 'none';
    }, 1000);
}

document.addEventListener('keydown', function (e) {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') return;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        if (document.body.classList.contains('tv-nav-mode')) return;
        if (e.key === 'ArrowLeft') { v.currentTime = Math.max(0, v.currentTime - 10); showUI(); }
        if (e.key === 'ArrowRight') { v.currentTime = Math.min(v.duration || 0, v.currentTime + 10); showUI(); }
        return;
    }
    if (e.key === ' ' || e.key === 'k' || e.key === 'K') { e.preventDefault(); haptic(10); v.paused ? v.play() : v.pause(); }
    if (e.key === 'f' || e.key === 'F') {
        if (isIOS()) {
            if (v.webkitDisplayingFullscreen) {
                v.webkitExitFullscreen();
            } else {
                v.webkitEnterFullscreen();
            }
            return;
        }
        var fsEl = document.fullscreenElement || document.webkitFullscreenElement;
        var player = document.getElementById('player');
        if (fsEl) {
            if (document.exitFullscreen) document.exitFullscreen();
            else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
        } else {
            if (player.requestFullscreen) player.requestFullscreen();
            else if (player.webkitRequestFullscreen) player.webkitRequestFullscreen();
        }
    }
});

var p = new URLSearchParams(location.search);
var id = p.get('id'), s = p.get('season'), e = p.get('episode'), ap = p.get('ap');

function isIOS() {
    return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
}

var _initialFetchPromise = null;

var sources = [];
var currentSourceIndex = 0;
var sourcesLoaded = false;
var buildSourceList = null;

function showNowPlayingToast(title) {
    var toast = document.getElementById('now-playing-toast');
    toast.innerHTML = '<div class="np-glow"></div><div class="np-inner"><span class="np-label">Now Playing</span><span class="np-title">\u201c' + title + '\u201d</span></div>';
    toast.className = '';
    setTimeout(function () {
        toast.classList.add('enter');
        setTimeout(function () {
            toast.classList.add('exit');
        }, 3800);
    }, 4500);
}


if (id) {
    var baseEndpoint = s
        ? baseURL + '/api/tv?id=' + id + '&season=' + s + '&episode=' + (e || '1')
        : baseURL + '/api/movie?id=' + id;

    (function () {
        var loaderEl = document.getElementById('loader');
        var loaderBgEl = document.getElementById('loader-bg');

        var spinnerEl = document.createElement('div');
        spinnerEl.id = 'loader-spinner-wrap';
        spinnerEl.style.cssText = 'position:absolute;top:50%;left:50%;transform:translate(-50%,-60%);z-index:30;display:flex;flex-direction:column;align-items:center;gap:20px;pointer-events:none;';
        spinnerEl.innerHTML = '<svg width="56" height="56" viewBox="0 0 52 52" style="filter:drop-shadow(0 0 18px rgba(255,255,255,0.18));animation:_vyla_spin 0.9s linear infinite"><style>@keyframes _vyla_spin{to{transform:rotate(360deg)}}</style><circle cx="26" cy="26" r="22" fill="none" stroke="rgba(255,255,255,0.88)" stroke-width="3.5" stroke-linecap="round" stroke-dasharray="100" stroke-dashoffset="70"/></svg>';
        if (loaderBgEl) loaderBgEl.appendChild(spinnerEl);
        else if (loaderEl) loaderEl.appendChild(spinnerEl);

        var _origHide = window.hideLoader;
        window.hideLoader = function () {
            if (spinnerEl) spinnerEl.style.display = 'none';
            var carousel = document.getElementById('loader-sources-carousel');
            if (carousel) carousel.style.display = 'none';
            var track = document.getElementById('loader-sources-track');
            if (track) track.innerHTML = '';
            var errScreen = document.getElementById('error-screen');
            if (errScreen) errScreen.classList.remove('show');
            if (_origHide) _origHide();
        };
    })();

    function fetchAllSources() {
        return fetch(baseURL + '/')
            .then(function (r) { return r.json(); })
            .then(function (data) {
                var bySource = data.tests && data.tests.bySource ? data.tests.bySource : {};
                var sourceNames = Object.keys(bySource);
                if (!sourceNames.length) throw new Error('no sources');

                return new Promise(function (resolve, reject) {
                    var settled = 0;
                    var total = sourceNames.length;
                    var aggregatedSources = [];
                    var firstResolved = false;

                    sourceNames.forEach(function (name) {
                        var path = s
                            ? bySource[name].tv.replace('/1396', '/' + id).replace('season=1', 'season=' + s).replace('episode=1', 'episode=' + (e || '1'))
                            : bySource[name].movie.replace('/155', '/' + id);

                        fetch(baseURL + path)
                            .then(function (r) { return r.json(); })
                            .then(function (d) {
                                settled++;
                                if (d && d.url) {
                                    var entry = {
                                        label: name,
                                        source: name,
                                        url: d.url.startsWith('/api')
                                            ? baseURL + d.url
                                            : d.url
                                    };
                                    aggregatedSources.push(entry);
                                    if (!firstResolved) {
                                        firstResolved = true;
                                        resolve({ first: entry, aggregated: aggregatedSources });
                                    }
                                }
                                if (settled === total && !firstResolved) {
                                    reject(new Error('no working sources'));
                                }
                            })
                            .catch(function () {
                                settled++;
                                if (settled === total && !firstResolved) {
                                    if (aggregatedSources.length > 0) {
                                        firstResolved = true;
                                        resolve({ first: aggregatedSources[0], aggregated: aggregatedSources });
                                    } else {
                                        reject(new Error('no working sources'));
                                    }
                                }
                            });
                    });
                });
            });
    }

    var _allSourcesSettled = false;
    var _aggregatedSources = [];

    fetchAllSources()
        .then(function (result) {
            shouldHideLoader = true;
            hideLoader();

            sources = result.aggregated.length ? result.aggregated : [result.first];
            sourcesLoaded = true;
            currentSourceIndex = 0;

            var isTv = !!s;
            var tmdbUrl = isTv
                ? 'https://api.themoviedb.org/3/tv/' + id + '?api_key=' + TMDB_KEY + '&append_to_response=images'
                : 'https://api.themoviedb.org/3/movie/' + id + '?api_key=' + TMDB_KEY + '&append_to_response=images';

            var metaTitle = 'Unknown';

            function startPlayback() {
                var src = sources[currentSourceIndex];
                if (!src) {
                    var errText = document.querySelector('.err-text');
                    if (errText) errText.innerHTML = 'Stream Unavailable';
                    var errSub = document.querySelector('.err-sub');
                    if (!errSub && errText) errText.insertAdjacentHTML('afterend', '<div class="err-sub">All sources failed.</div>');
                    document.getElementById('error-screen').classList.add('show');
                    return;
                }
                window._fallbackSources = result.aggregated;
                play(src.url, true, id);
                if (typeof buildSourceList === 'function') buildSourceList();
            }

            var checkInterval = setInterval(function () {
                sources = result.aggregated.slice();
                if (typeof buildSourceList === 'function') buildSourceList();
            }, 600);

            setTimeout(function () {
                clearInterval(checkInterval);
                sources = result.aggregated.slice();
                if (typeof buildSourceList === 'function') buildSourceList();
            }, 20000);

            fetch(tmdbUrl)
                .then(function (mr) { return mr.json(); })
                .then(function (meta) {
                    metaTitle = (meta.title || meta.name || 'Unknown');
                    if (s) metaTitle += ' \u00b7 S' + s + 'E' + (e || '1');
                    document.title = metaTitle;
                    setTitleWithTmdbImage(metaTitle, meta);
                    if ('mediaSession' in navigator) {
                        var img = 'https://image.tmdb.org/t/p/w500' + (meta.poster_path || meta.backdrop_path);
                        navigator.mediaSession.metadata = new MediaMetadata({
                            title: metaTitle,
                            artwork: [{ src: img, sizes: '500x500', type: 'image/jpeg' }]
                        });
                    }
                    showNowPlayingToast(metaTitle);
                    startPlayback();
                })
                .catch(function () {
                    if (s) metaTitle += ' \u00b7 S' + s + 'E' + (e || '1');
                    document.title = metaTitle;
                    document.getElementById('title-text').textContent = metaTitle;
                    showNowPlayingToast(metaTitle);
                    startPlayback();
                });
        })
        .catch(function () {
            var spinnerEl = document.getElementById('loader-spinner-wrap');
            if (spinnerEl) spinnerEl.style.display = 'none';
            var carousel = document.getElementById('loader-sources-carousel');
            if (carousel) carousel.style.display = 'none';
            var loaderMsg = document.getElementById('loader-msg');
            if (loaderMsg) loaderMsg.style.display = 'none';
            var errText = document.querySelector('.err-text');
            if (errText) errText.innerHTML = 'Stream Unavailable';
            var errSub = document.querySelector('.err-sub');
            if (!errSub) {
                errText && errText.insertAdjacentHTML('afterend', '<div class="err-sub">No working sources were found for this title. It may be unavailable or the ID may be incorrect.</div>');
            }
            document.getElementById('error-screen').classList.add('show');
        });
}

var _hxInput = (function () {
    if (!('ontouchstart' in window) && navigator.maxTouchPoints === 0) return null;
    var s = document.createElement('input');
    s.type = 'checkbox';
    s.setAttribute('switch', '');
    s.setAttribute('inert', '');
    s.tabIndex = -1;
    s.style.cssText = 'position:fixed;top:-9999px;opacity:0;pointer-events:none;';
    document.body.appendChild(s);
    var l = document.createElement('label');
    l.htmlFor = s.id = '__hx';
    l.style.cssText = 'position:fixed;top:-9999px;opacity:0;pointer-events:none;';
    document.body.appendChild(l);
    return l;
})();

function haptic() {
    if (_hxInput) _hxInput.click();
}

function fmt(sec) {
    if (!sec || isNaN(sec) || sec < 0) return '0:00';
    var h = Math.floor(sec / 3600);
    var m = Math.floor((sec % 3600) / 60);
    var s = Math.floor(sec % 60);
    var ss = s < 10 ? '0' + s : '' + s;
    if (h > 0) {
        var mm = m < 10 ? '0' + m : '' + m;
        return h + ':' + mm + ':' + ss;
    }
    return m + ':' + ss;
}

function parseSrt(text) {
    var cues = [];
    var blocks = text.trim().split(/\n\s*\n/);
    blocks.forEach(function (block) {
        var lines = block.trim().split('\n');
        var timeIdx = -1;
        for (var i = 0; i < lines.length; i++) {
            if (lines[i].includes('-->')) { timeIdx = i; break; }
        }
        if (timeIdx < 0) return;
        var times = lines[timeIdx].split('-->');
        function toSec(t) {
            var parts = t.trim().replace(',', '.').split(':');
            return parseFloat(parts[0]) * 3600 + parseFloat(parts[1]) * 60 + parseFloat(parts[2]);
        }
        var txt = lines.slice(timeIdx + 1).join('\n').replace(/<[^>]+>/g, '').trim();
        if (txt) cues.push({ start: toSec(times[0]), end: toSec(times[1]), text: txt });
    });
    return cues;
}

function parseVtt(text) {
    var cues = [];
    var blocks = text.trim().split(/\n\s*\n/);
    blocks.forEach(function (block) {
        var lines = block.trim().split('\n');
        var timeIdx = -1;
        for (var i = 0; i < lines.length; i++) {
            if (lines[i].includes('-->')) { timeIdx = i; break; }
        }
        if (timeIdx < 0) return;
        var times = lines[timeIdx].split('-->');
        function toSec(t) {
            var clean = t.trim().split(' ')[0];
            var parts = clean.split(':');
            if (parts.length === 2) return parseFloat(parts[0]) * 60 + parseFloat(parts[1]);
            return parseFloat(parts[0]) * 3600 + parseFloat(parts[1]) * 60 + parseFloat(parts[2]);
        }
        var txt = lines.slice(timeIdx + 1).join('\n').replace(/<[^>]+>/g, '').replace(/\{[^}]+\}/g, '').trim();
        if (txt) cues.push({ start: toSec(times[0]), end: toSec(times[1]), text: txt });
    });
    return cues;
}

function detectFormat(url, hint) {
    if (hint && (hint === 'srt' || hint === 'vtt')) return hint;
    if (url && url.toLowerCase().includes('.srt')) return 'srt';
    return 'vtt';
}

function testSubtitle(sub) {
    return fetch(sub.url, sub.headers ? { headers: sub.headers } : undefined)
        .then(function (r) {
            if (!r.ok) throw new Error('HTTP ' + r.status);
            return r.text();
        })
        .then(function (text) {
            var trimmed = text.trim();
            if (trimmed.length < 10) throw new Error('empty');
            if (trimmed.startsWith('#EXTM3U')) throw new Error('HLS playlist');
            if (trimmed.startsWith('{') || trimmed.startsWith('[')) throw new Error('JSON response');
            var fmt = detectFormat(sub.url, sub.format);
            var cues = fmt === 'srt' ? parseSrt(trimmed) : parseVtt(trimmed);
            if (!cues || cues.length === 0) {
                fmt = fmt === 'srt' ? 'vtt' : 'srt';
                cues = fmt === 'srt' ? parseSrt(trimmed) : parseVtt(trimmed);
            }
            if (!cues || cues.length === 0) throw new Error('no cues parsed');
            return { sub: sub, cues: cues, format: fmt };
        });
}

function fetchSubDirect(sub) {
    return testSubtitle(sub);
}

function fetchSubViaProxy(sub) {
    var proxyUrl = baseURL + '/api/proxy?url=' + encodeURIComponent(sub.url);
    return testSubtitle(Object.assign({}, sub, {
        url: proxyUrl,
        headers: { 'Referer': new URL(sub.url).origin + '/', 'Origin': new URL(sub.url).origin }
    }));
}

function fetchSubWithFallback(sub) {
    return fetchSubViaProxy(sub).catch(function () {
        return fetchSubDirect(sub);
    });
}

var langMap = {};
var getLangCode, flagImg;

fetch('https://restcountries.com/v3.1/all?fields=cca2,languages')
    .then(function (res) {
        return res.json();
    })
    .then(function (data) {
        if (!Array.isArray(data)) {
            return;
        }
        for (const country of data) {
            const cCode = country.cca2?.toLowerCase();
            const languages = country.languages || {};

            for (const [_, langName] of Object.entries(languages)) {
                const key = langName.toLowerCase();
                if (!langMap[key]) langMap[key] = new Set();
                langMap[key].add(cCode);
            }
        }

        getLangCode = function (label) {
            if (!label) return null;
            var key = label.toLowerCase().replace(/[^a-z]/g, ' ').trim().split(' ')[0];
            return langMap[key] ? Array.from(langMap[key])[0] : null;
        };

        flagImg = function (code) {
            if (!code) return '<span style="width:26px;height:20px;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;"><i class="fa-solid fa-globe" style="font-size:13px;color:rgba(255,255,255,0.3);"></i></span>';
            return '<img class="slg-flag" src="https://flagcdn.com/20x15/' + code + '.png" width="26" height="20" alt="">';
        };

    });

function play(raw, skipProxy, videoId) {
    (function () {
        if (document.getElementById('_vyla_styles')) return;
        var st = document.createElement('style');
        st.id = '_vyla_styles';
        st.textContent = '@keyframes _vyla_spin{to{transform:rotate(360deg)}}@keyframes _vyla_dot{0%,80%,100%{transform:scale(0.55);opacity:0.25}40%{transform:scale(1);opacity:1}}';
        document.head.appendChild(st);
    })();

    var src = (skipProxy || raw.startsWith(baseURL)) ? raw : (raw.startsWith('/api') ? baseURL + raw : baseURL + '/api/movie?url=' + encodeURIComponent(raw));
    var v = document.getElementById('v');
    var controlsWrapper = document.getElementById('player-controls-wrapper');
    var titleBar = document.getElementById('title-bar');
    var trackEl = document.getElementById('track');
    var wrap = document.getElementById('track-wrap');
    var prog = document.getElementById('prog');
    var bufEl = document.getElementById('buf');
    var thumb = document.getElementById('thumb');
    var tCur = document.getElementById('t-cur');
    var tDur = { textContent: '' };
    var tDur = document.getElementById('t-dur');
    var ci = document.getElementById('ci');
    var centerFlash = document.getElementById('center-flash');
    var cfSkipLeft = document.getElementById('cf-skip-left');
    var cfSkipRight = document.getElementById('cf-skip-right');

    cfSkipLeft.addEventListener('click', function (e) {
        e.stopPropagation();
        v.currentTime = Math.max(0, v.currentTime - 10);
        haptic();
    });

    cfSkipRight.addEventListener('click', function (e) {
        e.stopPropagation();
        v.currentTime = Math.min(v.duration || 0, v.currentTime + 10);
        haptic();
    });
    var skipL = document.getElementById('skip-left');
    var skipR = document.getElementById('skip-right');
    var skipLLbl = document.getElementById('skip-left-lbl');
    var skipRLbl = document.getElementById('skip-right-lbl');
    var btnPip = document.getElementById('btn-pip');
    var btnFullscreen = document.getElementById('btn-fullscreen');
    var btnSettings = document.getElementById('btn-settings');
    var settingsPanel = document.getElementById('settings-panel');
    var speedOpts = document.querySelectorAll('.settings-list-item[data-speed]');
    var qualityOptsEl = document.getElementById('quality-opts');
    var sourceBtnWrap = document.getElementById('source-title-wrap');
    var subFontSelect = document.getElementById('sub-font-select');
    var subSizeSelect = document.getElementById('sub-size-select');
    var subColorInput = document.getElementById('sub-color-input');
    var subBgColorInput = document.getElementById('sub-bg-color-input');
    var subBgOpacitySelect = document.getElementById('sub-bg-opacity-select');
    var subPosSelect = document.getElementById('sub-pos-select');
    var subEdgeSelect = document.getElementById('sub-edge-select');
    var subtitleDisplay = document.getElementById('subtitle-display');
    var subtitleText = document.getElementById('subtitle-text');
    var tooltip = document.getElementById('tooltip');

    var hideTimer = null;
    var dragging = false;
    var shown = false;
    var settingsOpen = false;

    var subFontMap = { sans: 'var(--font)', serif: 'Georgia, serif', mono: 'monospace' };
    var subSizeMap = { small: '14px', medium: '18px', large: '23px', xlarge: '28px', xxlarge: '34px' };
    var subEdgeMap = {
        shadow: '0 2px 6px rgba(0,0,0,0.85), 0 1px 3px rgba(0,0,0,0.9)',
        outline: '-1px -1px 0 rgba(0,0,0,0.9), 1px -1px 0 rgba(0,0,0,0.9), -1px 1px 0 rgba(0,0,0,0.9), 1px 1px 0 rgba(0,0,0,0.9)',
        uniform: '0 0 4px rgba(0,0,0,1), 0 0 4px rgba(0,0,0,1)',
        none: 'none'
    };
    var subPosMap = { top: '80%', high: '28%', mid: '10%', low: '4%', bottom: '1%' };

    function hexToRgba(hex, alpha) {
        var r = parseInt(hex.slice(1, 3), 16),
            g = parseInt(hex.slice(3, 5), 16),
            b = parseInt(hex.slice(5, 7), 16);
        return 'rgba(' + r + ', ' + g + ', ' + b + ', ' + alpha + ')';
    }

    var savedSub = (function () {
        try { return JSON.parse(localStorage.getItem('subSettings') || '{}'); } catch (err) { return {}; }
    })();

    var subState = {
        activeTrack: -1,
        font: savedSub.font || 'sans',
        color: savedSub.color || '#ffffff',
        size: savedSub.size || 'medium',
        bgColor: savedSub.bgColor || '#000000',
        bgOpacity: savedSub.bgOpacity !== undefined ? savedSub.bgOpacity : '0.75',
        overallOpacity: savedSub.overallOpacity !== undefined ? savedSub.overallOpacity : '1',
        textShadow: savedSub.textShadow || 'shadow',
        pos: savedSub.pos || 'mid',
        edge: savedSub.edge || 'shadow',
        weight: savedSub.weight || '500',
        spacing: savedSub.spacing || 'normal',
        cues: [],
        cueTimer: null
    };

    var videoState = {
        brightness: 100,
        contrast: 100,
        saturate: 100,
        ratio: 'contain',
    };

    var subPosMap = { top: '82%', high: '35%', mid: '12%', low: '6%', bottom: '2%' };
    var subWeightMap = { light: '300', normal: '500', bold: '700' };
    var subSpacingMap = { tight: '-0.5px', normal: '0px', wide: '1px', extra: '2px' };

    var savedSpeed = (function () {
        try {
            var r = parseFloat(localStorage.getItem('playbackSpeed'));
            return (!isNaN(r) && r > 0 && r <= 2) ? r : 1;
        } catch (err) { return 1; }
    })();

    var speedBoostEnabled = (function () {
        try { return localStorage.getItem('speedBoostEnabled') !== 'false'; } catch (ex) { return true; }
    })();

    function saveTimestamp(videoId, currentTime) {
        try {
            var timestamps = JSON.parse(localStorage.getItem('videoTimestamps') || '{}');
            timestamps[videoId] = currentTime;
            localStorage.setItem('videoTimestamps', JSON.stringify(timestamps));
        } catch (err) {
        }
    }

    function getTimestamp(videoId) {
        try {
            var timestamps = JSON.parse(localStorage.getItem('videoTimestamps') || '{}');
            return timestamps[videoId] || 0;
        } catch (err) {
            return 0;
        }
    }

    function clearTimestamp(videoId) {
        try {
            var timestamps = JSON.parse(localStorage.getItem('videoTimestamps') || '{}');
            delete timestamps[videoId];
            localStorage.setItem('videoTimestamps', JSON.stringify(timestamps));
        } catch (err) {
        }
    }

    function saveSubSettings() {
        try {
            localStorage.setItem('subSettings', JSON.stringify({
                font: subState.font,
                size: subState.size,
                color: subState.color,
                bgColor: subState.bgColor,
                bgOpacity: subState.bgOpacity,
                overallOpacity: subState.overallOpacity,
                textShadow: subState.textShadow,
                pos: subState.pos,
                edge: subState.edge,
                weight: subState.weight,
                spacing: subState.spacing
            }));
        } catch (err) { }
    }

    function applySubStyles() {
        subtitleDisplay.style.bottom = subPosMap[subState.pos];
        subtitleDisplay.style.opacity = subState.overallOpacity;
        subtitleText.style.fontFamily = subFontMap[subState.font];
        subtitleText.style.fontSize = subSizeMap[subState.size];
        subtitleText.style.color = subState.color;

        var textShadow = '';
        if (subState.textShadow === 'shadow') {
            textShadow = subEdgeMap.shadow;
        } else if (subState.textShadow === 'outline') {
            textShadow = subEdgeMap.outline;
        } else if (subState.textShadow === 'both') {
            textShadow = subEdgeMap.shadow + ', ' + subEdgeMap.outline;
        } else {
            textShadow = subEdgeMap.none;
        }
        subtitleText.style.textShadow = textShadow;

        subtitleText.style.fontWeight = subWeightMap[subState.weight] || '500';
        subtitleText.style.letterSpacing = subSpacingMap[subState.spacing] || '0px';

        var alpha = parseFloat(subState.bgOpacity);
        if (alpha > 0) {
            subtitleText.style.background = hexToRgba(subState.bgColor, alpha);
            subtitleText.style.padding = '4px 10px';
        } else {
            subtitleText.style.background = 'transparent';
            subtitleText.style.padding = '0';
        }
    }

    function applyVideoStyles() {
        v.style.filter = 'brightness(' + videoState.brightness + '%) contrast(' + videoState.contrast + '%) saturate(' + videoState.saturate + '%)';
        v.style.objectFit = videoState.ratio;
    }

    function isIOS() {
        return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    }

    function isAndroid() {
        return /Android/.test(navigator.userAgent);
    }

    function showToast(message, duration) {
        var toast = document.getElementById('now-playing-toast');
        if (toast) {
            toast.textContent = message;
            toast.style.display = 'block';
            setTimeout(function () {
                toast.style.display = 'none';
            }, duration || 3000);
        }
    }

    if (subFontSelect) subFontSelect.value = subState.font;
    if (subSizeSelect) subSizeSelect.value = subState.size;
    if (subColorInput) subColorInput.value = subState.color;
    if (subBgColorInput) subBgColorInput.value = subState.bgColor;
    if (subBgOpacitySelect) subBgOpacitySelect.value = subState.bgOpacity;
    if (subPosSelect) subPosSelect.value = subState.pos;
    if (subEdgeSelect) subEdgeSelect.value = subState.edge;

    applySubStyles();

    function updateListActive(containerId, clickedEl, labelId, labelText) {
        var container = document.getElementById(containerId);
        container.querySelectorAll('.settings-list-item').forEach(function (el) {
            el.classList.remove('active');
            var icon = el.querySelector('i');
            if (icon) icon.className = 'fa-regular fa-circle';
        });
        clickedEl.classList.add('active');
        var clickedIcon = clickedEl.querySelector('i');
        if (clickedIcon) clickedIcon.className = 'fa-regular fa-circle-dot';
        var labelEl = document.getElementById(labelId);
        if (labelEl) labelEl.textContent = labelText;
    }

    var _showedAt = 0;

    window.showUI = function showUI(pin) {
        var pl = document.getElementById('player');
        if (!pl) return;
        controlsWrapper.classList.add('on');
        titleBar.classList.add('on');
        pl.classList.add('ui-on');
        shown = true;
        _showedAt = Date.now();
        clearTimeout(hideTimer);
        if (!pin && !v.paused && !settingsOpen) {
            hideTimer = setTimeout(hideUI, 3200);
        }
    }

    window.hideUI = function hideUI() {
        if (settingsOpen) return;
        if (Date.now() - _showedAt < 320) return;
        var pl = document.getElementById('player');
        if (!pl) return;
        controlsWrapper.classList.remove('on');
        titleBar.classList.remove('on');
        pl.classList.remove('ui-on');
        shown = false;
    }

    v.addEventListener('play', function () {
        ci.className = 'fa-solid fa-pause';
        centerFlash.classList.remove('paused');
    });

    v.addEventListener('pause', function () {
        ci.className = 'fa-solid fa-play';
        centerFlash.classList.add('paused');
    });

    function flashCenter() {
        ci.classList.remove('pop');
        void ci.offsetWidth;
        ci.classList.add('pop');
    }

    var _progRaf = null;
    function setProg() {
        if (!v.duration || dragging) return;
        if (_progRaf) return;
        _progRaf = requestAnimationFrame(function () {
            _progRaf = null;
            if (!v.duration || dragging) return;
            var pct = v.currentTime / v.duration * 100;
            prog.style.width = pct + '%';
            thumb.style.left = 'calc(' + pct + '% - ' + (pct / 100 * 0) + 'px)';
            tCur.textContent = fmt(v.currentTime);
            tDur.textContent = fmt(v.duration);
            if (v.buffered.length) {
                var bufEnd = 0;
                for (var bi = 0; bi < v.buffered.length; bi++) {
                    if (v.buffered.start(bi) <= v.currentTime + 1) {
                        bufEnd = Math.max(bufEnd, v.buffered.end(bi));
                    }
                }
                bufEl.style.width = (bufEnd / v.duration * 100) + '%';
            }
        });
    }

    var _seekRaf = null;
    var _seekPct = 0;
    function seekX(x) {
        var r = wrap.getBoundingClientRect();
        _seekPct = Math.max(0, Math.min(1, (x - r.left) / r.width));
        var pct = _seekPct;
        prog.style.width = (pct * 100) + '%';
        thumb.style.left = (pct * 100) + '%';
        tCur.textContent = fmt(pct * (v.duration || 0));
        if (!dragging) {
            v.currentTime = pct * (v.duration || 0);
        }
    }

    function commitSeek(x) {
        var r = wrap.getBoundingClientRect();
        var pct = (x !== undefined) ? Math.max(0, Math.min(1, (x - r.left) / r.width)) : _seekPct;
        v.currentTime = pct * (v.duration || 0);

        if (nextEpReady && v.duration && v.duration >= 60) {
            var remaining = v.duration - v.currentTime;
            nextEpBtn.style.display = '';
            if (remaining <= 300) {
                nextEpBtn.classList.add('show');
            } else {
                nextEpBtn.classList.remove('show');
            }
        }
    }

    var tooltipTime = document.getElementById('tooltip-time');

    var lastTooltipPct = -1;

    var skipAccL = 0, skipAccR = 0;
    var skipResetTimers = { left: null, right: null };

    function hoverTooltip(x) {
        if (!v.duration) return;
        var r = wrap.getBoundingClientRect();
        var pct = Math.max(0, Math.min(1, (x - r.left) / r.width));
        var t = pct * v.duration;
        var thumbHalf = 8;
        var tipLeft = Math.max(thumbHalf, Math.min(r.width - thumbHalf, pct * r.width));
        tooltip.style.left = tipLeft + 'px';
        tooltipTime.textContent = fmt(t);
        tooltip.classList.add('show');
        lastTooltipPct = pct;
    }

    window.doSkip = function doSkip(dir, taps) {
        var secs = taps * 10;
        var delta = dir === 'left' ? -secs : secs;
        v.currentTime = Math.max(0, Math.min(v.duration || 0, v.currentTime + delta));

        if (nextEpReady && v.duration && v.duration >= 60) {
            var remaining = v.duration - v.currentTime;
            nextEpBtn.style.display = '';
            if (remaining <= 300) {
                nextEpBtn.classList.add('show');
            } else {
                nextEpBtn.classList.remove('show');
            }
        }

        var el = dir === 'left' ? skipL : skipR;
        var lbl = dir === 'left' ? skipLLbl : skipRLbl;

        if (dir === 'left') {
            skipAccL += secs;
            lbl.textContent = '-' + skipAccL + 's';
            clearTimeout(skipResetTimers.left);
            skipResetTimers.left = setTimeout(function () {
                skipAccL = 0;
                el.classList.remove('show');
                el.classList.add('hide');
                setTimeout(function () { el.classList.remove('hide'); lbl.textContent = '-10s'; }, 420);
            }, 900);
        } else {
            skipAccR += secs;
            lbl.textContent = '+' + skipAccR + 's';
            clearTimeout(skipResetTimers.right);
            skipResetTimers.right = setTimeout(function () {
                skipAccR = 0;
                el.classList.remove('show');
                el.classList.add('hide');
                setTimeout(function () { el.classList.remove('hide'); lbl.textContent = '+10s'; }, 420);
            }, 900);
        }

        el.classList.remove('hide');
        void el.offsetWidth;
        el.classList.add('show');
        haptic();
    }

    function startCueLoop() {
        clearInterval(subState.cueTimer);
        var loopTick = 0;
        subState.cueTimer = setInterval(function () {
            loopTick++;
            if (loopTick % 12 === 0) {
            }
            if (subState.activeTrack < 0 || !subState.cues.length) {
                if (subtitleText.textContent !== '') subtitleText.textContent = '';
                return;
            }
            var t = v.currentTime;
            var found = '';
            for (var i = 0; i < subState.cues.length; i++) {
                var c = subState.cues[i];
                if (t >= c.start && t <= c.end) { found = c.text; break; }
            }
            if (subtitleText.textContent !== found) {
                subtitleText.textContent = found;
            }
        }, 80);
    }

    function onReady() {
        v.classList.add('ready');
        v.playbackRate = savedSpeed;
        var onRateGuard = function () {
            if (Math.abs(v.playbackRate - savedSpeed) > 0.01) {
                v.playbackRate = savedSpeed;
            }
        };
        v.addEventListener('ratechange', onRateGuard);
        setTimeout(function () { v.removeEventListener('ratechange', onRateGuard); }, 3000);
        tDur.textContent = fmt(v.duration);
        var loaderBottomGlow = document.querySelector('.loader-bottom-glow');
        if (loaderBottomGlow) loaderBottomGlow.classList.add('video-playing');
        setTimeout(function () { showUI(true); }, 180);
        startCueLoop();
        scheduleRetry();
        attemptAutoplay();
        restoreVolume();
    }

    var _autoplayUnlocked = false;
    var _pendingUnmute = false;

    function attemptAutoplay() {
        var p = v.play();
        if (p !== undefined) {
            p.then(function () {
                if (v.muted) {
                    _pendingUnmute = true;
                    showUnmuteHint();
                } else {
                    _autoplayUnlocked = true;
                }
            }).catch(function () {
                v.muted = true;
                v.play().then(function () {
                    _pendingUnmute = true;
                    showUnmuteHint();
                }).catch(function () {
                    showUnmuteHint();
                });
            });
        } else {
            v.muted = true;
            showUnmuteHint();
        }
    }

    function showUnmuteHint() {
        var hint = document.getElementById('unmute-hint');
        var _unmuteDone = false;

        hint.style.opacity = '1';
        hint.style.pointerEvents = 'auto';

        function doUnmute() {
            if (_unmuteDone) return;
            _unmuteDone = true;
            v.muted = false;
            v.volume = 1;
            _autoplayUnlocked = true;
            _pendingUnmute = false;
            hint.style.opacity = '0';
            setTimeout(function () { hint.style.display = 'none'; }, 300);
            hint.removeEventListener('touchend', onHintTouch);
            hint.removeEventListener('click', onHintClick);
            document.removeEventListener('touchend', onDocTouch, true);
            document.removeEventListener('click', onDocClick, true);
            haptic();
        }

        function onHintTouch(ev) {
            ev.stopPropagation();
            ev.preventDefault();
            doUnmute();
        }

        function onHintClick(ev) {
            ev.stopPropagation();
            doUnmute();
        }

        var _docListenerReady = false;
        setTimeout(function () { _docListenerReady = true; }, 600);

        function onDocTouch(ev) {
            if (!_docListenerReady) return;
            if (ev.target.id === '__hx') return;
            doUnmute();
        }

        function onDocClick(ev) {
            if (!_docListenerReady) return;
            if (ev.target.id === '__hx') return;
            doUnmute();
        }

        hint.addEventListener('touchend', onHintTouch, { passive: false });
        hint.addEventListener('click', onHintClick);
        document.addEventListener('touchend', onDocTouch, true);
        document.addEventListener('click', onDocClick, true);
    }

    function unlockOnInteraction() {
        if (_autoplayUnlocked) return;
        function tryPlay() {
            if (v.paused) {
                v.muted = true;
                v.play().then(function () { _pendingUnmute = true; showUnmuteHint(); }).catch(function () { });
            }
            document.removeEventListener('touchstart', tryPlay);
            document.removeEventListener('mousedown', tryPlay);
        }
        document.addEventListener('touchstart', tryPlay, { once: true, passive: true });
        document.addEventListener('mousedown', tryPlay, { once: true });
    }

    window.addEventListener('orientationchange', function () {
        setTimeout(function () {
            shown = false;
            showUI(true);
            var pcw = document.getElementById('player-controls-wrapper');
            if (pcw) {
                pcw.style.pointerEvents = '';
                pcw.style.opacity = '';
            }
        }, 350);
    });

    unlockOnInteraction();

    function restoreVolume() {
        try {
            var vol = parseFloat(localStorage.getItem('playerVolume'));
            if (!isNaN(vol) && vol >= 0 && vol <= 1) v.volume = vol;
        } catch (ex) { }
    }

    v.addEventListener('volumechange', function () {
        if (!v.muted) {
            try { localStorage.setItem('playerVolume', v.volume); } catch (ex) { }
        }
    });

    var retryCount = 0;
    var maxRetries = 6;
    var retryTimer = null;
    var durationPollTimer = null;

    function scheduleRetry() {
        if (retryCount >= maxRetries) return;
        retryTimer = setTimeout(function () {
            if (!isNaN(v.duration) && v.duration > 0) return;
            if (v.readyState >= 2) return;
            retryCount++;
            showBuffering();
            if (Hls.isSupported()) {
                hls.stopLoad();
                hls.startLoad();
            }
            scheduleRetry();
        }, 800);
    }

    function startDurationPoll() {
        clearInterval(durationPollTimer);
        var pollCount = 0;
        durationPollTimer = setInterval(function () {
            pollCount++;
            if (!isNaN(v.duration) && v.duration > 0) {
                clearInterval(durationPollTimer);
                tDur.textContent = fmt(v.duration);
                restoreTimestamp();
                return;
            }
            if (pollCount >= 40) {
                clearInterval(durationPollTimer);
            }
        }, 250);
    }

    var bufSpinner = document.getElementById('buffering-spinner');
    var bufferingTimeout = null;

    function showBuffering() {
        clearTimeout(bufferingTimeout);
        bufferingTimeout = setTimeout(function () {
            if (v.paused || v.readyState >= 3) return;
            bufSpinner.classList.add('active');
        }, 500);
    }

    function showBufferingImmediate() {
        clearTimeout(bufferingTimeout);
        bufSpinner.style.display = 'flex';
        bufSpinner.classList.add('active');
    }

    function hideBuffering() {
        clearTimeout(bufferingTimeout);
        bufSpinner.classList.remove('active');
        bufSpinner.style.display = '';
    }

    v.addEventListener('waiting', showBuffering);
    v.addEventListener('stalled', showBuffering);
    v.addEventListener('playing', hideBuffering);
    v.addEventListener('canplay', hideBuffering);

    v.addEventListener('error', function () {
        var errText = document.querySelector('.err-text');
        var errSub = document.querySelector('.err-sub');
        if (errText) {
            errText.innerHTML = 'Source Not Found';
        }
        if (!errSub && errText) {
            errText.insertAdjacentHTML('afterend', '<div class="err-sub">The video source could not be loaded. It may be unavailable or the URL may be incorrect.</div>');
        } else if (errSub) {
            errSub.textContent = 'The video source could not be loaded. It may be unavailable or the URL may be incorrect.';
        }
        document.getElementById('error-screen').classList.add('show');
        hideBuffering();
    });

    var isAutoQuality = true;

    function buildQualityOpts() {
        qualityOptsEl.innerHTML = '';

        var allHeights = [2160, 1080, 720, 480, 360, 240];
        var availableHeights = hls.levels.map(function (l) { return l.height; });

        allHeights.forEach(function (h) {
            var label = h === 2160 ? '4K' : h + 'p';
            var available = availableHeights.indexOf(h) !== -1;
            var levelIdx = hls.levels.findIndex ? hls.levels.findIndex(function (l) { return l.height === h; }) : -1;
            if (!hls.levels.findIndex) {
                for (var k = 0; k < hls.levels.length; k++) {
                    if (hls.levels[k].height === h) { levelIdx = k; break; }
                }
            }

            var row = document.createElement('div');
            row.className = 'quality-row' + (!available ? ' quality-row-unavail' : '');
            row.innerHTML =
                '<span class="quality-row-label">' + label + '</span>' +
                '<i class="fa-solid fa-circle-check quality-row-check"></i>';

            if (available && levelIdx >= 0) {
                row.addEventListener('click', function (e) {
                    e.stopPropagation();
                    hls.currentLevel = levelIdx;
                    isAutoQuality = false;
                    updateQualityLabel();
                    updateQualityRowUI();
                    haptic(6);
                });
            }
            qualityOptsEl.appendChild(row);
        });

        var divider = document.createElement('div');
        divider.className = 'quality-divider';
        qualityOptsEl.appendChild(divider);

        var autoRow = document.createElement('div');
        autoRow.className = 'quality-auto-row';
        autoRow.innerHTML =
            '<span class="quality-auto-label">Automatic quality</span>' +
            '<div class="settings-toggle' + (isAutoQuality ? ' on' : '') + '" id="quality-auto-toggle"><div class="settings-toggle-knob"></div></div>';
        qualityOptsEl.appendChild(autoRow);

        var hint = document.createElement('div');
        hint.className = 'quality-hint';
        hint.innerHTML = 'You can try <a class="quality-hint-link" id="quality-hint-source-link" href="#">switching source</a> to get different quality options.';
        qualityOptsEl.appendChild(hint);

        document.getElementById('quality-auto-toggle').addEventListener('click', function (e) {
            e.stopPropagation();
            isAutoQuality = !isAutoQuality;
            this.classList.toggle('on', isAutoQuality);
            if (isAutoQuality) hls.currentLevel = -1;
            updateQualityLabel();
            updateQualityRowUI();
            haptic(6);
        });

        var srcLink = document.getElementById('quality-hint-source-link');
        if (srcLink) {
            srcLink.addEventListener('click', function (e) {
                e.preventDefault();
                e.stopPropagation();
                closeSettings();
            });
        }

        updateQualityRowUI();
    }

    function updateQualityRowUI() {
        var rows = qualityOptsEl.querySelectorAll('.quality-row');
        var currentHeight = (hls.levels[hls.currentLevel] || {}).height;
        rows.forEach(function (row) {
            var label = row.querySelector('.quality-row-label').textContent;
            var rowHeight = label === '4K' ? 2160 : parseInt(label);
            var check = row.querySelector('.quality-row-check');
            var isActive = !isAutoQuality && rowHeight === currentHeight;
            row.classList.toggle('quality-row-active', isActive);
            if (check) check.style.display = isActive ? '' : 'none';
        });
        var toggle = document.getElementById('quality-auto-toggle');
        if (toggle) toggle.classList.toggle('on', isAutoQuality);
    }

    function getQualityLabelText() {
        if (!isAutoQuality) {
            var currentLevel = hls.levels[hls.currentLevel];
            if (currentLevel && currentLevel.height) {
                return currentLevel.height + 'p';
            }
            return 'Unknown';
        }
        var currentLevel = hls.levels[hls.currentLevel];
        if (currentLevel && currentLevel.height) {
            return 'Auto (' + currentLevel.height + 'p)';
        }
        return 'Auto';
    }

    function updateQualityLabel() {
        var lbl = document.getElementById('lbl-quality');
        if (lbl) lbl.textContent = getQualityLabelText();
        if (typeof updateQualityRowUI === 'function') updateQualityRowUI();
    }

    if (Hls.isSupported()) {
        var hlsConfig = {
            startLevel: -1,
            maxBufferLength: 30,
            maxMaxBufferLength: 60,
            maxBufferSize: 60 * 1000 * 1000,
            backBufferLength: 10,
            maxBufferHole: 0.5,
            frontBufferFlushThreshold: 30,
            abrEwmaDefaultEstimate: 3000000,
            abrBandWidthFactor: 0.75,
            abrBandWidthUpFactor: 0.7,
            abrEwmaFastLive: 3,
            abrEwmaSlowLive: 9,
            highBufferWatchdogPeriod: 2,
            nudgeMaxRetry: 5,
            nudgeOffset: 0.2,
            fragLoadingTimeOut: 20000,
            manifestLoadingTimeOut: 20000,
            levelLoadingTimeOut: 20000,
            testBandwidth: true,
            xhrSetup: function (xhr, url) {
                xhr.withCredentials = false;
                if (url && url.startsWith('http://missourimonster-vyla.hf.space')) {
                    url = url.replace('http://', 'https://');
                    xhr.open('GET', url, true);
                }
            },
        };
        var hls = new Hls(hlsConfig);
        showBufferingImmediate();
        hls.loadSource(src);
        hls.attachMedia(v);

        var _srcSettled = false;

        function _doFallback() {
            if (_srcSettled) return;
            _srcSettled = true;
            var nextIdx = currentSourceIndex + 1;
            if (window._fallbackSources && nextIdx < window._fallbackSources.length) {
                hls.destroy();
                currentSourceIndex = nextIdx;
                sources = window._fallbackSources;
                window._fallbackSources = sources;
                if (typeof buildSourceList === 'function') buildSourceList();
                play(sources[currentSourceIndex].url, true, id);
            }
        }

        var _stallTimer = setTimeout(function () {
            if (!_srcSettled && (isNaN(v.duration) || v.duration === 0)) {
                _doFallback();
            }
        }, 10000);

        hls.on(Hls.Events.MANIFEST_PARSED, function () {
            if (_srcSettled) return;
            _srcSettled = true;
            clearTimeout(_stallTimer);
            hideBuffering();
            buildQualityOpts();
        });

        hls.on(Hls.Events.LEVEL_SWITCHED, function () {
            if (isAutoQuality) updateQualityLabel();
        });

        hls.on(Hls.Events.LEVEL_LOADED, function () {
            if (!isNaN(v.duration) && v.duration > 0) {
                clearTimeout(retryTimer);
                retryCount = maxRetries;
            }
        });

        hls.on(Hls.Events.ERROR, function (event, data) {
            if (data.fatal) {
                if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
                    if (data.details === 'keyLoadError') return;
                    _doFallback();
                } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
                    if (!_srcSettled) hls.recoverMediaError();
                }
            }
        });

        v.addEventListener('loadedmetadata', function () {
            clearTimeout(_stallTimer);
            onReady();
            startDurationPoll();
        });

        v.addEventListener('canplay', function () {
            if (isNaN(v.duration) || v.duration === 0) return;
            clearTimeout(retryTimer);
            retryCount = maxRetries;
            tDur.textContent = fmt(v.duration);
            restoreTimestamp();
        });

    } else if (v.canPlayType('application/vnd.apple.mpegurl')) {
        showBufferingImmediate();
        v.src = src;
        v.addEventListener('loadedmetadata', function () {
            hideBuffering();
            var loaderBottomGlow = document.querySelector('.loader-bottom-glow');
            if (loaderBottomGlow) {
                loaderBottomGlow.classList.add('video-playing');
            }
            onReady();
            startDurationPoll();
        });
        v.addEventListener('canplay', function () {
            if (isNaN(v.duration) || v.duration === 0) return;
            tDur.textContent = fmt(v.duration);
            restoreTimestamp();
        });
    }

    if (savedSpeed !== 1) {
        speedOpts.forEach(function (btn) {
            if (parseFloat(btn.dataset.speed) === savedSpeed) {
                updateListActive('speed-opts', btn, 'lbl-speed', btn.textContent.trim());
            }
        });
    }

    var PROXY = baseURL + '/api/proxy?url=';
    var vylaEndpoint = s
        ? (baseURL + '/api/subtitles/tv/' + id + '/' + s + '/' + (e || '1'))
        : (baseURL + '/api/subtitles/movie/' + id);

    document.getElementById('lbl-subtitle').textContent = 'Loading\u2026';

    var inlineEl = document.getElementById('sub-entries-inline');
    if (inlineEl) inlineEl.innerHTML = '<div class="sub-skeleton">' +
        '<div class="sub-skel-item"></div>' +
        '<div class="sub-skel-item"></div>' +
        '<div class="sub-skel-item"></div>' +
        '</div>';

    function _toSec(str) {
        str = str.trim().split(' ')[0].replace(',', '.');
        var p = str.split(':');
        if (p.length === 2) return +p[0] * 60 + +p[1];
        return +p[0] * 3600 + +p[1] * 60 + +p[2];
    }

    function _stripTags(s) {
        return s.replace(/<[^>]+>/g, '').replace(/\{[^}]+\}/g, '').trim();
    }

    function parseVTT(text) {
        var cues = [];
        text.trim().split(/\n\s*\n/).forEach(function (block) {
            var lines = block.trim().split('\n');
            var ti = -1;
            for (var i = 0; i < lines.length; i++) {
                if (lines[i].includes('-->')) { ti = i; break; }
            }
            if (ti < 0) return;
            var parts = lines[ti].split('-->');
            var txt = lines.slice(ti + 1).map(_stripTags).join('\n').trim();
            if (txt) cues.push({ start: _toSec(parts[0]), end: _toSec(parts[1]), text: txt });
        });
        return cues;
    }

    function parseSRT(text) {
        var cues = [];
        text.trim().split(/\n\s*\n/).forEach(function (block) {
            var lines = block.trim().split('\n');
            var ti = -1;
            for (var i = 0; i < lines.length; i++) {
                if (lines[i].includes('-->')) { ti = i; break; }
            }
            if (ti < 0) return;
            var parts = lines[ti].split('-->');
            var txt = lines.slice(ti + 1).map(_stripTags).join('\n').trim();
            if (txt) cues.push({ start: _toSec(parts[0]), end: _toSec(parts[1]), text: txt });
        });
        return cues;
    }

    function parseCues(text) {
        var t = text.trim();
        var cues = parseVTT(t);
        if (!cues.length) cues = parseSRT(t);
        return cues;
    }

    function findCue(cues, t) {
        var lo = 0, hi = cues.length - 1;
        while (lo <= hi) {
            var mid = (lo + hi) >> 1;
            var c = cues[mid];
            if (t < c.start) { hi = mid - 1; }
            else if (t > c.end) { lo = mid + 1; }
            else { return c.text; }
        }
        return '';
    }

    var _lastCueText = null;

    function onSubTimeUpdate() {
        if (subState.activeTrack < 0 || !subState.cues.length) {
            if (_lastCueText !== '') {
                subtitleText.textContent = '';
                _lastCueText = '';
            }
            return;
        }
        var found = findCue(subState.cues, v.currentTime);
        if (found !== _lastCueText) {
            subtitleText.textContent = found;
            _lastCueText = found;
        }
    }

    v.addEventListener('timeupdate', onSubTimeUpdate);

    if (subState.cueTimer) {
        clearInterval(subState.cueTimer);
        subState.cueTimer = null;
    }

    function fetchSub(url) {
        return fetch(url)
            .then(function (r) {
                if (!r.ok) throw new Error('HTTP ' + r.status);
                return r.text();
            })
            .then(function (text) {
                var t = text.trim();
                if (t.length < 10) throw new Error('empty');
                if (t.startsWith('#EXTM3U')) throw new Error('HLS');
                if (t.startsWith('{') || t.startsWith('[')) throw new Error('JSON');
                var cues = parseCues(t);
                if (!cues.length) throw new Error('no cues');
                return cues;
            })
            .catch(function (err) {
                var proxyUrl = PROXY + encodeURIComponent(url);
                return fetch(proxyUrl)
                    .then(function (r) {
                        if (!r.ok) throw new Error('HTTP ' + r.status);
                        return r.text();
                    })
                    .then(function (text) {
                        var t = text.trim();
                        if (t.length < 10) throw new Error('empty');
                        if (t.startsWith('#EXTM3U')) throw new Error('HLS');
                        if (t.startsWith('{') || t.startsWith('[')) throw new Error('JSON');
                        var cues = parseCues(t);
                        if (!cues.length) throw new Error('no cues');
                        return cues;
                    })
                    .catch(function (proxyErr) {
                        throw proxyErr;
                    });
            });
    }

    document.getElementById('lbl-subtitle').textContent = 'Off';

    fetch(vylaEndpoint)
        .then(function (r) {
            var ct = r.headers.get('Content-Type') || '';
            if (!ct.includes('application/json')) throw new Error('not json');
            return r.json();
        })
        .then(function (d) {
            var subs = Array.isArray(d) ? d : (d.subtitles || []);
            subs = subs.filter(function (s) { return s && (s.file || s.url) && s.label; });

            var inlineEl = document.getElementById('sub-entries-inline');

            if (!subs.length) {
                if (inlineEl) inlineEl.innerHTML =
                    '<div style="padding:20px;text-align:center;color:rgba(255,255,255,0.3);font-size:14px;">None available</div>';
                return;
            }

            window.availableSubtitles = subs;

            var groups = {};
            subs.forEach(function (sub, i) {
                sub._idx = i;
                var lang = sub.label || 'Unknown';
                var base = lang.replace(/\d+$/, '').trim();
                base = base.split(' ')[0];
                if (!groups[base]) groups[base] = { label: base, subs: [] };
                groups[base].subs.push(sub);
            });

            window._buildLangGroups = function () {
                if (!inlineEl) return;
                inlineEl.innerHTML = '';
                inlineEl.style.display = '';
                Object.keys(groups).forEach(function (lang) {
                    var g = groups[lang];
                    var code = getLangCode(g.label);
                    var row = document.createElement('div');
                    row.className = 'sub-lang-group-item';
                    row.innerHTML =
                        flagImg(code) +
                        '<span class="slg-name">' + g.label + '</span>' +
                        '<span class="slg-count">' + g.subs.length + '</span>' +
                        '<i class="fa-solid fa-chevron-right slg-chevron"></i>';
                    row.addEventListener('click', function () {
                        haptic(6);
                        showSubEntries(g.label, g.subs, code);
                    });
                    inlineEl.appendChild(row);
                });
            };

            window._buildLangGroups();

            document.getElementById('sub-off-row').addEventListener('click', function () {
                subState.activeTrack = -1;
                subState.cues = [];
                subtitleText.textContent = '';
                _lastCueText = '';
                document.getElementById('lbl-subtitle').textContent = 'Off';
                document.getElementById('sub-off-check').style.display = 'flex';
                var mainToggle = document.getElementById('subtitle-toggle');
                if (mainToggle) mainToggle.classList.remove('on');
                haptic(6);
            });
        })
        .catch(function () {
            document.getElementById('lbl-subtitle').textContent = 'Off';
        });

    function showSubEntries(langLabel, subs, code) {
        var inlineEl = document.getElementById('sub-entries-inline');
        if (!inlineEl) return;
        inlineEl.innerHTML = '';

        var specialList = document.querySelector('#sub-lang-group-view .sub-special-list');
        var sectionDivider = document.getElementById('sub-section-divider');
        var svshTitle = document.querySelector('#sub-lang-group-view .svsh-title');
        var customizeBtn = document.getElementById('sub-customize-open-btn');
        var svshBack = document.querySelector('#sub-lang-group-view .svsh-back');

        if (specialList) specialList.style.display = 'none';
        if (sectionDivider) sectionDivider.style.display = 'none';
        if (customizeBtn) customizeBtn.style.display = 'none';

        var titleCode = code || getLangCode(langLabel);
        if (svshTitle) {
            svshTitle.innerHTML = (titleCode ? '<img class="slg-flag" src="https://flagcdn.com/20x15/' + titleCode + '.png" width="20" height="15" style="border-radius:2px;object-fit:cover;vertical-align:middle;margin-right:6px;">' : '') + langLabel;
        }

        var _origBack = null;
        if (svshBack) {
            _origBack = svshBack.cloneNode(true);
            svshBack.replaceWith(_origBack);
            _origBack.addEventListener('click', function () {
                inlineEl.innerHTML = '';
                if (specialList) specialList.style.display = '';
                if (sectionDivider) sectionDivider.style.display = '';
                if (customizeBtn) customizeBtn.style.display = '';
                if (svshTitle) svshTitle.textContent = 'Subtitles';
                window._buildLangGroups();
                var newBack = document.querySelector('#sub-lang-group-view .svsh-back');
                if (newBack) {
                    newBack.addEventListener('click', function () {
                        showSettingsView('main');
                        haptic(6);
                    });
                }
                haptic(6);
            });
        }

        subs.forEach(function (sub) {
            var row = document.createElement('div');
            row.className = 'sub-entry-row';
            var url = sub.file || sub.url || '';
            var shortUrl = url.replace(/^https?:\/\//, '').substring(0, 28) + (url.length > 28 ? '\u2026' : '');
            var fmtLabel = (sub.format || (url.toLowerCase().includes('.srt') ? 'srt' : 'vtt')).toUpperCase();
            var srcName = sub.source || '';
            var entryCode = code || getLangCode(langLabel);
            var entryFlag = entryCode
                ? '<img src="https://flagcdn.com/20x15/' + entryCode + '.png" width="26" height="20" style="border-radius:3px;object-fit:cover;flex-shrink:0;" alt="">'
                : '<i class="fa-solid fa-globe" style="font-size:13px;color:var(--white-45);width:26px;text-align:center;"></i>';
            row.innerHTML =
                entryFlag +
                '<div class="se-info">' +
                '<span class="se-url">' + shortUrl + '</span>' +
                '<div class="se-badges">' +
                '<span class="fmt-badge">' + fmtLabel + '</span>' +
                (srcName ? '<span class="fmt-badge se-src-badge">' + srcName.toUpperCase() + '</span>' : '') +
                '</div></div>' +
                '<i class="fa-solid fa-language se-lang-icon"></i>';

            row.addEventListener('mouseenter', function () { this.style.background = 'rgba(255,255,255,0.06)'; });
            row.addEventListener('mouseleave', function () {
                if (!this.dataset.active) this.style.background = '';
            });

            row.addEventListener('click', function () {
                row.style.opacity = '0.5';
                fetchSub(url)
                    .then(function (cues) {
                        inlineEl.querySelectorAll('.sub-entry-row').forEach(function (el) {
                            el.removeAttribute('data-active');
                            el.style.background = '';
                        });
                        row.setAttribute('data-active', '1');
                        row.style.background = 'rgba(255,255,255,0.1)';
                        row.style.opacity = '';
                        subState.activeTrack = sub._idx;
                        subState.cues = cues;
                        _lastCueText = null;
                        document.getElementById('lbl-subtitle').textContent = langLabel;
                        var offCheck = document.getElementById('sub-off-check');
                        if (offCheck) offCheck.style.display = 'none';
                        var mainToggle = document.getElementById('subtitle-toggle');
                        if (mainToggle) mainToggle.classList.add('on');
                        haptic(6);
                        closeSettings();
                    })
                    .catch(function () {
                        row.style.opacity = '';
                    });
            });

            inlineEl.appendChild(row);
        });

        inlineEl.style.display = '';
    }

    function openSettings() {
        settingsOpen = true;
        showSettingsView('main');
        document.getElementById('settings-modal-wrap').classList.add('open');
        document.getElementById('settings-overlay-backdrop').classList.add('open');
        showUI(true);
        haptic(10);
    }

    function closeSettings() {
        settingsOpen = false;
        document.getElementById('settings-modal-wrap').classList.remove('open');
        document.getElementById('settings-overlay-backdrop').classList.remove('open');
        if (!v.paused) {
            clearTimeout(hideTimer);
            hideTimer = setTimeout(hideUI, 3200);
        }
    }

    function showSettingsView(name) {
        document.querySelectorAll('.settings-view').forEach(function (el) {
            el.classList.remove('active');
            el.style.display = 'none';
        });
        var target = document.getElementById('settings-view-' + name);
        if (target) {
            target.style.display = 'flex';
            target.classList.add('active');
            if (name === 'subtitles') {
                document.getElementById('sub-lang-group-view').style.display = 'flex';
                document.getElementById('sub-custom-view').style.display = 'none';
            }
        }
    }

    btnSettings.addEventListener('click', function (e) {
        e.stopPropagation();
        e.stopImmediatePropagation();
        settingsOpen ? closeSettings() : openSettings();
    });

    document.getElementById('settings-close-btn').addEventListener('click', function (e) {
        e.stopPropagation();
        closeSettings();
    });

    document.getElementById('settings-overlay-backdrop').addEventListener('click', function () {
        closeSettings();
    });

    document.getElementById('main-watchparty-btn').addEventListener('click', function (e) {
        e.stopPropagation();
        showSettingsView('watchparty');
        haptic(6);
    });

    document.getElementById('main-segment-btn').addEventListener('click', function (e) {
        e.stopPropagation();
        showSettingsView('segments');
        haptic(6);
        initSegmentsView();
    });

    var _segmentsData = null;
    var _segmentsLoaded = false;

    function initSegmentsView() {
        var cont = document.getElementById('seg-content');
        if (_segmentsLoaded) {
            renderSegmentsView();
            return;
        }
        cont.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;padding:40px 0;"><svg width="32" height="32" viewBox="0 0 52 52" style="animation:_vyla_spin 0.9s linear infinite"><circle cx="26" cy="26" r="22" fill="none" stroke="rgba(255,255,255,0.4)" stroke-width="3.5" stroke-dasharray="100" stroke-dashoffset="70"/></svg></div>';
        var tmdbId = id;
        var apiUrl = 'https://api.theintrodb.org/v2/media?tmdb_id=' + tmdbId;
        if (s) apiUrl += '&season=' + s + '&episode=' + (e || '1');
        fetch(apiUrl)
            .then(function (r) { return r.json(); })
            .then(function (d) {
                _segmentsData = d;
                _segmentsLoaded = true;
                renderSegmentsView();
                setupSkipButtons();
            })
            .catch(function () {
                _segmentsLoaded = true;
                _segmentsData = null;
                renderSegmentsView();
            });
    }

    var _skipSegments = [];

    function msToFmt(ms) {
        if (ms == null) return '0';
        var s = Math.floor(ms / 1000);
        var m = Math.floor(s / 60);
        s = s % 60;
        return m + ':' + (s < 10 ? '0' : '') + s;
    }

    var segTypeConfig = {
        intro: { label: 'Intro', icon: 'fa-clapperboard', color: 'var(--white)', btnLabel: 'Skip Intro' },
        recap: { label: 'Recap', icon: 'fa-clock-rotate-left', color: 'var(--white)', btnLabel: 'Skip Recap' },
        credits: { label: 'Credits', icon: 'fa-film', color: 'var(--white)', btnLabel: 'Skip Credits' },
        preview: { label: 'Preview', icon: 'fa-forward', color: 'var(--white)', btnLabel: 'Skip Preview' }
    };

    function renderSegmentsView() {
        var cont = document.getElementById('seg-content');

        if (!_segmentsData) {
            cont.innerHTML =
                '<div class="seg-empty">' +
                '<div class="seg-empty-icon"><i class="fa-solid fa-film"></i></div>' +
                '<div class="seg-empty-title">No segments found</div>' +
                '<div class="seg-empty-desc">No skip segments are available for this title yet.</div>' +
                '</div>';
            return;
        }

        var types = ['intro', 'recap', 'credits', 'preview'];
        var found = [];

        types.forEach(function (t) {
            var arr = _segmentsData[t];
            if (arr && arr.length) {
                arr.forEach(function (seg, idx) {
                    if (seg.start_ms != null || seg.end_ms != null) {
                        found.push({ type: t, seg: seg, idx: idx });
                    }
                });
            }
        });

        if (!found.length) {
            cont.innerHTML =
                '<div class="seg-empty">' +
                '<div class="seg-empty-title">No skip segments</div>' +
                '<div class="seg-empty-desc">This title has no skippable segments in the database.</div>' +
                '</div>';
            return;
        }

        var html = '<div class="seg-list">';

        found.forEach(function (item) {
            var cfg = segTypeConfig[item.type] || { label: item.type, icon: 'fa-forward', color: '#888' };
            var seg = item.seg;
            var startStr = msToFmt(seg.start_ms);
            var endStr = msToFmt(seg.end_ms);

            html +=
                '<div class="seg-item">' +
                '<div class="seg-icon" style="background:' + cfg.color + '20;">' +
                '<i class="fa-solid ' + cfg.icon + '" style="color:' + cfg.color + ';"></i>' +
                '</div>' +
                '<div class="seg-info">' +
                '<div class="seg-label">' +
                cfg.label +
                (found.filter(function (f) { return f.type === item.type; }).length > 1 ? ' ' + (item.idx + 1) : '') +
                '</div>' +
                '<div class="seg-time">' + startStr + ' - ' + endStr + '</div>' +
                '</div>' +
                '</div>';
        });

        html += '</div>';
        cont.innerHTML = html;
    }

    function setupSkipButtons() {
        if (!_segmentsData) return;
        _skipSegments = [];
        var types = ['intro', 'recap', 'credits', 'preview'];
        types.forEach(function (t) {
            var arr = _segmentsData[t];
            if (!arr || !arr.length) return;
            arr.forEach(function (seg) {
                if (seg.start_ms != null || seg.end_ms != null) {
                    var cfg = segTypeConfig[t] || { btnLabel: 'Skip' };
                    _skipSegments.push({
                        start: seg.start_ms != null ? seg.start_ms / 1000 : 0,
                        end: seg.end_ms != null ? seg.end_ms / 1000 : (v.duration || 0),
                        label: cfg.btnLabel
                    });
                }
            });
        });

        var skipBtn = document.getElementById('skip-segment-btn');
        var skipLbl = document.getElementById('skip-segment-label');

        v.addEventListener('timeupdate', function () {
            if (!_skipSegments.length) return;
            var ct = v.currentTime;
            var active = null;
            for (var i = 0; i < _skipSegments.length; i++) {
                var seg = _skipSegments[i];
                if (ct >= seg.start && ct < seg.end) { active = seg; break; }
            }
            if (active) {
                skipLbl.textContent = active.label;
                skipBtn.classList.add('show');
                skipBtn._activeSeg = active;
            } else {
                skipBtn.classList.remove('show');
                skipBtn._activeSeg = null;
            }
        });

        skipBtn.addEventListener('click', function () {
            var seg = this._activeSeg;
            if (seg) {
                v.currentTime = seg.end;
                haptic(6);
            }
        });

        function updateSegmentEndTimes() {
            if (v.duration && v.duration > 0) {
                _skipSegments.forEach(function (seg) {
                    if (seg.end === 0) {
                        seg.end = v.duration;
                    }
                });
            }
        }

        v.addEventListener('loadedmetadata', updateSegmentEndTimes);
        v.addEventListener('durationchange', updateSegmentEndTimes);
    }

    (function () {
        initSegmentsView();
    })();

    (function () {
        var wpState = {
            active: false,
            isHost: false,
            roomCode: null,
            peer: null,
            connections: [],
            hostConn: null,
            overlayOn: false,
            members: 1,
            syncInterval: null,
            lockControls: false,
            disconnected: false,
            lastRoomCode: null
        };

        var wpMainView = document.getElementById('wp-main-view');
        var wpJoinView = document.getElementById('wp-join-view');
        var wpHostingView = document.getElementById('wp-hosting-view');
        var wpHostBtn = document.getElementById('wp-host-btn');
        var wpJoinBtn = document.getElementById('wp-join-btn');
        var wpJoinCancelBtn = document.getElementById('wp-join-cancel-btn');
        var wpJoinConfirmBtn = document.getElementById('wp-join-confirm-btn');
        var wpCodeInput = document.getElementById('wp-code-input');
        var wpRoomCode = document.getElementById('wp-room-code');
        var wpLeaveBtn = document.getElementById('wp-leave-btn');
        var wpReconnectBtn = document.getElementById('wp-reconnect-btn');
        var wpCodeDisplay = document.getElementById('wp-code-display');
        var wpMembersList = document.getElementById('wp-members-list');
        var wpOverlayToggle = document.getElementById('wp-overlay-toggle');
        var wpBackendLabel = document.getElementById('wp-backend-label');
        var wpBackendName = document.getElementById('wp-backend-name');

        if (wpBackendLabel) wpBackendLabel.textContent = 'P2P via WebRTC (PeerJS)';
        if (wpBackendName) wpBackendName.textContent = 'PeerJS';

        function genCode() {
            var chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
            var code = '';
            for (var i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
            return code;
        }

        function showWpView(name) {
            wpMainView.style.display = 'none';
            wpJoinView.style.display = 'none';
            wpHostingView.style.display = 'none';
            if (name === 'main') wpMainView.style.display = 'flex';
            else if (name === 'join') wpJoinView.style.display = 'flex';
            else if (name === 'hosting') wpHostingView.style.display = 'flex';
        }

        function updateMembersLabel() {
            if (wpMembersList) {
                if (wpState.members <= 1) {
                    wpMembersList.textContent = '\u25b8 Alone — share the code!';
                } else {
                    wpMembersList.textContent = '\u25b8 ' + wpState.members + ' watching together';
                }
            }
        }

        function setGuestLock(locked) {
            wpState.lockControls = locked;
            var lockBanner = document.getElementById('wp-guest-lock-banner');
            if (locked) {
                if (!lockBanner) {
                    lockBanner = document.createElement('div');
                    lockBanner.id = 'wp-guest-lock-banner';
                    lockBanner.style.cssText = 'position:absolute;bottom:72px;left:50%;transform:translateX(-50%);z-index:28;background:rgba(0,0,0,0.72);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);border-radius:100px;padding:7px 18px;font-size:12px;font-weight:600;color:rgba(255,255,255,0.7);pointer-events:none;white-space:nowrap;display:flex;align-items:center;gap:7px;';
                    lockBanner.innerHTML = '<i class="fa-solid fa-lock" style="font-size:11px;"></i> Host controls playback';
                    document.getElementById('player').appendChild(lockBanner);
                }
                lockBanner.style.display = 'flex';
                var btnPlay = document.getElementById('btn-play');
                if (btnPlay) btnPlay.style.opacity = '0.35';
                var trackWrap = document.getElementById('track-wrap');
                if (trackWrap) trackWrap.style.pointerEvents = 'none';
            } else {
                if (lockBanner) lockBanner.style.display = 'none';
                var btnPlay = document.getElementById('btn-play');
                if (btnPlay) btnPlay.style.opacity = '';
                var trackWrap = document.getElementById('track-wrap');
                if (trackWrap) trackWrap.style.pointerEvents = '';
            }
        }

        function broadcastToGuests(msg) {
            wpState.connections.forEach(function (conn) {
                if (conn.open) {
                    try { conn.send(msg); } catch (ex) { }
                }
            });
        }

        function applyRemoteEvent(msg) {
            if (!msg || !msg.type) return;
            if (msg.type === 'play') {
                if (Math.abs(v.currentTime - msg.time) > 0.5) v.currentTime = msg.time;
                v.play().catch(function () { });
            } else if (msg.type === 'pause') {
                if (Math.abs(v.currentTime - msg.time) > 0.5) v.currentTime = msg.time;
                v.pause();
            } else if (msg.type === 'seek') {
                v.currentTime = msg.time;
            } else if (msg.type === 'sync') {
                var diff = v.currentTime - msg.time;
                if (!v.paused && Math.abs(diff) > 1.5) {
                    v.currentTime = msg.time;
                }
                if (msg.paused && !v.paused) v.pause();
                if (!msg.paused && v.paused) v.play().catch(function () { });
            } else if (msg.type === 'member_count') {
                wpState.members = msg.count;
                updateMembersLabel();
                updateWatchPartyOverlay();
            }
        }

        function attachHostVideoListeners() {
            v.addEventListener('play', function () {
                var icon = document.getElementById('play-btn-icon');
                if (icon) icon.className = 'fa-solid fa-pause';
            });
            v.addEventListener('pause', function () {
                var icon = document.getElementById('play-btn-icon');
                if (icon) icon.className = 'fa-solid fa-play';
            });
            v.addEventListener('seeked', function () {
                if (!wpState.active || !wpState.isHost) return;
                broadcastToGuests({ type: 'seek', time: v.currentTime });
            });
        }

        attachHostVideoListeners();

        function startSyncInterval() {
            clearInterval(wpState.syncInterval);
            wpState.syncInterval = setInterval(function () {
                if (!wpState.active || !wpState.isHost) return;
                broadcastToGuests({ type: 'sync', time: v.currentTime, paused: v.paused });
            }, 5000);
        }

        function initPeer(peerId, onReady) {
            if (typeof Peer === 'undefined') {
                var script = document.createElement('script');
                script.src = 'https://unpkg.com/peerjs@1.5.2/dist/peerjs.min.js';
                script.onload = function () { createPeer(peerId, onReady); };
                script.onerror = function () {
                    showWpError('Failed to load PeerJS. Check your connection.');
                };
                document.head.appendChild(script);
            } else {
                createPeer(peerId, onReady);
            }
        }

        function createPeer(peerId, onReady) {
            if (wpState.peer) {
                try { wpState.peer.destroy(); } catch (ex) { }
            }
            var peer = new Peer(peerId, { debug: 0 });
            wpState.peer = peer;

            peer.on('open', function (id) {
                onReady(id);
            });

            peer.on('error', function (err) {
                var msg = err.type === 'unavailable-id'
                    ? 'Room code already in use. Try a different one.'
                    : err.type === 'peer-unavailable'
                        ? 'Room not found. Check the code and try again.'
                        : 'Connection error: ' + (err.message || err.type);
                showWpError(msg);
                leaveParty();
            });

            peer.on('connection', function (conn) {
                conn.on('open', function () {
                    wpState.connections.push(conn);
                    wpState.members = 1 + wpState.connections.length;
                    updateMembersLabel();
                    updateWatchPartyOverlay();
                    broadcastToGuests({ type: 'member_count', count: wpState.members });
                    conn.send({ type: 'sync', time: v.currentTime, paused: v.paused });
                });
                conn.on('data', function (msg) { });
                conn.on('close', function () {
                    wpState.connections = wpState.connections.filter(function (c) { return c !== conn; });
                    wpState.members = 1 + wpState.connections.length;
                    updateMembersLabel();
                    updateWatchPartyOverlay();
                    broadcastToGuests({ type: 'member_count', count: wpState.members });
                });
                conn.on('error', function () {
                    wpState.connections = wpState.connections.filter(function (c) { return c !== conn; });
                    wpState.members = 1 + wpState.connections.length;
                    updateMembersLabel();
                });
            });
        }

        function showWpError(msg) {
            var err = document.getElementById('wp-error-msg');
            if (!err) {
                err = document.createElement('div');
                err.id = 'wp-error-msg';
                err.style.cssText = 'font-size:13px;color:#ff6b6b;text-align:center;padding:10px 16px;line-height:1.5;';
                wpMainView.insertBefore(err, wpMainView.firstChild);
            }
            err.textContent = msg;
            err.style.display = 'block';
            setTimeout(function () { if (err) err.style.display = 'none'; }, 5000);
        }

        function setWpBtnLoading(btn, loading, text) {
            btn.disabled = loading;
            btn.textContent = loading ? 'Connecting\u2026' : text;
        }

        function startHosting() {
            var code = genCode();
            var peerId = 'vyla-wp-' + code;
            setWpBtnLoading(wpHostBtn, true, 'Host a Watch Party');
            initPeer(peerId, function (id) {
                setWpBtnLoading(wpHostBtn, false, 'Host a Watch Party');
                wpState.active = true;
                wpState.isHost = true;
                wpState.roomCode = code;
                wpState.members = 1;
                wpState.connections = [];
                if (wpRoomCode) wpRoomCode.textContent = code;
                updateMembersLabel();
                showWpView('hosting');
                updateWatchPartyOverlay();
                startSyncInterval();
                setGuestLock(false);
            });
        }

        function joinParty(code) {
            var cleanCode = code.toUpperCase().trim();
            var peerId = 'vyla-wp-guest-' + Math.random().toString(36).slice(2, 8);
            var hostPeerId = 'vyla-wp-' + cleanCode;
            setWpBtnLoading(wpJoinConfirmBtn, true, 'Join');
            initPeer(peerId, function () {
                var conn = wpState.peer.connect(hostPeerId, { reliable: true });
                wpState.hostConn = conn;
                var connTimeout = setTimeout(function () {
                    setWpBtnLoading(wpJoinConfirmBtn, false, 'Join');
                    showWpError('Could not reach that room. Is the code correct?');
                    showWpView('join');
                }, 10000);

                conn.on('open', function () {
                    clearTimeout(connTimeout);
                    setWpBtnLoading(wpJoinConfirmBtn, false, 'Join');
                    wpState.active = true;
                    wpState.isHost = false;
                    wpState.roomCode = cleanCode;
                    wpState.lastRoomCode = cleanCode;
                    wpState.disconnected = false;
                    wpState.members = 2;
                    if (wpRoomCode) wpRoomCode.textContent = cleanCode;
                    updateMembersLabel();
                    showWpView('hosting');
                    updateWatchPartyOverlay();
                    setGuestLock(true);
                    if (wpReconnectBtn) {
                        wpReconnectBtn.style.display = 'none';
                    }
                    if (wpLeaveBtn) {
                        wpLeaveBtn.style.display = 'block';
                    }
                });

                conn.on('data', function (msg) {
                    applyRemoteEvent(msg);
                });

                conn.on('close', function () {
                    if (!wpState.active) return;
                    wpState.disconnected = true;
                    wpState.lastRoomCode = wpState.roomCode;
                    showWpError('Host disconnected.');
                    if (wpReconnectBtn) {
                        wpReconnectBtn.style.display = 'block';
                    }
                    if (wpLeaveBtn) {
                        wpLeaveBtn.style.display = 'none';
                    }
                });

                conn.on('error', function () {
                    clearTimeout(connTimeout);
                    setWpBtnLoading(wpJoinConfirmBtn, false, 'Join');
                    showWpError('Could not reach that room. Is the code correct?');
                    showWpView('join');
                });
            });
        }

        function leaveParty() {
            clearInterval(wpState.syncInterval);
            wpState.syncInterval = null;
            if (wpState.hostConn) {
                try { wpState.hostConn.close(); } catch (ex) { }
                wpState.hostConn = null;
            }
            wpState.connections.forEach(function (c) { try { c.close(); } catch (ex) { } });
            wpState.connections = [];
            if (wpState.peer) {
                try { wpState.peer.destroy(); } catch (ex) { }
                wpState.peer = null;
            }
            wpState.active = false;
            wpState.isHost = false;
            wpState.roomCode = null;
            wpState.members = 1;
            wpState.disconnected = false;
            wpState.lastRoomCode = null;
            setGuestLock(false);
            if (wpReconnectBtn) {
                wpReconnectBtn.style.display = 'none';
            }
            if (wpLeaveBtn) {
                wpLeaveBtn.style.display = 'block';
            }
            showWpView('main');
            updateWatchPartyOverlay();
        }

        function updateWatchPartyOverlay() {
            var existing = document.getElementById('wp-status-overlay');
            if (!wpState.active) {
                if (existing) existing.style.display = 'none';
                return;
            }
            if (!existing) {
                existing = document.createElement('div');
                existing.id = 'wp-status-overlay';
                existing.style.cssText = 'position:absolute;top:10px;right:10px;z-index:25;background:rgba(0,0,0,0.7);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);border-radius:12px;padding:8px 14px;display:flex;flex-direction:column;gap:3px;pointer-events:none;min-width:140px;';
                document.getElementById('player').appendChild(existing);
            }
            if (!wpState.overlayOn) {
                existing.style.display = 'none';
                return;
            }
            existing.style.display = '';
            existing.innerHTML =
                '<div style="display:flex;align-items:center;gap:7px;">' +
                '<i class="fa-solid fa-podcast" style="font-size:11px;color:var(--white);"></i>' +
                '<span style="font-size:12px;font-weight:700;color:rgba(255,255,255,0.9);">' + (wpState.isHost ? 'Hosting' : 'Watching') + '</span>' +
                '<span style="font-size:13px;font-weight:700;color:var(--white);letter-spacing:0.08em;">' + wpState.roomCode + '</span>' +
                '</div>' +
                '<div style="font-size:11px;color:rgba(255,255,255,0.55);">\u25b8 ' + (wpState.members <= 1 ? 'Alone' : wpState.members + ' watching') + '</div>';
        }

        wpHostBtn.addEventListener('click', function () { startHosting(); haptic(6); });

        wpJoinBtn.addEventListener('click', function () {
            showWpView('join');
            wpCodeInput.value = '';
            setTimeout(function () { wpCodeInput.focus(); }, 120);
            haptic(6);
        });

        wpJoinCancelBtn.addEventListener('click', function () { showWpView('main'); haptic(6); });

        wpJoinConfirmBtn.addEventListener('click', function () {
            var code = wpCodeInput.value.trim();
            if (!code) return;
            joinParty(code);
            haptic(6);
        });

        wpCodeInput.addEventListener('keydown', function (e) {
            if (e.key === 'Enter') { wpJoinConfirmBtn.click(); }
        });

        wpLeaveBtn.addEventListener('click', function () { leaveParty(); haptic(6); });

        if (wpReconnectBtn) {
            wpReconnectBtn.addEventListener('click', function () {
                if (wpState.disconnected && wpState.lastRoomCode) {
                    wpState.disconnected = false;
                    if (wpReconnectBtn) {
                        wpReconnectBtn.style.display = 'none';
                    }
                    if (wpLeaveBtn) {
                        wpLeaveBtn.style.display = 'block';
                    }

                    wpCodeInput.value = wpState.lastRoomCode;
                    wpJoinConfirmBtn.click();
                }
                haptic(6);
            });
        }

        wpCodeDisplay.addEventListener('click', function () {
            var link = location.origin + location.pathname + location.search + '&wp=' + wpState.roomCode;
            if (navigator.clipboard) {
                navigator.clipboard.writeText(link).then(function () {
                    var icon = wpCodeDisplay.querySelector('i');
                    if (icon) { icon.className = 'fa-solid fa-check'; setTimeout(function () { icon.className = 'fa-solid fa-copy'; }, 1500); }
                }).catch(function () { });
            }
            haptic(6);
        });

        var btnSubShortcut = document.getElementById('btn-subtitles-shortcut');
        if (btnSubShortcut) {
            btnSubShortcut.addEventListener('click', function (e) {
                e.stopPropagation();
                openSettings();
                showSettingsView('subtitles');
            });
        }

        wpOverlayToggle.addEventListener('click', function () {
            wpState.overlayOn = !wpState.overlayOn;
            this.classList.toggle('on', wpState.overlayOn);
            updateWatchPartyOverlay();
            haptic(6);
        });

        document.addEventListener('keydown', function (e) {
            if (!wpState.lockControls) return;
            if (e.key === ' ' || e.key === 'k' || e.key === 'K') { e.stopImmediatePropagation(); e.preventDefault(); }
            if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.stopImmediatePropagation(); e.preventDefault(); }
        }, true);

        document.getElementById('settings-view-watchparty').addEventListener('click', function (e) {
            e.stopPropagation();
        });

        var hashWp = (location.hash.match(/wp=([A-Z0-9]+)/) || [])[1] || (new URLSearchParams(location.search).get('wp') || null);
        if (hashWp) {
            setTimeout(function () {
                document.getElementById('main-watchparty-btn') && document.getElementById('main-watchparty-btn').click();
                wpCodeInput.value = hashWp;
                wpJoinBtn.click();
                setTimeout(function () { wpCodeInput.value = hashWp; wpJoinConfirmBtn.click(); }, 200);
            }, 1500);
        }
    })();

    document.querySelector('.settings-tile[data-nav="sources"]').addEventListener('click', function (e) {
        e.stopPropagation();
        showSettingsView('sources');
        haptic(6);
    });

    document.querySelector('.settings-tile[data-nav="quality"]').addEventListener('click', function (e) {
        e.stopPropagation();
        showSettingsView('quality');
        haptic(6);
    });

    document.querySelector('.settings-tile[data-nav="subtitles"]').addEventListener('click', function (e) {
        e.stopPropagation();
        showSettingsView('subtitles');
        haptic(6);
    });

    document.querySelector('.settings-tile[data-nav="video"]').addEventListener('click', function (e) {
        e.stopPropagation();
        showSettingsView('video');
        haptic(6);
    });

    document.querySelectorAll('.settings-back-btn').forEach(function (btn) {
        if (btn.id === 'sub-main-back-btn') return;
        btn.addEventListener('click', function (e) {
            e.stopPropagation();
            showSettingsView('main');
            haptic(6);
        });
    });

    var subtitleToggleEl = document.getElementById('subtitle-toggle');
    if (subtitleToggleEl) {
        subtitleToggleEl.addEventListener('click', function (e) {
            e.stopPropagation();
            if (subState.activeTrack >= 0) {
                subState.activeTrack = -1;
                subState.cues = [];
                subtitleText.textContent = '';
                _lastCueText = '';
                subtitleToggleEl.classList.remove('on');
                document.getElementById('lbl-subtitle').textContent = 'Off';

                var offItem = document.querySelector('.sub-off-item');
                if (offItem) {
                    document.querySelectorAll('.sub-special-item, .sub-lang-item').forEach(function (x) {
                        x.classList.remove('active-sub-item');
                        var check = x.querySelector('.sub-active-check');
                        if (check) check.style.display = 'none';
                    });
                    offItem.classList.add('active-sub-item');
                    var check = offItem.querySelector('.sub-active-check');
                    if (check) check.style.display = 'block';
                }
            } else {
                var firstSubItem = document.querySelector('.sub-lang-item:not(.disabled)');
                if (firstSubItem) {
                    firstSubItem.click();
                } else {
                    subtitleToggleEl.classList.remove('on');
                }
            }
            haptic(6);
        });

        var speedBoostToggleEl = document.getElementById('speed-boost-toggle');
        if (speedBoostToggleEl) {
            if (!speedBoostEnabled) speedBoostToggleEl.classList.remove('on');
            speedBoostToggleEl.addEventListener('click', function (e) {
                e.stopPropagation();
                speedBoostEnabled = !speedBoostEnabled;
                speedBoostToggleEl.classList.toggle('on', speedBoostEnabled);
                try { localStorage.setItem('speedBoostEnabled', speedBoostEnabled ? 'true' : 'false'); } catch (ex) { }
                haptic(6);
            });
        }
    }

    var mainPipBtn = document.getElementById('main-pip-btn');

    if (mainPipBtn) {
        mainPipBtn.addEventListener('click', function (event) {
            event.stopPropagation();

            showSettingsView('download');
            haptic(6);

            var list = document.getElementById('download-list');

            if (list.dataset.loaded) return;
            list.dataset.loaded = '1';

            list.innerHTML =
                '<div class="source-skeleton">' +
                '<div class="source-skel-item"></div>' +
                '<div class="source-skel-item"></div>' +
                '<div class="source-skel-item"></div>' +
                '</div>';

            var episode = e || 1;
            var endpoint = s
                ? `${baseURL}/api/downloads/tv/${id}/${s}/${episode}`
                : `${baseURL}/api/downloads/movie/${id}`;

            function fetchWithRetry(attempts = 0) {
                var maxRetries = 2;
                var delays = [1000, 2000, 4000];

                fetch(endpoint)
                    .then(r => {
                        if (!r.ok) throw new Error('HTTP ' + r.status);
                        return r.json();
                    })
                    .then(data => {
                        var downloads = data.downloads || [];

                        if (!downloads.length) {
                            list.innerHTML =
                                '<div style="padding:20px;text-align:center;color:var(--white-45);font-size:14px;">No downloads available.</div>';
                            return;
                        }

                        list.innerHTML = '';

                        downloads.forEach(dl => {
                            var item = document.createElement('a');
                            item.className = 'download-item';
                            item.href = dl.url;
                            item.target = '_blank';
                            item.rel = 'noopener noreferrer';

                            item.innerHTML =
                                '<div class="download-item-left">' +
                                '<span class="download-item-name">' +
                                dl.quality +
                                (dl.size ? ` <span class="download-item-quality">${dl.size}</span>` : '') +
                                '</span>' +
                                '<span class="download-item-type">' + (dl.format || '') + '</span>' +
                                '</div>' +
                                '<div class="download-item-actions">' +
                                '<i class="fa-solid fa-download"></i>' +
                                '</div>';

                            list.appendChild(item);
                        });
                    })
                    .catch(() => {
                        if (attempts < maxRetries) {
                            list.innerHTML =
                                '<div style="padding:20px;text-align:center;color:var(--white-45);font-size:14px;">Retrying... (' + (attempts + 1) + '/' + (maxRetries + 1) + ')</div>' +
                                '<div class="source-skeleton">' +
                                '<div class="source-skel-item"></div>' +
                                '<div class="source-skel-item"></div>' +
                                '<div class="source-skel-item"></div>' +
                                '</div>';

                            setTimeout(() => fetchWithRetry(attempts + 1), delays[attempts]);
                        } else {
                            list.innerHTML =
                                '<div style="padding:20px;text-align:center;color:var(--white-45);font-size:14px;">Failed to fetch downloads.</div>';
                        }
                    });
            }

            fetchWithRetry();
        });
    }

    var mainPlaybackBtn = document.getElementById('main-playback-btn');
    if (mainPlaybackBtn) {
        mainPlaybackBtn.addEventListener('click', function (e) {
            e.stopPropagation();
            showSettingsView('speed');
            haptic(6);
        });
    }

    var mainVideoBtn = document.getElementById('main-video-btn');
    if (mainVideoBtn) {
        mainVideoBtn.addEventListener('click', function (e) {
            e.stopPropagation();
            showSettingsView('video');
            haptic(6);
        });
    }

    var videoInputs = ['brightness', 'contrast', 'saturate'];
    videoInputs.forEach(function (key) {
        var el = document.getElementById('vid-' + key);
        if (!el) return;
        el.addEventListener('input', function (e) {
            e.stopPropagation();
            videoState[key] = this.value;
            applyVideoStyles();
            updateVideoLabel();
        });
    });

    var ratioOpts = document.querySelectorAll('.settings-list-item[data-ratio]');
    ratioOpts.forEach(function (btn) {
        btn.addEventListener('click', function (e) {
            e.stopPropagation();
            videoState.ratio = this.dataset.ratio;
            applyVideoStyles();
            updateListActive('ratio-opts', this, 'lbl-ratio', this.textContent.trim());
            haptic(6);
        });
    });

    var btnResetVideo = document.getElementById('btn-reset-video');
    if (btnResetVideo) {
        btnResetVideo.addEventListener('click', function (e) {
            e.stopPropagation();
            videoState.brightness = 100;
            videoState.contrast = 100;
            videoState.saturate = 100;
            videoState.ratio = 'contain';
            applyVideoStyles();
            updateVideoLabel();
            var el;
            el = document.getElementById('vid-brightness'); if (el) el.value = 100;
            el = document.getElementById('vid-contrast'); if (el) el.value = 100;
            el = document.getElementById('vid-saturate'); if (el) el.value = 100;
            var fitBtn = document.querySelector('.settings-list-item[data-ratio="contain"]');
            if (fitBtn) updateListActive('ratio-opts', fitBtn, 'lbl-ratio', 'Fit');
            haptic(6);
        });
    }

    function updateVideoLabel() {
        var lbl = document.getElementById('lbl-video');
        if (!lbl) return;
        var isDefault = videoState.brightness == 100 && videoState.contrast == 100 && videoState.saturate == 100 && videoState.ratio === 'contain';
        lbl.textContent = isDefault ? 'Default' : 'Custom';
    }

    speedOpts.forEach(function (btn) {
        btn.addEventListener('click', function (e) {
            e.stopPropagation();
            var rate = parseFloat(this.dataset.speed);
            v.playbackRate = rate;
            savedSpeed = rate;
            try { localStorage.setItem('playbackSpeed', rate); } catch (err) { }
            updateListActive('speed-opts', this, 'lbl-speed', this.textContent.trim());
            haptic(6);
            showUI(true);
        });
    });

    function switchSource(url) {
        var wasPlaying = !v.paused;
        var savedTime = v.currentTime;
        var cancelled = false;

        if (Hls.isSupported() && typeof hls !== 'undefined') {
            showBufferingImmediate();
            hls.destroy();
            hls = new Hls({
                startLevel: -1,
                maxBufferLength: 30,
                maxMaxBufferLength: 60,
                maxBufferSize: 60 * 1000 * 1000,
                backBufferLength: 10,
                maxBufferHole: 0.5,
                nudgeMaxRetry: 5,
                fragLoadingTimeOut: 20000,
                manifestLoadingTimeOut: 20000,
                levelLoadingTimeOut: 20000,
            });
            hls.loadSource(url);
            hls.attachMedia(v);
            hls.on(Hls.Events.MANIFEST_PARSED, function () {
                buildQualityOpts();
            });
            v.addEventListener('canplay', function onSwitch() {
                v.removeEventListener('canplay', onSwitch);
                if (cancelled) return;
                hideBuffering();
                v.currentTime = savedTime;
                if (wasPlaying) v.play();
            }, { once: true });
        } else if (v.canPlayType('application/vnd.apple.mpegurl')) {
            showBufferingImmediate();
            v.src = url;
            v.load();
            v.addEventListener('canplay', function onSwitchNative() {
                v.removeEventListener('canplay', onSwitchNative);
                if (cancelled) return;
                hideBuffering();
                v.currentTime = savedTime;
                if (wasPlaying) v.play();
            }, { once: true });
        }
    }

    buildSourceList = function () {
        var sourcesOpts = document.getElementById('sources-opts');
        if (!sourcesOpts) return;
        sourcesOpts.innerHTML = '';

        var activeName = sources[currentSourceIndex]
            ? (sources[currentSourceIndex].label || sources[currentSourceIndex].source || 'Source')
            : 'Source';
        activeName = activeName.charAt(0).toUpperCase() + activeName.slice(1);
        var lblSource = document.getElementById('lbl-source');
        if (lblSource) lblSource.textContent = activeName;

        sources.forEach(function (source, i) {
            var isActive = i === currentSourceIndex;
            var rawName = source.label || source.source || 'Source ' + (i + 1);
            var name = rawName.charAt(0).toUpperCase() + rawName.slice(1);
            var emoji = source.emoji || '';

            var item = document.createElement('div');
            item.style.cssText = 'display:flex;align-items:center;padding:15px 20px;cursor:' + (isActive ? 'default' : 'pointer') + ';border-radius:10px;transition:background 0.15s;gap:12px;';
            item.innerHTML =
                '<span style="flex:1;font-size:15px;font-weight:' + (isActive ? '600' : '500') + ';color:rgba(255,255,255,' + (isActive ? '0.95' : '0.8') + ');">' + name + (emoji ? ' ' + emoji : '') + '</span>' +
                (isActive ? '<span style="width:22px;height:22px;border-radius:50%;display:flex;align-items:center;justify-content:center;flex-shrink:0;"><i class="fa-solid fa-check" style="font-size:11px;color:var(--white);"></i></span>' : '');

            if (!isActive) {
                item.addEventListener('mouseenter', function () { this.style.background = 'rgba(255,255,255,0.06)'; });
                item.addEventListener('mouseleave', function () { this.style.background = ''; });
                item.addEventListener('click', function () {
                    haptic(10);
                    showSrcDetail(source, i);
                });
            }
            sourcesOpts.appendChild(item);
        });

        var srcFindNext = document.getElementById('src-find-next-btn');
        if (srcFindNext) {
            srcFindNext.onclick = function () {
                var next = (currentSourceIndex + 1) % sources.length;
                if (sources[next]) { haptic(10); showSrcDetail(sources[next], next); }
            };
        }

        var backBtn = document.getElementById('src-detail-back');
        if (backBtn) {
            backBtn.onclick = function () {
                var dv = document.getElementById('src-detail-view');
                var lv = document.getElementById('src-list-view');
                if (dv) dv.style.display = 'none';
                if (lv) lv.style.display = 'flex';
            };
        }
    }

    function showSrcDetail(source, idx) {
        var listView = document.getElementById('src-list-view');
        var detailView = document.getElementById('src-detail-view');
        var detailTitle = document.getElementById('src-detail-title');
        var detailBody = document.getElementById('src-detail-body');

        if (!listView || !detailView || !detailTitle || !detailBody) return;

        var rawName = source.label || source.source || 'Source';
        var name = rawName.charAt(0).toUpperCase() + rawName.slice(1);
        var emoji = source.emoji || '';
        detailTitle.textContent = name + (emoji ? ' ' + emoji : '');

        detailBody.innerHTML =
            '<div style="display:flex;align-items:center;justify-content:center;flex:1;padding:40px 0;">' +
            '<div style="display:flex;align-items:center;gap:8px;">' +
            '<span style="width:11px;height:11px;border-radius:50%;background:rgba(255,255,255,0.7);display:inline-block;animation:_vyla_dot 1.4s ease-in-out infinite both;animation-delay:0s;"></span>' +
            '<span style="width:11px;height:11px;border-radius:50%;background:rgba(255,255,255,0.7);display:inline-block;animation:_vyla_dot 1.4s ease-in-out infinite both;animation-delay:0.16s;"></span>' +
            '<span style="width:11px;height:11px;border-radius:50%;background:rgba(255,255,255,0.7);display:inline-block;animation:_vyla_dot 1.4s ease-in-out infinite both;animation-delay:0.32s;"></span>' +
            '<span style="width:8px;height:8px;border-radius:50%;background:rgba(255,255,255,0.4);display:inline-block;animation:_vyla_dot 1.4s ease-in-out infinite both;animation-delay:0.48s;"></span>' +
            '</div></div>';

        listView.style.display = 'none';
        detailView.style.display = 'flex';

        var timeout = source.timeout || 15000;
        var cancelled = false;

        var timer = setTimeout(function () {
            if (cancelled) return;
            showSrcFailed(detailBody);
        }, timeout);

        var testUrl = source.url || (baseURL + '/' + (s ? 'api/tv?id=' + id + '&season=' + s + '&episode=' + (e || '1') : 'api/movie?id=' + id));
        fetch(testUrl, { method: 'HEAD' })
            .then(function (r) {
                if (cancelled) return;
                clearTimeout(timer);
                currentSourceIndex = idx;
                closeSettings();
                switchSource(source.url || testUrl);
                buildSourceList();
            })
            .catch(function () {
                if (cancelled) return;
                clearTimeout(timer);
                currentSourceIndex = idx;
                closeSettings();
                switchSource(source.url || testUrl);
                buildSourceList();
            });

        var backBtn = document.getElementById('src-detail-back');
        if (backBtn) {
            backBtn.onclick = function () {
                cancelled = true;
                clearTimeout(timer);
                detailView.style.display = 'none';
                listView.style.display = 'flex';
            };
        }
    }

    function showSrcFailed(container) {
        container.innerHTML =
            '<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;flex:1;padding:36px 24px;gap:16px;text-align:center;">' +
            '<div style="width:54px;height:54px;border-radius:12px;background:rgba(255,255,255,0.07);display:flex;align-items:center;justify-content:center;">' +
            '<i class="fa-solid fa-eye-slash" style="font-size:22px;color:rgba(255,255,255,0.35);"></i></div>' +
            '<div style="font-size:17px;font-weight:600;color:rgba(255,255,255,0.9);">Failed to scrape</div>' +
            '<div style="font-size:14px;color:rgba(255,255,255,0.42);line-height:1.65;max-width:240px;">There was an error while trying to find any videos\u2026 Try a different source?</div>' +
            '</div>';
    }

    function fetchSources() {
        if (sourcesLoaded && sources.length > 0) {
            buildSourceList();
            return;
        }
        var sourcesOpts = document.getElementById('sources-opts');
        if (sourcesOpts) sourcesOpts.innerHTML = '<div class="source-skeleton"><div class="source-skel-item"></div><div class="source-skel-item"></div><div class="source-skel-item"></div></div>';
        fetchAllSources()
            .then(function (result) {
                sources = result.aggregated.length ? result.aggregated : [result.first];
                sourcesLoaded = true;
                currentSourceIndex = 0;
                buildSourceList();
            })
            .catch(function () {
                buildSourceList();
            });
    }

    fetchSources();

    function bindControl(el, key, isColor) {
        if (!el) return;
        var eventType = isColor ? 'input' : 'change';
        el.addEventListener(eventType, function (e) {
            e.stopPropagation();
            subState[key] = this.value;
            applySubStyles();
            if (!isColor) saveSubSettings();
        });
        if (isColor) {
            el.addEventListener('change', function (e) {
                e.stopPropagation();
                saveSubSettings();
                haptic(6);
            });
        } else {
            el.addEventListener('change', function () {
                haptic(6);
            });
        }
    }

    bindControl(subFontSelect, 'font', false);
    bindControl(subSizeSelect, 'size', false);
    bindControl(subColorInput, 'color', true);
    bindControl(subBgColorInput, 'bgColor', true);
    bindControl(subBgOpacitySelect, 'bgOpacity', false);
    bindControl(subPosSelect, 'pos', false);
    bindControl(subEdgeSelect, 'edge', false);

    if (btnPip) {
        var pipSupported = 'pictureInPictureEnabled' in document ||
            'webkitPictureInPictureEnabled' in document ||
            'pictureInPictureElement' in document;
        if (!pipSupported) {
            btnPip.style.display = 'none';
        } else {
            btnPip.addEventListener('click', function (e) {
                e.stopPropagation();
                haptic(10);
                var pipElement = document.pictureInPictureElement || document.webkitPictureInPictureElement;
                if (pipElement) {
                    if (document.exitPictureInPicture) document.exitPictureInPicture();
                    else if (document.webkitExitPictureInPicture) document.webkitExitPictureInPicture();
                } else {
                    if (v.requestPictureInPicture) v.requestPictureInPicture();
                    else if (v.webkitRequestPictureInPicture) v.webkitRequestPictureInPicture();
                }
            });
        }
    }

    if (btnFullscreen) {
        var fsIcon = btnFullscreen.querySelector('i');
        function updateFsIcon() {
            var fsEl = document.fullscreenElement || document.webkitFullscreenElement ||
                document.mozFullScreenElement || document.msFullscreenElement;
            var iosFs = isIOS() && v.webkitDisplayingFullscreen;
            var isFs = fsEl || iosFs;
            btnFullscreen.innerHTML = isFs
                ? '<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 448 512" fill="currentColor"><path d="M160 64c0-17.7-14.3-32-32-32s-32 14.3-32 32v64H32c-17.7 0-32 14.3-32 32s14.3 32 32 32h96c17.7 0 32-14.3 32-32V64zM32 320c-17.7 0-32 14.3-32 32s14.3 32 32 32H96v64c0 17.7 14.3 32 32 32s32-14.3 32-32V352c0-17.7-14.3-32-32-32H32zM352 64c0-17.7-14.3-32-32-32s-32 14.3-32 32v96c0 17.7 14.3 32 32 32h96c17.7 0 32-14.3 32-32s-14.3-32-32-32H352V64zM320 320c-17.7 0-32 14.3-32 32v96c0 17.7 14.3 32 32 32s32-14.3 32-32V384h64c17.7 0 32-14.3 32-32s-14.3-32-32-32H320z"/></svg>'
                : '<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 448 512" fill="currentColor"><path d="M32 32C14.3 32 0 46.3 0 64v96c0 17.7 14.3 32 32 32s32-14.3 32-32V96h64c17.7 0 32-14.3 32-32s-14.3-32-32-32H32zM64 352c0-17.7-14.3-32-32-32s-32 14.3-32 32v96c0 17.7 14.3 32 32 32h96c17.7 0 32-14.3 32-32s-14.3-32-32-32H64V352zM320 32c-17.7 0-32 14.3-32 32s14.3 32 32 32h64v64c0 17.7 14.3 32 32 32s32-14.3 32-32V64c0-17.7-14.3-32-32-32H320zM448 352c0-17.7-14.3-32-32-32s-32 14.3-32 32v64H320c-17.7 0-32 14.3-32 32s14.3 32 32 32h96c17.7 0 32-14.3 32-32V352z"/></svg>';
        }
        function onFsChange() {
            updateFsIcon();
            showUI(true);
        }
        document.addEventListener('fullscreenchange', onFsChange);
        document.addEventListener('webkitfullscreenchange', onFsChange);
        document.addEventListener('mozfullscreenchange', onFsChange);
        document.addEventListener('MSFullscreenChange', onFsChange);
        v.addEventListener('webkitbeginfullscreen', updateFsIcon);
        v.addEventListener('webkitendfullscreen', updateFsIcon);
        btnFullscreen.addEventListener('click', function (e) {
            e.stopPropagation();
            haptic(10);
            if (isIOS()) {
                if (v.webkitDisplayingFullscreen) {
                    v.webkitExitFullscreen();
                } else {
                    v.webkitEnterFullscreen();
                }
                return;
            }
            var fsEl = document.fullscreenElement || document.webkitFullscreenElement ||
                document.mozFullScreenElement || document.msFullscreenElement;
            if (fsEl) {
                if (document.exitFullscreen) document.exitFullscreen();
                else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
                else if (document.mozCancelFullScreen) document.mozCancelFullScreen();
                else if (document.msExitFullscreen) document.msExitFullscreen();
            } else {
                var player = document.getElementById('player');
                if (player.requestFullscreen) player.requestFullscreen();
                else if (player.webkitRequestFullscreen) player.webkitRequestFullscreen();
                else if (player.mozRequestFullScreen) player.mozRequestFullScreen();
                else if (player.msRequestFullscreen) player.msRequestFullscreen();
            }
        });
    }

    wrap.addEventListener('mouseenter', function () { trackEl.classList.add('hover'); });
    wrap.addEventListener('mouseleave', function () {
        if (!dragging) trackEl.classList.remove('hover');
        tooltip.classList.remove('show');
        lastTooltipPct = -1;
    });
    wrap.addEventListener('mousemove', function (e) { e.stopPropagation(); hoverTooltip(e.clientX); });
    wrap.addEventListener('mousedown', function (e) {
        e.stopPropagation();
        dragging = true;
        trackEl.classList.add('drag');
        seekX(e.clientX);
        showUI(true);
        haptic(6);
    });
    function showSeekTooltip(clientX) {
        if (!v.duration) return;
        var r = wrap.getBoundingClientRect();
        var pct = Math.max(0, Math.min(1, (clientX - r.left) / r.width));
        var thumbHalf = 8;
        var tipLeft = Math.max(thumbHalf, Math.min(r.width - thumbHalf, pct * r.width));
        tooltip.style.left = tipLeft + 'px';
        tooltipTime.textContent = fmt(pct * v.duration);
        tooltip.classList.add('show');
    }

    wrap.addEventListener('touchstart', function (e) {
        e.stopPropagation();
        clearTimeout(_speedBoostTimer);
        dragging = true;
        trackEl.classList.add('drag');
        seekX(e.touches[0].clientX);
        showUI(true);
        haptic();
        showSeekTooltip(e.touches[0].clientX);
    }, { passive: true });

    wrap.addEventListener('touchmove', function (e) {
        if (!dragging) return;
        e.preventDefault();
        seekX(e.touches[0].clientX);
        showSeekTooltip(e.touches[0].clientX);
    }, { passive: false });

    wrap.addEventListener('touchend', function (e) {
        if (!dragging) return;
        var x = e.changedTouches ? e.changedTouches[0].clientX : undefined;
        if (x !== undefined) { seekX(x); commitSeek(x); }
        dragging = false;
        trackEl.classList.remove('drag', 'hover');
        tooltip.classList.remove('show');
        if (!v.paused) showUI();
    });

    var lastDragX = 0;
    function endDrag(e) {
        if (!dragging) return;
        dragging = false;
        trackEl.classList.remove('drag', 'hover');
        var x = e.changedTouches ? e.changedTouches[0].clientX : e.clientX;
        commitSeek(x !== undefined ? x : lastDragX);
        tooltip.classList.remove('show');
        if (!v.paused) showUI();
    }
    document.addEventListener('mousemove', function (e) {
        if (!dragging) return;
        lastDragX = e.clientX;
        seekX(e.clientX);
        hoverTooltip(e.clientX);
    });
    document.addEventListener('touchmove', function (e) {
        if (!dragging) return;
        lastDragX = e.touches[0].clientX;
        seekX(e.touches[0].clientX);
        showSeekTooltip(e.touches[0].clientX);
    }, { passive: true });
    document.addEventListener('mouseup', endDrag);
    document.addEventListener('touchend', function (e) {
        if (dragging) endDrag(e);
    });

    document.addEventListener('keydown', function (e) {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') return;
        if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
            if (document.body.classList.contains('tv-nav-mode')) return;
            if (e.key === 'ArrowLeft') { doSkip('left', 1); showUI(); }
            if (e.key === 'ArrowRight') { doSkip('right', 1); showUI(); }
            return;
        }
        if (e.key === ' ' || e.key === 'k' || e.key === 'K') { e.preventDefault(); haptic(10); v.paused ? v.play() : v.pause(); }
        if (e.key === 'f' || e.key === 'F') {
            if (isIOS()) {
                if (v.webkitDisplayingFullscreen) {
                    v.webkitExitFullscreen();
                } else {
                    v.webkitEnterFullscreen();
                }
                return;
            }
            var fsEl = document.fullscreenElement || document.webkitFullscreenElement;
            var player = document.getElementById('player');
            if (fsEl) {
                if (document.exitFullscreen) document.exitFullscreen();
                else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
            } else {
                if (player.requestFullscreen) player.requestFullscreen();
                else if (player.webkitRequestFullscreen) player.webkitRequestFullscreen();
            }
        }
    });

    (function () {
        var kbHint = null;
        var kbHintTimer = null;
        var shortcuts = [
            { key: 'Space / K', desc: 'Play / Pause' },
            { key: '← →', desc: 'Skip 10 seconds' },
            { key: 'F', desc: 'Fullscreen' }
        ];

        document.addEventListener('keydown', function (e) {
            if (e.key === '?') {
                if (!kbHint) {
                    kbHint = document.createElement('div');
                    shortcuts.forEach(function (s) {
                        var row = document.createElement('div');
                        row.innerHTML = '<span style="background:rgba(255,255,255,0.12);border-radius:6px;padding:3px 10px;font-size:12px;font-weight:700;color:var(--white);letter-spacing:0.04em;min-width:36px;text-align:center;font-family:var(--font);">' + s.key + '</span><span style="font-size:13px;color:rgba(255,255,255,0.75);font-family:var(--font);font-weight:500;">' + s.desc + '</span>';
                        kbHint.appendChild(row);
                    });
                    document.body.appendChild(kbHint);
                }
                kbHint.style.opacity = '1';
                clearTimeout(kbHintTimer);
                kbHintTimer = setTimeout(function () {
                    kbHint.style.opacity = '0';
                }, 3000);
            }
        });
    })();

    document.getElementById('player').addEventListener('mousemove', function () {
        if (!v.paused) {
            clearTimeout(hideTimer);
            if (shown) {
                if (!settingsOpen) hideTimer = setTimeout(hideUI, 3200);
            } else {
                showUI();
            }
        }
    });

    v.addEventListener('timeupdate', setProg);

    var timestampRestored = false;
    function restoreTimestamp() {
        if (timestampRestored) return;

        var videoKey = (s ? videoId + '_s' + s + '_e' + (e || '1') : videoId);
        var savedTime = getTimestamp(videoKey);

        if (savedTime > 5 && v.duration > savedTime + 5) {
            v.currentTime = savedTime;
            timestampRestored = true;
        }
    }

    v.addEventListener('loadedmetadata', function () {
        restoreTimestamp();
    });

    v.addEventListener('loadeddata', function () {
        restoreTimestamp();
    });

    v.addEventListener('canplay', function () {
        restoreTimestamp();
    });

    v.addEventListener('durationchange', function () {
        if (v.duration) {
            clearTimeout(retryTimer);
            retryCount = maxRetries;
            hideBuffering();
            restoreTimestamp();
        }
    });

    setTimeout(function () {
        restoreTimestamp();
    }, 2000);

    var lastSaveTime = 0;
    v.addEventListener('timeupdate', function () {
        var now = Date.now();
        if (now - lastSaveTime > 5000) {
            var videoKey = (s ? videoId + '_s' + s + '_e' + (e || '1') : videoId);
            saveTimestamp(videoKey, v.currentTime);
            lastSaveTime = now;
        }
    });

    if (s) {
        v.addEventListener('ended', function () {
            var videoKey = (s ? videoId + '_s' + s + '_e' + (e || '1') : videoId);
            clearTimestamp(videoKey);

            var nextE = parseInt(e || '1') + 1;
            var nextS = parseInt(s);

            fetch(baseURL + '/api/tv?id=' + id + '&season=' + nextS + '&episode=' + nextE)
                .then(function (r) { return r.json(); })
                .then(function (d) {
                    if (d.error || !d.url) {
                        fetch(baseURL + '/api/tv?id=' + id + '&season=' + (nextS + 1) + '&episode=1')
                            .then(function (r) { return r.json(); })
                            .then(function (d2) {
                                if (d2.error || !d2.url) return;

                                var toast = document.getElementById('now-playing-toast');
                                var title = d2.meta ? (d2.meta.title || d2.meta.name || 'Unknown') : 'Unknown';
                                title += ' \u00b7 S' + (nextS + 1) + 'E1';

                                toast.innerHTML = '<div class="np-glow"></div><div class="np-inner"><span class="np-label">Up Next</span><span class="np-title">\u201c' + title + '\u201d</span></div>';
                                toast.className = '';

                                setTimeout(function () {
                                    toast.classList.add('enter');
                                    setTimeout(function () {
                                        toast.classList.remove('enter');
                                        toast.classList.add('exit');
                                        setTimeout(function () {
                                            location.href = location.pathname + '?id=' + id + '&season=' + (nextS + 1) + '&episode=1&ap=1';
                                        }, 800);
                                    }, 3800);
                                }, 400);
                            })
                            .catch(function () { });
                        return;
                    }

                    var toast = document.getElementById('now-playing-toast');
                    var title = d.meta ? (d.meta.title || d.meta.name || 'Unknown') : 'Unknown';
                    title += ' \u00b7 S' + nextS + 'E' + nextE;

                    toast.innerHTML = '<div class="np-glow"></div><div class="np-inner"><span class="np-label">Up Next</span><span class="np-title">\u201c' + title + '\u201d</span></div>';
                    toast.className = '';

                    setTimeout(function () {
                        toast.classList.add('enter');
                        setTimeout(function () {
                            toast.classList.remove('enter');
                            toast.classList.add('exit');
                            setTimeout(function () {
                                location.href = location.pathname + '?id=' + id + '&season=' + nextS + '&episode=' + nextE + '&ap=1';
                            }, 800);
                        }, 3800);
                    }, 400);
                })
                .catch(function () { });
        });

        var nextEpBtn = document.getElementById('next-ep-btn');
        var nextEpInner = document.getElementById('next-ep-inner');
        var nextEpLabel = document.getElementById('next-ep-label');
        var nextEpHref = null;
        var nextEpReady = false;

        var nextE = parseInt(e || '1') + 1;
        var nextS = parseInt(s);

        setTimeout(function () {
            fetch(baseURL + '/api/tv?id=' + id + '&season=' + nextS + '&episode=' + nextE)
                .then(function (r) { return r.json(); })
                .then(function (d) {
                    if (d.error || !d.url) {
                        return fetch(baseURL + '/api/tv?id=' + id + '&season=' + (nextS + 1) + '&episode=1')
                            .then(function (r) { return r.json(); })
                            .then(function (d2) {
                                if (d2.error || !d2.url) return;
                                var t = d2.meta ? (d2.meta.title || d2.meta.name || 'Unknown') : 'Unknown';
                                nextEpLabel.textContent = 'S' + (nextS + 1) + ' E1 \u00b7 ' + t;
                                nextEpHref = location.pathname + '?id=' + id + '&season=' + (nextS + 1) + '&episode=1&ap=1';
                                nextEpReady = true;
                            });
                    }
                    var t = d.meta ? (d.meta.title || d.meta.name || 'Unknown') : 'Unknown';
                    nextEpLabel.textContent = 'S' + nextS + ' E' + nextE + ' \u00b7 ' + t;
                    nextEpHref = location.pathname + '?id=' + id + '&season=' + nextS + '&episode=' + nextE + '&ap=1';
                    nextEpReady = true;
                })
                .catch(function () { });
        }, 1000);

        nextEpInner.addEventListener('click', function () {
            if (nextEpHref) location.href = nextEpHref;
        });

        v.addEventListener('timeupdate', function () {
            if (!nextEpReady || !v.duration || v.duration < 60) return;
            var remaining = v.duration - v.currentTime;
            nextEpBtn.style.display = '';
            if (remaining <= 300) {
                nextEpBtn.classList.add('show');
            } else {
                nextEpBtn.classList.remove('show');
            }
        });

        v.addEventListener('durationchange', function () {
            if (!nextEpReady || !v.duration || v.duration < 60) return;
            if (v.duration - v.currentTime <= 300) {
                nextEpBtn.classList.add('show');
            }
        });
    }

    v.style.pointerEvents = 'none';

    var existingOverlay = document.getElementById('click-overlay');
    if (existingOverlay) existingOverlay.remove();

    var clickOverlay = document.createElement('div');
    clickOverlay.id = 'click-overlay';
    clickOverlay.style.cssText = 'position:absolute;inset:0;z-index:1;';
    v.parentElement.appendChild(clickOverlay);

    clickOverlay.addEventListener('click', function (e) {
        if (settingsOpen || dragging) return;
        if (!shown) {
            showUI(true);
            return;
        }
        var isTouch = window.matchMedia('(pointer: coarse)').matches;
        if (isTouch) {
            var rect = clickOverlay.getBoundingClientRect();
            var dx = e.clientX - (rect.left + rect.width / 2);
            var dy = e.clientY - (rect.top + rect.height / 2);
            if (Math.sqrt(dx * dx + dy * dy) <= 100) {
                haptic();
                flashCenter();
                v.paused ? v.play() : v.pause();
            } else {
                hideUI();
            }
        } else {
            haptic();
            flashCenter();
            v.paused ? v.play() : v.pause();
        }
    });

    document.getElementById('player').addEventListener('click', function (e) {
        if (settingsOpen || dragging) return;
        if (e.target === clickOverlay || clickOverlay.contains(e.target)) return;
        if (controlsWrapper.contains(e.target)) return;
        if (settingsPanel && settingsPanel.contains(e.target)) return;
        if (btnSettings && btnSettings.contains(e.target)) return;
        if (sourceBtnWrap && sourceBtnWrap.contains(e.target)) return;
        if (e.target.closest && e.target.closest('.cf-skip-btn')) return;
        if (!shown) { showUI(true); return; }
        hideUI();
    });

    var isPressing = false;
    var _boostDidActivate = false;
    var _wasPausedBeforeBoost = false;
    var originalPlaybackSpeed = 1;
    var playerEl = document.getElementById('player');

    var _speedBoostTimer = null;
    var _speedBoostRaf = null;

    function startSpeedBoost() {
        if (isPressing) return;
        isPressing = true;
        _boostDidActivate = true;
        _wasPausedBeforeBoost = v.paused;
        originalPlaybackSpeed = savedSpeed;
        if (v.paused) {
            var _boostPlayPromise = v.play();
            if (_boostPlayPromise !== undefined) {
                _boostPlayPromise.then(function () {
                    if (isPressing) v.playbackRate = 2;
                    else v.pause();
                }).catch(function () { });
            }
        }
        v.playbackRate = 2;
        playerEl.style.cursor = 'grabbing';
        var badge = document.getElementById('speed-boost-badge');
        if (!badge) {
            badge = document.createElement('div');
            badge.id = 'speed-boost-badge';
            badge.style.cssText = 'position:absolute;top:18px;left:50%;transform:translateX(-50%);z-index:30;background:rgba(0,0,0,0.65);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);color:var(--white);font-family:var(--font);font-size:13px;font-weight:700;padding:6px 16px;border-radius:100px;display:flex;align-items:center;gap:7px;letter-spacing:0.03em;opacity:0;transition:opacity 0.18s ease;pointer-events:none;';
            badge.innerHTML = '<i class="fa-solid fa-forward" style="font-size:12px;"></i> 2x speed';
            document.getElementById('player').appendChild(badge);
        }
        _speedBoostRaf = requestAnimationFrame(function () { _speedBoostRaf = null; badge.style.opacity = '1'; });
    }

    function endSpeedBoost() {
        clearTimeout(_speedBoostTimer);
        _speedBoostTimer = null;
        if (_speedBoostRaf) {
            cancelAnimationFrame(_speedBoostRaf);
            _speedBoostRaf = null;
        }
        if (!isPressing) return;
        isPressing = false;
        v.playbackRate = originalPlaybackSpeed;
        if (_wasPausedBeforeBoost) {
            var pausePromise = v.play();
            if (pausePromise !== undefined) {
                pausePromise.then(function () { v.pause(); }).catch(function () { });
            } else {
                v.pause();
            }
        }
        playerEl.style.cursor = '';
        var badge = document.getElementById('speed-boost-badge');
        if (badge) badge.style.opacity = '0';
    }

    playerEl.addEventListener('mousedown', function (e) {
        if (controlsWrapper.contains(e.target)) return;
        if (settingsPanel && settingsPanel.contains(e.target)) return;
        if (btnSettings.contains(e.target)) return;
        if (e.button !== 0) return;
        _boostDidActivate = false;
        if (speedBoostEnabled) _speedBoostTimer = setTimeout(function () { startSpeedBoost(); }, 600);
    });

    playerEl.addEventListener('mouseup', function (e) {
        endSpeedBoost();
    });
    playerEl.addEventListener('mouseleave', endSpeedBoost);

    playerEl.addEventListener('click', function (e) {
        if (_boostDidActivate) {
            _boostDidActivate = false;
            e.stopImmediatePropagation();
            return;
        }
    }, true);

    playerEl.addEventListener('touchstart', function (e) {
        if (controlsWrapper.contains(e.target)) return;
        if (settingsPanel && settingsPanel.contains(e.target)) return;
        if (btnSettings.contains(e.target)) return;
        if (wrap.contains(e.target)) return;
        _boostDidActivate = false;
        if (speedBoostEnabled) _speedBoostTimer = setTimeout(function () {
            if (!dragging) startSpeedBoost();
        }, 600);
    }, { passive: true });

    playerEl.addEventListener('touchend', function (e) {
        endSpeedBoost();
    });

    (function () {
        var openBtn = document.getElementById('sub-customize-open-btn');
        var backBtn = document.getElementById('sub-custom-back-btn');
        var langView = document.getElementById('sub-lang-group-view');
        var customView = document.getElementById('sub-custom-view');

        var subViewTitle = document.getElementById('sub-view-title');
        var subCustomizeBtn = document.getElementById('sub-customize-open-btn');
        var subMainBackBtn = document.getElementById('sub-main-back-btn');
        var advancedBtn = document.getElementById('sub-advanced-btn');
        var advancedContent = document.getElementById('sub-advanced-content');

        var subPresets = {
            default: {
                font: 'sans',
                size: 'medium',
                color: '#ffffff',
                bgColor: '#000000',
                bgOpacity: 0.75,
                textShadow: 'shadow',
                pos: 'mid',
                weight: '500'
            },
            clean: {
                font: 'sans',
                size: 'medium',
                color: '#ffffff',
                bgColor: 'transparent',
                bgOpacity: 0,
                textShadow: 'shadow',
                pos: 'mid',
                weight: '500'
            },
            'high-contrast': {
                font: 'sans',
                size: 'medium',
                color: '#ffffff',
                bgColor: '#000000',
                bgOpacity: 1,
                textShadow: 'none',
                pos: 'mid',
                weight: '700'
            },
            cinema: {
                font: 'serif',
                size: 'medium',
                color: '#ffff00',
                bgColor: '#000000',
                bgOpacity: 0.9,
                textShadow: 'both',
                pos: 'mid',
                weight: '500'
            }
        };

        function applySubPreset(presetName) {
            var preset = subPresets[presetName];
            if (!preset) return;

            Object.keys(preset).forEach(function (key) {
                subState[key] = preset[key];
            });

            applySubStyles();
            saveSubSettings();
            updateSimpleControls();
            updateAdvancedControls();
        }

        function updateSimpleControls() {
            document.querySelectorAll('.sub-size-btn').forEach(function (btn) {
                btn.classList.toggle('active', btn.dataset.size === subState.size);
            });

            document.querySelectorAll('.sub-pos-btn').forEach(function (btn) {
                btn.classList.toggle('active', btn.dataset.pos === subState.pos);
            });

            var bgType = 'none';
            if (subState.bgOpacity > 0.8) bgType = 'dark';
            else if (subState.bgOpacity > 0.3) bgType = 'light';

            document.querySelectorAll('.sub-bg-btn').forEach(function (btn) {
                btn.classList.toggle('active', btn.dataset.bg === bgType);
            });

            var currentPreset = 'default';
            Object.keys(subPresets).forEach(function (presetName) {
                var preset = subPresets[presetName];
                var matches = true;
                Object.keys(preset).forEach(function (key) {
                    if (subState[key] !== preset[key]) matches = false;
                });
                if (matches) currentPreset = presetName;
            });

            document.querySelectorAll('.sub-preset-btn').forEach(function (btn) {
                btn.classList.toggle('active', btn.dataset.preset === currentPreset);
            });
        }

        function updateAdvancedControls() {
            var subBgOpacityRange = document.getElementById('sub-bg-opacity-range');
            var subBgOpacityVal = document.getElementById('sub-bg-opacity-val');
            if (subBgOpacityRange && subBgOpacityVal) {
                subBgOpacityRange.value = parseFloat(subState.bgOpacity) * 100;
                subBgOpacityVal.textContent = Math.round(parseFloat(subState.bgOpacity) * 100) + '%';
            }

            var subTextSizeRange = document.getElementById('sub-text-size-range');
            var subTextSizeVal = document.getElementById('sub-text-size-val');
            if (subTextSizeRange && subTextSizeVal) {
                subTextSizeRange.value = 100;
                subTextSizeVal.textContent = '100%';
            }

            var subTextStyleSelect = document.getElementById('sub-text-style-select');
            if (subTextStyleSelect) {
                subTextStyleSelect.value = subState.font;
            }

            var subBoldToggle = document.getElementById('sub-bold-toggle');
            if (subBoldToggle) {
                subBoldToggle.classList.toggle('on', subState.weight === '700');
            }
        }

        document.querySelectorAll('.sub-preset-btn').forEach(function (btn) {
            btn.addEventListener('click', function () {
                var preset = this.dataset.preset;
                applySubPreset(preset);
                haptic(6);
            });
        });

        document.querySelectorAll('.sub-size-btn').forEach(function (btn) {
            btn.addEventListener('click', function () {
                subState.size = this.dataset.size;
                applySubStyles();
                saveSubSettings();
                updateSimpleControls();
                haptic(6);
            });
        });

        document.querySelectorAll('.sub-pos-btn').forEach(function (btn) {
            btn.addEventListener('click', function () {
                subState.pos = this.dataset.pos;
                applySubStyles();
                saveSubSettings();
                updateSimpleControls();
                haptic(6);
            });
        });

        document.querySelectorAll('.sub-bg-btn').forEach(function (btn) {
            btn.addEventListener('click', function () {
                var bgType = this.dataset.bg;
                if (bgType === 'none') {
                    subState.bgOpacity = 0;
                } else if (bgType === 'light') {
                    subState.bgOpacity = 0.5;
                } else if (bgType === 'dark') {
                    subState.bgOpacity = 0.9;
                }
                applySubStyles();
                saveSubSettings();
                updateSimpleControls();
                updateAdvancedControls();
                haptic(6);
            });
        });

        if (advancedBtn) {
            advancedBtn.addEventListener('click', function () {
                var isExpanded = this.classList.contains('expanded');

                if (isExpanded) {
                    this.classList.remove('expanded');
                    if (advancedContent) advancedContent.style.display = 'none';
                } else {
                    this.classList.add('expanded');
                    if (advancedContent) {
                        advancedContent.style.display = 'block';
                        updateAdvancedControls();
                    }
                }
                haptic(6);
            });
        }

        if (openBtn) openBtn.addEventListener('click', function () {
            document.getElementById('sub-lang-group-view').style.display = 'none';
            document.getElementById('sub-custom-view').style.display = 'flex';
            updateSimpleControls();
            updateAdvancedControls();
        });

        if (backBtn) backBtn.addEventListener('click', function () {
            document.getElementById('sub-custom-view').style.display = 'none';
            document.getElementById('sub-lang-group-view').style.display = 'flex';
        });

        if (subMainBackBtn) subMainBackBtn.addEventListener('click', function (e) {
            e.stopPropagation();
            if (customView.style.display === 'block') {
                customView.style.display = 'none';
                langView.style.display = 'block';
                if (subViewTitle) subViewTitle.textContent = 'Subtitles';
                if (subCustomizeBtn) subCustomizeBtn.style.display = '';
                if (advancedBtn) advancedBtn.classList.remove('expanded');
                if (advancedContent) advancedContent.style.display = 'none';
            } else {
                showSettingsView('main');
            }
        });

        document.querySelectorAll('.sub-special-item').forEach(function (el) {
            el.addEventListener('click', function () {
                var subType = el.dataset.sub;
                document.querySelectorAll('.sub-special-item, .sub-lang-item').forEach(function (x) {
                    x.classList.remove('active-sub-item');
                    var check = x.querySelector('.sub-active-check');
                    if (check) check.style.display = 'none';
                });
                el.classList.add('active-sub-item');
                var check = el.querySelector('.sub-active-check');
                if (check) check.style.display = 'block';

                if (subType === 'off') {
                    subState.activeTrack = -1;
                    subState.cues = [];
                    subtitleText.textContent = '';
                    _lastCueText = '';
                    document.getElementById('lbl-subtitle').textContent = 'Off';

                    var mainToggle = document.getElementById('subtitle-toggle');
                    if (mainToggle) {
                        mainToggle.classList.remove('on');
                    }

                    haptic(6);
                }
            });
        });

        function updateSliderBg(el) {
            var pct = ((el.value - el.min) / (el.max - el.min) * 100).toFixed(1) + '%';
            el.style.setProperty('--val', pct);
        }

        var subBgOpacityRange = document.getElementById('sub-bg-opacity-range');
        var subBgOpacityVal = document.getElementById('sub-bg-opacity-val');
        if (subBgOpacityRange) {
            updateSliderBg(subBgOpacityRange);
            subBgOpacityRange.value = parseFloat(subState.bgOpacity) * 100;
            subBgOpacityVal.textContent = Math.round(parseFloat(subState.bgOpacity) * 100) + '%';
            subBgOpacityRange.addEventListener('input', function () {
                subState.bgOpacity = (this.value / 100).toFixed(2);
                subBgOpacityVal.textContent = this.value + '%';
                updateSliderBg(this);
                applySubStyles();
                saveSubSettings();
            });
        }

        var subBlurIntensityRange = document.getElementById('sub-blur-intensity-range');
        var subBlurIntensityVal = document.getElementById('sub-blur-intensity-val');
        if (subBlurIntensityRange) {
            updateSliderBg(subBlurIntensityRange);
            subBlurIntensityRange.addEventListener('input', function () {
                subBlurIntensityVal.textContent = this.value + '%';
                updateSliderBg(this);
                var blurPx = (parseFloat(this.value) / 100 * 20).toFixed(1) + 'px';
                subtitleText.style.backdropFilter = 'blur(' + blurPx + ')';
                subtitleText.style.webkitBackdropFilter = 'blur(' + blurPx + ')';
            });
        }

        var subTextSizeRange = document.getElementById('sub-text-size-range');
        var subTextSizeVal = document.getElementById('sub-text-size-val');
        var subSizeBaseMap = { small: 14, medium: 18, large: 23, xlarge: 28, xxlarge: 34 };
        if (subTextSizeRange) {
            updateSliderBg(subTextSizeRange);
            subTextSizeRange.addEventListener('input', function () {
                subTextSizeVal.textContent = this.value + '%';
                updateSliderBg(this);
                var basePx = subSizeBaseMap[subState.size] || 18;
                subtitleText.style.fontSize = (basePx * (parseFloat(this.value) / 100)).toFixed(1) + 'px';
            });
        }

        var dr = document.getElementById('sub-delay-range');
        var dv = document.getElementById('sub-delay-val');
        var subDelaySeconds = 0;
        if (dr) {
            updateSliderBg(dr);
            dr.addEventListener('input', function () {
                subDelaySeconds = parseFloat(this.value);
                dv.textContent = subDelaySeconds.toFixed(1) + 's';
                updateSliderBg(this);
            });
        }
        var hb = document.getElementById('sub-delay-heard');
        var sb = document.getElementById('sub-delay-saw');
        if (hb && dr) hb.addEventListener('click', function () {
            dr.value = Math.max(-10, parseFloat(dr.value) - 0.1);
            subDelaySeconds = parseFloat(dr.value);
            dv.textContent = subDelaySeconds.toFixed(1) + 's';
            updateSliderBg(dr);
        });
        if (sb && dr) sb.addEventListener('click', function () {
            dr.value = Math.min(10, parseFloat(dr.value) + 0.1);
            subDelaySeconds = parseFloat(dr.value);
            dv.textContent = subDelaySeconds.toFixed(1) + 's';
            updateSliderBg(dr);
        });

        var subTextStyleSelect = document.getElementById('sub-text-style-select');
        if (subTextStyleSelect) {
            subTextStyleSelect.value = subState.font;
            subTextStyleSelect.addEventListener('change', function () {
                subState.font = this.value;
                applySubStyles();
                saveSubSettings();
                haptic(6);
            });
        }

        var subBoldToggle = document.getElementById('sub-bold-toggle');
        if (subBoldToggle) {
            if (subState.weight === '700') subBoldToggle.classList.add('on');
            subBoldToggle.addEventListener('click', function () {
                this.classList.toggle('on');
                subState.weight = this.classList.contains('on') ? '700' : '500';
                applySubStyles();
                saveSubSettings();
            });
        }

        var subFixCapsToggle = document.getElementById('sub-fix-caps-toggle');
        if (subFixCapsToggle) {
            subFixCapsToggle.addEventListener('click', function () {
                this.classList.toggle('on');
                var on = this.classList.contains('on');
                subtitleText.style.textTransform = on ? 'capitalize' : '';
            });
        }

        var subBgBlurToggle = document.getElementById('sub-bg-blur-toggle');
        if (subBgBlurToggle) {
            subBgBlurToggle.classList.add('on');
            subBgBlurToggle.addEventListener('click', function () {
                this.classList.toggle('on');
                var on = this.classList.contains('on');
                if (!on) {
                    subtitleText.style.backdropFilter = 'none';
                    subtitleText.style.webkitBackdropFilter = 'none';
                } else {
                    var intensity = subBlurIntensityRange ? subBlurIntensityRange.value : 50;
                    var blurPx = (parseFloat(intensity) / 100 * 20).toFixed(1) + 'px';
                    subtitleText.style.backdropFilter = 'blur(' + blurPx + ')';
                    subtitleText.style.webkitBackdropFilter = 'blur(' + blurPx + ')';
                }
            });
        }

        var nativeSubToggle = document.getElementById('native-sub-toggle');
        if (nativeSubToggle) {
            nativeSubToggle.addEventListener('click', function () {
                this.classList.toggle('on');
            });
        }

        var colorSwatches = document.querySelectorAll('.sub-swatch');
        var customColorPicker = document.getElementById('sub-custom-color-picker');
        colorSwatches.forEach(function (sw) {
            sw.addEventListener('click', function () {
                if (sw.dataset.color === 'custom') {
                    customColorPicker.click();
                    return;
                }
                colorSwatches.forEach(function (s) {
                    s.classList.remove('sub-swatch-active');
                    s.innerHTML = s.dataset.color === 'custom' ? '<i class="fa-solid fa-paint-brush" style="color:var(--white-60);font-size:12px;"></i>' : '';
                });
                sw.classList.add('sub-swatch-active');
                sw.innerHTML = '<i class="fa-solid fa-check" style="color:#000;"></i>';
                subState.color = sw.dataset.color;
                applySubStyles();
                saveSubSettings();
            });
        });
        if (customColorPicker) {
            customColorPicker.addEventListener('change', function () {
                colorSwatches.forEach(function (s) {
                    s.classList.remove('sub-swatch-active');
                    s.innerHTML = s.dataset.color === 'custom' ? '<i class="fa-solid fa-paint-brush" style="color:var(--white-60);font-size:12px;"></i>' : '';
                });
                var csw = document.querySelector('.sub-swatch-brush');
                if (csw) {
                    csw.style.background = customColorPicker.value;
                    csw.classList.add('sub-swatch-active');
                }
                subState.color = customColorPicker.value;
                applySubStyles();
                saveSubSettings();
            });
        }

        var bgSwatches = document.querySelectorAll('.sub-bg-swatch');
        var customBgColorPicker = document.getElementById('sub-custom-bg-color-picker');
        bgSwatches.forEach(function (sw) {
            sw.addEventListener('click', function () {
                if (sw.dataset.bgColor === 'custom') {
                    customBgColorPicker.click();
                    return;
                }
                bgSwatches.forEach(function (s) {
                    s.classList.remove('sub-bg-swatch-active');
                    s.innerHTML = s.dataset.bgColor === 'custom' ? '<i class="fa-solid fa-paint-brush" style="color:var(--white-60);font-size:12px;"></i>' : '';
                });
                sw.classList.add('sub-bg-swatch-active');
                sw.innerHTML = '<i class="fa-solid fa-check" style="color:#000;"></i>';
                subState.bgColor = sw.dataset.bgColor;
                applySubStyles();
                saveSubSettings();
            });
        });
        if (customBgColorPicker) {
            customBgColorPicker.addEventListener('change', function () {
                bgSwatches.forEach(function (s) {
                    s.classList.remove('sub-bg-swatch-active');
                    s.innerHTML = s.dataset.bgColor === 'custom' ? '<i class="fa-solid fa-paint-brush" style="color:var(--white-60);font-size:12px;"></i>' : '';
                });
                var csw = document.querySelector('.sub-bg-swatch-brush');
                if (csw) {
                    csw.style.background = customBgColorPicker.value;
                    csw.classList.add('sub-bg-swatch-active');
                }
                subState.bgColor = customBgColorPicker.value;
                applySubStyles();
                saveSubSettings();
            });
        }

        bgSwatches.forEach(function (s) {
            s.classList.remove('sub-bg-swatch-active');
            s.innerHTML = s.dataset.bgColor === 'custom' ? '<i class="fa-solid fa-paint-brush" style="color:var(--white-60);font-size:12px;"></i>' : '';
        });
        if (subState.bgColor === 'transparent') {
            var transparentSwatch = document.querySelector('.sub-bg-swatch[data-bg-color="transparent"]');
            if (transparentSwatch) {
                transparentSwatch.classList.add('sub-bg-swatch-active');
                transparentSwatch.innerHTML = '<i class="fa-solid fa-check" style="color:#000;"></i>';
            }
        } else {
            var currentBgSwatch = document.querySelector('.sub-bg-swatch[data-bg-color="' + subState.bgColor + '"]');
            if (currentBgSwatch) {
                currentBgSwatch.classList.add('sub-bg-swatch-active');
                currentBgSwatch.innerHTML = '<i class="fa-solid fa-check" style="color:#000;"></i>';
            } else {
                var customBgSwatch = document.querySelector('.sub-bg-swatch-brush');
                if (customBgSwatch) {
                    customBgSwatch.style.background = subState.bgColor;
                    customBgSwatch.classList.add('sub-bg-swatch-active');
                }
                if (customBgColorPicker) customBgColorPicker.value = subState.bgColor;
            }
        }

        var subPosSelect = document.getElementById('sub-pos-select');
        if (subPosSelect) {
            subPosSelect.value = subState.pos;
            subPosSelect.addEventListener('change', function () {
                subState.pos = this.value;
                applySubStyles();
                saveSubSettings();
                haptic(6);
            });
        }

        var subOverallOpacityRange = document.getElementById('sub-overall-opacity-range');
        var subOverallOpacityVal = document.getElementById('sub-overall-opacity-val');
        if (subOverallOpacityRange) {
            updateSliderBg(subOverallOpacityRange);
            subOverallOpacityRange.value = parseFloat(subState.overallOpacity) * 100;
            subOverallOpacityVal.textContent = Math.round(parseFloat(subState.overallOpacity) * 100) + '%';
            subOverallOpacityRange.addEventListener('input', function () {
                subState.overallOpacity = (this.value / 100).toFixed(2);
                subOverallOpacityVal.textContent = this.value + '%';
                updateSliderBg(this);
                applySubStyles();
                saveSubSettings();
            });
        }

        var subTextShadowSelect = document.getElementById('sub-text-shadow-select');
        if (subTextShadowSelect) {
            subTextShadowSelect.value = subState.textShadow;
            subTextShadowSelect.addEventListener('change', function () {
                subState.textShadow = this.value;
                applySubStyles();
                saveSubSettings();
                haptic(6);
            });
        }

        var rb = document.getElementById('sub-custom-reset-btn');
        if (rb) rb.addEventListener('click', function () {
            subState.bgOpacity = '0.75';
            subState.color = '#ffffff';
            subState.bgColor = '#000000';
            subState.overallOpacity = '1';
            subState.textShadow = 'shadow';
            subState.font = 'sans';
            subState.size = 'medium';
            subState.pos = 'mid';
            subState.weight = '500';

            if (subBgOpacityRange) { subBgOpacityRange.value = 75; subBgOpacityVal.textContent = '75%'; updateSliderBg(subBgOpacityRange); }
            if (subBlurIntensityRange) { subBlurIntensityRange.value = 50; subBlurIntensityVal.textContent = '50%'; updateSliderBg(subBlurIntensityRange); }
            if (subTextSizeRange) { subTextSizeRange.value = 100; subTextSizeVal.textContent = '100%'; updateSliderBg(subTextSizeRange); }
            if (dr && dv) { dr.value = 0; subDelaySeconds = 0; dv.textContent = '0.0s'; updateSliderBg(dr); }
            if (subTextStyleSelect) subTextStyleSelect.value = 'sans';
            if (subPosSelect) subPosSelect.value = 'mid';
            if (subTextShadowSelect) subTextShadowSelect.value = 'shadow';
            if (subBoldToggle) subBoldToggle.classList.remove('on');
            if (subFixCapsToggle) subFixCapsToggle.classList.remove('on');
            if (subBgBlurToggle) subBgBlurToggle.classList.add('on');
            if (nativeSubToggle) nativeSubToggle.classList.remove('on');
            if (subOverallOpacityRange) { subOverallOpacityRange.value = 100; subOverallOpacityVal.textContent = '100%'; updateSliderBg(subOverallOpacityRange); }
            subtitleText.style.textTransform = '';
            applySubStyles();
            saveSubSettings();
            haptic(6);
        });

        var origOnSubTimeUpdate = v.onSubTimeUpdate;
        var _delayedTimeUpdate = function () {
            if (subState.activeTrack < 0 || !subState.cues.length) {
                if (_lastCueText !== '') { subtitleText.textContent = ''; _lastCueText = ''; }
                return;
            }
            var found = findCue(subState.cues, v.currentTime - subDelaySeconds);
            if (found !== _lastCueText) { subtitleText.textContent = found; _lastCueText = found; }
        };
        v.removeEventListener('timeupdate', onSubTimeUpdate);
        v.addEventListener('timeupdate', _delayedTimeUpdate);
    })();

    document.querySelectorAll('.settings-view').forEach(function (el) {
        el.style.display = 'none';
        el.classList.remove('active');
    });
}

(function () {
    if (!_hxInput) return;
    var SELECTOR = [
        'button', 'a[href]', '[role="button"]', '[role="tab"]',
        '[role="option"]', '[role="menuitem"]', '[tabindex]',
        '.settings-list-item', '.ep-item', '.ep-season-pill',
        '.ctrl-btn', '#track-wrap', '#next-ep-inner'
    ].join(',');
    document.addEventListener('click', function (e) {
        if (e.target.id === '__hx') return;
        var el = e.target.closest(SELECTOR);
        if (el) haptic();
    }, true);
    document.addEventListener('input', function (e) {
        if (e.target.type === 'range') haptic();
    }, true);
})();

(function () {
    if (!s) return;

    var epPanelBackdrop = document.getElementById('ep-panel-backdrop');
    var epPanel = document.getElementById('ep-panel');
    var epPanelSeasonView = document.getElementById('ep-panel-season-view');
    var epPanelEpisodeView = document.getElementById('ep-panel-episode-view');
    var epPanelShowTitle = document.getElementById('ep-panel-show-title');
    var epPanelSeasonTitle = document.getElementById('ep-panel-season-title');
    var epSeasonList = document.getElementById('ep-season-list');
    var epPanelEpList = document.getElementById('ep-panel-ep-list');
    var epPanelClose = document.getElementById('ep-panel-close');
    var epPanelEpBack = document.getElementById('ep-panel-ep-back');
    var epPanelCloseBtn = document.getElementById('ep-panel-close-btn');
    var btnEpisodes = document.getElementById('btn-episodes');

    var _epTotalSeasons = 1;
    var _epSeasonCache = {};
    var _epActiveSeason = parseInt(s);
    var _epCurrentEpisode = parseInt(e || '1');

    function openEpPanel() {
        epPanelBackdrop.style.display = 'block';
        requestAnimationFrame(function () {
            epPanelBackdrop.classList.add('open');
            epPanel.classList.add('open');
        });
        showEpSeasonView();
    }

    function closeEpPanel() {
        epPanelBackdrop.classList.remove('open');
        epPanel.classList.remove('open');
        setTimeout(function () { epPanelBackdrop.style.display = 'none'; }, 300);
    }

    function showEpSeasonView() {
        epPanelSeasonView.style.display = 'flex';
        epPanelSeasonView.style.flexDirection = 'column';
        epPanelEpisodeView.style.display = 'none';
        buildSeasonRows(epSeasonList, function (season) {
            showEpEpisodeView(season);
        });
    }

    function showEpEpisodeView(season) {
        epPanelSeasonTitle.textContent = 'Season ' + season;
        epPanelSeasonView.style.display = 'none';
        epPanelEpisodeView.style.display = 'flex';
        epPanelEpisodeView.style.flexDirection = 'column';
        buildPanelEpRows(season, epPanelEpList, function (epNum) {
            closeEpPanel();
            if (epNum !== _epCurrentEpisode || season !== _epActiveSeason) {
                location.href = location.pathname + '?id=' + id + '&season=' + season + '&episode=' + epNum + '&ap=1';
            }
        });
    }

    function buildSeasonRows(container, onSelect) {
        container.innerHTML = '';
        for (var i = 1; i <= _epTotalSeasons; i++) {
            (function (season) {
                var row = document.createElement('div');
                row.className = 'ep-season-row';
                row.innerHTML = 'Season ' + season + '<i class="fa-solid fa-chevron-right"></i>';
                row.addEventListener('click', function () { haptic(6); onSelect(season); });
                container.appendChild(row);
            })(i);
        }
    }

    function buildPanelEpRows(season, container, onSelect) {
        container.innerHTML = '<div style="padding:20px;text-align:center;"><svg width="28" height="28" viewBox="0 0 52 52" style="animation:_vyla_spin 0.9s linear infinite"><circle cx="26" cy="26" r="22" fill="none" stroke="rgba(255,255,255,0.4)" stroke-width="3.5" stroke-dasharray="100" stroke-dashoffset="70"/></svg></div>';
        fetchSeason(season, function (eps) {
            container.innerHTML = '';
            eps.forEach(function (ep) {
                var isCurrent = season === _epActiveSeason && ep.episode_number === _epCurrentEpisode;
                var row = document.createElement('div');
                row.className = 'ep-panel-ep-row' + (isCurrent ? ' current' : '');
                var thumbHtml = '<div class="ep-panel-ep-thumb">';
                if (ep.still_path) {
                    thumbHtml += '<img src="https://image.tmdb.org/t/p/w185' + ep.still_path + '" alt="">';
                } else {
                    thumbHtml += '<div class="ep-panel-ep-thumb-placeholder"><i class="fa-solid fa-film"></i></div>';
                }
                thumbHtml += '<span class="ep-panel-ep-badge">E' + ep.episode_number + '</span></div>';
                row.innerHTML = thumbHtml + '<div class="ep-panel-ep-info"><div class="ep-panel-ep-name">' + (ep.name || 'Episode ' + ep.episode_number) + '</div><div class="ep-panel-ep-meta">' + (ep.runtime ? ep.runtime + ' min' : '') + '</div></div>';
                if (!isCurrent) {
                    row.addEventListener('click', function () { haptic(10); onSelect(ep.episode_number); });
                }
                container.appendChild(row);
            });
            var cur = container.querySelector('.current');
            if (cur) setTimeout(function () { cur.scrollIntoView({ block: 'center', behavior: 'smooth' }); }, 80);
        });
    }

    function fallbackEps(season) {
        var arr = [];
        var count = (_epSeasonCache['_count_' + season]) || 20;
        for (var i = 1; i <= count; i++) arr.push({ episode_number: i, name: 'Episode ' + i, runtime: null, still_path: null });
        return arr;
    }

    function fetchSeason(season, cb) {
        if (_epSeasonCache[season] && _epSeasonCache[season]._real) { cb(_epSeasonCache[season]); return; }
        fetch('https://api.themoviedb.org/3/tv/' + id + '/season/' + season + '?api_key=' + TMDB_KEY + '&language=en-US&append_to_response=images')
            .then(function (r) {
                if (!r.ok) throw new Error('HTTP ' + r.status);
                return r.json();
            })
            .then(function (d) {
                if (!d.episodes || !d.episodes.length) throw new Error('no episodes');
                d.episodes._real = true;
                _epSeasonCache[season] = d.episodes;
                _epSeasonCache[season]._real = true;
                cb(_epSeasonCache[season]);
            })
            .catch(function () {
                _epSeasonCache[season] = null;
                cb(fallbackEps(season));
            });
    }

    fetch('https://api.themoviedb.org/3/tv/' + id + '?api_key=' + TMDB_KEY)
        .then(function (r) { return r.json(); })
        .then(function (d) {
            _epTotalSeasons = d.number_of_seasons || parseInt(s);
            if (epPanelShowTitle) epPanelShowTitle.textContent = d.name || '';
            if (btnEpisodes) btnEpisodes.style.display = '';
        })
        .catch(function () {
            if (btnEpisodes) btnEpisodes.style.display = '';
        });

    btnEpisodes && btnEpisodes.addEventListener('click', function (ev) { ev.stopPropagation(); openEpPanel(); haptic(10); });
    epPanelClose && epPanelClose.addEventListener('click', function () { closeEpPanel(); haptic(6); });
    epPanelCloseBtn && epPanelCloseBtn.addEventListener('click', function () { closeEpPanel(); haptic(6); });
    epPanelBackdrop && epPanelBackdrop.addEventListener('click', function () { closeEpPanel(); });
    epPanelEpBack && epPanelEpBack.addEventListener('click', function () { showEpSeasonView(); haptic(6); });
})();