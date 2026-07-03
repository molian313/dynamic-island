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

    // --- DXGI Desktop Duplication screen capture ---
    var screenTexture = null;
    var screenTexW = 0, screenTexH = 0;
    var capturing = false;

    var glCanvas = document.getElementById('glCanvas');
    var gl = glCanvas.getContext('webgl2') || glCanvas.getContext('webgl');

    // Use EXT_texture_swizzle to convert BGRA→RGBA on GPU (zero CPU cost)
    // If unavailable, fall back to JS-side conversion
    var swizzleExt = gl ? gl.getExtension('EXT_texture_swizzle') : null;

    function setupSwizzleTexture() {
      if (swizzleExt) {
        // BGRA: src[0]=B, src[1]=G, src[2]=R, src[3]=A
        // Want:  R=src[2], G=src[1], B=src[0], A=src[3]
        gl.texParameteri(gl.TEXTURE_2D, 0x8840, 0x8842); // RED = BLUE
        gl.texParameteri(gl.TEXTURE_2D, 0x8841, 0x8841); // GREEN = GREEN
        gl.texParameteri(gl.TEXTURE_2D, 0x8842, 0x8840); // BLUE = RED
        gl.texParameteri(gl.TEXTURE_2D, 0x8843, 0x8843); // ALPHA = ALPHA
      }
    }

    // Fallback: JS-side BGRA→RGBA conversion
    function convertBgraToRgba(src) {
      var dst = new Uint8Array(src.length);
      for (var i = 0, len = src.length; i < len; i += 4) {
        dst[i]     = src[i + 2]; // R
        dst[i + 1] = src[i + 1]; // G
        dst[i + 2] = src[i];     // B
        dst[i + 3] = src[i + 3]; // A
      }
      return dst;
    }

    async function captureScreen() {
      if (capturing) return;
      capturing = true;
      try {
        if (!gl) {
          gl = glCanvas.getContext('webgl2') || glCanvas.getContext('webgl');
          if (!gl) return;
        }

        var getCurrentWindow = window.__TAURI__.window.getCurrentWindow;
        var pos = await getCurrentWindow().outerPosition();
        var capW = glCanvas.width;
        var capH = glCanvas.height;
        var capScreenX = Math.round(pos.x);
        var capScreenY = Math.round(pos.y);

        // capture_screen returns cropped BGRA pixels via DXGI
        var raw = await invoke('capture_screen', {
          x: capScreenX, y: capScreenY, width: capW, height: capH
        });
        if (!raw || raw.length === 0) return;

        var pixels = (raw instanceof Uint8Array) ? raw : new Uint8Array(raw);

        // Validate size
        if (pixels.length !== capW * capH * 4) {
          console.warn('[ScreenCap] size mismatch:', pixels.length, 'expected', capW * capH * 4);
          return;
        }

        // Convert BGRA→RGBA: use GPU swizzle if available, else CPU
        var uploadData = swizzleExt ? pixels : convertBgraToRgba(pixels);

        // Create / resize texture
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
          gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
          if (swizzleExt) setupSwizzleTexture();
        }
        gl.bindTexture(gl.TEXTURE_2D, screenTexture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, capW, capH, 0, gl.RGBA, gl.UNSIGNED_BYTE, uploadData);

        if (window.__liquidGlassState) {
          window.__liquidGlassState.setScreenTexture(screenTexture, capW / capH);
        }
      } catch (e) {
        console.error('[ScreenCap]', e);
      } finally {
        capturing = false;
        // Yield to event loop, then capture next frame.
        // DXGI AcquireNextFrame blocks until desktop changes,
        // so setTimeout(16) caps at ~60fps and avoids busy-wait.
        setTimeout(captureScreen, 16);
      }
    }
    captureScreen();

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
