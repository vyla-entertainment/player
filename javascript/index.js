var alive = true;
var shouldHideLoader = false;
var blocked = false;

(function () {
    var allowedOrigins = ['https://vyla.pages.dev', 'http://localhost', 'http://localhost:7860', 'http://169.254.162.163:7860'];
    var anc = document.referrer ? new URL(document.referrer).origin : '';
    var isLocalhost = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
    var isInIframe = window.self !== window.top;
    var isAllowedEmbed = isInIframe && allowedOrigins.some(function (o) { return anc.startsWith(o); });
    var isAllowedOrigin = allowedOrigins.some(function (o) { return location.origin === o; });

    if (!isLocalhost && (!isAllowedEmbed) && (!isAllowedOrigin)) {
        var loader = document.getElementById('loader');
        if (loader) {
            var p = new URLSearchParams(location.search);
            var t = p.get('type') || (p.get('s') ? 'tv' : 'movie');
            var mid = p.get('id');
            var season = p.get('s');
            var ep = p.get('e');
            var movieUrl = 'vyla.pages.dev/player?type=movie&id=' + (mid || 'tmdbid');
            var showUrl = 'vyla.pages.dev/player?type=tv&id=' + (mid || 'tmdbid') + '&s=' + (season || 'thenumber') + '&e=' + (ep || 'thenumber');
            document.getElementById('loader-msg').innerHTML =
                '<span class="loader-msg-title">This site cannot be visited this way.</span>' +
                '<span class="loader-msg-url">' + (t === 'tv'
                    ? 'vyla.pages.dev/player?type=tv&id=' + (mid || 'tmdbid') + '&s=' + (season || 'thenumber') + '&e=' + (ep || 'thenumber')
                    : 'vyla.pages.dev/player?type=movie&id=' + (mid || 'tmdbid')) + '</span>';
        }
        blocked = true;
        return;
    }
})();

function initLoaderBackdrop() {
    var loaderBg = document.getElementById('loader-bg');
    if (!loaderBg) return;

    var p = new URLSearchParams(location.search);
    var id = p.get('id');

    var isTv = !!p.get('s');
    var tmdbUrl = isTv ? '/api?tmdb_tv=1&id=' + id : '/api?tmdb_movie=1&id=' + id;

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

    if (meta && meta.images && meta.images.logos && meta.images.logos.length > 0) {
        var logo = meta.images.logos[0];
        var logoUrl = 'https://image.tmdb.org/t/p/w300' + logo.file_path;

        titleElement.innerHTML = '<img src="' + logoUrl + '" alt="' + titleText + '" style="max-height:24px;max-width:200px;object-fit:contain;">';
    } else if (meta && meta.logo_object && meta.logo_object.file_path) {
        var logoUrl = 'https://image.tmdb.org/t/p/w300' + meta.logo_object.file_path;

        titleElement.innerHTML = '<img src="' + logoUrl + '" alt="' + titleText + '" style="max-height:24px;max-width:200px;object-fit:contain;">';
    } else {
        if (meta && meta.images) {
        }
        titleElement.textContent = titleText;
    }
}

function isMobile() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

document.addEventListener('DOMContentLoaded', function () {
    if (!blocked) {
        initLoaderBackdrop();
    }

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
    if (e.key === 'F' || e.key === 'f') {
        var player = document.getElementById('player');
        var v = document.getElementById('v');
        if (/iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream) {
            if (v && v.webkitDisplayingFullscreen) {
                v.webkitExitFullscreen();
            } else if (v) {
                v.webkitEnterFullscreen();
            }
            return;
        }
        var fsElement = document.fullscreenElement ||
            document.webkitFullscreenElement ||
            document.mozFullScreenElement ||
            document.msFullscreenElement;
        if (!fsElement) {
            if (player.requestFullscreen) player.requestFullscreen();
            else if (player.webkitRequestFullscreen) player.webkitRequestFullscreen();
            else if (player.mozRequestFullScreen) player.mozRequestFullScreen();
            else if (player.msRequestFullscreen) player.msRequestFullscreen();
        } else {
            if (document.exitFullscreen) document.exitFullscreen();
            else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
            else if (document.mozCancelFullScreen) document.mozCancelFullScreen();
            else if (document.msExitFullscreen) document.msExitFullscreen();
        }
    }
});

var p = new URLSearchParams(location.search);
var id = p.get('id'), s = p.get('s'), e = p.get('e'), ap = p.get('ap');

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

if (!blocked) {
    if (id) {
        var apiUrl = '/api?' + (s ? 'id=' + id + '&s=' + s + '&e=' + (e || '1') : 'id=' + id);

        (function () {
            var SOURCES = [];
            var TIMEOUTS = [];
            var ITEM_H = 54;
            var track = document.getElementById('loader-sources-track');
            var subtitle = document.getElementById('loader-sources-subtitle');
            if (!track) return;

            var sourceTimeouts = {};
            var fallbackSources = [];
            var fallbackTimeouts = [];

            var subtitleStates = {
                fetching: 'Fetching sources\u2026',
                testing: 'Testing stream\u2026',
                found: 'Stream found',
                retrying: 'Trying next source\u2026',
            };

            function setSubtitle(state) {
                if (!subtitle) return;
                subtitle.textContent = subtitleStates[state] || state;
            }

            function buildCarousel(names, timeouts) {
                track.innerHTML = '';
                SOURCES = names.map(function (name, i) {
                    return { name: name, timeout: timeouts[i] || 20000 };
                });
                TIMEOUTS = SOURCES.map(function (s) { return s.timeout; });
                SOURCES.forEach(function (src) {
                    var el = document.createElement('div');
                    el.className = 'loader-source-item';
                    el.innerHTML =
                        '<div class="loader-source-ring"></div>' +
                        '<div class="loader-source-info">' +
                        '<span class="loader-source-name">' + src.name + '</span>' +
                        '<span class="loader-source-status"></span>' +
                        '</div>';
                    track.appendChild(el);
                });
                activeIndex = 0;
                destroyed = false;
                updateClasses();
                setSubtitle('fetching');
                scheduleNext(0);
            }

            buildCarousel(fallbackSources, fallbackTimeouts);

            fetch('/api?sources=1&id=' + id + (s ? '&s=' + s + '&e=' + (e || '1') : ''))
                .then(function (r) { return r.json(); })
                .then(function (data) {
                    if (data.sources && data.sources.length) {
                        clearTimeout(stepTimer);
                        var names = data.sources.map(function (source) {
                            return source.label || source.source || 'unknown';
                        });
                        var timeouts = data.sources.map(function (source) {
                            return source.timeout || 20000;
                        });
                        buildCarousel(names, timeouts);
                        setSubtitle('testing');
                    }
                })
                .catch(function () { });

            var activeIndex = 0;
            var destroyed = false;
            var stepTimer = null;

            function getOffset(idx) {
                return -(idx * ITEM_H);
            }

            function setItemStatus(idx, text) {
                var items = track.querySelectorAll('.loader-source-item');
                if (!items[idx]) return;
                var statusEl = items[idx].querySelector('.loader-source-status');
                if (statusEl) statusEl.textContent = text;
            }

            function updateClasses() {
                var items = track.querySelectorAll('.loader-source-item');
                items.forEach(function (el, i) {
                    el.classList.remove('lsi-active', 'lsi-adjacent', 'lsi-done', 'lsi-failed');
                    var statusEl = el.querySelector('.loader-source-status');

                    if (i === activeIndex) {
                        el.classList.add('lsi-active');
                        setItemStatus(i, 'Connecting\u2026');
                    } else if (i === activeIndex - 1) {
                        el.classList.add('lsi-adjacent', 'lsi-failed');
                        if (statusEl) statusEl.textContent = 'No response';
                    } else if (i === activeIndex + 1) {
                        el.classList.add('lsi-adjacent');
                        if (statusEl) statusEl.textContent = '';
                    } else {
                        if (i < activeIndex) {
                            el.classList.add('lsi-done');
                        }
                        if (statusEl) statusEl.textContent = '';
                    }
                });
                track.style.transform = 'translateY(' + getOffset(activeIndex) + 'px)';
            }

            function scheduleNext(idx) {
                if (destroyed) return;
                setItemStatus(idx, 'Connecting\u2026');
            }

            var _origHide = window.hideLoader;
            window.hideLoader = function () {
                destroyed = true;
                clearTimeout(stepTimer);
                stepTimer = null;
                if (track) track.innerHTML = '';
                var carousel = document.getElementById('loader-sources-carousel');
                if (carousel) carousel.style.display = 'none';
                var errScreen = document.getElementById('error-screen');
                if (errScreen) errScreen.classList.remove('show');
                if (_origHide) _origHide();
            };
        })();

        function fetchWithRetry(attempts) {
            return fetch(apiUrl)
                .then(function (r) {
                    var ct = r.headers.get('Content-Type') || '';
                    if (ct.includes('application/json')) {
                        return r.json().then(function (d) {
                            if (d.error || !d.url) {
                                throw new Error(d.error || 'no url');
                            }
                            return { type: 'json', data: d };
                        });
                    } else if (ct.includes('mpegurl') || ct.includes('m3u8')) {
                        return { type: 'm3u8', url: apiUrl };
                    } else {
                        throw new Error('unexpected content type');
                    }
                })
                .catch(function (err) {
                    if (attempts > 0) {
                        return new Promise(function (resolve) {
                            setTimeout(function () {
                                resolve(fetchWithRetry(attempts - 1));
                            }, 500);
                        });
                    }
                    throw err;
                });
        }

        fetchWithRetry(2)
            .then(function (result) {
                shouldHideLoader = true;
                hideLoader();
                if (result.type === 'json') {
                    play(result.data.url, true, id);
                    var title = 'Unknown';
                    if (result.data.meta) {
                        var m = result.data.meta;
                        title = (m.title || m.name || 'Unknown');
                        if ('mediaSession' in navigator) {
                            var img = 'https://image.tmdb.org/t/p/w500' + (m.still_path || m.backdrop_path || m.poster_path);
                            navigator.mediaSession.metadata = new MediaMetadata({
                                title: title,
                                artwork: [{ src: img, sizes: '500x500', type: 'image/jpeg' }]
                            });
                        }
                    }
                    if (s) title += ' \u00b7 S' + s + 'E' + (e || '1');
                    document.title = title;

                    var isTv = !!s;
                    var tmdbUrl = isTv ? '/api?tmdb_tv=1&id=' + id + '&append_to_response=images' : '/api?tmdb_movie=1&id=' + id + '&append_to_response=images';
                    fetch(tmdbUrl)
                        .then(function (mr) {
                            if (!mr.ok) {
                                throw new Error('TMDB fetch failed: ' + mr.status);
                            }
                            return mr.json();
                        })
                        .then(function (meta) {
                            setTitleWithTmdbImage(title, meta);
                        })
                        .catch(function (err) {
                            document.getElementById('title-text').textContent = title;
                        });

                    showNowPlayingToast(title);
                } else if (result.type === 'm3u8') {
                    var isTv = !!s;
                    var tmdbUrl = isTv ? '/api?tmdb_tv=1&id=' + id + '&append_to_response=images' : '/api?tmdb_movie=1&id=' + id + '&append_to_response=images';

                    fetch(tmdbUrl)
                        .then(function (mr) {
                            if (!mr.ok) {
                                throw new Error('TMDB fetch failed: ' + mr.status);
                            }
                            return mr.json();
                        })
                        .then(function (meta) {
                            if (meta.success === false) {
                                throw new Error(meta.status_message);
                            }
                            var title = (meta.title || meta.name || 'Unknown');
                            if (s) title += ' \u00b7 S' + s + 'E' + (e || '1');
                            document.title = title;
                            setTitleWithTmdbImage(title, meta);
                            showNowPlayingToast(title);
                            if ('mediaSession' in navigator) {
                                var img = 'https://image.tmdb.org/t/p/w500' + (meta.poster_path || meta.backdrop_path);
                                navigator.mediaSession.metadata = new MediaMetadata({
                                    title: title,
                                    artwork: [{ src: img, sizes: '500x500', type: 'image/jpeg' }]
                                });
                            }
                        })
                        .catch(function (err) {
                        });
                    play(result.url, true, id);
                }
            }).catch(function (err) {
                var carousel = document.getElementById('loader-sources-carousel');
                if (carousel) carousel.style.display = 'none';
                var loaderMsg = document.getElementById('loader-msg');
                if (loaderMsg) loaderMsg.style.display = 'none';
                var errText = document.querySelector('.err-text');
                if (errText) errText.innerHTML = '</i> Stream Unavailable';
                var errSub = document.querySelector('.err-sub');
                if (!errSub) {
                    errText && errText.insertAdjacentHTML('afterend', '<div class="err-sub">No working sources were found for this title. It may be unavailable or the ID may be incorrect.</div>');
                }
                document.getElementById('error-screen').classList.add('show');
            });
    } else {
        var errText = document.querySelector('.err-text');
        if (errText) {
            errText.innerHTML = 'No ID Provided';
            document.querySelector('.err-text + *') && (document.querySelector('.err-text').insertAdjacentHTML('afterend', '<div class="err-sub">Add an <code>?id=</code> parameter to the URL — e.g. <code>?id=550</code> for a movie or <code>?id=1396&s=1&e=1</code> for a show.</div>'));
        }
        document.getElementById('error-screen').classList.add('show');
    }
}

var _hxInput = (function () {
    if (!('ontouchstart' in window) && navigator.maxTouchPoints === 0) return null;
    var s = document.createElement('input');
    s.type = 'checkbox';
    s.setAttribute('switch', '');
    s.setAttribute('aria-hidden', 'true');
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
    var proxyUrl = 'https://vyla-api.pages.dev/api/proxy?url=' + encodeURIComponent(sub.url);
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

function play(raw, skipProxy, videoId) {
    var src = (skipProxy || raw.startsWith('/api')) ? raw : '/api?url=' + encodeURIComponent(raw);
    var v = document.getElementById('v');
    var controlsWrapper = document.getElementById('player-controls-wrapper');
    var titleBar = document.getElementById('title-bar');
    var trackEl = document.getElementById('track');
    var wrap = document.getElementById('track-wrap');
    var prog = document.getElementById('prog');
    var bufEl = document.getElementById('buf');
    var thumb = document.getElementById('thumb');
    var tCur = document.getElementById('t-cur');
    var tDur = document.getElementById('t-dur');
    var playIco = document.getElementById('play-ico');
    var ci = document.getElementById('ci');
    var skipL = document.getElementById('skip-left');
    var skipR = document.getElementById('skip-right');
    var skipLLbl = document.getElementById('skip-left-lbl');
    var skipRLbl = document.getElementById('skip-right-lbl');
    var tapL = document.getElementById('tap-left');
    var tapR = document.getElementById('tap-right');
    var btnPip = document.getElementById('btn-pip');
    var btnFullscreen = document.getElementById('btn-fullscreen');
    var btnSettings = document.getElementById('btn-settings');
    var settingsPanel = document.getElementById('settings-panel');
    var speedOpts = document.querySelectorAll('.settings-list-item[data-speed]');
    var qualityOptsEl = document.getElementById('quality-opts');
    var subtitleOptsEl = document.getElementById('subtitle-opts');
    var btnSource = null;
    var sourceBtnWrap = document.getElementById('source-title-wrap');
    var sourceDropdown = document.getElementById('source-dropdown');
    var sourceBtnLabel = document.getElementById('source-sub-label'); var sourceBtnWrap = document.getElementById('source-title-wrap');
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
    var menuGroups = [];

    var hideTimer = null;
    var tapTimer = null;
    var tapCount = 0;
    var tapSide = null;
    var skipTimers = { left: null, right: null };
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

    function showUI(pin) {
        controlsWrapper.classList.add('on');
        titleBar.classList.add('on');
        document.getElementById('player').classList.add('ui-on');
        shown = true;
        clearTimeout(hideTimer);
        if (!pin && !v.paused && !settingsOpen) {
            hideTimer = setTimeout(hideUI, 3200);
        }
    }

    function hideUI() {
        if (settingsOpen) return;
        controlsWrapper.classList.remove('on');
        titleBar.classList.remove('on');
        document.getElementById('player').classList.remove('ui-on');
        shown = false;
    }

    function syncIcon() {
        playIco.className = v.paused ? 'fa-solid fa-play' : 'fa-solid fa-pause';
    }

    function flashCenter() {
        ci.className = v.paused ? 'fa-solid fa-play' : 'fa-solid fa-pause';
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

    function doSkip(dir, taps) {
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
        var delay = 800;

        retryTimer = setTimeout(function () {
            if (!isNaN(v.duration) && v.duration > 0) return;
            if (v.readyState >= 2) return;
            retryCount++;
            showBuffering();
            var endpoint = '/api?' + (s ? 'id=' + id + '&s=' + s + '&e=' + (e || '1') : 'id=' + id);
            fetch(endpoint)
                .then(function (r) { return r.json(); })
                .then(function (d) {
                    if (!d.url) { scheduleRetry(); return; }
                    var newSrc = d.url; if (Hls.isSupported()) {
                        hls.stopLoad();
                        hls.detachMedia();
                        hls.loadSource(newSrc);
                        hls.attachMedia(v);
                    } else {
                        v.src = newSrc;
                        v.load();
                    }
                    scheduleRetry();
                })
                .catch(function () { scheduleRetry(); });
        }, delay);
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

    function hideBuffering() {
        clearTimeout(bufferingTimeout);
        bufSpinner.classList.remove('active');
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
            },
        };
        var hls = new Hls(hlsConfig);
        hls.loadSource(src);
        hls.attachMedia(v);
        hls.on(Hls.Events.MANIFEST_PARSED, function () {
            buildQualityOpts();
        });
        hls.on(Hls.Events.LEVEL_SWITCHED, function () {
            if (isAutoQuality) {
                updateQualityLabel();
            }
        });
        hls.on(Hls.Events.LEVEL_LOADED, function () {
            if (!isNaN(v.duration) && v.duration > 0) {
                clearTimeout(retryTimer);
                retryCount = maxRetries;
            }
        });
        v.addEventListener('loadedmetadata', function () {
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
        hls.on(Hls.Events.ERROR, function (event, data) {
            if (data.fatal) {
                if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
                    if (data.details === 'keyLoadError') {
                        return;
                    }
                    hls.startLoad();
                } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
                    hls.recoverMediaError();
                }
            }
        });
    } else if (v.canPlayType('application/vnd.apple.mpegurl')) {
        v.src = src;
        v.addEventListener('loadedmetadata', function () {
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

    var PROXY = 'https://vyla-api.pages.dev/api/proxy?url=';
    var vylaBase = 'https://vyla-api.pages.dev';
    var vylaEndpoint = s
        ? (vylaBase + '/api/subtitles/tv/' + id + '/' + s + '/' + (e || '1'))
        : (vylaBase + '/api/subtitles/movie/' + id);

    var subLangList = document.getElementById('subtitle-opts');

    document.getElementById('lbl-subtitle').textContent = 'Loading\u2026';

    subLangList.innerHTML = '<div class="sub-skeleton">' +
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

    function fingerprint(cues) {
        return cues.slice(0, 3).map(function (c) {
            return c.start.toFixed(1) + ':' + c.text.slice(0, 24);
        }).join('|');
    }

    fetch(vylaEndpoint)
        .then(function (r) { return r.json(); })
        .then(function (d) {
            var subs = Array.isArray(d) ? d : (d.subtitles || []);
            subs = subs.filter(function (sub) {
                return sub && (sub.file || sub.url) && sub.label;
            });

            if (!subs.length) {
                document.getElementById('lbl-subtitle').textContent = 'Off';
                subLangList.innerHTML =
                    '<div class="sub-lang-empty" style="color:var(--white-45);cursor:default;font-size:13px;padding:12px 14px;text-align:center;">' +
                    '<i style="margin-bottom:8px;display:block;font-size:16px;"></i> None available</div>';
                return;
            }

            window.availableSubtitles = subs;

            buildSubtitleList(subs);

            document.getElementById('lbl-subtitle').textContent = 'Off';

            var mainToggle = document.getElementById('subtitle-toggle');
            if (mainToggle) {
                if (subState.activeTrack >= 0) {
                    mainToggle.classList.add('on');
                } else {
                    mainToggle.classList.remove('on');
                }
            }
        })
        .catch(function () {
            document.getElementById('lbl-subtitle').textContent = 'Off';

            var mainToggle = document.getElementById('subtitle-toggle');
            if (mainToggle) {
                mainToggle.classList.remove('on');
            }
        });

    var langCodeMap = {
        english: 'gb', arabic: 'sa', bosnian: 'ba', bulgarian: 'bg',
        chinese: 'cn', croatian: 'hr', czech: 'cz', danish: 'dk',
        dutch: 'nl', finnish: 'fi', french: 'fr', german: 'de',
        greek: 'gr', hebrew: 'il', hindi: 'in', hungarian: 'hu',
        indonesian: 'id', italian: 'it', japanese: 'jp', korean: 'kr',
        malay: 'my', norwegian: 'no', persian: 'ir', polish: 'pl',
        portuguese: 'pt', romanian: 'ro', russian: 'ru', serbian: 'rs',
        slovak: 'sk', slovenian: 'si', spanish: 'es', swedish: 'se',
        thai: 'th', turkish: 'tr', ukrainian: 'ua', vietnamese: 'vn',
        catalan: 'es', latvian: 'lv', lithuanian: 'lt', estonian: 'ee',
        albanian: 'al', macedonian: 'mk', bengali: 'bd', tamil: 'in',
        urdu: 'pk', swahili: 'ke', afrikaans: 'za', icelandic: 'is',
        maltese: 'mt', welsh: 'gb', irish: 'ie'
    };

    function getLangFlag(label) {
        if (!label) return null;
        var key = label.toLowerCase().replace(/[^a-z]/g, ' ').trim().split(' ')[0];
        return langCodeMap[key] || null;
    }

    function buildSubtitleList(subs) {
        subLangList.innerHTML = '';

        subs.forEach(function (sub, i) {
            var btn = document.createElement('div');
            btn.className = 'sub-lang-item';
            var code = getLangFlag(sub.label);
            var flagHtml = code
                ? '<img src="https://flagcdn.com/20x15/' + code + '.png" width="20" height="15" style="border-radius:2px;flex-shrink:0;object-fit:cover;" alt="">'
                : '<span style="width:20px;height:15px;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;"><i class="fa-solid fa-globe" style="font-size:13px;color:var(--white-45);"></i></span>';
            btn.innerHTML =
                flagHtml +
                '<span class="sub-lang-name">' + sub.label + '</span>' +
                '<i class="fa-solid fa-circle-check sub-active-check" style="display:none;"></i>';
            btn.addEventListener('click', function (ev) {
                ev.stopPropagation();

                btn.classList.add('loading');
                var check = btn.querySelector('.sub-active-check');
                if (check) check.style.display = 'none';

                loadSubtitle(sub, i, btn);
            });
            subLangList.appendChild(btn);
        });
    }

    function loadSubtitle(sub, index, btn) {
        fetchSub(sub.file || sub.url)
            .then(function (cues) {
                document.querySelectorAll('.sub-lang-item, .sub-off-item').forEach(function (el) {
                    el.classList.remove('active-sub-item', 'loading');
                    var check = el.querySelector('.sub-active-check');
                    if (check) check.style.display = 'none';
                });

                btn.classList.add('active-sub-item');
                var check = btn.querySelector('.sub-active-check');
                if (check) check.style.display = 'block';

                subState.activeTrack = index;
                subState.cues = cues;
                _lastCueText = null;
                document.getElementById('lbl-subtitle').textContent = sub.label;

                var mainToggle = document.getElementById('subtitle-toggle');
                if (mainToggle) {
                    mainToggle.classList.add('on');
                }

                haptic(6);
                showUI(true);
            })
            .catch(function () {
                btn.classList.remove('loading');
            });
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

    var lsBack = document.getElementById('landscape-back-btn');
    if (lsBack) lsBack.addEventListener('click', function () {
        document.getElementById('settings-modal-wrap').classList.remove('open');
        document.getElementById('settings-overlay-backdrop').classList.remove('open');
    });

    function showSettingsView(name) {
        document.querySelectorAll('.settings-view').forEach(function (el) {
            el.classList.remove('active');
            el.style.display = 'none';
        });
        var target = document.getElementById('settings-view-' + name);
        if (target) {
            target.style.display = 'flex';
            target.classList.add('active');
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

    document.querySelectorAll('.settings-tile').forEach(function (tile) {
        tile.addEventListener('click', function (e) {
            e.stopPropagation();
            var nav = this.dataset.nav;
            if (nav) { showSettingsView(nav); haptic(6); }
        });
    });

    document.querySelector('.settings-tile[data-nav="sources"]').addEventListener('click', function (e) {
        e.stopPropagation();
        showSettingsView('sources');
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
                ? `https://vyla-api.pages.dev/api/downloads/tv/${id}/${s}/${episode}`
                : `https://vyla-api.pages.dev/api/downloads/movie/${id}`;

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

        var loaderEl = document.getElementById('loader');
        var track = document.getElementById('loader-sources-track');

        if (loaderEl) {
            if (track) track.innerHTML = '';
            loaderEl.style.display = '';
            loaderEl.classList.remove('out');
        }

        if (Hls.isSupported() && typeof hls !== 'undefined') {
            hls.destroy();
            hls = new Hls();
            hls.loadSource(url);
            hls.attachMedia(v);
            v.addEventListener('canplay', function onSwitch() {
                v.removeEventListener('canplay', onSwitch);
                v.currentTime = savedTime;
                if (wasPlaying) v.play();
                if (loaderEl) {
                    loaderEl.classList.add('out');
                    setTimeout(function () { loaderEl.style.display = 'none'; }, 1000);
                }
            }, { once: true });
        }
    }

    var sources = [];
    var currentSourceIndex = 0;

    function buildSourceList() {
        var sourcesOpts = document.getElementById('sources-opts');
        if (!sourcesOpts) return;
        sourcesOpts.innerHTML = '';
        var activeName = sources[currentSourceIndex] ? (sources[currentSourceIndex].source || 'Source') : 'Source';
        activeName = activeName.charAt(0).toUpperCase() + activeName.slice(1);
        var lblSource = document.getElementById('lbl-source');
        if (lblSource) lblSource.textContent = activeName;
        sources.forEach(function (source, i) {
            var isActive = i === currentSourceIndex;
            var name = source.source || 'Source ' + (i + 1);
            name = name.charAt(0).toUpperCase() + name.slice(1);
            var item = document.createElement('div');
            item.className = 'settings-list-item' + (isActive ? ' active' : '');
            item.innerHTML = '<i class="fa-' + (isActive ? 'solid fa-circle-dot' : 'regular fa-circle') + '"></i>' + name;
            if (!isActive) {
                item.addEventListener('click', function () {
                    currentSourceIndex = i;
                    closeSettings();
                    haptic(10);
                    switchSource(source.url);
                    buildSourceList();
                });
            }
            sourcesOpts.appendChild(item);
        });
    }

    function fetchSources() {
        var sourcesOpts = document.getElementById('sources-opts');
        if (sourcesOpts) sourcesOpts.innerHTML = '<div class="source-skeleton"><div class="source-skel-item"></div><div class="source-skel-item"></div><div class="source-skel-item"></div></div>';
        var endpoint = s ? '/api?sources=1&id=' + id + '&s=' + s + '&e=' + (e || '1') : '/api?sources=1&id=' + id;
        fetch(endpoint)
            .then(function (r) { return r.json(); })
            .then(function (d) {
                if (!d.sources || !d.sources.length) return;
                sources = d.sources;
                currentSourceIndex = 0;
                var playingUrl = src;
                for (var i = 0; i < sources.length; i++) {
                    if (sources[i].url === playingUrl) { currentSourceIndex = i; break; }
                }
                buildSourceList();
            })
            .catch(function () { });
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
            fsIcon.className = (fsEl || iosFs) ? 'fa-solid fa-compress' : 'fa-solid fa-expand';
        }
        document.addEventListener('fullscreenchange', updateFsIcon);
        document.addEventListener('webkitfullscreenchange', updateFsIcon);
        document.addEventListener('mozfullscreenchange', updateFsIcon);
        document.addEventListener('MSFullscreenChange', updateFsIcon);
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
        if (e.key === 'ArrowLeft') { doSkip('left', 1); showUI(); }
        if (e.key === 'ArrowRight') { doSkip('right', 1); showUI(); }
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
                    kbHint.style.cssText = 'position:fixed;bottom:90px;left:50%;transform:translateX(-50%);z-index:99999;background:rgba(0,0,0,0.78);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);border-radius:14px;padding:16px 22px;display:flex;flex-direction:column;gap:10px;pointer-events:none;transition:opacity 0.25s ease;';
                    shortcuts.forEach(function (s) {
                        var row = document.createElement('div');
                        row.style.cssText = 'display:flex;align-items:center;gap:14px;';
                        row.innerHTML = '<span style="background:rgba(255,255,255,0.12);border-radius:6px;padding:3px 10px;font-size:12px;font-weight:700;color:#fff;letter-spacing:0.04em;min-width:36px;text-align:center;font-family:var(--font);">' + s.key + '</span><span style="font-size:13px;color:rgba(255,255,255,0.75);font-family:var(--font);font-weight:500;">' + s.desc + '</span>';
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
        if (!v.paused) showUI();
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
            tDur.textContent = fmt(v.duration);
            clearTimeout(retryTimer);
            retryCount = maxRetries;
            hideBuffering();
            restoreTimestamp();
        }
    });

    setTimeout(function () {
        restoreTimestamp();
    }, 2000);

    v.addEventListener('play', function () { syncIcon(); showUI(); });
    v.addEventListener('pause', function () {
        syncIcon();
        showUI(true);
        clearTimeout(hideTimer);
        var videoKey = (s ? videoId + '_s' + s + '_e' + (e || '1') : videoId);
        saveTimestamp(videoKey, v.currentTime);
    });

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

            fetch('/api?id=' + id + '&s=' + nextS + '&e=' + nextE)
                .then(function (r) { return r.json(); })
                .then(function (d) {
                    if (d.error || !d.url) {
                        fetch('/api?id=' + id + '&s=' + (nextS + 1) + '&e=1')
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
                                            location.href = location.pathname + '?id=' + id + '&s=' + (nextS + 1) + '&e=1&ap=1';
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
                                location.href = location.pathname + '?id=' + id + '&s=' + nextS + '&e=' + nextE + '&ap=1';
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
            fetch('/api?id=' + id + '&s=' + nextS + '&e=' + nextE)
                .then(function (r) { return r.json(); })
                .then(function (d) {
                    if (d.error || !d.url) {
                        return fetch('/api?id=' + id + '&s=' + (nextS + 1) + '&e=1')
                            .then(function (r) { return r.json(); })
                            .then(function (d2) {
                                if (d2.error || !d2.url) return;
                                var t = d2.meta ? (d2.meta.title || d2.meta.name || 'Unknown') : 'Unknown';
                                nextEpLabel.textContent = 'S' + (nextS + 1) + ' E1 \u00b7 ' + t;
                                nextEpHref = location.pathname + '?id=' + id + '&s=' + (nextS + 1) + '&e=1&ap=1';
                                nextEpReady = true;
                            });
                    }
                    var t = d.meta ? (d.meta.title || d.meta.name || 'Unknown') : 'Unknown';
                    nextEpLabel.textContent = 'S' + nextS + ' E' + nextE + ' \u00b7 ' + t;
                    nextEpHref = location.pathname + '?id=' + id + '&s=' + nextS + '&e=' + nextE + '&ap=1';
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

    (function () {
        if (!s) return;

        var epPanel = document.getElementById('ep-panel');
        var epOverlay = document.getElementById('ep-panel-overlay');
        var epList = document.getElementById('ep-list');
        var epCurrentTitle = document.getElementById('ep-current-title');
        var epPanelOpen = false;
        var epSeasonData = {};
        var currentSeason = parseInt(s);
        var currentEpisode = parseInt(e || '1');
        var activeSeason = currentSeason;
        var totalSeasons = 1;

        epCurrentTitle.style.display = '';

        fetch('/api?tmdb_season=1&id=' + id + '&s=' + currentSeason)
            .then(function (r) { return r.json(); })
            .then(function (d) {
                if (d.episodes) {
                    var currentEp = d.episodes.find(function (ep) {
                        return ep.episode_number === currentEpisode;
                    });
                    if (currentEp && currentEp.name) {
                        epCurrentTitle.textContent = 'S' + currentSeason + ' E' + currentEpisode + ' \u00b7 ' + currentEp.name;
                    } else {
                        epCurrentTitle.textContent = 'S' + currentSeason + ' E' + currentEpisode;
                    }
                } else {
                    epCurrentTitle.textContent = 'S' + currentSeason + ' E' + currentEpisode;
                }
            })
            .catch(function () {
                epCurrentTitle.textContent = 'S' + currentSeason + ' E' + currentEpisode;
            });

        function openEpPanel() {
            epPanelOpen = true;
            epPanel.classList.add('open');
            epOverlay.classList.add('show');
            showUI(true);
            haptic(10);
        }

        function closeEpPanel() {
            epPanelOpen = false;
            epPanel.classList.remove('open');
            epOverlay.classList.remove('show');
            if (!v.paused) {
                clearTimeout(hideTimer);
                hideTimer = setTimeout(hideUI, 3200);
            }
        }

        epCurrentTitle.addEventListener('click', function (ev) {
            ev.stopPropagation();
            epPanelOpen ? closeEpPanel() : openEpPanel();
        });

        var overlayTouchMoved = false;
        epOverlay.addEventListener('touchstart', function () { overlayTouchMoved = false; }, { passive: true });
        epOverlay.addEventListener('touchmove', function () { overlayTouchMoved = true; }, { passive: true });
        epOverlay.addEventListener('click', function () { if (!overlayTouchMoved) closeEpPanel(); });

        epPanel.addEventListener('click', function (ev) { ev.stopPropagation(); });
        ['mousedown', 'pointerdown'].forEach(function (ev) {
            epPanel.addEventListener(ev, function (e2) { e2.stopPropagation(); });
        });

        function buildSeasonPills() {
            var pillsEl = document.getElementById('ep-season-pills');
            pillsEl.innerHTML = '';
            for (var i = 1; i <= totalSeasons; i++) {
                (function (season) {
                    var pill = document.createElement('div');
                    pill.className = 'ep-season-pill' + (season === activeSeason ? ' active' : '');
                    pill.textContent = 'Season ' + season;
                    pill.addEventListener('click', function (ev) {
                        ev.stopPropagation();
                        activeSeason = season;
                        buildSeasonPills();
                        renderEpisodes(activeSeason);
                        haptic(6);
                    });
                    pillsEl.appendChild(pill);
                })(i);
            }
            var activePill = pillsEl.querySelector('.ep-season-pill.active');
            if (activePill) {
                setTimeout(function () {
                    activePill.scrollIntoView({ inline: 'center', behavior: 'smooth', block: 'nearest' });
                }, 50);
            }
        }

        function updateSeasonNav() {
            buildSeasonPills();
        }

        function renderEpisodes(season) {
            var eps = epSeasonData[season];
            var t0 = performance.now();

            function doRender(items) {
                var newList = document.createElement('div');
                newList.style.cssText = 'opacity:0;transition:opacity 0.22s ease;';

                if (!items) {
                    for (var s = 0; s < 10; s++) {
                        var skel = document.createElement('div');
                        skel.className = 'ep-item ep-item-skeleton';
                        skel.innerHTML =
                            '<div class="ep-thumb ep-skel-block"></div>' +
                            '<div class="ep-info">' +
                            '<div class="ep-skel-line ep-skel-line--title"></div>' +
                            '<div class="ep-skel-line ep-skel-line--meta"></div>' +
                            '</div>';
                        newList.appendChild(skel);
                    }
                } else {
                    items.forEach(function (ep) {
                        var isCurrent = (season === currentSeason && ep.episode_number === currentEpisode);
                        var item = document.createElement('div');
                        item.className = 'ep-item' + (isCurrent ? ' current' : '');

                        var thumbHtml = '<div class="ep-thumb">';
                        if (ep.still_path) {
                            thumbHtml += '<img src="https://image.tmdb.org/t/p/w185' + ep.still_path + '" alt="">';
                        } else {
                            thumbHtml += '<div class="ep-thumb-placeholder"><i class="fa-solid fa-film"></i></div>';
                        }
                        thumbHtml += '<span class="ep-num-badge">E' + ep.episode_number + '</span></div>';

                        item.innerHTML = thumbHtml +
                            '<div class="ep-info">' +
                            '<div class="ep-info-row"><span class="ep-name">' + (ep.name || 'Episode ' + ep.episode_number) + '</span></div>' +
                            '<div class="ep-meta">' + (ep.runtime ? ep.runtime + ' min' : '') + '</div>' +
                            '</div>';

                        if (!isCurrent) {
                            item.addEventListener('click', function () {
                                haptic(10);
                                location.href = location.pathname + '?id=' + id + '&s=' + season + '&e=' + ep.episode_number + '&ap=1';
                            });
                        }
                        newList.appendChild(item);
                    });
                }

                epList.style.opacity = '0';
                epList.style.transition = 'opacity 0.18s ease';

                setTimeout(function () {
                    epList.innerHTML = '';
                    epList.scrollTop = 0;
                    epList.appendChild(newList);

                    epList.style.opacity = '1';
                    setTimeout(function () {
                        newList.style.opacity = '1';
                    }, 10);

                    if (items) {
                        var currentItem = epList.querySelector('.ep-item.current');
                        if (currentItem) {
                            setTimeout(function () {
                                currentItem.scrollIntoView({ block: 'center', behavior: 'smooth' });
                            }, 80);
                        }
                    }
                }, 180);
            }

            if (!eps) {
                doRender(null);
                fetchSeason(season, function () {
                    renderEpisodes(season);
                });
                return;
            }

            doRender(eps);
        }

        function fetchSeason(season, cb) {
            fetch('/api?tmdb_season=1&id=' + id + '&s=' + season)
                .then(function (r) { return r.json(); })
                .then(function (d) {
                    epSeasonData[season] = d.episodes || generateFallback(season);
                    if (cb) cb();
                })
                .catch(function () {
                    epSeasonData[season] = generateFallback(season);
                    if (cb) cb();
                });
        }

        function generateFallback(season) {
            var arr = [];
            for (var i = 1; i <= 20; i++) arr.push({ episode_number: i, name: 'Episode ' + i, runtime: null, still_path: null });
            return arr;
        }

        fetch('/api?tmdb_show=1&id=' + id)
            .then(function (r) { return r.json(); })
            .then(function (d) {
                totalSeasons = d.number_of_seasons || currentSeason;
                updateSeasonNav();
                fetchSeason(currentSeason, function () { renderEpisodes(currentSeason); });
            })
            .catch(function () {
                totalSeasons = currentSeason;
                updateSeasonNav();
                fetchSeason(currentSeason, function () { renderEpisodes(currentSeason); });
            });

        (function () {
            if (window.innerWidth > 768) return;
            var dragStartY = 0;
            var dragStartX = 0;
            var dragCurrentY = 0;
            var isDraggingPanel = false;
            var directionLocked = false;
            var panelHeight = 0;
            var handle = epPanel.querySelector('::before') || epPanel;

            epPanel.addEventListener('touchstart', function (e) {
                var touch = e.touches[0];
                var panelRect = epPanel.getBoundingClientRect();
                var hitY = touch.clientY - panelRect.top;
                if (hitY > 48) return;
                dragStartY = touch.clientY;
                dragStartX = touch.clientX;
                dragCurrentY = 0;
                directionLocked = false;
                isDraggingPanel = false;
                panelHeight = epPanel.offsetHeight;
            }, { passive: true });

            epPanel.addEventListener('touchmove', function (e) {
                if (panelHeight === 0) return;
                var touch = e.touches[0];
                var dy = touch.clientY - dragStartY;
                var dx = touch.clientX - dragStartX;
                if (!directionLocked) {
                    if (Math.abs(dx) > Math.abs(dy) + 6) { panelHeight = 0; return; }
                    if (Math.abs(dy) > Math.abs(dx) + 6) {
                        isDraggingPanel = true;
                        directionLocked = true;
                        epPanel.classList.add('dragging');
                    } else {
                        return;
                    }
                }
                if (!isDraggingPanel) return;
                e.preventDefault();
                var delta = dy < 0 ? 0 : dy;
                dragCurrentY = delta;
                epPanel.style.transform = 'translateY(' + delta + 'px)';
            }, { passive: false });

            epPanel.addEventListener('touchend', function () {
                if (!isDraggingPanel) { panelHeight = 0; return; }
                isDraggingPanel = false;
                directionLocked = false;
                epPanel.classList.remove('dragging');
                if (dragCurrentY > panelHeight * 0.3) {
                    epPanel.style.transition = 'transform 0.35s var(--ease-out)';
                    epPanel.style.transform = 'translateY(100%)';
                    setTimeout(function () {
                        epPanel.style.transition = '';
                        epPanel.style.transform = '';
                        closeEpPanel();
                    }, 360);
                } else {
                    epPanel.style.transition = 'transform 0.3s var(--ease-spring)';
                    epPanel.style.transform = 'translateY(0)';
                    setTimeout(function () { epPanel.style.transition = ''; }, 320);
                }
                panelHeight = 0;
            });
        })();
    })();

    document.getElementById('btn-play').addEventListener('click', function (e) {
        e.stopPropagation();
        v.paused ? v.play() : v.pause();
    });

    document.getElementById('player').addEventListener('click', function (e) {
        if (settingsOpen) { return; }
        if (controlsWrapper.contains(e.target)) return;
        if (settingsPanel && settingsPanel.contains(e.target)) return;
        if (btnSettings && btnSettings.contains(e.target)) return;
        if (sourceBtnWrap && sourceBtnWrap.contains(e.target)) return;

        if (!shown) {
            showUI(true);
            return;
        }

        var rect = document.getElementById('player').getBoundingClientRect();
        var cx = rect.left + rect.width / 2;
        var cy = rect.top + rect.height / 2;
        var dx = e.clientX - cx;
        var dy = e.clientY - cy;
        var dist = Math.sqrt(dx * dx + dy * dy);

        if (dist <= 150) {
            haptic();
            flashCenter();
            v.paused ? v.play() : v.pause();
            return;
        }

        var leftZone = rect.left + rect.width * 0.25;
        var rightZone = rect.left + rect.width * 0.75;
        var inLeft = e.clientX < leftZone;
        var inRight = e.clientX > rightZone;

        if (!inLeft && !inRight) {
            hideUI();
            return;
        }

        var side = inLeft ? 'left' : 'right';

        if (tapSide && tapSide !== side) {
            tapCount = 0;
            skipAccL = 0;
            skipAccR = 0;
            clearTimeout(tapTimer);
        }
        tapSide = side;
        tapCount++;

        var el = side === 'left' ? skipL : skipR;
        var lbl = side === 'left' ? skipLLbl : skipRLbl;
        if (tapCount >= 2) {
            lbl.textContent = (side === 'left' ? '-' : '+') + (tapCount * 10) + 's';
            el.classList.remove('hide');
            void el.offsetWidth;
            el.classList.add('show');
        }

        clearTimeout(tapTimer);

        tapTimer = setTimeout(function () {
            if (tapCount >= 2) {
                doSkip(side, tapCount);
            } else {
                if (shown) {
                    hideUI();
                } else {
                    showUI(true);
                }
            }
            tapCount = 0;
            tapSide = null;
        }, 300);
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
            badge.style.cssText = 'position:absolute;top:18px;left:50%;transform:translateX(-50%);z-index:30;background:rgba(0,0,0,0.65);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);color:#fff;font-family:var(--font);font-size:13px;font-weight:700;padding:6px 16px;border-radius:100px;display:flex;align-items:center;gap:7px;letter-spacing:0.03em;opacity:0;transition:opacity 0.18s ease;pointer-events:none;';
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
        _speedBoostTimer = setTimeout(function () { startSpeedBoost(); }, 600);
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
        _speedBoostTimer = setTimeout(function () {
            if (!dragging) startSpeedBoost();
        }, 600);
    }, { passive: true });

    playerEl.addEventListener('touchend', function (e) {
        endSpeedBoost();
    });

    (function () {
        var openBtn = document.getElementById('sub-customize-open-btn');
        var backBtn = document.getElementById('sub-custom-back-btn');
        var langView = document.getElementById('sub-lang-view');
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
            langView.style.display = 'none';
            customView.style.display = 'block';
            if (subViewTitle) subViewTitle.textContent = 'Customize Subtitles';
            if (subCustomizeBtn) subCustomizeBtn.style.display = 'none';
            updateSimpleControls();
            updateAdvancedControls();
        });

        if (backBtn) backBtn.addEventListener('click', function () {
            customView.style.display = 'none';
            langView.style.display = 'block';
            if (subViewTitle) subViewTitle.textContent = 'Subtitles';
            if (subCustomizeBtn) subCustomizeBtn.style.display = '';
            if (advancedBtn) advancedBtn.classList.remove('expanded');
            if (advancedContent) advancedContent.style.display = 'none';
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