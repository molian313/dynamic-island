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

    // Try to use BGRA extension to avoid pixel swizzling on JS side
    var glCanvas = document.getElementById('glCanvas');
    var gl = glCanvas.getContext('webgl2') || glCanvas.getContext('webgl');
    var bgraExt = gl ? gl.getExtension('EXT_texture_format_bgra8888') : null;

    // Flip + BGRA→RGBA in-place (used when BGRA extension unavailable)
    function flipBgraToRgba(pixels, w, h) {
      var rowBytes = w * 4;
      var tmp = new Uint8Array(rowBytes);
      for (var top = 0, bot = h - 1; top < bot; top++, bot--) {
        var a = top * rowBytes, b = bot * rowBytes;
        tmp.set(pixels.subarray(a, a + rowBytes));
        pixels.set(pixels.subarray(b, b + rowBytes), a);
        pixels.set(tmp, b);
      }
      // swap B↔R in-place
      for (var i = 0, len = w * h * 4; i < len; i += 4) {
        var t = pixels[i]; pixels[i] = pixels[i + 2]; pixels[i + 2] = t;
      }
    }

    async function captureScreen() {
      if (capturing) return;
      capturing = true;
      try {
        if (!gl) {
          gl = glCanvas.getContext('webgl2') || glCanvas.getContext('webgl');
          if (!gl) return;
          if (!bgraExt) bgraExt = gl.getExtension('EXT_texture_format_bgra8888');
        }

        var getCurrentWindow = window.__TAURI__.window.getCurrentWindow;
        var pos = await getCurrentWindow().outerPosition();
        var capW = glCanvas.width;
        var capH = glCanvas.height;
        var capScreenX = Math.round(pos.x);
        var capScreenY = Math.round(pos.y);

        // capture_screen now returns raw BGRA pixels via DXGI Desktop Duplication
        var raw = await invoke('capture_screen', { x: capScreenX, y: capScreenY, width: capW, height: capH });
        if (!raw || raw.length === 0) return;

        // Ensure we have a Uint8Array
        var pixels = (raw instanceof Uint8Array) ? raw : new Uint8Array(raw);

        // Get actual dimensions from the returned data
        var fullW = Math.floor(pixels.length / 4 / capH) || capW;
        var texW = capW, texH = capH;

        // Extract the island's region from the full desktop capture
        var regionPixels;
        if (fullW === capW) {
          regionPixels = pixels;
        } else {
          regionPixels = new Uint8Array(capW * capH * 4);
          var bytesPerRow = fullW * 4;
          for (var row = 0; row < capH; row++) {
            var srcOff = (row * fullW + capScreenX) * 4;
            var dstOff = row * capW * 4;
            regionPixels.set(pixels.subarray(srcOff, srcOff + capW * 4), dstOff);
          }
        }

        // Prepare for WebGL upload: flip vertically + convert BGRA→RGBA if needed
        var uploadPixels;
        if (bgraExt) {
          // BGRA extension available — just flip rows (top-down → bottom-up)
          uploadPixels = new Uint8Array(regionPixels.length);
          var rowBytes = capW * 4;
          for (var row = 0; row < capH; row++) {
            var src = row * rowBytes;
            var dst = (capH - 1 - row) * rowBytes;
            uploadPixels.set(regionPixels.subarray(src, src + rowBytes), dst);
          }
        } else {
          // No BGRA extension — flip + swap channels
          uploadPixels = new Uint8Array(regionPixels);
          flipBgraToRgba(uploadPixels, capW, capH);
        }

        // Upload to WebGL texture
        if (!screenTexture || screenTexW !== texW || screenTexH !== texH) {
          if (screenTexture) gl.deleteTexture(screenTexture);
          screenTexture = gl.createTexture();
          screenTexW = texW;
          screenTexH = texH;
          gl.bindTexture(gl.TEXTURE_2D, screenTexture);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        }
        gl.bindTexture(gl.TEXTURE_2D, screenTexture);
        if (bgraExt) {
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, texW, texH, 0, 0x80E1, gl.UNSIGNED_BYTE, uploadPixels);
        } else {
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, texW, texH, 0, gl.RGBA, gl.UNSIGNED_BYTE, uploadPixels);
        }
        if (window.__liquidGlassState) {
          window.__liquidGlassState.setScreenTexture(screenTexture, texW / texH);
        }
      } catch (e) {
        console.error('[ScreenCap]', e);
      } finally {
        capturing = false;
        // DXGI AcquireNextFrame blocks until a new frame is available,
        // so we just schedule the next capture immediately.
        setTimeout(captureScreen, 0);
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
