// Island main entry point
window.IslandMain = {
  init: function() {
    // Initialize all modules
    if (window.IslandCapsuleInteraction) window.IslandCapsuleInteraction.init();
    if (window.IslandMinimize) window.IslandMinimize.init();
    if (window.IslandShortcut) window.IslandShortcut.init();
    if (window.IslandPrinter) window.IslandPrinter.init();

    // Debug button
    this.initDebugButton();

    // Start brightness polling
    if (window.IslandBrightness) window.IslandBrightness.start(200);
  },

  initDebugButton: async function() {
    var invoke = window.__TAURI__.core.invoke;
    var listen = window.__TAURI__.event.listen;
    var dom = window.IslandDOM;
    var debugBtn = document.getElementById('debug-expand-btn');
    if (!debugBtn) return;

    // Load initial state from Rust
    invoke('get_debug_mode').then(function(enabled) {
      debugBtn.style.display = enabled ? 'flex' : 'none';
    }).catch(function() {});

    // Listen for changes from Rust
    listen('debug-mode-changed', function(event) {
      debugBtn.style.display = event.payload.enabled ? 'flex' : 'none';
    });

    // Click to toggle expanded state
    debugBtn.addEventListener('click', function() {
      dom.leftPanel.classList.toggle('expanded');
      dom.rightPanel.classList.toggle('expanded');
    });
  }
};
