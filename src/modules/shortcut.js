// Shortcut management
window.IslandShortcut = {
  _dragOut: null,

  init: function() {
    var self = this;
    var dom = window.IslandDOM;
    var invoke = window.__TAURI__.core.invoke;
    var listen = window.__TAURI__.event.listen;

    self.loadShortcuts();

    // Drag-out-to-delete
    dom.shortcutList.addEventListener('mousedown', function(e) {
      var itemEl = e.target.closest('.sc-item');
      if (!itemEl) return;
      e.stopPropagation();
      e.preventDefault();
      self._dragOut = {
        itemId: itemEl.dataset.id,
        startX: e.clientX,
        startY: e.clientY,
        isDragging: false,
      };
    });

    document.addEventListener('mousemove', function(e) {
      if (!self._dragOut) return;
      if (!self._dragOut.isDragging) {
        var dx = e.clientX - self._dragOut.startX;
        var dy = e.clientY - self._dragOut.startY;
        if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
          self._dragOut.isDragging = true;
          var el = dom.shortcutList.querySelector('[data-id="' + self._dragOut.itemId + '"]');
          if (el) el.classList.add('dragging');
        }
      }
    });

    document.addEventListener('mouseup', async function(e) {
      if (!self._dragOut) return;
      var el = dom.shortcutList.querySelector('[data-id="' + self._dragOut.itemId + '"]');
      if (el) el.classList.remove('dragging');

      if (self._dragOut.isDragging) {
        var r = dom.capsule.getBoundingClientRect();
        if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) {
          try {
            await invoke('remove_shortcut', { id: self._dragOut.itemId });
            await self.loadShortcuts();
          } catch (err) {
            console.error('[Shortcut] delete failed:', err);
          }
        }
      }
      self._dragOut = null;
    });

    // Tauri drag-drop events
    listen('tauri://drag-drop', async function(event) {
      dom.shortcutArea.classList.remove('drag-over');
      var payload = event.payload;
      var paths = [];
      if (payload && payload.Drop && payload.Drop.paths) {
        paths = payload.Drop.paths;
      } else if (Array.isArray(payload)) {
        paths = payload;
      } else if (payload && payload.paths) {
        paths = payload.paths;
      }
      for (var i = 0; i < paths.length; i++) {
        try {
          await invoke('add_shortcut', { path: paths[i] });
        } catch (e) {
          console.error('[DragDrop] add failed:', e);
        }
      }
      if (paths.length > 0) {
        await self.loadShortcuts();
      }
    });

    listen('tauri://drag-enter', function() {
      dom.shortcutArea.classList.add('drag-over');
    });

    listen('tauri://drag-over', function() {});

    listen('tauri://drag-leave', function() {
      dom.shortcutArea.classList.remove('drag-over');
    });
  },

  loadShortcuts: async function() {
    var self = this;
    var dom = window.IslandDOM;
    var invoke = window.__TAURI__.core.invoke;
    try {
      var shortcuts = await invoke('get_shortcuts');
      self.renderShortcuts(shortcuts);
    } catch (e) {
      console.error('[Shortcut] load failed:', e);
    }
  },

  renderShortcuts: function(shortcuts) {
    var dom = window.IslandDOM;
    var invoke = window.__TAURI__.core.invoke;
    dom.shortcutList.innerHTML = '';

    if (shortcuts.length === 0) {
      dom.shortcutList.innerHTML = '<div class="shortcut-empty">拖拽文件夹到此处添加</div>';
      return;
    }

    shortcuts.forEach(function(item) {
      var el = document.createElement('div');
      el.className = 'sc-item';
      el.dataset.id = item.id;

      var icon = document.createElement('span');
      icon.className = 'sc-icon';
      if (item.icon) {
        var img = document.createElement('img');
        img.src = item.icon;
        img.draggable = false;
        icon.appendChild(img);
      } else {
        icon.textContent = item.type === 'folder' ? '\uD83D\uDCC1' : item.type === 'app' ? '\uD83D\uDCF1' : '\uD83D\uDCC4';
      }

      var labelShort = document.createElement('span');
      labelShort.className = 'sc-label sc-label-short';
      labelShort.textContent = item.name.slice(0, 2);

      var labelFull = document.createElement('span');
      labelFull.className = 'sc-label sc-label-full';
      labelFull.textContent = item.name;

      el.appendChild(icon);
      el.appendChild(labelShort);
      el.appendChild(labelFull);

      el.addEventListener('click', function() {
        invoke('open_shortcut', { id: item.id }).catch(console.warn);
      });

      dom.shortcutList.appendChild(el);
    });
  }
};
