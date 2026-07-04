// ============================================================================
// Liquid Glass Studio — Settings Panel (Controls)
// IIFE that creates the DOM panel and binds to window.__liquidGlassConfig
// ============================================================================

(function () {
  'use strict';

  var PRESETS_KEY = 'liquid-glass-presets';

  // ---------------------------------------------------------------------------
  // Default values (mirrors the C object in app.js)
  // ---------------------------------------------------------------------------
  var DEFAULTS = {
    refThickness: 20,
    refFactor: 1.4,
    refDispersion: 7,
    refFresnelRange: 30,
    refFresnelHardness: 20,
    refFresnelFactor: 20,
    glareRange: 30,
    glareHardness: 20,
    glareFactor: 90,
    glareConvergence: 50,
    glareOppositeFactor: 80,
    glareAngle: -45,
    blurRadius: 1,
    blurEdge: true,
    tint: { r: 255, g: 255, b: 255, a: 0 },
    shadowExpand: 25,
    shadowFactor: 15,
    shadowPosition: { x: 0, y: -10 },
    shapeWidth: 140,
    shapeHeight: 50,
    shapeRadius: 25,
    shapeRoundness: 5,
    shape1Width: 50,
    shape1Height: 50,
    shape1Radius: 25,
    mergeRate: 0.05,
    showShape1: true,
    islandGap: 6,
    springSizeFactor: 10,
    bgType: 0,
    cssShadowBlur: 5,
    cssShadowOpacity: 0.25,
    cssShadowOffsetY: 0,
    cssShadowTop: 5
  };

  // ---------------------------------------------------------------------------
  // Control definitions
  // ---------------------------------------------------------------------------
  var BASIC_CONTROLS = [
    { key: 'refThickness',           label: '折射厚度',       type: 'range', min: 1,    max: 80,    step: 0.01  },
    { key: 'refFactor',              label: '折射系数',       type: 'range', min: 1,    max: 4,     step: 0.01  },
    { key: 'refDispersion',          label: '色散增益',       type: 'range', min: 0,    max: 50,    step: 0.01  },
    { key: 'refFresnelRange',        label: '菲涅尔反射范围', type: 'range', min: 0,    max: 100,   step: 0.01  },
    { key: 'refFresnelHardness',     label: '菲涅尔反射硬度', type: 'range', min: 0,    max: 100,   step: 0.01  },
    { key: 'refFresnelFactor',       label: '菲涅尔反射强度', type: 'range', min: 0,    max: 100,   step: 0.01  },
    { key: 'glareRange',             label: '高光范围',       type: 'range', min: 0,    max: 100,   step: 0.01  },
    { key: 'glareHardness',          label: '高光硬度',       type: 'range', min: 0,    max: 100,   step: 0.01  },
    { key: 'glareFactor',            label: '高光强度',       type: 'range', min: 0,    max: 120,   step: 0.01  },
    { key: 'glareConvergence',       label: '高光聚拢度',     type: 'range', min: 0,    max: 100,   step: 0.01  },
    { key: 'glareOppositeFactor',    label: '高光对侧强度',   type: 'range', min: 0,    max: 100,   step: 0.01  },
    { key: 'glareAngle',             label: '高光角度',       type: 'range', min: -180, max: 180,   step: 0.01  },
    { key: 'blurRadius',             label: '模糊半径',       type: 'range', min: 1,    max: 200,   step: 1     },
    { key: 'blurEdge',               label: '模糊边缘',       type: 'checkbox' },
    // tint is handled separately
    { key: 'shadowExpand',           label: '阴影扩散',       type: 'range', min: 2,    max: 100,   step: 0.01  },
    { key: 'shadowFactor',           label: '阴影强度',       type: 'range', min: 0,    max: 100,   step: 0.01  },
    // shadowPosition handled separately
    { key: 'bgType',                 label: '背景',           type: 'select', options: [
      { value: '0',   text: '棋盘格' },
      { value: '1',   text: '四象限' },
      { value: '2',   text: '半色调' },
      { value: '11',  text: '自定义图片' },
      { value: '100', text: '流动渐变' }
    ]}
  ];

  var SHAPE_CONTROLS = [
    { key: 'shapeWidth',     label: '主岛-宽',       type: 'range', min: 20, max: 800, step: 1    },
    { key: 'shapeHeight',    label: '主岛-高',       type: 'range', min: 20, max: 800, step: 1    },
    { key: 'shapeRadius',    label: '主岛-圆角',     type: 'range', min: 1,  max: 100, step: 0.1  },
    { key: 'shapeRoundness', label: '超椭圆系数', type: 'range', min: 2,  max: 7,   step: 0.01 },
    { key: 'mergeRate',      label: '形状融合度', type: 'range', min: 0,  max: 0.3, step: 0.01 },
    { key: 'showShape1',     label: '显示副岛', type: 'checkbox' },
    { key: 'shape1Width',    label: '副岛-宽',       type: 'range', min: 20, max: 800, step: 1    },
    { key: 'shape1Height',   label: '副岛-高',       type: 'range', min: 20, max: 800, step: 1    },
    { key: 'shape1Radius',   label: '副岛-圆角',     type: 'range', min: 1,  max: 100, step: 0.1  },
    { key: 'islandGap',      label: '间距',           type: 'range', min: 0,  max: 40,  step: 1    },
  ];

  var ANIM_CONTROLS = [
    { key: 'springSizeFactor', label: '动画形变', type: 'range', min: 0, max: 50, step: 0.01 }
  ];

  var SHADOW_CONTROLS = [
    { key: 'cssShadowBlur',    label: '阴影模糊半径', type: 'range', min: 0, max: 50, step: 1 },
    { key: 'cssShadowOpacity', label: '阴影不透明度', type: 'range', min: 0, max: 1,  step: 0.01 },
    { key: 'cssShadowOffsetY', label: '阴影垂直偏移', type: 'range', min: -50, max: 50, step: 1 },
    { key: 'cssShadowTop',     label: '阴影整体偏移', type: 'range', min: -50, max: 50, step: 1 },
  ];

  // ---------------------------------------------------------------------------
  // Internal state: DOM references for each control
  // ---------------------------------------------------------------------------
  var sliderRefs = {};   // key -> { slider: <input range>, number: <input number> }
  var checkboxRefs = {}; // key -> <input checkbox>
  var selectRefs = {};   // key -> <select>
  var tintColorRef = null; // <input color>
  var tintAlphaSliderRef = null;
  var tintAlphaNumberRef = null;
  var shadowXSlider = null;
  var shadowXNumber = null;
  var shadowYSlider = null;
  var shadowYNumber = null;
  var bgTypeSelect = null;
  var uploadHintEl = null;

  var panel = null;
  var toggleBtn = null;
  var saveIndicator = null;

  // Auto-persist current state to localStorage (debounced)
  var CURRENT_STATE_KEY = 'liquid-glass-current-state';
  var persistTimer = null;
  function persistState() {
    clearTimeout(persistTimer);
    persistTimer = setTimeout(function () {
      var cfg = getCfg();
      if (!cfg) return;
      try {
        localStorage.setItem(CURRENT_STATE_KEY, JSON.stringify(cfg));
      } catch (e) { /* ignore */ }
    }, 300);
  }
  var savePresetRow = null;
  var savePresetInput = null;
  var savePresetConfirmBtn = null;
  var loadPresetRow = null;
  var presetListEl = null;
  var activePresetIndex = -1;

  var panelVisible = true;

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------
  function el(tag) {
    return document.createElement(tag);
  }

  function getCfg() {
    return window.__liquidGlassConfig;
  }

  function hexToRgb(hex) {
    var r = parseInt(hex.slice(1, 3), 16);
    var g = parseInt(hex.slice(3, 5), 16);
    var b = parseInt(hex.slice(5, 7), 16);
    return { r: r, g: g, b: b };
  }

  function rgbToHex(r, g, b) {
    return '#' +
      ('0' + Math.round(r).toString(16)).slice(-2) +
      ('0' + Math.round(g).toString(16)).slice(-2) +
      ('0' + Math.round(b).toString(16)).slice(-2);
  }

  function deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
  }

  // ---------------------------------------------------------------------------
  // Create a range control row
  // ---------------------------------------------------------------------------
  function createRangeRow(def) {
    var row = el('div');
    row.className = 'ctrl-row';

    var label = el('label');
    label.textContent = def.label;
    row.appendChild(label);

    var slider = el('input');
    slider.type = 'range';
    slider.min = def.min;
    slider.max = def.max;
    slider.step = def.step;
    slider.value = DEFAULTS[def.key];
    row.appendChild(slider);

    var num = el('input');
    num.type = 'number';
    num.min = def.min;
    num.max = def.max;
    num.step = def.step;
    num.value = DEFAULTS[def.key];
    row.appendChild(num);

    sliderRefs[def.key] = { slider: slider, number: num };

    // Sync slider -> number -> config
    slider.addEventListener('input', function () {
      var val = parseFloat(slider.value);
      num.value = val;
      var cfg = getCfg();
      if (cfg) cfg[def.key] = val;
      persistState();
    });

    // Sync number -> slider -> config
    num.addEventListener('input', function () {
      var val = parseFloat(num.value);
      if (isNaN(val)) return;
      val = clamp(val, def.min, def.max);
      slider.value = val;
      var cfg = getCfg();
      if (cfg) cfg[def.key] = val;
      persistState();
    });

    return row;
  }

  // ---------------------------------------------------------------------------
  // Create a checkbox control row
  // ---------------------------------------------------------------------------
  function createCheckboxRow(def) {
    var row = el('div');
    row.className = 'ctrl-row';

    var cb = el('input');
    cb.type = 'checkbox';
    cb.checked = DEFAULTS[def.key];
    row.appendChild(cb);

    var label = el('span');
    label.className = 'check-label';
    label.textContent = def.label;
    row.appendChild(label);

    checkboxRefs[def.key] = cb;

    cb.addEventListener('change', function () {
      var cfg = getCfg();
      if (cfg) cfg[def.key] = cb.checked;
      persistState();
    });

    return row;
  }

  // ---------------------------------------------------------------------------
  // Create a select control row
  // ---------------------------------------------------------------------------
  function createSelectRow(def) {
    var row = el('div');
    row.className = 'ctrl-row';

    var label = el('label');
    label.textContent = def.label;
    row.appendChild(label);

    var select = el('select');
    for (var i = 0; i < def.options.length; i++) {
      var opt = el('option');
      opt.value = def.options[i].value;
      opt.textContent = def.options[i].text;
      select.appendChild(opt);
    }
    select.value = String(DEFAULTS[def.key]);
    row.appendChild(select);

    selectRefs[def.key] = select;
    if (def.key === 'bgType') {
      bgTypeSelect = select;
    }

    select.addEventListener('change', function () {
      var cfg = getCfg();
      if (cfg) cfg[def.key] = parseInt(select.value, 10);
      persistState();
      // Show/hide upload hint
      if (uploadHintEl) {
        uploadHintEl.style.display = (parseInt(select.value, 10) === 11) ? 'inline' : 'none';
      }
    });

    return row;
  }

  // ---------------------------------------------------------------------------
  // Create tint color row
  // ---------------------------------------------------------------------------
  function createTintColorRow() {
    var row = el('div');
    row.className = 'ctrl-color-row';

    var label = el('label');
    label.textContent = '色调';
    row.appendChild(label);

    var colorInput = el('input');
    colorInput.type = 'color';
    colorInput.value = rgbToHex(DEFAULTS.tint.r, DEFAULTS.tint.g, DEFAULTS.tint.b);
    row.appendChild(colorInput);

    tintColorRef = colorInput;

    colorInput.addEventListener('input', function () {
      var rgb = hexToRgb(colorInput.value);
      var cfg = getCfg();
      if (cfg && cfg.tint) {
        cfg.tint.r = rgb.r;
        cfg.tint.g = rgb.g;
        cfg.tint.b = rgb.b;
        persistState();
      }
    });

    return row;
  }

  // ---------------------------------------------------------------------------
  // Create tint alpha row
  // ---------------------------------------------------------------------------
  function createTintAlphaRow() {
    var row = el('div');
    row.className = 'ctrl-alpha-row';

    var label = el('label');
    label.textContent = '色调透明度';
    row.appendChild(label);

    var slider = el('input');
    slider.type = 'range';
    slider.min = 0;
    slider.max = 1;
    slider.step = 0.01;
    slider.value = DEFAULTS.tint.a;
    row.appendChild(slider);

    var num = el('input');
    num.type = 'number';
    num.min = 0;
    num.max = 1;
    num.step = 0.01;
    num.value = DEFAULTS.tint.a;
    row.appendChild(num);

    tintAlphaSliderRef = slider;
    tintAlphaNumberRef = num;

    slider.addEventListener('input', function () {
      var val = parseFloat(slider.value);
      num.value = val;
      var cfg = getCfg();
      if (cfg && cfg.tint) cfg.tint.a = val;
      persistState();
    });

    num.addEventListener('input', function () {
      var val = parseFloat(num.value);
      if (isNaN(val)) return;
      val = clamp(val, 0, 1);
      slider.value = val;
      var cfg = getCfg();
      if (cfg && cfg.tint) cfg.tint.a = val;
      persistState();
    });

    return row;
  }

  // ---------------------------------------------------------------------------
  // Create shadow position sub-rows
  // ---------------------------------------------------------------------------
  function createShadowPositionRows() {
    var container = el('div');

    // X row
    var xRow = el('div');
    xRow.className = 'ctrl-sub-row';

    var xLabel = el('span');
    xLabel.className = 'sub-label';
    xLabel.textContent = 'X';
    xRow.appendChild(xLabel);

    var xLabel2 = el('span');
    xLabel2.className = 'sub-label';
    xLabel2.style.minWidth = '56px';
    xLabel2.textContent = '阴影位置';
    xRow.appendChild(xLabel2);

    var xSlider = el('input');
    xSlider.type = 'range';
    xSlider.min = -20;
    xSlider.max = 20;
    xSlider.step = 0.1;
    xSlider.value = DEFAULTS.shadowPosition.x;
    xRow.appendChild(xSlider);

    var xNum = el('input');
    xNum.type = 'number';
    xNum.min = -20;
    xNum.max = 20;
    xNum.step = 0.1;
    xNum.value = DEFAULTS.shadowPosition.x;
    xNum.style.width = '50px';
    xRow.appendChild(xNum);

    shadowXSlider = xSlider;
    shadowXNumber = xNum;

    xSlider.addEventListener('input', function () {
      var val = parseFloat(xSlider.value);
      xNum.value = val;
      var cfg = getCfg();
      if (cfg && cfg.shadowPosition) cfg.shadowPosition.x = val;
      persistState();
    });

    xNum.addEventListener('input', function () {
      var val = parseFloat(xNum.value);
      if (isNaN(val)) return;
      val = clamp(val, -20, 20);
      xSlider.value = val;
      var cfg = getCfg();
      if (cfg && cfg.shadowPosition) cfg.shadowPosition.x = val;
      persistState();
    });

    container.appendChild(xRow);

    // Y row
    var yRow = el('div');
    yRow.className = 'ctrl-sub-row';

    var yLabel = el('span');
    yLabel.className = 'sub-label';
    yLabel.textContent = 'Y';
    yRow.appendChild(yLabel);

    var yBlank = el('span');
    yBlank.style.minWidth = '56px';
    yRow.appendChild(yBlank);

    var ySlider = el('input');
    ySlider.type = 'range';
    ySlider.min = -20;
    ySlider.max = 20;
    ySlider.step = 0.1;
    ySlider.value = DEFAULTS.shadowPosition.y;
    yRow.appendChild(ySlider);

    var yNum = el('input');
    yNum.type = 'number';
    yNum.min = -20;
    yNum.max = 20;
    yNum.step = 0.1;
    yNum.value = DEFAULTS.shadowPosition.y;
    yNum.style.width = '50px';
    yRow.appendChild(yNum);

    shadowYSlider = ySlider;
    shadowYNumber = yNum;

    ySlider.addEventListener('input', function () {
      var val = parseFloat(ySlider.value);
      yNum.value = val;
      var cfg = getCfg();
      if (cfg && cfg.shadowPosition) cfg.shadowPosition.y = val;
      persistState();
    });

    yNum.addEventListener('input', function () {
      var val = parseFloat(yNum.value);
      if (isNaN(val)) return;
      val = clamp(val, -20, 20);
      ySlider.value = val;
      var cfg = getCfg();
      if (cfg && cfg.shadowPosition) cfg.shadowPosition.y = val;
      persistState();
    });

    container.appendChild(yRow);

    return container;
  }

  // ---------------------------------------------------------------------------
  // Create folder (collapsible section)
  // ---------------------------------------------------------------------------
  function createFolder(name, controls, openByDefault) {
    var folder = el('div');
    folder.className = 'ctrl-folder';

    var header = el('div');
    header.className = 'ctrl-folder-header' + (openByDefault ? ' open' : '');

    var arrow = el('span');
    arrow.className = 'arrow';
    arrow.textContent = '\u25B6';
    header.appendChild(arrow);

    var folderName = el('span');
    folderName.className = 'folder-name';
    folderName.textContent = name;
    header.appendChild(folderName);

    var body = el('div');
    body.className = 'ctrl-folder-body' + (openByDefault ? ' open' : '');

    header.addEventListener('click', function () {
      var isOpen = header.classList.toggle('open');
      body.classList.toggle('open', isOpen);
    });

    folder.appendChild(header);
    folder.appendChild(body);

    // Add controls in order, with special handling for tint and shadowPosition
    for (var i = 0; i < controls.length; i++) {
      var def = controls[i];
      if (def.key === 'tint') {
        body.appendChild(createTintColorRow());
        body.appendChild(createTintAlphaRow());
      } else if (def.key === 'shadowPosition') {
        body.appendChild(createShadowPositionRows());
      } else if (def.type === 'range') {
        body.appendChild(createRangeRow(def));
      } else if (def.type === 'checkbox') {
        body.appendChild(createCheckboxRow(def));
      } else if (def.type === 'select') {
        body.appendChild(createSelectRow(def));
      }
    }

    return folder;
  }

  // ---------------------------------------------------------------------------
  // Build the full panel
  // ---------------------------------------------------------------------------
  function buildPanel() {
    // Main panel
    panel = el('div');
    panel.id = 'controls-panel';

    // Header
    var header = el('div');
    header.className = 'panel-header';

    var title = el('h3');
    title.textContent = 'Liquid Glass \u63A7\u5236\u9762\u677F';
    header.appendChild(title);

    var closeBtn = el('button');
    closeBtn.textContent = '\u2715';
    closeBtn.title = '\u5173\u95ED';
    closeBtn.addEventListener('click', function () {
      hidePanel();
    });
    header.appendChild(closeBtn);

    panel.appendChild(header);

    // Action buttons row
    var actions = el('div');
    actions.className = 'panel-actions';

    var saveBtn = el('button');
    saveBtn.textContent = '\u4FDD\u5B58\u9884\u8BBE';
    saveBtn.className = 'primary';
    saveBtn.addEventListener('click', function () {
      toggleSavePresetRow();
    });
    actions.appendChild(saveBtn);

    var loadBtn = el('button');
    loadBtn.textContent = '\u52A0\u8F7D\u9884\u8BBE';
    loadBtn.addEventListener('click', function () {
      toggleLoadPresetRow();
    });
    actions.appendChild(loadBtn);

    var resetBtn = el('button');
    resetBtn.textContent = '\u91CD\u7F6E';
    resetBtn.addEventListener('click', function () {
      resetAll();
    });
    actions.appendChild(resetBtn);

    panel.appendChild(actions);

    // Save indicator
    saveIndicator = el('div');
    saveIndicator.className = 'save-indicator';
    saveIndicator.textContent = '\u2713 \u5DF2\u4FDD\u5B58';
    panel.appendChild(saveIndicator);

    // Save preset row (inline input)
    savePresetRow = el('div');
    savePresetRow.className = 'save-preset-row';

    savePresetInput = el('input');
    savePresetInput.type = 'text';
    savePresetInput.placeholder = '\u8F93\u5165\u9884\u8BBE\u540D\u79F0...';
    savePresetRow.appendChild(savePresetInput);

    savePresetConfirmBtn = el('button');
    savePresetConfirmBtn.textContent = '\u786E\u8BA4';
    savePresetConfirmBtn.addEventListener('click', function () {
      savePreset();
    });
    savePresetRow.appendChild(savePresetConfirmBtn);

    // Handle Enter key on save preset input
    savePresetInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        savePreset();
      }
    });

    panel.appendChild(savePresetRow);

    // Load preset row (list)
    loadPresetRow = el('div');
    loadPresetRow.className = 'load-preset-row';

    presetListEl = el('div');
    presetListEl.className = 'preset-list';
    loadPresetRow.appendChild(presetListEl);

    panel.appendChild(loadPresetRow);

    // Folder: Basic Settings
    // Insert tint and shadowPosition into the basic controls list
    var basicControlsWithSpecial = [];
    for (var bi = 0; bi < BASIC_CONTROLS.length; bi++) {
      var bdef = BASIC_CONTROLS[bi];
      if (bdef.key === 'shadowFactor') {
        basicControlsWithSpecial.push(bdef);
        basicControlsWithSpecial.push({ key: 'shadowPosition', label: '阴影位置', type: 'sub-sliders' });
      } else if (bdef.key === 'blurEdge') {
        basicControlsWithSpecial.push(bdef);
        basicControlsWithSpecial.push({ key: 'tint', label: '色调', type: 'tint' });
      } else {
        basicControlsWithSpecial.push(bdef);
      }
    }
    panel.appendChild(createFolder('\u57FA\u7840\u8BBE\u7F6E (Basic Settings)', basicControlsWithSpecial, true));

    // Folder: Shape Settings
    panel.appendChild(createFolder('\u5F62\u72B6\u8BBE\u7F6E (Shape Settings)', SHAPE_CONTROLS, true));

    // Folder: Animation Settings
    panel.appendChild(createFolder('\u52A8\u753B\u8BBE\u7F6E (Animation Settings)', ANIM_CONTROLS, false));

    // Folder: Shadow Settings
    panel.appendChild(createFolder('\u9634\u5F71\u8BBE\u7F6E (Shadow Settings)', SHADOW_CONTROLS, false));

    // Upload hint (shown when bgType === 11)
    var uploadHintContainer = el('div');
    uploadHintContainer.style.cssText = 'padding:0 14px 8px;';
    uploadHintEl = el('span');
    uploadHintEl.className = 'upload-hint';
    uploadHintEl.textContent = '(\u4E0A\u4F20\u56FE\u7247)';
    uploadHintEl.style.display = 'none';
    uploadHintEl.addEventListener('click', function () {
      var fileInput = document.getElementById('file-input');
      if (fileInput) fileInput.click();
    });
    uploadHintContainer.appendChild(uploadHintEl);
    panel.appendChild(uploadHintContainer);

    // Append panel to body
    document.body.appendChild(panel);

    // Toggle button
    toggleBtn = el('button');
    toggleBtn.id = 'controls-toggle';
    toggleBtn.textContent = '\u2699';
    toggleBtn.title = '\u6253\u5F00\u63A7\u5236\u9762\u677F';
    toggleBtn.classList.add('hidden');
    toggleBtn.addEventListener('click', function () {
      showPanel();
    });
    document.body.appendChild(toggleBtn);
  }

  // ---------------------------------------------------------------------------
  // Panel visibility
  // ---------------------------------------------------------------------------
  function hidePanel() {
    panel.classList.add('hidden');
    toggleBtn.classList.remove('hidden');
    panelVisible = false;
  }

  function showPanel() {
    panel.classList.remove('hidden');
    toggleBtn.classList.add('hidden');
    panelVisible = true;
  }

  // ---------------------------------------------------------------------------
  // Toggle helpers for save/load rows
  // ---------------------------------------------------------------------------
  function toggleSavePresetRow() {
    // Close load row if open
    loadPresetRow.classList.remove('show');

    var showing = savePresetRow.classList.toggle('show');
    if (showing) {
      savePresetInput.value = '';
      savePresetInput.focus();
    }
  }

  function toggleLoadPresetRow() {
    // Close save row if open
    savePresetRow.classList.remove('show');

    var showing = loadPresetRow.classList.toggle('show');
    if (showing) {
      refreshPresetList();
    }
  }

  // ---------------------------------------------------------------------------
  // Presets: load list from localStorage
  // ---------------------------------------------------------------------------
  function getPresets() {
    try {
      var data = localStorage.getItem(PRESETS_KEY);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      return [];
    }
  }

  function setPresets(list) {
    try {
      localStorage.setItem(PRESETS_KEY, JSON.stringify(list));
    } catch (e) {
      // storage full or unavailable
    }
  }

  function refreshPresetList() {
    var presets = getPresets();
    presetListEl.innerHTML = '';

    if (presets.length === 0) {
      var empty = el('div');
      empty.className = 'preset-empty';
      empty.textContent = '\u6682\u65E0\u9884\u8BBE';
      presetListEl.appendChild(empty);
      return;
    }

    for (var i = 0; i < presets.length; i++) {
      var card = el('div');
      card.className = 'preset-card' + (i === activePresetIndex ? ' active' : '');
      card.dataset.index = i;

      var name = el('span');
      name.className = 'preset-name';
      name.textContent = presets[i].name;
      card.appendChild(name);

      var delBtn = el('button');
      delBtn.className = 'preset-delete';
      delBtn.textContent = '\u00D7';
      delBtn.title = '\u5220\u9664';
      delBtn.addEventListener('click', (function(idx) {
        return function(e) {
          e.stopPropagation();
          deletePreset(String(idx));
        };
      })(i));
      card.appendChild(delBtn);

      card.addEventListener('click', (function(idx) {
        return function() {
          loadPreset(String(idx));
        };
      })(i));

      presetListEl.appendChild(card);
    }
  }

  // ---------------------------------------------------------------------------
  // Save preset
  // ---------------------------------------------------------------------------
  function savePreset() {
    var name = savePresetInput.value.trim();
    if (!name) {
      savePresetInput.style.borderColor = 'rgba(255,100,100,0.6)';
      setTimeout(function () {
        savePresetInput.style.borderColor = '';
      }, 1000);
      return;
    }

    var cfg = getCfg();
    if (!cfg) return;

    var snapshot = deepClone(cfg);
    var presets = getPresets();
    presets.push({ name: name, config: snapshot, timestamp: Date.now() });
    setPresets(presets);

    // Mark the newly saved preset as active
    activePresetIndex = presets.length - 1;
    refreshPresetList();

    // Show indicator
    saveIndicator.classList.add('show');
    setTimeout(function () {
      saveIndicator.classList.remove('show');
    }, 1500);

    // Hide save row
    savePresetRow.classList.remove('show');
  }

  // ---------------------------------------------------------------------------
  // Load preset
  // ---------------------------------------------------------------------------
  function loadPreset(indexStr) {
    if (indexStr === '' || indexStr === null) return;
    var idx = parseInt(indexStr, 10);
    var presets = getPresets();
    if (idx < 0 || idx >= presets.length) return;

    var config = presets[idx].config;
    var cfg = getCfg();
    if (!cfg) return;

    // Copy config values
    applyConfigToUI(config);
    // Copy to live config
    copyConfig(config, cfg);

    // Track active preset
    activePresetIndex = idx;
    refreshPresetList();
  }

  // ---------------------------------------------------------------------------
  // Delete preset
  // ---------------------------------------------------------------------------
  function deletePreset(indexStr) {
    if (indexStr === '' || indexStr === null) return;
    var idx = parseInt(indexStr, 10);
    var presets = getPresets();
    if (idx < 0 || idx >= presets.length) return;

    presets.splice(idx, 1);
    setPresets(presets);

    // Adjust active index
    if (activePresetIndex === idx) {
      activePresetIndex = -1;
    } else if (activePresetIndex > idx) {
      activePresetIndex--;
    }

    refreshPresetList();
  }

  // ---------------------------------------------------------------------------
  // Copy config snapshot to live config
  // ---------------------------------------------------------------------------
  function copyConfig(src, dst) {
    var keys = Object.keys(src);
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i];
      if (typeof src[k] === 'object' && src[k] !== null && !Array.isArray(src[k])) {
        if (!dst[k]) dst[k] = {};
        var subKeys = Object.keys(src[k]);
        for (var j = 0; j < subKeys.length; j++) {
          dst[k][subKeys[j]] = src[k][subKeys[j]];
        }
      } else {
        dst[k] = src[k];
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Apply a config snapshot to all UI controls
  // ---------------------------------------------------------------------------
  function applyConfigToUI(config) {
    // Range controls
    var rangeKeys = Object.keys(sliderRefs);
    for (var i = 0; i < rangeKeys.length; i++) {
      var key = rangeKeys[i];
      var ref = sliderRefs[key];
      if (config[key] !== undefined) {
        ref.slider.value = config[key];
        ref.number.value = config[key];
      }
    }

    // Checkbox controls
    var checkKeys = Object.keys(checkboxRefs);
    for (var i = 0; i < checkKeys.length; i++) {
      var key = checkKeys[i];
      if (config[key] !== undefined) {
        checkboxRefs[key].checked = config[key];
      }
    }

    // Select controls
    var selKeys = Object.keys(selectRefs);
    for (var i = 0; i < selKeys.length; i++) {
      var key = selKeys[i];
      if (config[key] !== undefined) {
        selectRefs[key].value = String(config[key]);
      }
    }

    // Tint color
    if (config.tint && tintColorRef) {
      tintColorRef.value = rgbToHex(config.tint.r, config.tint.g, config.tint.b);
      tintAlphaSliderRef.value = config.tint.a;
      tintAlphaNumberRef.value = config.tint.a;
    }

    // Shadow position
    if (config.shadowPosition) {
      shadowXSlider.value = config.shadowPosition.x;
      shadowXNumber.value = config.shadowPosition.x;
      shadowYSlider.value = config.shadowPosition.y;
      shadowYNumber.value = config.shadowPosition.y;
    }

    // Upload hint
    if (uploadHintEl && config.bgType !== undefined) {
      uploadHintEl.style.display = (parseInt(config.bgType, 10) === 11) ? 'inline' : 'none';
    }
  }

  // ---------------------------------------------------------------------------
  // Reset all to defaults
  // ---------------------------------------------------------------------------
  function resetAll() {
    var cfg = getCfg();
    if (!cfg) return;

    // Apply defaults to config
    var keys = Object.keys(DEFAULTS);
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i];
      if (typeof DEFAULTS[k] === 'object' && DEFAULTS[k] !== null && !Array.isArray(DEFAULTS[k])) {
        if (!cfg[k]) cfg[k] = {};
        var subKeys = Object.keys(DEFAULTS[k]);
        for (var j = 0; j < subKeys.length; j++) {
          cfg[k][subKeys[j]] = DEFAULTS[k][subKeys[j]];
        }
      } else {
        cfg[k] = DEFAULTS[k];
      }
    }

    // Apply defaults to UI
    applyConfigToUI(DEFAULTS);

    // Clear persisted state
    try { localStorage.removeItem(CURRENT_STATE_KEY); } catch (e) {}
  }

  // ---------------------------------------------------------------------------
  // Init: wait for config to be available
  // ---------------------------------------------------------------------------
  function waitForConfig() {
    if (window.__liquidGlassConfig) {
      buildPanel();
      // Sync UI with current config values (in case they differ from defaults)
      applyConfigToUI(window.__liquidGlassConfig);
      return;
    }
    setTimeout(waitForConfig, 50);
  }

  // Expose for settings window to sync controls after receiving config
  window.__syncControlsFromConfig = function() {
    if (window.__liquidGlassConfig) {
      applyConfigToUI(window.__liquidGlassConfig);
    }
  };

  // Start
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', waitForConfig);
  } else {
    waitForConfig();
  }

})();
