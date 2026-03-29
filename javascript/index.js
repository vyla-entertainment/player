(function () {
    var canvas = document.getElementById('loader-canvas');
    var ctx = canvas.getContext('2d');
    var W, H, dots = [], mx = -9999, my = -9999;
    var SP = 26, R = 1.4, INF = 160;

    function resize() {
        W = canvas.width = window.innerWidth;
        H = canvas.height = window.innerHeight;
        dots = [];
        for (var row = 0; row <= Math.ceil(H / SP); row++)
            for (var col = 0; col <= Math.ceil(W / SP); col++)
                dots.push({ x: col * SP, y: row * SP, s: 1 });
    }
    window.addEventListener('resize', resize);
    resize();

    document.addEventListener('mousemove', function (e) { mx = e.clientX; my = e.clientY; });
    document.addEventListener('touchmove', function (e) {
        if (e.touches[0]) { mx = e.touches[0].clientX; my = e.touches[0].clientY; }
    }, { passive: true });

    function lerp(a, b, t) { return a + (b - a) * t; }

    var alive = true, last = 0;

    function frame(ts) {
        if (!alive) return;
        var dt = Math.min((ts - last) / 16, 4);
        last = ts;
        ctx.clearRect(0, 0, W, H);
        for (var i = 0; i < dots.length; i++) {
            var d = dots[i];
            var dx = d.x - mx, dy = d.y - my;
            var dist = Math.sqrt(dx * dx + dy * dy);
            var target = dist < INF ? (1 + (1 - dist / INF) * 4) : 1;
            d.s = lerp(d.s, target, 0.1 * dt);
            var a = 0.08 + (d.s - 1) * 0.11;
            ctx.beginPath();
            ctx.arc(d.x, d.y, R * Math.min(d.s, 2.5), 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(255,255,255,' + Math.min(a, 0.55) + ')';
            ctx.fill();
        }
        requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);

    setTimeout(function () {
        var loader = document.getElementById('loader');
        loader.classList.add('out');
        setTimeout(function () {
            alive = false;
            loader.style.display = 'none';
        }, 1000);
    }, 3400);
})();

document.addEventListener('keydown', function (e) {
    if (e.key === 'F' || e.key === 'f') {
        var player = document.getElementById('player');
        if (!document.fullscreenElement) {
            (player.requestFullscreen || player.webkitRequestFullscreen || player.mozRequestFullScreen || player.msRequestFullscreen || function () { }).call(player);
        } else {
            document.exitFullscreen();
        }
    }
});

var p = new URLSearchParams(location.search);
var id = p.get('id'), s = p.get('s'), e = p.get('e');

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
        .then(r => r.json())
        .then(d => {
            if (d.error || !d.url) {
                document.getElementById('error-screen').classList.add('show');
                return;
            }
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
        }).catch(() => {
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

function play(raw) {
    var src = '/api?url=' + encodeURIComponent(raw);
    var v = document.getElementById('v');
    var controlsWrapper = document.getElementById('player-controls-wrapper');
    var ctrl = document.getElementById('controls');
    var progressContainer = document.getElementById('progress-container');
    var titleBar = document.getElementById('title-bar');
    var vignette = document.getElementById('vignette');
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
    var btnSpeed = document.getElementById('btn-speed');
    var speedMenu = document.getElementById('speed-menu');
    var speedOpts = document.querySelectorAll('.speed-opt');
    var tooltip = document.getElementById('tooltip');

    var hideTimer = null;
    var tapTimer = null;
    var tapCount = 0;
    var tapSide = null;
    var skipTimers = { left: null, right: null };
    var dragging = false;
    var shown = false;
    var speedOpen = false;

    function showUI(pin) {
        controlsWrapper.classList.add('on');
        titleBar.classList.add('on');
        vignette.classList.add('on');
        shown = true;
        clearTimeout(hideTimer);
        if (!pin && !v.paused) hideTimer = setTimeout(hideUI, 3200);
    }

    function hideUI() {
        controlsWrapper.classList.remove('on');
        titleBar.classList.remove('on');
        vignette.classList.remove('on');
        shown = false;
        speedMenu.classList.remove('open');
        speedOpen = false;
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
        var time = pct * v.duration;
        tooltip.textContent = fmt(time);
        var left = (pct * r.width);
        tooltip.style.left = left + 'px';
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

    function onReady() {
        v.classList.add('ready');
        v.currentTime = 0.1;
        tDur.textContent = fmt(v.duration);
        setTimeout(function () { showUI(true); }, 180);
    }

    if (Hls.isSupported()) {
        var hls = new Hls({ startLevel: -1, maxBufferLength: 20, maxMaxBufferLength: 40, maxBufferSize: 30 * 1000 * 1000, enableWorker: true });
        hls.loadSource(src);
        hls.attachMedia(v);
        hls.on(Hls.Events.MANIFEST_PARSED, onReady);
    } else if (v.canPlayType('application/vnd.apple.mpegurl')) {
        v.src = src;
        v.addEventListener('loadedmetadata', onReady);
    }

    v.addEventListener('timeupdate', setProg);
    v.addEventListener('durationchange', function () { if (v.duration) tDur.textContent = fmt(v.duration); });
    v.addEventListener('play', function () { syncIcon(); showUI(); });
    v.addEventListener('pause', function () { syncIcon(); showUI(true); clearTimeout(hideTimer); });

    document.getElementById('btn-play').addEventListener('click', function (e) {
        e.stopPropagation();
        haptic(10);
        v.paused ? v.play() : v.pause();
    });

    btnSpeed.addEventListener('click', function (e) {
        e.stopPropagation();
        speedOpen = !speedOpen;
        speedMenu.classList.toggle('open', speedOpen);
        showUI(true);
        haptic(6);
    });

    speedOpts.forEach(function (btn) {
        btn.addEventListener('click', function (e) {
            e.stopPropagation();
            var rate = parseFloat(this.dataset.speed);
            v.playbackRate = rate;
            speedOpts.forEach(function (b) { b.classList.remove('active'); });
            this.classList.add('active');
            speedMenu.classList.remove('open');
            speedOpen = false;
            haptic(6);
            showUI();
        });
    });

    if (btnPip) {
        if (!document.pictureInPictureEnabled) btnPip.style.display = 'none';
        btnPip.addEventListener('click', function (e) {
            e.stopPropagation();
            haptic(10);
            if (document.pictureInPictureElement) document.exitPictureInPicture();
            else if (v.requestPictureInPicture) v.requestPictureInPicture();
        });
    }

    if (btnFullscreen) {
        var fsIcon = btnFullscreen.querySelector('i');
        function updateFsIcon() {
            fsIcon.className = document.fullscreenElement ? 'fa-solid fa-compress' : 'fa-solid fa-expand';
        }
        document.addEventListener('fullscreenchange', updateFsIcon);
        btnFullscreen.addEventListener('click', function (e) {
            e.stopPropagation();
            haptic(10);
            if (document.fullscreenElement) {
                document.exitFullscreen();
            } else {
                var player = document.getElementById('player');
                (player.requestFullscreen || player.webkitRequestFullscreen || player.mozRequestFullScreen || player.msRequestFullscreen || function () { }).call(player);
            }
        });
    }

    wrap.addEventListener('mouseenter', function () { trackEl.classList.add('hover'); });
    wrap.addEventListener('mouseleave', function () {
        if (!dragging) trackEl.classList.remove('hover');
        tooltip.classList.remove('show');
    });

    wrap.addEventListener('mousemove', function (e) {
        e.stopPropagation();
        hoverTooltip(e.clientX);
    });

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

    document.addEventListener('click', function () {
        if (speedOpen) { speedMenu.classList.remove('open'); speedOpen = false; }
    });

    function handleTap(side) {
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
                haptic(8);
                if (!shown) {
                    showUI();
                } else {
                    flashCenter();
                    v.paused ? v.play() : v.pause();
                }
            }
            tapCount = 0;
            tapSide = null;
        }, 270);
    }

    tapL.addEventListener('click', function (e) { e.stopPropagation(); handleTap('left'); });
    tapR.addEventListener('click', function (e) { e.stopPropagation(); handleTap('right'); });
}