// Adaptive text color based on screen brightness
window.IslandBrightness = {
  _timer: null,
  _cachedPos: null,

  start: function(intervalMs) {
    var self = this;
    if (self._timer) return;
    intervalMs = intervalMs || 200;
    self.poll();
    self._timer = setInterval(function() { self.poll(); }, intervalMs);
  },

  stop: function() {
    if (this._timer) {
      clearInterval(this._timer);
      this._timer = null;
    }
  },

  poll: async function() {
    var self = this;
    var invoke = window.__TAURI__.core.invoke;
    var getCurrentWindow = window.__TAURI__.window.getCurrentWindow;
    try {
      if (!self._cachedPos) {
        self._cachedPos = await getCurrentWindow().outerPosition();
      }
      var left = document.getElementById('left-panel');
      var right = document.getElementById('right-panel');
      if (!left || !right) return;

      var scale = window.devicePixelRatio || 1;
      var rects = [self.buildRect(left, self._cachedPos, scale), self.buildRect(right, self._cachedPos, scale)];
      var lum = await invoke('get_area_brightness', { rects: rects });
      self.applyBrightness(lum);
    } catch (e) {
      console.error('[Brightness]', e);
    }
  },

  buildRect: function(el, pos, scale) {
    var r = el.getBoundingClientRect();
    return {
      x: pos.x + Math.round(r.x * scale),
      y: pos.y + Math.round(r.y * scale),
      w: Math.round(r.width * scale),
      h: Math.round(r.height * scale),
    };
  },

  luminanceToTextColor: function(lum) {
    if (lum > 0.6) return '#000000';
    if (lum < 0.55) return '#ffffff';
    return document.documentElement.style.getPropertyValue('--adaptive-text') || '#ffffff';
  },

  applyBrightness: function(lum) {
    document.documentElement.style.setProperty('--adaptive-text', this.luminanceToTextColor(lum));
  }
};
