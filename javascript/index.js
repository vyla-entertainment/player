var alive = true;
var shouldHideLoader = false;

function initLoaderVideo() {
    var loaderVideo = document.getElementById('loader-bg-video');
    if (loaderVideo) {
        loaderVideo.src = 'https://hosting.anticroom.workers.dev/view/video/prjcfe0som98vhyb5tyk.mp4';
        loaderVideo.play().catch(function (e) {
        });
    }
}

function isMobile() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

document.addEventListener('DOMContentLoaded', function () {
    initLoaderVideo();

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

if (id) {
    var apiUrl = '/api?' + (s ? 'id=' + id + '&s=' + s + '&e=' + (e || '1') : 'id=' + id);
    fetch(apiUrl)
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
        .then(function (result) {
            shouldHideLoader = true;
            hideLoader();
            if (result.type === 'json') {
                play(result.data.url, false, id);
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
                document.getElementById('title-text').textContent = title;
                showNowPlayingToast(title);
            } else if (result.type === 'm3u8') {
                var tmdbUrl = '/api?tmdb_movie=1&id=' + id;

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
                        document.getElementById('title-text').textContent = title;
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
        }).catch(function () {
            document.getElementById('error-screen').classList.add('show');
        });
} else {
    document.getElementById('error-screen').classList.add('show');
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
    var src = skipProxy || raw.startsWith('/api') ? raw : '/api?url=' + encodeURIComponent(raw);
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
    var sourceBtnLabel = document.getElementById('source-sub-label');
    var subCustomize = document.getElementById('sub-customize');
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
    var menuGroups = document.querySelectorAll('.settings-menu-group');

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
                pos: subState.pos,
                edge: subState.edge,
                weight: subState.weight,
                spacing: subState.spacing
            }));
        } catch (err) { }
    }

    function applySubStyles() {
        subtitleDisplay.style.bottom = subPosMap[subState.pos];
        subtitleText.style.fontFamily = subFontMap[subState.font];
        subtitleText.style.fontSize = subSizeMap[subState.size];
        subtitleText.style.color = subState.color;
        subtitleText.style.textShadow = subEdgeMap[subState.edge];
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
        settingsPanel.classList.remove('open');
        settingsPanel.style.opacity = '0';
        settingsPanel.style.transform = 'translateY(10px) scale(1)';
        settingsPanel.style.pointerEvents = 'none';
        settingsOpen = false;
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
        if (!hint) {
            hint = document.createElement('div');
            hint.id = 'unmute-hint';
            hint.style.cssText = 'position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);z-index:9999;background:rgba(0,0,0,0.72);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);color:#fff;font-family:var(--font);font-size:14px;font-weight:600;padding:14px 22px;border-radius:100px;display:flex;align-items:center;gap:10px;cursor:pointer;letter-spacing:0.02em;pointer-events:auto;transition:opacity 0.3s ease;';
            hint.innerHTML = '<i class="fa-solid fa-volume-xmark" style="font-size:16px;"></i> Tap to unmute';
            document.getElementById('player').appendChild(hint);
        }
        hint.style.display = 'flex';
        hint.style.opacity = '1';

        function doUnmute() {
            v.muted = false;
            v.volume = 1;
            _autoplayUnlocked = true;
            _pendingUnmute = false;
            hint.style.opacity = '0';
            setTimeout(function () { hint.style.display = 'none'; }, 300);
            document.removeEventListener('click', onDoc, true);
            haptic();
        }

        function onDoc(ev) {
            if (ev.target.id === '__hx') return;
            doUnmute();
        }

        hint.addEventListener('click', function (ev) { ev.stopPropagation(); doUnmute(); });
        hint.addEventListener('touchend', function (ev) { ev.stopPropagation(); doUnmute(); });
        document.addEventListener('click', onDoc, true);
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
        var delay = retryCount === 0 ? 6000 : 8000;
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
                    var newSrc = '/api?url=' + encodeURIComponent(d.url);
                    if (Hls.isSupported()) {
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

    var isAutoQuality = true;

    function buildQualityOpts() {
        qualityOptsEl.innerHTML = '';
        var autoBtn = document.createElement('div');
        autoBtn.className = 'settings-list-item active';
        autoBtn.innerHTML = '<i class="fa-regular fa-circle-dot"></i> Auto';
        autoBtn.addEventListener('click', function (e) {
            e.stopPropagation();
            hls.currentLevel = -1;
            isAutoQuality = true;
            updateQualityLabel();
            updateListActive('quality-opts', autoBtn, 'lbl-quality', getQualityLabelText());
            haptic(6);
            showUI(true);
        });
        qualityOptsEl.appendChild(autoBtn);
        hls.levels.slice().reverse().forEach(function (level, ri) {
            var i = hls.levels.length - 1 - ri;
            var btn = document.createElement('div');
            var txt = level.height ? level.height + 'p' : 'Level ' + (i + 1);
            btn.className = 'settings-list-item';
            btn.innerHTML = '<i class="fa-regular fa-circle"></i> ' + txt;
            btn.addEventListener('click', function (e) {
                e.stopPropagation();
                hls.currentLevel = i;
                isAutoQuality = false;
                updateListActive('quality-opts', btn, 'lbl-quality', txt);
                haptic(6);
                showUI(true);
            });
            qualityOptsEl.appendChild(btn);
        });
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
    }

    if (Hls.isSupported()) {
        var hls = new Hls({
            startLevel: 0,
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
        });
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

    var vylaBase = 'https://vyla-api.pages.dev/api';
    var vylaEndpoint = s
        ? (vylaBase + '/tv?id=' + id + '&season=' + s + '&episode=' + (e || '1'))
        : (vylaBase + '/movie?id=' + id);

    subtitleOptsEl.innerHTML = '<div class="sub-skeleton"><div class="sub-skel-item"></div><div class="sub-skel-item"></div><div class="sub-skel-item"></div></div>';
    document.getElementById('lbl-subtitle').textContent = 'Loading...';

    setTimeout(function () {
        fetch(vylaEndpoint)
            .then(function (r) { return r.json(); })
            .then(function (d) {
                if (!d.subtitles || !d.subtitles.length) return [];
                return d.subtitles.map(function (sub) {
                    return { label: sub.label, format: sub.format || detectFormat(sub.url, null), url: sub.url };
                });
            })
            .catch(function () { return []; })
            .then(function (allSubs) {
                if (!allSubs.length) {
                    document.getElementById('lbl-subtitle').textContent = 'Off';
                    subtitleOptsEl.innerHTML = '<div class="settings-list-item" style="color:var(--white-45);cursor:default;font-size:13px;padding:12px 14px;"><i class="fa-solid fa-circle-exclamation"></i> None available</div>';
                    return;
                }
                var tests = allSubs.map(function (sub) {
                    return fetchSubWithFallback(sub).catch(function () { return null; });
                });
                Promise.all(tests).then(function (results) {
                    var seen = {};
                    var passed = results.filter(Boolean).filter(function (r) {
                        var fingerprint = r.cues.slice(0, 3).map(function (c) { return c.start + ':' + c.text.slice(0, 20); }).join('|');
                        if (seen[fingerprint]) return false;
                        seen[fingerprint] = true;
                        return true;
                    });
                    document.getElementById('lbl-subtitle').textContent = 'Off';
                    if (!passed.length) {
                        subtitleOptsEl.innerHTML = '<div class="settings-list-item" style="color:var(--white-45);cursor:default;font-size:13px;padding:12px 14px;"><i class="fa-solid fa-circle-exclamation"></i> None available</div>';
                        return;
                    }
                    buildSubtitleOpts(passed);
                });
            })
            .catch(function () {
                document.getElementById('lbl-subtitle').textContent = 'Off';
            });
    }, 5000);

    function buildSubtitleOpts(results) {
        subtitleOptsEl.innerHTML = '';
        subCustomize.style.display = 'none';

        var offBtn = document.createElement('div');
        offBtn.className = 'settings-list-item active';
        offBtn.innerHTML = '<i class="fa-regular fa-circle-dot"></i> Off';
        offBtn.dataset.track = '-1';
        offBtn.addEventListener('click', function (e) {
            e.stopPropagation();
            subState.activeTrack = -1;
            subState.cues = [];
            subtitleText.textContent = '';
            updateListActive('subtitle-opts', offBtn, 'lbl-subtitle', 'Off');
            subCustomize.style.display = 'none';
            haptic(6);
        });
        subtitleOptsEl.appendChild(offBtn);

        results.forEach(function (result, i) {
            var btn = document.createElement('div');
            btn.className = 'settings-list-item';
            btn.innerHTML = '<i class="fa-regular fa-circle"></i> ' + result.sub.label;
            btn.dataset.track = String(i);
            btn.addEventListener('click', function (e) {
                e.stopPropagation();
                subState.activeTrack = i;
                subState.cues = result.cues;
                updateListActive('subtitle-opts', btn, 'lbl-subtitle', result.sub.label);
                subCustomize.style.display = 'block';
                haptic(6);
                showUI(true);
            });
            subtitleOptsEl.appendChild(btn);
        });
    }

    settingsPanel.addEventListener('click', function (e) {
        e.stopPropagation();
    });

    ['mousedown', 'touchstart', 'pointerdown'].forEach(function (ev) {
        settingsPanel.addEventListener(ev, function (e) { e.stopPropagation(); });
    });

    document.addEventListener('click', function (e) {
        if (e.target.id === '__hx') return;
        if (e.target.htmlFor === '__hx') return;
        if (e.target.tagName === 'LABEL') return;
        if (!settingsOpen) return;
        if (btnSettings.contains(e.target)) return;
        if (settingsPanel.contains(e.target)) return;
        settingsOpen = false;
        settingsPanel.classList.remove('open');
        settingsPanel.style.opacity = '0';
        settingsPanel.style.pointerEvents = 'none';
        settingsPanel.style.transform = 'translateY(10px) scale(0.9)';
        menuGroups.forEach(function (g) { g.classList.remove('expanded'); });
        if (!v.paused) {
            clearTimeout(hideTimer);
            hideTimer = setTimeout(hideUI, 3200);
        }
    }, false);

    menuGroups.forEach(function (group) {
        group.querySelector('.settings-menu-header').addEventListener('click', function (e) {
            e.stopPropagation();
            var isExp = group.classList.contains('expanded');
            menuGroups.forEach(function (g) { g.classList.remove('expanded'); });
            if (!isExp) group.classList.add('expanded');
            haptic(6);
        });
    });

    btnSettings.addEventListener('click', function (e) {
        e.stopPropagation();
        e.stopImmediatePropagation();
        setTimeout(function () {
        }, 50);
        if (settingsOpen) {
            settingsOpen = false;
            settingsPanel.classList.remove('open');
            settingsPanel.style.opacity = '0';
            settingsPanel.style.pointerEvents = 'none';
            settingsPanel.style.transform = 'translateY(10px) scale(0.9)';
            menuGroups.forEach(function (g) { g.classList.remove('expanded'); });
            if (!v.paused) {
                clearTimeout(hideTimer);
                hideTimer = setTimeout(hideUI, 3200);
            }
        } else {
            settingsOpen = true;
            settingsPanel.classList.add('open');
            settingsPanel.style.opacity = '';
            settingsPanel.style.pointerEvents = '';
            settingsPanel.style.transform = '';
        }
        showUI(true);
        haptic(10);
    });

    bindControl(document.getElementById('sub-weight-select'), 'weight', false);
    bindControl(document.getElementById('sub-spacing-select'), 'spacing', false);

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
        var newSrc = url.startsWith('/api') ? url : '/api?url=' + encodeURIComponent(url);
        var wasPlaying = !v.paused;
        var savedTime = v.currentTime;

        showBuffering();

        var loaderEl = document.getElementById('loader');
        var loaderVid = document.getElementById('loader-bg-video');
        if (loaderEl) {
            loaderEl.style.display = '';
            loaderEl.classList.remove('out');
        }
        if (loaderVid) {
            loaderVid.src = 'https://hosting.anticroom.workers.dev/view/video/prjcfe0som98vhyb5tyk.mp4';
            loaderVid.play().catch(function () { });
        }

        var loaderHideTimeout = null;

        function onSwitchReady() {
            clearTimeout(loaderHideTimeout);
            hideBuffering();
            if (loaderEl) {
                loaderEl.classList.add('out');
                setTimeout(function () { loaderEl.style.display = 'none'; }, 1000);
            }
            if (savedTime > 0 && v.duration && savedTime < v.duration) {
                v.currentTime = savedTime;
            }
            if (wasPlaying) v.play().catch(function () { });
        }

        loaderHideTimeout = setTimeout(function () {
            onSwitchReady();
        }, 12000);

        if (Hls.isSupported() && typeof hls !== 'undefined') {
            hls.stopLoad();
            hls.detachMedia();
            hls.loadSource(newSrc);
            hls.attachMedia(v);
            hls.once(Hls.Events.MANIFEST_PARSED, function () {
                buildQualityOpts();
            });
            v.addEventListener('loadedmetadata', function onSwitchMeta() {
                v.removeEventListener('loadedmetadata', onSwitchMeta);
                onSwitchReady();
            });
        } else {
            v.src = newSrc;
            v.load();
            v.addEventListener('loadedmetadata', function onSwitchMeta() {
                v.removeEventListener('loadedmetadata', onSwitchMeta);
                onSwitchReady();
            });
        }
    }

    var sources = [];
    var currentSourceIndex = 0;
    var sourcePanelOpen = false;
    var sourceListEl = sourceDropdown;

    function openSourcePanel() {
        sourcePanelOpen = true;
        sourceDropdown.classList.add('open');
        showUI(true);
        haptic(10);
    }

    function closeSourcePanel() {
        sourcePanelOpen = false;
        sourceDropdown.classList.remove('open');
        if (!v.paused) {
            clearTimeout(hideTimer);
            hideTimer = setTimeout(hideUI, 3200);
        }
    }

    if (sourceBtnLabel) {
        sourceBtnLabel.addEventListener('click', function (e) {
            e.stopPropagation();
            sourcePanelOpen ? closeSourcePanel() : openSourcePanel();
            haptic(6);
        });
    }

    function buildSourceList() {
        sourceListEl.innerHTML = '';
        if (sourceBtnLabel) {
            sourceBtnLabel.innerHTML = 'SOURCE: ' + (currentSourceIndex + 1) + ' <i class="fa-solid fa-chevron-down" style="font-size:9px;"></i>';
        }
        sources.forEach(function (source, i) {
            var item = document.createElement('div');
            var isActive = i === currentSourceIndex;
            item.className = 'ep-item' + (isActive ? ' current' : '');
            item.innerHTML =
                '<div class="source-icon-wrap"><i class="fa-solid fa-' + (isActive ? 'circle-check' : 'circle') + '"></i></div>' +
                '<div class="ep-info"><div class="ep-info-row"><span class="ep-name">' + (source.label || 'Source: ' + (i + 1)) + '</span></div></div>' +
                (isActive ? '<i class="fa-solid fa-check source-active-check"></i>' : '');
            if (!isActive) {
                item.addEventListener('click', function () {
                    currentSourceIndex = i;
                    switchSource(source.url);
                    buildSourceList();
                    closeSourcePanel();
                    haptic(10);
                });
            }
            sourceListEl.appendChild(item);
        });
    }

    function fetchSources() {
        if (sourceBtnWrap) sourceBtnWrap.style.display = 'flex';
        if (sourceBtnLabel) sourceBtnLabel.innerHTML = 'LOADING... <i class="fa-solid fa-chevron-down" style="font-size:9px;"></i>';
        sourceListEl.innerHTML = '<div class="ep-item" style="color:var(--white-45);cursor:default;pointer-events:none;"><div class="ep-info"><span class="ep-name" style="color:var(--white-45);">Loading...</span></div></div>';
        var endpoint = s
            ? '/api?sources=1&id=' + id + '&s=' + s + '&e=' + (e || '1')
            : '/api?sources=1&id=' + id;
        fetch(endpoint)
            .then(function (r) {
                if (!r.ok) throw new Error('HTTP ' + r.status);
                return r.json();
            })
            .then(function (d) {
                if (!d.sources || !d.sources.length) {
                    if (sourceBtnLabel) sourceBtnLabel.innerHTML = 'NO SOURCES <i class="fa-solid fa-chevron-down" style="font-size:9px;"></i>';
                    sourceListEl.innerHTML = '<div class="ep-item" style="color:var(--white-45);cursor:default;pointer-events:none;"><div class="ep-info"><span class="ep-name" style="color:var(--white-45);">No sources available</span></div></div>';
                    return;
                }
                sources = d.sources;
                var playingUrl = src;
                currentSourceIndex = 0;
                for (var i = 0; i < sources.length; i++) {
                    var sUrl = sources[i].url;
                    if (sUrl && playingUrl && (
                        playingUrl.includes(encodeURIComponent(sUrl.split('?')[0])) ||
                        sUrl === playingUrl ||
                        (playingUrl.startsWith('/api?vyla_inline') && sUrl.startsWith('/api?vyla_inline'))
                    )) {
                        currentSourceIndex = i;
                        break;
                    }
                }
                buildSourceList();
            })
            .catch(function () {
                if (sourceBtnLabel) sourceBtnLabel.innerHTML = 'SOURCE: 1 <i class="fa-solid fa-chevron-down" style="font-size:9px;"></i>';
                sourceListEl.innerHTML = '<div class="ep-item" style="color:var(--white-45);cursor:default;pointer-events:none;"><div class="ep-info"><span class="ep-name" style="color:var(--white-45);">Failed to load</span></div></div>';
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
            fsIcon.className = fsEl ? 'fa-solid fa-compress' : 'fa-solid fa-expand';
        }
        document.addEventListener('fullscreenchange', updateFsIcon);
        document.addEventListener('webkitfullscreenchange', updateFsIcon);
        document.addEventListener('mozfullscreenchange', updateFsIcon);
        document.addEventListener('MSFullscreenChange', updateFsIcon);
        btnFullscreen.addEventListener('click', function (e) {
            e.stopPropagation();
            haptic(10);
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
                            thumbHtml += '<img src="https://image.tmdb.org/t/p/w185' + ep.still_path + '" loading="lazy" alt="">';
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

    var errRetryBtn = document.getElementById('err-retry-btn');
    if (errRetryBtn) {
        errRetryBtn.addEventListener('click', function () {
            document.getElementById('error-screen').classList.remove('show');
            var endpoint = s
                ? '/api?sources=1&id=' + id + '&s=' + s + '&e=' + (e || '1')
                : '/api?sources=1&id=' + id;
            fetch(endpoint)
                .then(function (r) { return r.json(); })
                .then(function (d) {
                    if (!d.sources || !d.sources.length) throw new Error('no sources');
                    var first = d.sources[0];
                    switchSource(first.url);
                })
                .catch(function () {
                    document.getElementById('error-screen').classList.add('show');
                });
        });
    }

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
        if (window.innerWidth > 768) return;
        var panel = document.getElementById('settings-panel');
        if (!panel) return;
        var dragStartY = 0;
        var dragCurrentY = 0;
        var isDraggingPanel = false;
        var panelHeight = 0;

        panel.addEventListener('touchstart', function (e) {
            var touch = e.touches[0];
            var panelRect = panel.getBoundingClientRect();
            if (touch.clientY - panelRect.top > 60) return;
            isDraggingPanel = true;
            dragStartY = touch.clientY;
            dragCurrentY = 0;
            panelHeight = panel.offsetHeight;
            panel.classList.add('dragging');
        }, { passive: true });

        panel.addEventListener('touchmove', function (e) {
            if (!isDraggingPanel) return;
            e.preventDefault();
            var touch = e.touches[0];
            var delta = touch.clientY - dragStartY;
            if (delta < 0) delta = 0;
            dragCurrentY = delta;
            panel.style.transform = 'translateY(' + delta + 'px)';
        }, { passive: false });

        panel.addEventListener('touchend', function () {
            if (!isDraggingPanel) return;
            isDraggingPanel = false;
            panel.classList.remove('dragging');
            if (dragCurrentY > panelHeight * 0.3) {
                panel.style.transition = 'transform 0.35s cubic-bezier(0.22,1,0.36,1)';
                panel.style.transform = 'translateY(100%)';
                setTimeout(function () {
                    panel.style.transition = '';
                    panel.style.transform = '';
                    panel.classList.remove('open');
                    settingsOpen = false;
                    menuGroups.forEach(function (g) { g.classList.remove('expanded'); });
                    if (!v.paused) {
                        clearTimeout(hideTimer);
                        hideTimer = setTimeout(hideUI, 3200);
                    }
                }, 360);
            } else {
                panel.style.transition = 'transform 0.3s cubic-bezier(0.25,1.4,0.5,1)';
                panel.style.transform = 'translateY(0)';
                setTimeout(function () { panel.style.transition = ''; }, 320);
            }
        });
    })();
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