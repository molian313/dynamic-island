// Settings page logic — navigation, glass panel, printer configs, blacklist
(function() {
  var invoke = window.__TAURI__.core.invoke;

  // Page navigation
  var navItems = document.querySelectorAll('.nav-item');
  var pages = document.querySelectorAll('.page');
  var pageTitle = document.getElementById('page-title');
  var pageDesc = document.getElementById('page-desc');

  var pageInfo = {
    general: { title: '常规设置', desc: '配置系统选项。' },
    printer: { title: '打印机', desc: '管理 Bambu Lab 打印机连接配置。' },
    blacklist: { title: '屏蔽列表', desc: '添加需要屏蔽灵动岛的进程名称（如 chrome.exe）。' },
    glass: { title: '玻璃参数', desc: '调整液态玻璃效果参数。' },
  };

  var glassLoaded = false;

  function navigateTo(pageId) {
    navItems.forEach(function(n) { n.classList.remove('active'); });
    document.querySelector('.nav-item[data-page="' + pageId + '"]').classList.add('active');
    pages.forEach(function(p) { p.classList.remove('active'); });
    document.getElementById('page-' + pageId).classList.add('active');
    var info = pageInfo[pageId];
    if (info) {
      pageTitle.textContent = info.title;
      pageDesc.textContent = info.desc;
    }
    var ctrlPanel = document.getElementById('controls-panel');
    var ctrlToggle = document.getElementById('controls-toggle');
    if (pageId === 'glass') {
      if (!glassLoaded) loadGlassPanel();
      if (ctrlPanel) ctrlPanel.classList.remove('hidden');
      if (ctrlToggle) ctrlToggle.classList.add('hidden');
    } else {
      if (ctrlPanel) ctrlPanel.classList.add('hidden');
      if (ctrlToggle) ctrlToggle.classList.remove('hidden');
    }
  }

  function loadGlassPanel() {
    if (glassLoaded) return;
    glassLoaded = true;
    var DEFAULTS = {
      refThickness: 18, refFactor: 1.4, refDispersion: 4,
      refFresnelRange: 15, refFresnelHardness: 5, refFresnelFactor: 5,
      glareRange: 35, glareHardness: 12, glareFactor: 50,
      glareConvergence: 70, glareOppositeFactor: 60, glareAngle: -45,
      blurRadius: 1, blurEdge: true,
      tint: { r: 255, g: 255, b: 255, a: 0 },
      shadowExpand: 25, shadowFactor: 5, shadowPosition: { x: 0, y: -10 },
      shapeWidth: 140, shapeHeight: 50, shapeRadius: 25, shapeRoundness: 2,
      shape1Width: 50, shape1Height: 50, shape1Radius: 25,
      mergeRate: 0, showShape1: true, islandGap: 8,
      springSizeFactor: 0, bgType: 0,
      cssShadowBlur: 5, cssShadowOpacity: 0.25, cssShadowOffsetY: 0, cssShadowTop: 5
    };
    var cfg = JSON.parse(JSON.stringify(DEFAULTS));
    try {
      var saved = localStorage.getItem('liquid-glass-current-state');
      if (saved) {
        var parsed = JSON.parse(saved);
        Object.keys(parsed).forEach(function(k) {
          if (typeof parsed[k] === 'object' && parsed[k] !== null && !Array.isArray(parsed[k]) && typeof cfg[k] === 'object') {
            Object.assign(cfg[k], parsed[k]);
          } else { cfg[k] = parsed[k]; }
        });
      }
    } catch(e) {}
    window.__liquidGlassConfig = cfg;
    var script = document.createElement('script');
    script.src = 'controls.js';
    document.body.appendChild(script);
    var origSetItem = localStorage.setItem.bind(localStorage);
    localStorage.setItem = function(key, value) {
      origSetItem(key, value);
      if (key === 'liquid-glass-current-state') {
        try {
          var payload = JSON.parse(value);
          if (window.__TAURI__) {
            window.__TAURI__.core.invoke('forward_settings', { settings: payload });
          }
        } catch(e) {}
      }
    };
  }

  navItems.forEach(function(item) {
    item.addEventListener('click', function() { navigateTo(item.dataset.page); });
  });

  // Auto-start
  var autoStartToggle = document.getElementById('auto-start-toggle');
  invoke('get_auto_start').then(function(v) { autoStartToggle.checked = v; }).catch(function() {});
  autoStartToggle.addEventListener('change', function() {
    invoke('set_auto_start', { enabled: autoStartToggle.checked }).catch(function() {});
  });

  // Debug mode
  var debugToggle = document.getElementById('debug-toggle');
  invoke('get_debug_mode').then(function(v) { debugToggle.checked = v; }).catch(function() {});
  debugToggle.addEventListener('change', function() {
    invoke('set_debug_mode', { enabled: debugToggle.checked }).catch(function() {});
  });

  // Theme selector
  var themeSelect = document.getElementById('theme-select');
  invoke('get_theme').then(function(v) { themeSelect.value = v || 'glass'; }).catch(function() {});
  themeSelect.addEventListener('change', function() {
    invoke('save_theme', { theme: themeSelect.value }).catch(function() {});
  });

  // Printer configs
  var printerList = document.getElementById('printer-list');
  var pcfgName = document.getElementById('pcfg-name');
  var pcfgIp = document.getElementById('pcfg-ip');
  var pcfgAccess = document.getElementById('pcfg-access');
  var pcfgSerial = document.getElementById('pcfg-serial');
  var pcfgAdd = document.getElementById('pcfg-add');
  var pcfgSave = document.getElementById('pcfg-save');
  var printerConfigs = [];
  var editingIndex = -1;

  function renderPrinterList() {
    printerList.innerHTML = '';
    printerConfigs.forEach(function(cfg, i) {
      var el = document.createElement('div');
      el.className = 'printer-item';
      el.innerHTML = '<div class="printer-item-info"><div class="printer-item-name">' + cfg.name + '</div><div class="printer-item-ip">' + cfg.ip_address + '</div></div><div class="printer-item-actions"><button class="btn btn-edit" data-index="' + i + '">编辑</button><button class="btn btn-danger" data-index="' + i + '">删除</button></div>';
      el.querySelector('.btn-edit').addEventListener('click', function() {
        editingIndex = i;
        pcfgName.value = cfg.name;
        pcfgIp.value = cfg.ip_address;
        pcfgAccess.value = cfg.access_code;
        pcfgSerial.value = cfg.serial;
        pcfgAdd.textContent = '更新';
        pcfgAdd.classList.remove('btn-primary');
        pcfgAdd.classList.add('btn-edit');
      });
      el.querySelector('.btn-danger').addEventListener('click', function() {
        if (editingIndex === i) cancelEdit();
        else if (editingIndex > i) editingIndex--;
        printerConfigs.splice(i, 1);
        renderPrinterList();
      });
      printerList.appendChild(el);
    });
  }

  function cancelEdit() {
    editingIndex = -1;
    pcfgAdd.textContent = '添加';
    pcfgAdd.classList.remove('btn-edit');
    pcfgAdd.classList.add('btn-primary');
    pcfgName.value = '';
    pcfgIp.value = '';
    pcfgAccess.value = '';
    pcfgSerial.value = '';
  }

  pcfgAdd.addEventListener('click', function() {
    var name = pcfgName.value.trim();
    var ip = pcfgIp.value.trim();
    var access = pcfgAccess.value.trim();
    var serial = pcfgSerial.value.trim();
    if (!name || !ip || !access || !serial) return;
    if (editingIndex >= 0) {
      printerConfigs[editingIndex] = { name: name, ip_address: ip, access_code: access, serial: serial };
      cancelEdit();
    } else {
      printerConfigs.push({ name: name, ip_address: ip, access_code: access, serial: serial });
    }
    renderPrinterList();
    pcfgName.value = '';
    pcfgIp.value = '';
    pcfgAccess.value = '';
    pcfgSerial.value = '';
  });

  pcfgSave.addEventListener('click', function() {
    invoke('set_printer_configs', { configs: printerConfigs }).then(function() {
      showStatus('打印机配置已保存');
    }).catch(function() {});
  });

  invoke('get_printer_configs').then(function(v) {
    printerConfigs = v;
    renderPrinterList();
  }).catch(function() {});

  // Status toast
  var statusEl = document.getElementById('status');
  function showStatus(msg) {
    statusEl.textContent = msg;
    statusEl.classList.add('show');
    setTimeout(function() { statusEl.classList.remove('show'); }, 2000);
  }

  // Blacklist
  var blacklistEnabled = document.getElementById('blacklist-enabled');
  var blacklistInput = document.getElementById('blacklist-input');
  var blacklistAdd = document.getElementById('blacklist-add');
  var blacklistSave = document.getElementById('blacklist-save');
  var blacklistList = document.getElementById('blacklist-list');
  var blacklistProcesses = [];

  function renderBlacklist() {
    blacklistList.innerHTML = '';
    blacklistProcesses.forEach(function(name, i) {
      var el = document.createElement('div');
      el.className = 'printer-item';
      el.innerHTML = '<div class="printer-item-info"><div class="printer-item-name">' + name + '</div></div><button class="btn btn-danger" data-index="' + i + '">删除</button>';
      el.querySelector('button').addEventListener('click', function() {
        blacklistProcesses.splice(i, 1);
        renderBlacklist();
      });
      blacklistList.appendChild(el);
    });
  }

  invoke('get_blacklist_enabled').then(function(v) { blacklistEnabled.checked = v; }).catch(function() {});
  invoke('get_blacklist').then(function(v) { blacklistProcesses = v; renderBlacklist(); }).catch(function() {});

  blacklistEnabled.addEventListener('change', function() {
    invoke('set_blacklist_enabled', { enabled: blacklistEnabled.checked }).catch(function() {});
  });

  blacklistAdd.addEventListener('click', function() {
    var name = blacklistInput.value.trim().toLowerCase();
    if (!name) return;
    if (blacklistProcesses.indexOf(name) === -1) {
      blacklistProcesses.push(name);
      renderBlacklist();
    }
    blacklistInput.value = '';
  });

  blacklistSave.addEventListener('click', function() {
    invoke('save_blacklist', { processes: blacklistProcesses }).then(function() {
      showStatus('黑名单已保存');
    }).catch(function() {});
  });
})();
