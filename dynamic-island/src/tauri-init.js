// Tauri mode initialization — screen capture, settings sync, sysinfo polling
(function() {
  var isTauri = window.__TAURI__ !== undefined;
  if (isTauri) {
    document.documentElement.classList.add('tauri-mode');
    document.body.classList.add('tauri-mode');
    initTauriMode();
  }

  async function initTauriMode() {
    var invoke = window.__TAURI__.core.invoke;
    var listen = window.__TAURI__.event.listen;

    // Listen for settings changes from the settings window
    await listen('settings-changed', function(event) {
      var cfg = event.payload;
      if (window.__liquidGlassConfig && cfg) {
        Object.keys(cfg).forEach(function(k) {
          if (typeof cfg[k] === 'object' && cfg[k] !== null && !Array.isArray(cfg[k]) && typeof window.__liquidGlassConfig[k] === 'object') {
            Object.assign(window.__liquidGlassConfig[k], cfg[k]);
          } else {
            window.__liquidGlassConfig[k] = cfg[k];
          }
        });
        try {
          localStorage.setItem('liquid-glass-current-state', JSON.stringify(window.__liquidGlassConfig));
        } catch(e) {}
      }
    });

    // Update time
    function updateTime() {
      var now = new Date();
      var h = String(now.getHours()).padStart(2, '0');
      var m = String(now.getMinutes()).padStart(2, '0');
      var s = String(now.getSeconds()).padStart(2, '0');
      document.getElementById('ov-time').textContent = h + ':' + m + ':' + s;
    }
    updateTime();
    setInterval(updateTime, 1000);

    // Update system info
    async function updateSysInfo() {
      try {
        var info = await invoke('get_system_stats');
        document.getElementById('ov-mem').textContent = '内存 ' + info.memory_percent + '%';
        document.getElementById('net-up').textContent = info.net_up_speed;
        document.getElementById('net-down').textContent = info.net_down_speed;
      } catch (e) {
        console.error('[SysInfo]', e);
      }
    }
    updateSysInfo();
    setInterval(updateSysInfo, 1500);

    // Screen capture for glass refraction source
    var screenTexture = null;
    var screenTexW = 0, screenTexH = 0;
    var capturing = false;
    var CAPTURE_INTERVAL = 7;

    function decodeJpegB64(b64) {
      return new Promise(function(resolve, reject) {
        var raw = atob(b64);
        var bytes = new Uint8Array(raw.length);
        for (var i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
        var blob = new Blob([bytes], { type: 'image/jpeg' });
        var url = URL.createObjectURL(blob);
        var img = new Image();
        img.onload = function() { URL.revokeObjectURL(url); resolve(img); };
        img.onerror = function() { URL.revokeObjectURL(url); reject(new Error('JPEG decode failed')); };
        img.src = url;
      });
    }

    async function captureAndUpdateScreenTexture() {
      if (capturing) return;
      capturing = true;
      try {
        var glCanvas = document.getElementById('glCanvas');
        var gl = glCanvas.getContext('webgl2') || glCanvas.getContext('webgl');
        if (!gl) { capturing = false; return; }

        var getCurrentWindow = window.__TAURI__.window.getCurrentWindow;
        var pos = await getCurrentWindow().outerPosition();
        var capW = glCanvas.width;
        var capH = glCanvas.height;
        var capScreenX = Math.round(pos.x);
        var capScreenY = Math.round(pos.y);

        var b64 = await invoke('capture_screen', { x: capScreenX, y: capScreenY, width: capW, height: capH });
        if (!b64) { capturing = false; return; }

        var img = await decodeJpegB64(b64);

        requestAnimationFrame(function() {
          if (!screenTexture || screenTexW !== capW || screenTexH !== capH) {
            if (screenTexture) gl.deleteTexture(screenTexture);
            screenTexture = gl.createTexture();
            screenTexW = capW;
            screenTexH = capH;
            gl.bindTexture(gl.TEXTURE_2D, screenTexture);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
          }
          gl.bindTexture(gl.TEXTURE_2D, screenTexture);
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
          if (window.__liquidGlassState) {
            window.__liquidGlassState.setScreenTexture(screenTexture, capW / capH);
          }
        });
      } catch (e) {
        console.error('[ScreenCap]', e);
      } finally {
        capturing = false;
        setTimeout(captureAndUpdateScreenTexture, CAPTURE_INTERVAL);
      }
    }
    captureAndUpdateScreenTexture();

    // Emit interacting state for click-through
    var canvas = document.getElementById('glCanvas');
    canvas.addEventListener('mouseenter', function() {
      window.__TAURI__.event.emit('set-interacting', true);
    });
    canvas.addEventListener('mouseleave', function() {
      window.__TAURI__.event.emit('set-interacting', false);
    });

    // Initialize island modules
    if (window.IslandMain) window.IslandMain.init();
  }
})();
