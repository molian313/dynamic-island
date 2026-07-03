// ============================================================================
// Liquid Glass Studio — Standalone Demo (exact replica of original project)
// ============================================================================

(function () {
  "use strict";

  // ---------------------------------------------------------------------------
  // Controls defaults — copied exactly from Controls.tsx
  // ---------------------------------------------------------------------------
  const C = {
    refThickness: 20,
    refFactor: 1.4,
    refDispersion: 7,
    refFresnelRange: 30,
    refFresnelHardness: 20, // → /100 when passed to shader
    refFresnelFactor: 20, // → /100
    glareRange: 30,
    glareHardness: 20, // → /100
    glareFactor: 90, // → /100
    glareConvergence: 50, // → /100
    glareOppositeFactor: 80, // → /100
    glareAngle: -45,
    blurRadius: 1, // original default is 1, NOT 40
    blurEdge: true,
    tint: { r: 255, g: 255, b: 255, a: 0 }, // 0-255 range
    shadowExpand: 25,
    shadowFactor: 15, // → /100 when passed to shader
    shadowPosition: { x: 0, y: -10 },
    // Shape 1 (主岛 / left capsule)
    shapeWidth: 140,
    shapeHeight: 50,
    shapeRadius: 25,
    // Shape 2 (副岛 / right capsule)
    shape1Width: 50,
    shape1Height: 50,
    shape1Radius: 25,
    shapeRoundness: 5,
    mergeRate: 0.05,
    showShape1: true, // two shapes
    // Island gap (CSS pixels, for initial positioning)
    islandGap: 6,
    // Expanded sizes (on hover)
    expandedWidth: 270,
    expandedHeight: 74,
    expandedShape1Width: 140,
    expandedShape1Height: 74,
    expandSpeed: 8, // lerp speed
    // Compact mode sizes (after double-click right island)
    compactWidth: 86,
    compactHeight: 50,
    compactExpandedWidth: 200,
    compactExpandedHeight: 74,
    compactShape1Width: 104,
    compactShape1Height: 50,
    compactExpandedShape1Width: 210,
    compactExpandedShape1Height: 74,
    springSizeFactor: 10,
    step: 9,
    bgType: 0, // 0 = chessboard (original default)
    // CSS shadow settings (synced from controls.js)
    cssShadowBlur: 5,
    cssShadowOpacity: 0.25,
    cssShadowOffsetY: 0,
    cssShadowTop: 5,
  };

  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------
  let gl, canvas;
  let dpr = 1;
  let canvasW = 0,
    canvasH = 0;

  // Programs
  let bgProgram, vblurProgram, hblurProgram, mainProgram;

  // VAO
  let quadVAO;

  // FBOs
  let bgFBO, vblurFBO, hblurFBO;

  // Uniform locations
  let bgU = {},
    vblurU = {},
    hblurU = {},
    mainU = {};

  // Mouse / spring
  let pointerX = 0,
    pointerY = 0; // in canvas pixel coords (GL origin)
  let springX = 0,
    springY = 0;
  let springVX = 0,
    springVY = 0;
  let isHovering = false;
  let isCompactMode = false; // toggled by double-click on right island
  let isTauriMode = !!window.__TAURI__;
  // Current animated sizes (lerp towards target)
  let animWidth = 140,
    animHeight = 50;
  let anim1Width = 50,
    anim1Height = 50;
  let shape1CenterX = 0,
    shape1CenterY = 0;
  let mainIslandCenterX = 0,
    mainIslandCenterY = 0;
  // Shape 1 (副岛) spring
  let pointer1X = 0,
    pointer1Y = 0;
  let spring1X = 0,
    spring1Y = 0;
  let spring1VX = 0,
    spring1VY = 0;
  let springSpeedX = 0,
    springSpeedY = 0;
  let lastSpringValueX = 0,
    lastSpringValueY = 0;
  let lastSpringTime = null;
  let springInitialized = false;

  // Blur kernel (precomputed once)
  let blurWeights = [];

  // Background texture
  let bgTexture = null;
  let bgTextureRatio = 1;
  let bgTextureReady = false;
  // Screen capture texture (set from Tauri initTauriMode)
  let screenCapTexture = null;
  let screenCapRatio = 1;
  let screenCapReady = false;

  // ---------------------------------------------------------------------------
  // Gaussian kernel — exact copy from src/utils/index.ts
  // ---------------------------------------------------------------------------
  function computeGaussianKernel(radius) {
    const sigma = radius / 3.0;
    const kernel = [];
    let sum = 0;
    for (let i = 0; i <= radius; i++) {
      const weight = Math.exp((-0.5 * (i * i)) / (sigma * sigma));
      kernel.push(weight);
      sum += i === 0 ? weight : weight * 2;
    }
    return kernel.map(function (w) {
      return w / sum;
    });
  }

  // ---------------------------------------------------------------------------
  // Spring physics — substep integration for stability (replicates @react-spring)
  // ---------------------------------------------------------------------------
  var SPRING_STIFFNESS = 170;
  var SPRING_DAMPING = 26;
  var SPRING_PRECISION = 0.0001;
  var SPRING_SUBSTEPS = 10;

  function updateSpring(dt) {
    if (dt <= 0 || dt > 0.5) return;

    var innerDt = dt / SPRING_SUBSTEPS;
    for (var s = 0; s < SPRING_SUBSTEPS; s++) {
      var ax =
        SPRING_STIFFNESS * (pointerX - springX) - SPRING_DAMPING * springVX;
      var ay =
        SPRING_STIFFNESS * (pointerY - springY) - SPRING_DAMPING * springVY;
      springVX += ax * innerDt;
      springVY += ay * innerDt;
      springX += springVX * innerDt;
      springY += springVY * innerDt;
    }

    // Compute speed for elastic deformation
    if (lastSpringTime !== null) {
      var sdt = dt;
      if (sdt > 0) {
        springSpeedX = Math.abs((springX - lastSpringValueX) / sdt);
        springSpeedY = Math.abs((springY - lastSpringValueY) / sdt);
        if (Math.abs(springSpeedX) > 1e10 || Math.abs(springSpeedY) > 1e10) {
          springSpeedX = 0;
          springSpeedY = 0;
        }
      }
    }
    lastSpringValueX = springX;
    lastSpringValueY = springY;
    lastSpringTime = performance.now();
  }

  function updateSpring1(dt) {
    if (dt <= 0 || dt > 0.5) return;
    var innerDt = dt / SPRING_SUBSTEPS;
    for (var s = 0; s < SPRING_SUBSTEPS; s++) {
      var ax =
        SPRING_STIFFNESS * (pointer1X - spring1X) - SPRING_DAMPING * spring1VX;
      var ay =
        SPRING_STIFFNESS * (pointer1Y - spring1Y) - SPRING_DAMPING * spring1VY;
      spring1VX += ax * innerDt;
      spring1VY += ay * innerDt;
      spring1X += spring1VX * innerDt;
      spring1Y += spring1VY * innerDt;
    }
  }

  // ---------------------------------------------------------------------------
  // Shader helpers
  // ---------------------------------------------------------------------------
  function compileShader(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.error("Shader compile error:", gl.getShaderInfoLog(shader));
      gl.deleteShader(shader);
      return null;
    }
    return shader;
  }

  function linkProgram(gl, vs, fs) {
    const program = gl.createProgram();
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error("Program link error:", gl.getProgramInfoLog(program));
      return null;
    }
    return program;
  }

  function buildProgram(gl, vsSource, fsSource) {
    const vs = compileShader(gl, gl.VERTEX_SHADER, vsSource);
    const fs = compileShader(gl, gl.FRAGMENT_SHADER, fsSource);
    if (!vs || !fs) return null;
    return linkProgram(gl, vs, fs);
  }

  function cacheUniforms(gl, program, names) {
    const locs = {};
    for (let i = 0; i < names.length; i++) {
      locs[names[i]] = gl.getUniformLocation(program, names[i]);
    }
    return locs;
  }

  // ---------------------------------------------------------------------------
  // Fullscreen quad
  // ---------------------------------------------------------------------------
  function createQuadVAO(gl, program) {
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
      gl.STATIC_DRAW,
    );
    const loc = gl.getAttribLocation(program, "a_position");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    gl.bindVertexArray(null);
    return vao;
  }

  // ---------------------------------------------------------------------------
  // FBO
  // ---------------------------------------------------------------------------
  function createFBO(gl, w, h) {
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA16F,
      w,
      h,
      0,
      gl.RGBA,
      gl.HALF_FLOAT,
      null,
    );
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    const fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(
      gl.FRAMEBUFFER,
      gl.COLOR_ATTACHMENT0,
      gl.TEXTURE_2D,
      tex,
      0,
    );
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    return { fbo: fbo, tex: tex };
  }

  function resizeFBO(gl, fboObj, w, h) {
    gl.bindTexture(gl.TEXTURE_2D, fboObj.tex);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA16F,
      w,
      h,
      0,
      gl.RGBA,
      gl.HALF_FLOAT,
      null,
    );
    gl.bindTexture(gl.TEXTURE_2D, null);
  }

  // ---------------------------------------------------------------------------
  // Resize
  // ---------------------------------------------------------------------------
  function handleResize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    if (w === canvasW && h === canvasH) return;

    canvasW = w;
    canvasH = h;
    dpr = window.devicePixelRatio || 1;

    const pw = Math.round(w * dpr);
    const ph = Math.round(h * dpr);
    canvas.width = pw;
    canvas.height = ph;
    canvas.style.width = w + "px";
    canvas.style.height = h + "px";

    gl.viewport(0, 0, pw, ph);
    resizeFBO(gl, bgFBO, pw, ph);
    resizeFBO(gl, vblurFBO, pw, ph);
    resizeFBO(gl, hblurFBO, pw, ph);
  }

  // ---------------------------------------------------------------------------
  // Render — 4-pass pipeline, exact replica of App.tsx render function
  // ---------------------------------------------------------------------------
  let lastTime = 0;

  // Sync DOM overlay to match animated island state (for Tauri mode)
  let _prevOverlayExpanded = false;
  let _prevOverlayCompact = false;
  function syncOverlay() {
    // In Tauri mode, DOM class toggling is handled by capsule-interaction.js
    if (!isTauriMode) {
      var ovLeft = document.getElementById("left-panel");
      var ovRight = document.getElementById("right-panel");
      if (ovLeft) {
        var expanded = isHovering;
        var compact = isCompactMode;
        if (expanded !== _prevOverlayExpanded) {
          ovLeft.classList.toggle("expanded", expanded);
          ovRight.classList.toggle("expanded", expanded);
          _prevOverlayExpanded = expanded;
        }
        if (compact !== _prevOverlayCompact) {
          ovLeft.classList.toggle("compact", compact);
          ovRight.classList.toggle("compact", compact);
          _prevOverlayCompact = compact;
        }
      }
    }
    // 动态更新阴影位置和大小，与 WebGL 岛完全匹配
    var shadowL = document.getElementById("shadow-left");
    var shadowR = document.getElementById("shadow-right");
    if (shadowL && shadowR) {
      var gap = C.islandGap;
      var totalW = animWidth + gap + anim1Width;
      var centerX = canvasW / 2;
      var topY = 11 + (C.cssShadowTop || 0);
      var radiusL = Math.min(C.shapeRadius, animHeight / 2);
      var radiusR = Math.min(C.shape1Radius, anim1Height / 2);
      var shadowBlur = C.cssShadowBlur || 5;
      var shadowOpacity = C.cssShadowOpacity || 0.25;
      var shadowOffsetY = C.cssShadowOffsetY || 0;
      var shadowCSS =
        "0 " +
        shadowOffsetY +
        "px " +
        shadowBlur +
        "px rgba(0,0,0," +
        shadowOpacity +
        "), " +
        "inset 0 " +
        shadowOffsetY +
        "px " +
        shadowBlur +
        "px rgba(0,0,0," +
        shadowOpacity +
        ")";
      // 左岛阴影
      var leftX = centerX - totalW / 2;
      shadowL.style.left = leftX + "px";
      shadowL.style.top = topY + "px";
      shadowL.style.width = animWidth + "px";
      shadowL.style.height = animHeight + "px";
      shadowL.style.borderRadius = radiusL + "px";
      shadowL.style.boxShadow = shadowCSS;
      // 右岛阴影
      var rightX = leftX + animWidth + gap;
      shadowR.style.left = rightX + "px";
      shadowR.style.top = topY + "px";
      shadowR.style.width = anim1Width + "px";
      shadowR.style.height = anim1Height + "px";
      shadowR.style.borderRadius = radiusR + "px";
      shadowR.style.boxShadow = shadowCSS;
    }
  }

  var _frameCount = 0,
    _fpsTime = 0;

  function render(timestamp) {
    requestAnimationFrame(render);

    handleResize();

    // Clear default framebuffer to prevent showing stale/undefined content
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    const dt = Math.min((timestamp - lastTime) / 1000, 0.05);
    lastTime = timestamp;
    if (dt <= 0) return;

    // FPS counter
    _frameCount++;
    // Show capsule after first frame renders
    if (_frameCount === 1) {
      var capsule = document.getElementById('island-capsule');
      if (capsule) capsule.classList.add('ready');
    }
    if (timestamp - _fpsTime >= 2000) {
      console.log(
        "[Render] FPS:",
        Math.round((_frameCount * 1000) / (timestamp - _fpsTime)),
      );
      _frameCount = 0;
      _fpsTime = timestamp;
    }

    // Update spring physics
    updateSpring(dt);
    updateSpring1(dt);

    // Animate sizes toward target (hover expand / collapse, compact mode)
    var baseW = isCompactMode ? C.compactWidth : C.shapeWidth;
    var baseH = isCompactMode ? C.compactHeight : C.shapeHeight;
    var base1W = isCompactMode ? C.compactShape1Width : C.shape1Width;
    var base1H = isCompactMode ? C.compactShape1Height : C.shape1Height;
    var expW = isCompactMode ? C.compactExpandedWidth : C.expandedWidth;
    var expH = isCompactMode ? C.compactExpandedHeight : C.expandedHeight;
    var exp1W = isCompactMode
      ? C.compactExpandedShape1Width
      : C.expandedShape1Width;
    var exp1H = isCompactMode
      ? C.compactExpandedShape1Height
      : C.expandedShape1Height;
    var targetW = isHovering ? expW : baseW;
    var targetH = isHovering ? expH : baseH;
    var target1W = isHovering ? exp1W : base1W;
    var target1H = isHovering ? exp1H : base1H;
    var lerpF = 1 - Math.exp(-C.expandSpeed * dt);
    animWidth += (targetW - animWidth) * lerpF;
    animHeight += (targetH - animHeight) * lerpF;
    anim1Width += (target1W - anim1Width) * lerpF;
    anim1Height += (target1H - anim1Height) * lerpF;

    // Sync DOM overlay state (for Tauri mode)
    syncOverlay();

    // Recompute blur kernel if radius changed
    if (blurWeights.length !== C.blurRadius + 1) {
      blurWeights = computeGaussianKernel(C.blurRadius);
    }

    const pw = canvas.width;
    const ph = canvas.height;

    var shapeSizeSpringX = animWidth;
    var shapeSizeSpringY = animHeight;

    // Lock shapes at center-top, 50px from top, side by side
    var totalW = animWidth + C.islandGap + anim1Width;
    var centerX = (canvasW / 2) * dpr;
    var baseCenterY = (canvasH - 36) * dpr;
    // 用目标高度（非动画高度）计算中心，避免弹簧追逐移动目标产生振荡
    var targetH = isHovering
      ? isCompactMode
        ? C.compactExpandedHeight
        : C.expandedHeight
      : isCompactMode
        ? C.compactHeight
        : C.shapeHeight;
    var centerY = baseCenterY - ((targetH - C.shapeHeight) / 2) * dpr;
    // Both shapes track one pointer
    pointerX = centerX;
    pointerY = centerY;

    // First frame: snap spring to target position (skip fly-in animation)
    if (!springInitialized) {
      springInitialized = true;
      springX = pointerX;
      springY = pointerY;
      spring1X = pointerX;
      spring1Y = pointerY;
    }

    // 主岛 center = group center - (副岛宽 + 间距) / 2
    mainIslandCenterX = springX - ((anim1Width + C.islandGap) / 2) * dpr;
    mainIslandCenterY = springY;
    // 副岛 center = group center + (主岛宽 + 间距) / 2
    shape1CenterX = springX + ((animWidth + C.islandGap) / 2) * dpr;
    shape1CenterY = springY;

    // Global uniforms (set on all programs by the original renderer)
    // These match App.tsx lines 633-648
    var uResolution = [pw, ph];
    var uDpr = dpr;
    var uMouse = [pointerX, pointerY];
    var uMouseSpring = [mainIslandCenterX, mainIslandCenterY];
    var uShapeWidth = shapeSizeSpringX;
    var uShapeHeight = shapeSizeSpringY;
    var uShapeRadius = Math.min(C.shapeRadius, animHeight / 2); // clamp to half height for capsule
    var uShapeRoundness = C.shapeRoundness;
    var uShape1Width = anim1Width;
    var uShape1Height = anim1Height;
    var uShape1Radius = Math.min(C.shape1Radius, anim1Height / 2);
    var uMergeRate = C.mergeRate;
    var uGlareAngle = (C.glareAngle * Math.PI) / 180;
    var uShowShape1 = C.showShape1 ? 1 : 0;

    // ---------------------------------------------------------------
    // Pass 1: Background
    // ---------------------------------------------------------------
    gl.bindFramebuffer(gl.FRAMEBUFFER, bgFBO.fbo);
    gl.useProgram(bgProgram);

    gl.uniform2f(bgU.u_resolution, uResolution[0], uResolution[1]);
    gl.uniform1f(bgU.u_dpr, uDpr);
    gl.uniform2f(bgU.u_mouse, uMouse[0], uMouse[1]);
    gl.uniform2f(bgU.u_mouseSpring, uMouseSpring[0], uMouseSpring[1]);
    gl.uniform1f(bgU.u_time, timestamp / 1000);
    gl.uniform1f(bgU.u_mergeRate, uMergeRate);
    gl.uniform1f(bgU.u_shapeWidth, uShapeWidth);
    gl.uniform1f(bgU.u_shapeHeight, uShapeHeight);
    gl.uniform1f(bgU.u_shapeRadius, uShapeRadius);
    gl.uniform1f(bgU.u_shapeRoundness, uShapeRoundness);
    gl.uniform1f(bgU.u_shape1Width, uShape1Width);
    gl.uniform1f(bgU.u_shape1Height, uShape1Height);
    gl.uniform1f(bgU.u_shape1Radius, uShape1Radius);
    gl.uniform2f(bgU.u_shape1Center, shape1CenterX, shape1CenterY);
    gl.uniform1f(bgU.u_shadowExpand, C.shadowExpand);
    gl.uniform1f(bgU.u_shadowFactor, C.shadowFactor / 100);
    gl.uniform2f(
      bgU.u_shadowPosition,
      -C.shadowPosition.x,
      -C.shadowPosition.y,
    );
    gl.uniform1i(bgU.u_bgType, C.bgType);
    gl.uniform1i(bgU.u_showShape1, uShowShape1);
    gl.uniform1i(bgU.u_tauriMode, isTauriMode ? 1 : 0);

    // Background texture (prefer screen capture in Tauri mode)
    var activeBgTex = null,
      activeBgRatio = 1,
      activeBgReady = false;
    if (isTauriMode && screenCapTexture && screenCapReady) {
      activeBgTex = screenCapTexture;
      activeBgRatio = screenCapRatio;
      activeBgReady = true;
    } else if (bgTexture && bgTextureReady) {
      activeBgTex = bgTexture;
      activeBgRatio = bgTextureRatio;
      activeBgReady = true;
    }
    if (activeBgReady) {
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, activeBgTex);
      gl.uniform1i(bgU.u_bgTexture, 0);
      gl.uniform1f(bgU.u_bgTextureRatio, activeBgRatio);
      gl.uniform1i(bgU.u_bgTextureReady, 1);
      // Override bgType to custom texture mode when screen capture is active
      if (isTauriMode && screenCapReady) {
        gl.uniform1i(bgU.u_bgType, 11);
      }
    } else {
      gl.uniform1i(bgU.u_bgTextureReady, 0);
    }

    for (var i = 0; i <= C.blurRadius && i < blurWeights.length; i++) {
      gl.uniform1f(bgU["u_blurWeights[" + i + "]"], blurWeights[i]);
    }
    gl.uniform1i(bgU.u_blurRadius, C.blurRadius);

    gl.bindVertexArray(quadVAO);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    // ---------------------------------------------------------------
    // Pass 2+3: Blur (skipped when blurRadius <= 1)
    // ---------------------------------------------------------------
    var useBlurredTex = bgFBO.tex;
    if (C.blurRadius >= 2) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, vblurFBO.fbo);
      gl.useProgram(vblurProgram);

      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, bgFBO.tex);
      gl.uniform1i(vblurU.u_prevPassTexture, 0);
      gl.uniform2f(vblurU.u_resolution, uResolution[0], uResolution[1]);
      gl.uniform1i(vblurU.u_blurRadius, C.blurRadius);
      for (var i = 0; i <= C.blurRadius && i < blurWeights.length; i++) {
        gl.uniform1f(vblurU["u_blurWeights[" + i + "]"], blurWeights[i]);
      }
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

      gl.bindFramebuffer(gl.FRAMEBUFFER, hblurFBO.fbo);
      gl.useProgram(hblurProgram);

      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, vblurFBO.tex);
      gl.uniform1i(hblurU.u_prevPassTexture, 0);
      gl.uniform2f(hblurU.u_resolution, uResolution[0], uResolution[1]);
      gl.uniform1i(hblurU.u_blurRadius, C.blurRadius);
      for (var i = 0; i <= C.blurRadius && i < blurWeights.length; i++) {
        gl.uniform1f(hblurU["u_blurWeights[" + i + "]"], blurWeights[i]);
      }
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

      useBlurredTex = hblurFBO.tex;
    }

    // ---------------------------------------------------------------
    // Pass 4: Main composite
    // ---------------------------------------------------------------
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.useProgram(mainProgram);

    // Bind textures — use bgFBO directly when blur is skipped
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, useBlurredTex);
    gl.uniform1i(mainU.u_blurredBg, 0);

    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, bgFBO.tex);
    gl.uniform1i(mainU.u_bg, 1);

    // Global uniforms
    gl.uniform2f(mainU.u_resolution, uResolution[0], uResolution[1]);
    gl.uniform1f(mainU.u_dpr, uDpr);
    gl.uniform2f(mainU.u_mouse, uMouse[0], uMouse[1]);
    gl.uniform2f(mainU.u_mouseSpring, uMouseSpring[0], uMouseSpring[1]);
    gl.uniform1f(mainU.u_mergeRate, uMergeRate);
    gl.uniform1f(mainU.u_shapeWidth, uShapeWidth);
    gl.uniform1f(mainU.u_shapeHeight, uShapeHeight);
    gl.uniform1f(mainU.u_shapeRadius, uShapeRadius);
    gl.uniform1f(mainU.u_shapeRoundness, uShapeRoundness);
    gl.uniform1f(mainU.u_shape1Width, uShape1Width);
    gl.uniform1f(mainU.u_shape1Height, uShape1Height);
    gl.uniform1f(mainU.u_shape1Radius, uShape1Radius);
    gl.uniform2f(mainU.u_shape1Center, shape1CenterX, shape1CenterY);
    gl.uniform1f(mainU.u_glareAngle, uGlareAngle);
    gl.uniform1i(mainU.u_showShape1, uShowShape1);

    // Pass-specific uniforms (mainPass) — exact /100 divisions from App.tsx
    gl.uniform4f(
      mainU.u_tint,
      C.tint.r / 255,
      C.tint.g / 255,
      C.tint.b / 255,
      C.tint.a,
    );
    gl.uniform1f(mainU.u_refThickness, C.refThickness);
    gl.uniform1f(mainU.u_refFactor, C.refFactor);
    gl.uniform1f(mainU.u_refDispersion, C.refDispersion);
    gl.uniform1f(mainU.u_refFresnelRange, C.refFresnelRange);
    gl.uniform1f(mainU.u_refFresnelHardness, C.refFresnelHardness / 100); // /100
    gl.uniform1f(mainU.u_refFresnelFactor, C.refFresnelFactor / 100); // /100
    gl.uniform1f(mainU.u_glareRange, C.glareRange);
    gl.uniform1f(mainU.u_glareHardness, C.glareHardness / 100); // /100
    gl.uniform1f(mainU.u_glareConvergence, C.glareConvergence / 100); // /100
    gl.uniform1f(mainU.u_glareOppositeFactor, C.glareOppositeFactor / 100); // /100
    gl.uniform1f(mainU.u_glareFactor, C.glareFactor / 100); // /100
    gl.uniform1i(mainU.u_blurEdge, C.blurEdge ? 1 : 0);
    gl.uniform1i(mainU.STEP, C.step);
    gl.uniform1i(mainU.u_tauriMode, isTauriMode ? 1 : 0);

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    gl.bindVertexArray(null);
  }

  // ---------------------------------------------------------------------------
  // Init
  // ---------------------------------------------------------------------------
  function init() {
    isTauriMode = !!window.__TAURI__;
    canvas = document.getElementById("glCanvas");

    gl = canvas.getContext("webgl2", {
      preserveDrawingBuffer: true,
      antialias: false,
      alpha: isTauriMode ? true : false,
      premultipliedAlpha: false,
    });

    if (!gl) {
      console.error("WebGL2 not supported");
      return;
    }

    var ext = gl.getExtension("EXT_color_buffer_float");
    if (!ext) {
      console.error("EXT_color_buffer_float not supported");
      return;
    }

    // Immediately clear to transparent so the window doesn't flash white on startup
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    // Initial dimensions
    dpr = window.devicePixelRatio || 1;
    canvasW = window.innerWidth;
    canvasH = window.innerHeight;
    canvas.width = Math.round(canvasW * dpr);
    canvas.height = Math.round(canvasH * dpr);
    canvas.style.width = canvasW + "px";
    canvas.style.height = canvasH + "px";
    gl.viewport(0, 0, canvas.width, canvas.height);

    // Load shaders
    Promise.all([
      fetch("shaders/vertex.glsl").then(function (r) {
        return r.text();
      }),
      fetch("shaders/fragment-bg.glsl").then(function (r) {
        return r.text();
      }),
      fetch("shaders/fragment-vblur.glsl").then(function (r) {
        return r.text();
      }),
      fetch("shaders/fragment-hblur.glsl").then(function (r) {
        return r.text();
      }),
      fetch("shaders/fragment-main.glsl").then(function (r) {
        return r.text();
      }),
    ])
      .then(function (sources) {
        var vsSrc = sources[0];
        var bgSrc = sources[1];
        var vbSrc = sources[2];
        var hbSrc = sources[3];
        var mainSrc = sources[4];

        bgProgram = buildProgram(gl, vsSrc, bgSrc);
        vblurProgram = buildProgram(gl, vsSrc, vbSrc);
        hblurProgram = buildProgram(gl, vsSrc, hbSrc);
        mainProgram = buildProgram(gl, vsSrc, mainSrc);

        if (!bgProgram || !vblurProgram || !hblurProgram || !mainProgram) {
          console.error("Failed to compile/link shader programs");
          return;
        }

        // Build blur weight uniform names
        var blurWeightNames = [];
        for (var i = 0; i <= 200; i++) {
          blurWeightNames.push("u_blurWeights[" + i + "]");
        }

        // Cache uniform locations
        bgU = cacheUniforms(
          gl,
          bgProgram,
          [
            "u_resolution",
            "u_dpr",
            "u_time",
            "u_mouse",
            "u_mouseSpring",
            "u_mergeRate",
            "u_shapeWidth",
            "u_shapeHeight",
            "u_shapeRadius",
            "u_shapeRoundness",
            "u_shape1Width",
            "u_shape1Height",
            "u_shape1Radius",
            "u_shape1Center",
            "u_shadowExpand",
            "u_shadowFactor",
            "u_shadowPosition",
            "u_bgType",
            "u_bgTexture",
            "u_bgTextureRatio",
            "u_bgTextureReady",
            "u_showShape1",
            "u_blurRadius",
            "u_tauriMode",
          ].concat(blurWeightNames),
        );

        vblurU = cacheUniforms(
          gl,
          vblurProgram,
          ["u_prevPassTexture", "u_resolution", "u_blurRadius"].concat(
            blurWeightNames,
          ),
        );

        hblurU = cacheUniforms(
          gl,
          hblurProgram,
          ["u_prevPassTexture", "u_resolution", "u_blurRadius"].concat(
            blurWeightNames,
          ),
        );

        mainU = cacheUniforms(gl, mainProgram, [
          "u_blurredBg",
          "u_bg",
          "u_resolution",
          "u_dpr",
          "u_mouse",
          "u_mouseSpring",
          "u_mergeRate",
          "u_shapeWidth",
          "u_shapeHeight",
          "u_shapeRadius",
          "u_shapeRoundness",
          "u_shape1Width",
          "u_shape1Height",
          "u_shape1Radius",
          "u_shape1Center",
          "u_tint",
          "u_refThickness",
          "u_refFactor",
          "u_refDispersion",
          "u_refFresnelRange",
          "u_refFresnelHardness",
          "u_refFresnelFactor",
          "u_glareRange",
          "u_glareHardness",
          "u_glareConvergence",
          "u_glareOppositeFactor",
          "u_glareFactor",
          "u_glareAngle",
          "u_blurEdge",
          "u_showShape1",
          "STEP",
          "u_tauriMode",
        ]);

        // Create quad VAO (use bgProgram to find a_position location)
        quadVAO = createQuadVAO(gl, bgProgram);

        // Create FBOs
        bgFBO = createFBO(gl, canvas.width, canvas.height);
        vblurFBO = createFBO(gl, canvas.width, canvas.height);
        hblurFBO = createFBO(gl, canvas.width, canvas.height);

        // Precompute blur kernel
        blurWeights = computeGaussianKernel(C.blurRadius);

        // Set up event listeners
        setupEvents();

        // Start render loop
        requestAnimationFrame(render);
      })
      .catch(function (err) {
        console.error("Failed to load shaders:", err);
      });
  }

  // ---------------------------------------------------------------------------
  // Events
  // ---------------------------------------------------------------------------
  function setupEvents() {
    // Hover detection: check if mouse is inside either shape
    function isInsideIsland(mx, my) {
      // mx, my in CSS pixel coords (origin top-left)
      // Convert shape centers from GL to CSS coords
      var s2cx = mainIslandCenterX / dpr;
      var s2cy = canvasH - mainIslandCenterY / dpr;
      var s1cx = shape1CenterX / dpr;
      var s1cy = canvasH - shape1CenterY / dpr;
      // Check main island
      if (
        mx >= s2cx - animWidth / 2 &&
        mx <= s2cx + animWidth / 2 &&
        my >= s2cy - animHeight / 2 &&
        my <= s2cy + animHeight / 2
      )
        return true;
      // Check sub island
      if (
        mx >= s1cx - anim1Width / 2 &&
        mx <= s1cx + anim1Width / 2 &&
        my >= s1cy - anim1Height / 2 &&
        my <= s1cy + anim1Height / 2
      )
        return true;
      // Check gap area between shapes
      var gapLeft = Math.max(s2cx + animWidth / 2, s1cx - anim1Width / 2);
      var gapRight = Math.min(s1cx + anim1Width / 2, s2cx + animWidth / 2);
      // Actually just check if within the bounding box of both shapes combined
      var allLeft = Math.min(s2cx - animWidth / 2, s1cx - anim1Width / 2);
      var allRight = Math.max(s2cx + animWidth / 2, s1cx + anim1Width / 2);
      var allTop = Math.min(s2cy - animHeight / 2, s1cy - anim1Height / 2);
      var allBot = Math.max(s2cy + animHeight / 2, s1cy + anim1Height / 2);
      // Generous hit area: use expanded bounding box
      if (
        mx >= allLeft - 5 &&
        mx <= allRight + 5 &&
        my >= allTop - 10 &&
        my <= allBot + 10
      )
        return true;
      return false;
    }

    canvas.addEventListener("pointermove", function (e) {
      var mx = e.clientX;
      var my = e.clientY;
      // In Tauri mode, expand is driven by Rust zone detection (set-expand event)
      if (!isTauriMode) {
        isHovering = isInsideIsland(mx, my);
      }
    });

    canvas.addEventListener("pointerleave", function () {
      // In Tauri mode, expand is driven by Rust zone detection
      if (!isTauriMode) {
        isHovering = false;
      }
    });

    // Double-click on right island to toggle compact mode (standalone mode only)
    if (!isTauriMode) {
      canvas.addEventListener("dblclick", function (e) {
        var mx = e.clientX;
        var my = e.clientY;
        var s1cx = shape1CenterX / dpr;
        var s1cy = canvasH - shape1CenterY / dpr;
        if (
          mx >= s1cx - anim1Width / 2 - 10 &&
          mx <= s1cx + anim1Width / 2 + 10 &&
          my >= s1cy - anim1Height / 2 - 10 &&
          my <= s1cy + anim1Height / 2 + 10
        ) {
          isCompactMode = !isCompactMode;
        }
      });
    }

    // Resize
    window.addEventListener("resize", handleResize);

    // Image upload
    var fileInput = document.getElementById("file-input");
    var uploadBtn = document.getElementById("upload-btn");
    uploadBtn.addEventListener("click", function () {
      fileInput.click();
    });
    fileInput.addEventListener("change", function (e) {
      var file = e.target.files[0];
      if (!file) return;

      var img = new Image();
      img.onload = function () {
        if (bgTexture) gl.deleteTexture(bgTexture);

        bgTexture = gl.createTexture();
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, bgTexture);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
        gl.texImage2D(
          gl.TEXTURE_2D,
          0,
          gl.RGBA,
          gl.RGBA,
          gl.UNSIGNED_BYTE,
          img,
        );
        gl.generateMipmap(gl.TEXTURE_2D);
        gl.texParameteri(
          gl.TEXTURE_2D,
          gl.TEXTURE_MIN_FILTER,
          gl.LINEAR_MIPMAP_LINEAR,
        );
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

        bgTextureRatio = img.naturalWidth / img.naturalHeight;
        bgTextureReady = true;
        C.bgType = 11;

        URL.revokeObjectURL(img.src);
      };
      img.src = URL.createObjectURL(file);
    });
  }

  // Restore current state from localStorage (persisted by controls.js)
  try {
    var saved = localStorage.getItem("liquid-glass-current-state");
    if (saved) {
      var parsed = JSON.parse(saved);
      var keys = Object.keys(parsed);
      for (var i = 0; i < keys.length; i++) {
        var k = keys[i];
        if (
          typeof parsed[k] === "object" &&
          parsed[k] !== null &&
          !Array.isArray(parsed[k]) &&
          typeof C[k] === "object"
        ) {
          var subKeys = Object.keys(parsed[k]);
          for (var j = 0; j < subKeys.length; j++) {
            C[k][subKeys[j]] = parsed[k][subKeys[j]];
          }
        } else if (k in C) {
          C[k] = parsed[k];
        }
      }
    }
  } catch (e) {
    /* ignore */
  }

  // Write merged config back to main window's localStorage
  // (settings window may have separate localStorage partition in Tauri v2)
  try {
    localStorage.setItem("liquid-glass-current-state", JSON.stringify(C));
  } catch (e) { /* ignore */ }

  // Expose config for controls panel
  window.__liquidGlassConfig = C;
  window.__liquidGlassState = {
    isHovering: function () {
      return isHovering;
    },
    setHover: function (v) {
      isHovering = v;
    },
    setScreenTexture: function (tex, ratio) {
      screenCapTexture = tex;
      screenCapRatio = ratio;
      screenCapReady = true;
    },
    isCompactMode: function () {
      return isCompactMode;
    },
    setCompactMode: function (v) {
      isCompactMode = v;
    },
    animWidth: function () {
      return animWidth;
    },
    animHeight: function () {
      return animHeight;
    },
    anim1Width: function () {
      return anim1Width;
    },
    anim1Height: function () {
      return anim1Height;
    },
  };

  // ---------------------------------------------------------------------------
  // Boot — deferred to ensure window dimensions are available
  // ---------------------------------------------------------------------------
  window.addEventListener("load", function () {
    requestAnimationFrame(function () {
      init();
    });
  });
})();
