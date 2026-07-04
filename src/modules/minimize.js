// Minimize/restore functionality
window.IslandMinimize = {
  init: function() {
    var dom = window.IslandDOM;
    var state = window.IslandState;
    var invoke = window.__TAURI__.core.invoke;
    var listen = window.__TAURI__.event.listen;
    var emit = window.__TAURI__.event.emit;

    function minimizePanel() {
      if (state.isMinimized) return;
      state.isMinimized = true;

      var glCanvas = document.getElementById('glCanvas');
      var shadowL = document.getElementById('shadow-left');
      var shadowR = document.getElementById('shadow-right');

      dom.capsule.style.transition = 'opacity 0.25s cubic-bezier(0.4,0,0.2,1), transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)';
      dom.capsule.style.opacity = '0';
      dom.capsule.style.transform = 'translateX(-50%) scaleY(0.7)';
      dom.capsule.style.pointerEvents = 'none';
      if (glCanvas) glCanvas.style.display = 'none';
      if (shadowL) shadowL.style.display = 'none';
      if (shadowR) shadowR.style.display = 'none';
      if (window.__setCapturePaused) window.__setCapturePaused(true);
      emit('set-minimized', true);

      setTimeout(function() {
        dom.capsule.style.display = 'none';
        dom.capsule.style.opacity = '';
        dom.capsule.style.transform = '';
        dom.capsule.style.transition = '';
        dom.collapsedIndicator.style.display = 'block';
      }, 300);
    }

    function expandFromMinimized() {
      if (!state.isMinimized) return;
      state.isMinimized = false;
      dom.collapsedIndicator.style.display = 'none';

      var glCanvas = document.getElementById('glCanvas');
      var shadowL = document.getElementById('shadow-left');
      var shadowR = document.getElementById('shadow-right');

      dom.capsule.style.display = '';
      dom.capsule.style.pointerEvents = '';
      dom.capsule.style.opacity = '0';
      dom.capsule.style.transform = 'translateX(-50%) scaleY(0.7)';
      dom.capsule.style.transition = 'opacity 0.25s cubic-bezier(0.4,0,0.2,1), transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)';
      if (glCanvas) glCanvas.style.display = '';
      if (shadowL) shadowL.style.display = '';
      if (shadowR) shadowR.style.display = '';
      if (window.__setCapturePaused) window.__setCapturePaused(false);
      emit('set-minimized', false);

      requestAnimationFrame(function() {
        dom.capsule.style.opacity = '1';
        dom.capsule.style.transform = 'translateX(-50%) scaleY(1)';
      });

      setTimeout(function() {
        dom.capsule.style.transition = '';
        dom.capsule.style.transform = '';
      }, 420);
    }

    // Right-click context menu
    dom.capsule.addEventListener('contextmenu', function(e) {
      e.preventDefault();
      e.stopPropagation();
      invoke('show_context_menu');
    });

    // Listen for minimize action from Rust context menu
    listen('context-menu-action', function(event) {
      if (event.payload === 'minimize') {
        minimizePanel();
      }
    });

    // Click collapsed indicator to expand
    dom.collapsedIndicator.addEventListener('click', function(e) {
      e.stopPropagation();
      expandFromMinimized();
    });
  }
};
