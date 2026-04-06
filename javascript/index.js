var alive = true;
var shouldHideLoader = false;

function initLoaderVideo() {
    var loaderVideo = document.getElementById('loader-bg-video');
    if (loaderVideo) {
        loaderVideo.src = 'https://hosting.anticroom.workers.dev/view/video/prjcfe0som98vhyb5tyk.mp4';
        loaderVideo.play().catch(function (e) {
            console.log('Background video autoplay failed:', e);
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
            toast.classList.remove('enter');
            toast.classList.add('exit');
        }, 3800);
    }, 4500);
}

if (id) {
    fetch('/api?' + (s ? 'id=' + id + '&s=' + s + '&e=' + (e || '1') : 'id=' + id))
        .then(function (r) { return r.json(); })
        .then(function (d) {
            if (d.error || !d.url) {
                document.getElementById('error-screen').classList.add('show');
                return;
            }
            shouldHideLoader = true;
            hideLoader();
            play(d.url);
            var title = 'Unknown';
            if (d.meta) {
                var m = d.meta;
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
        }).catch(function () {
            document.getElementById('error-screen').classList.add('show');
        });
} else {
    document.getElementById('error-screen').classList.add('show');
}

function haptic(t) { if (navigator.vibrate) navigator.vibrate(t); }

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
    return fetch(sub.url)
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
    return testSubtitle(Object.assign({}, sub, {
        url: 'https://vyla-api.pages.dev/api/proxy?url=' + encodeURIComponent(sub.url)
    }));
}

function fetchSubWithFallback(sub) {
    return fetchSubDirect(sub).catch(function (err) {
        return fetchSubViaProxy(sub);
    });
}

function play(raw) {
    var src = '/api?url=' + encodeURIComponent(raw);
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
        ratio: 'contain'
    };

    var subPosMap = { top: '82%', high: '35%', mid: '12%', low: '6%', bottom: '2%' };
    var subWeightMap = { light: '300', normal: '500', bold: '700' };
    var subSpacingMap = { tight: '-0.5px', normal: '0px', wide: '1px', extra: '2px' };

    var savedSpeed = (function () {
        try { return parseFloat(localStorage.getItem('playbackSpeed')) || 1; } catch (err) { return 1; }
    })();

    function saveSubSettings() {
        try {
            localStorage.setItem('subSettings', JSON.stringify({
                font: subState.font, size: subState.size, color: subState.color,
                bgColor: subState.bgColor, bgOpacity: subState.bgOpacity,
                pos: subState.pos, edge: subState.edge
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

    function saveSubSettings() {
        try {
            localStorage.setItem('subSettings', JSON.stringify({
                font: subState.font, size: subState.size, color: subState.color,
                bgColor: subState.bgColor, bgOpacity: subState.bgOpacity,
                pos: subState.pos, edge: subState.edge, weight: subState.weight, spacing: subState.spacing
            }));
        } catch (err) { }
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
        document.getElementById(labelId).textContent = labelText;
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
        settingsOpen = false;
    }

    function syncIcon() {
        playIco.className = v.paused ? 'fa-solid fa-play' : 'fa-solid fa-pause';
    }

    function flashCenter() {
        ci.className = v.paused ? 'fa-solid fa-pause' : 'fa-solid fa-play';
        ci.classList.remove('pop');
        void ci.offsetWidth;
        ci.classList.add('pop');
    }

    function setProg() {
        if (!v.duration || dragging) return;
        var pct = v.currentTime / v.duration * 100;
        prog.style.width = pct + '%';
        thumb.style.left = pct + '%';
        tCur.textContent = fmt(v.currentTime);
        tDur.textContent = fmt(v.duration);
        if (v.buffered.length)
            bufEl.style.width = (v.buffered.end(v.buffered.length - 1) / v.duration * 100) + '%';
    }

    function seekX(x) {
        var r = wrap.getBoundingClientRect();
        var pct = Math.max(0, Math.min(1, (x - r.left) / r.width));
        v.currentTime = pct * (v.duration || 0);
        prog.style.width = (pct * 100) + '%';
        thumb.style.left = (pct * 100) + '%';
        tCur.textContent = fmt(v.currentTime);
    }

    function hoverTooltip(x) {
        if (!v.duration) return;
        var r = wrap.getBoundingClientRect();
        var pct = Math.max(0, Math.min(1, (x - r.left) / r.width));
        tooltip.textContent = fmt(pct * v.duration);
        tooltip.style.left = (pct * r.width) + 'px';
        tooltip.classList.add('show');
    }

    function doSkip(dir, taps) {
        var secs = taps * 10;
        var delta = dir === 'left' ? -secs : secs;
        v.currentTime = Math.max(0, Math.min(v.duration || 0, v.currentTime + delta));
        var el = dir === 'left' ? skipL : skipR;
        var lbl = dir === 'left' ? skipLLbl : skipRLbl;
        lbl.textContent = (dir === 'left' ? '-' : '+') + secs + ' sec';
        el.classList.remove('hide');
        void el.offsetWidth;
        el.classList.add('show');
        clearTimeout(skipTimers[dir]);
        skipTimers[dir] = setTimeout(function () {
            el.classList.remove('show');
            el.classList.add('hide');
            setTimeout(function () { el.classList.remove('hide'); }, 420);
        }, 900);
        haptic([8, 40, 8]);
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
        v.currentTime = 0.1;         if (ap) {             var playAttempt = setInterval(function () {                 v.play().then(function () {                     clearInterval(playAttempt);                 }).catch(function () {});             }, 300);         }
        if (savedSpeed !== 1) v.playbackRate = savedSpeed;
        tDur.textContent = fmt(v.duration);

        var loaderBottomGlow = document.querySelector('.loader-bottom-glow');
        if (loaderBottomGlow) {
            loaderBottomGlow.classList.add('video-playing');
        }

        setTimeout(function () { showUI(true); }, 180);
        startCueLoop();
        scheduleRetry();
    }

    var retryCount = 0;
    var maxRetries = 4;
    var retryTimer = null;

    function scheduleRetry() {
        if (retryCount >= maxRetries) return;
        retryTimer = setTimeout(function () {
            if (!isNaN(v.duration) && v.duration > 0) return;
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
        }, 4000);
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

    if (Hls.isSupported()) {
        var hls = new Hls({ startLevel: -1, maxBufferLength: 20, maxMaxBufferLength: 40, maxBufferSize: 30 * 1000 * 1000, enableWorker: true });
        hls.loadSource(src);
        hls.attachMedia(v);
        hls.on(Hls.Events.MANIFEST_PARSED, function () {
            onReady();
            qualityOptsEl.innerHTML = '';
            var autoBtn = document.createElement('div');
            autoBtn.className = 'settings-list-item active';
            autoBtn.innerHTML = '<i class="fa-regular fa-circle-dot"></i> Auto';
            autoBtn.addEventListener('click', function (e) {
                e.stopPropagation();
                hls.currentLevel = -1;
                updateListActive('quality-opts', autoBtn, 'lbl-quality', 'Auto');
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
                    updateListActive('quality-opts', btn, 'lbl-quality', txt);
                    haptic(6);
                    showUI(true);
                });
                qualityOptsEl.appendChild(btn);
            });
        });
    } else if (v.canPlayType('application/vnd.apple.mpegurl')) {
        v.src = src;
        v.addEventListener('loadedmetadata', function () {
            var loaderBottomGlow = document.querySelector('.loader-bottom-glow');
            if (loaderBottomGlow) {
                loaderBottomGlow.classList.add('video-playing');
            }
            onReady();
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

    document.getElementById('player-controls-wrapper').addEventListener('click', function (e) {
        e.stopPropagation();
    });

    fetch(vylaEndpoint)
        .then(function (r) { return r.json(); })
        .then(function (d) {
            if (!d.subtitles || !d.subtitles.length) return [];
            return d.subtitles.map(function (sub) {
                return { label: sub.label, format: sub.format || detectFormat(sub.url, null), url: sub.url };
            });
        })
        .catch(function (err) {
            return [];
        })
        .then(function (allSubs) {
            if (!allSubs.length) {
                document.getElementById('lbl-subtitle').textContent = 'Off';
                subtitleOptsEl.innerHTML = '<div class="settings-list-item" style="color:var(--white-45);cursor:default;font-size:13px;padding:12px 14px;"><i class="fa-solid fa-circle-exclamation"></i> None available</div>';
                return;
            }


            var tests = allSubs.map(function (sub) {
                return fetchSubWithFallback(sub).catch(function (err) {
                    return null;
                });
            });

            Promise.all(tests).then(function (results) {
                var seen = {};
                var passed = results.filter(Boolean).filter(function (r) {
                    var fingerprint = r.cues.slice(0, 3).map(function (c) { return c.start + ':' + c.text.slice(0, 20); }).join('|');
                    if (seen[fingerprint]) {
                        return false;
                    }
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
        .catch(function (err) {
            document.getElementById('lbl-subtitle').textContent = 'Off';
        });

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
        if (!settingsOpen) return;
        var isClickInside = settingsPanel.contains(e.target) || btnSettings.contains(e.target);
        var isHapticGhost = e.target.id === '__hx';

        if (!isClickInside && !isHapticGhost) {
            settingsOpen = false;
            settingsPanel.classList.remove('open');
            menuGroups.forEach(function (g) { g.classList.remove('expanded'); });
            if (!v.paused) {
                clearTimeout(hideTimer);
                hideTimer = setTimeout(hideUI, 3200);
            }
        }
    }, true);

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
        settingsOpen = !settingsOpen;
        settingsPanel.classList.toggle('open', settingsOpen);
        if (!settingsOpen) menuGroups.forEach(function (g) { g.classList.remove('expanded'); });
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

    document.addEventListener('click', function (e) {
        if (!e.isTrusted) return;
        if (e.target.id === '__hx') return;
        if (settingsOpen && !settingsPanel.contains(e.target)) {
            settingsPanel.classList.remove('open');
            settingsOpen = false;
            menuGroups.forEach(function (g) { g.classList.remove('expanded'); });
            if (!v.paused) {
                clearTimeout(hideTimer);
                hideTimer = setTimeout(hideUI, 3200);
            }
        }
    });

    speedOpts.forEach(function (btn) {
        btn.addEventListener('click', function (e) {
            e.stopPropagation();
            var rate = parseFloat(this.dataset.speed);
            v.playbackRate = rate;
            try { localStorage.setItem('playbackSpeed', rate); } catch (err) { }
            updateListActive('speed-opts', this, 'lbl-speed', this.textContent.trim());
            haptic(6);
            showUI(true);
        });
    });

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
    wrap.addEventListener('touchstart', function (e) {
        e.stopPropagation();
        dragging = true;
        trackEl.classList.add('drag');
        seekX(e.touches[0].clientX);
        showUI(true);
        haptic(6);
    }, { passive: true });

    document.addEventListener('mousemove', function (e) { if (dragging) seekX(e.clientX); });
    document.addEventListener('touchmove', function (e) { if (dragging) seekX(e.touches[0].clientX); }, { passive: true });

    function endDrag() {
        if (!dragging) return;
        dragging = false;
        trackEl.classList.remove('drag', 'hover');
        if (!v.paused) showUI();
    }
    document.addEventListener('mouseup', endDrag);
    document.addEventListener('touchend', endDrag);

    document.addEventListener('keydown', function (e) {
        if (e.key === 'ArrowLeft') { doSkip('left', 1); showUI(); }
        if (e.key === 'ArrowRight') { doSkip('right', 1); showUI(); }
        if (e.key === ' ') { e.preventDefault(); haptic(10); v.paused ? v.play() : v.pause(); }
    });

    document.getElementById('player').addEventListener('mousemove', function () {
        if (!v.paused) showUI();
    });

    v.addEventListener('timeupdate', setProg);
    v.addEventListener('durationchange', function () {
        if (v.duration) {
            tDur.textContent = fmt(v.duration);
            clearTimeout(retryTimer);
            retryCount = maxRetries;
            hideBuffering();
        }
    });
    v.addEventListener('play', function () { syncIcon(); showUI(); });
    v.addEventListener('pause', function () { syncIcon(); showUI(true); clearTimeout(hideTimer); });
    
    if (s) {
        v.addEventListener('ended', function () {
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
                            .catch(function () {});
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
                .catch(function () {});
        });
        var nextEpBtn = document.getElementById('next-ep-btn');
    var nextEpInner = document.getElementById('next-ep-inner');
    var nextEpLabel = document.getElementById('next-ep-label');
    var nextEpHref = null;
    var nextEpReady = false;

    var nextE = parseInt(e || '1') + 1;
    var nextS = parseInt(s);
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
        .catch(function () {});

    nextEpInner.addEventListener('click', function () {
        if (nextEpHref) location.href = nextEpHref;
    });

    v.addEventListener('timeupdate', function () {
        if (!nextEpReady || !v.duration || v.duration < 60) return;
        if (v.duration - v.currentTime <= 300) {
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
    
    document.getElementById('btn-play').addEventListener('click', function (e) {
        e.stopPropagation();
        haptic(10);
        v.paused ? v.play() : v.pause();
    });

    document.getElementById('player').addEventListener('click', function (e) {
        if (controlsWrapper.contains(e.target)) return;
        if (settingsPanel && settingsPanel.contains(e.target)) return;

        var rect = document.getElementById('player').getBoundingClientRect();
        var cx = rect.left + rect.width / 2;
        var cy = rect.top + rect.height / 2;
        var dx = e.clientX - cx;
        var dy = e.clientY - cy;
        var dist = Math.sqrt(dx * dx + dy * dy);

        if (dist <= 150) {
            haptic(10);
            flashCenter();
            v.paused ? v.play() : v.pause();
            return;
        }

        var side = e.clientX < cx ? 'left' : 'right';
        if (tapSide && tapSide !== side) tapCount = 0;
        tapSide = side;
        tapCount++;
        var count = tapCount;
        clearTimeout(tapTimer);
        tapTimer = setTimeout(function () {
            if (count >= 2) {
                doSkip(tapSide, count - 1);
                showUI();
            } else {
                if (!shown) {
                    showUI();
                } else {
                    hideUI();
                }
            }
            tapCount = 0;
            tapSide = null;
        }, 270);
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