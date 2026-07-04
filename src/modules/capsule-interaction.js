// Capsule interaction: expand/collapse, view switching, multi-mode toggle
window.IslandCapsuleInteraction = {
  _isExpanded: false,

  init: function() {
    var self = this;
    var dom = window.IslandDOM;
    var state = window.IslandState;
    var invoke = window.__TAURI__.core.invoke;
    var listen = window.__TAURI__.event.listen;
    var emit = window.__TAURI__.event.emit;

    // Listen for expand/collapse from Rust thread
    listen('set-expand', function(event) {
      if (event.payload && !self._isExpanded) {
        self._isExpanded = true;
        dom.leftPanel.classList.add('expanded');
        dom.rightPanel.classList.add('expanded');
      } else if (!event.payload && self._isExpanded) {
        self._isExpanded = false;
        dom.leftPanel.classList.remove('expanded');
        dom.rightPanel.classList.remove('expanded');
      }
      // Sync hover state with app.js
      if (window.__liquidGlassState) {
        window.__liquidGlassState.setHover(event.payload);
      }
    });

    // Emit interacting state for click-through logic
    dom.capsule.addEventListener('mouseenter', function() {
      emit('set-interacting', true);
    });

    dom.capsule.addEventListener('mouseleave', function() {
      emit('set-interacting', false);
    });

    // Double-click left panel to switch view
    dom.leftPanel.addEventListener('dblclick', function(e) {
      e.stopPropagation();
      window.IslandViewSwitcher.switchToNextView();
    });

    // Double-click right panel to toggle single/multi mode
    dom.rightPanel.addEventListener('dblclick', function(e) {
      e.stopPropagation();
      var newMode = state.rightMode === 'single' ? 'multi' : 'single';
      state.rightMode = newMode;
      dom.rightPanel.classList.toggle('single-mode');
      dom.rightPanel.classList.toggle('multi-mode');
      dom.leftPanel.classList.toggle('multi-open');
      // Sync compact mode with WebGL island shape
      if (window.__liquidGlassState) {
        window.__liquidGlassState.setCompactMode(newMode === 'multi');
      }
    });
  }
};
