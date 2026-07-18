/* ── SPACE BACKGROUND ENGINE ── */

(function() {
  const cv = document.getElementById('space-canvas');
  if (!cv) return;
  const cx = cv.getContext('2d', { alpha: false }); // Optimisation: no alpha compositing
  let W, H, stars = [], mouse = { x: 0.5, y: 0.5 }, smoothMouse = { x: 0.5, y: 0.5 };

  // --- Offscreen caches for nebulae and mouse glow ---
  // Nebulae are slow to redraw (radial gradients); render at low-res and stretch to fill.
  const nebOffscreen = document.createElement('canvas');
  const nebCtx = nebOffscreen.getContext('2d');
  const NEBULA_SCALE = 0.15; // 15% of screen resolution — smooth blobs need no detail

  // Mouse glow is a fixed radial gradient; bake it once into a tiny canvas.
  const glowOffscreen = document.createElement('canvas');
  glowOffscreen.width = 64; glowOffscreen.height = 64;
  const glowCtx = glowOffscreen.getContext('2d');
  const glowGr = glowCtx.createRadialGradient(32, 32, 0, 32, 32, 32);
  glowGr.addColorStop(0, 'rgba(200,169,110,0.03)');
  glowGr.addColorStop(1, 'transparent');
  glowCtx.fillStyle = glowGr;
  glowCtx.fillRect(0, 0, 64, 64);

  function resize() {
    W = cv.width = window.innerWidth;
    H = cv.height = window.innerHeight;
    initStars(300); // Reduced star count for better perf
    buildNebulaCache(); // Bake static nebulae and Milky Way onto offscreen canvas
  }

  function mkStar() {
    return {
      x: Math.random() * W,
      y: Math.random() * H,
      r: Math.random() * 1.5 + 0.1,
      speed: Math.random() * 0.018 + 0.003,
      opacity: Math.random() * 0.75 + 0.1,
      twinkle: Math.random() * Math.PI * 2,
      ts: Math.random() * 0.02 + 0.005,
      hue: Math.random() < 0.08 ? (Math.random() < 0.5 ? 210 : 45) : 0,
      sat: Math.random() < 0.08 ? 80 : 0,
    };
  }

  function initStars(n) {
    stars = Array.from({ length: n }, () => mkStar());
  }

  const nebulae = [
    { x: 0.15, y: 0.25, r: 0.22, h: 220, o: 0.03 },
    { x: 0.82, y: 0.55, r: 0.2,  h: 260, o: 0.025 },
    { x: 0.48, y: 0.78, r: 0.18, h: 195, o: 0.02 },
    { x: 0.68, y: 0.18, r: 0.15, h: 30,  o: 0.02 },
  ];

  /**
   * Bakes the Milky Way band and all four nebulae onto a small offscreen canvas
   * once per resize. In the render loop we just drawImage() this cache.
   * This eliminates four radial gradient + one linear gradient construction per frame.
   */
  function buildNebulaCache() {
    const nW = Math.ceil(W * NEBULA_SCALE);
    const nH = Math.ceil(H * NEBULA_SCALE);
    nebOffscreen.width = nW;
    nebOffscreen.height = nH;
    nebCtx.clearRect(0, 0, nW, nH);

    // --- Milky Way band ---
    const cy2 = nH * 0.48;
    const milkyGr = nebCtx.createLinearGradient(0, cy2 - nH * 0.15, 0, cy2 + nH * 0.15);
    milkyGr.addColorStop(0, 'transparent');
    milkyGr.addColorStop(0.5, 'rgba(160,180,255,0.015)');
    milkyGr.addColorStop(1, 'transparent');
    nebCtx.save();
    nebCtx.translate(nW * 0.5, cy2);
    nebCtx.rotate(-0.18);
    nebCtx.fillStyle = milkyGr;
    nebCtx.fillRect(-nW * 0.8, -nH * 0.15, nW * 1.6, nH * 0.3);
    nebCtx.restore();

    // --- Nebulae at their home positions (no time offset — drift is applied on draw) ---
    const maxDim = Math.max(nW, nH);
    for (let i = 0; i < nebulae.length; i++) {
      const b = nebulae[i];
      const px = b.x * nW;
      const py = b.y * nH;
      const radius = b.r * maxDim;
      const gr = nebCtx.createRadialGradient(px, py, 0, px, py, radius);
      gr.addColorStop(0, `hsla(${b.h},60%,60%,${b.o})`);
      gr.addColorStop(1, 'transparent');
      nebCtx.fillStyle = gr;
      nebCtx.fillRect(px - radius, py - radius, radius * 2, radius * 2);
    }
  }

  /**
   * Draws the pre-baked nebula cache with a tiny time-driven positional offset
   * on each nebula, giving the illusion of organic drift without rebuilding gradients.
   * We achieve this by drawing the full offscreen canvas with a very slight translate.
   */
  function drawNebulaCache(t) {
    // Apply a gentle screen-space drift (≤ 1% of screen) via canvas transform
    const driftX = Math.sin(t * 0.0002) * W * 0.005;
    const driftY = Math.cos(t * 0.00025) * H * 0.005;
    cx.save();
    cx.translate(driftX, driftY);
    cx.drawImage(nebOffscreen, 0, 0, W, H);
    cx.restore();
  }

  /** Draws a soft golden radial glow at the current (smoothed) mouse position. */
  function drawMouseGlow() {
    const px = smoothMouse.x * W, py = smoothMouse.y * H;
    const SIZE = 500;
    // Draw the pre-baked 64×64 glow canvas stretched to 500×500 at the mouse position
    cx.drawImage(glowOffscreen, px - SIZE / 2, py - SIZE / 2, SIZE, SIZE);
  }

  let shoot = null, shootStart = 0;
  function maybeShoot(t) {
    if (!shoot && Math.random() < 0.0005) {
      shoot = { x: Math.random() * W * 0.8, y: Math.random() * H * 0.4, len: Math.random() * 120 + 60, angle: Math.PI / 5 + (Math.random() - 0.5) * 0.2 };
      shootStart = t;
    }
    if (shoot) {
      const p = (t - shootStart) / 800;
      if (p > 1) { shoot = null; return; }
      const tail = Math.min(p * 2, 1);
      const ex = shoot.x + Math.cos(shoot.angle) * shoot.len * tail;
      const ey = shoot.y + Math.sin(shoot.angle) * shoot.len * tail;
      const sx = ex - Math.cos(shoot.angle) * shoot.len * Math.min(tail, 0.3);
      const sy = ey - Math.sin(shoot.angle) * shoot.len * Math.min(tail, 0.3);
      cx.strokeStyle = `rgba(255,255,240,${0.8 * (p > 0.5 ? 1 - (p-0.5)/0.5 : 1)})`;
      cx.lineWidth = 1.2;
      cx.beginPath(); cx.moveTo(sx, sy); cx.lineTo(ex, ey); cx.stroke();
    }
  }

  let lastTime = 0, accumulatedTime = 0;
  function draw(t) {
    if (!lastTime) lastTime = t;
    if (window.spacePaused) {
      lastTime = t;
      requestAnimationFrame(draw);
      return;
    }
    accumulatedTime += (t - lastTime);
    lastTime = t;

    cx.fillStyle = 'rgb(4,4,12)'; 
    cx.fillRect(0, 0, W, H);
    cx.fillStyle = 'rgba(10,10,25,0.15)'; 
    cx.fillRect(0, 0, W, H);

    smoothMouse.x += (mouse.x - smoothMouse.x) * 0.05;
    smoothMouse.y += (mouse.y - smoothMouse.y) * 0.05;

    drawNebulaCache(accumulatedTime);
    drawMouseGlow();

    const mode = window.starfieldMode || 0;
    const centerX = W / 2, centerY = H / 2;

    for (let i = 0; i < stars.length; i++) {
      const s = stars[i];
      s.twinkle += s.ts;
      let op = s.opacity * (0.7 + 0.3 * Math.sin(s.twinkle));
      if (mode >= 1) op = Math.min(1.0, op * 1.6); // Boost opacity for warp modes

      const px = s.x + (smoothMouse.x - 0.5) * s.r * 12;
      const py = s.y + (smoothMouse.y - 0.5) * s.r * 12;

      let col = s.sat > 0 ? `hsla(${s.hue},${s.sat}%, 90%, ${op})` : `rgba(240,240,255, ${op})`;
      
      // Mode 3: Hyperspace (Rainbow stars)
      if (mode === 3) {
        col = `hsla(${(accumulatedTime * 0.1 + i * 2) % 360}, 80%, 70%, ${op})`;
      }

      if (mode >= 1) { // Warp, Warpspeed, or Hyperspace
        let dx = s.x - centerX, dy = s.y - centerY;
        
        let f = s.r * 0.0005 + 0.0001;
        if (mode === 1) f *= 1.2; // Slight speed boost for basic warp
        if (mode === 2) f *= 12; // Warpspeed
        if (mode === 3) f *= 35; // Hyperspace
        
        let vx = dx * f, vy = dy * f;
        s.x += vx; s.y += vy;

        if (s.x < -100 || s.x > W + 100 || s.y < -100 || s.y > H + 100) {
          let angle = Math.random() * Math.PI * 2;
          let dist = Math.random() * 50;
          s.x = centerX + Math.cos(angle) * dist;
          s.y = centerY + Math.sin(angle) * dist;
        }

        cx.strokeStyle = col;
        cx.lineWidth = Math.max(0.8, s.r * (mode >= 2 ? 2.5 : 1.5)); // Boost thickness
        cx.beginPath(); 
        cx.moveTo(px, py); 
        
        // Longer trails for higher modes
        let trailLength = 5; // Basic warp trails
        if (mode === 2) trailLength = 12;
        if (mode === 3) trailLength = 25;
        
        cx.lineTo(px - vx * trailLength, py - vy * trailLength); 
        cx.stroke();
      } else {
        cx.fillStyle = col;
        // Use fillRect for all stars — avoids expensive path/arc construction per star
        cx.fillRect(px - s.r, py - s.r, s.r * 2, s.r * 2);
        
        s.x -= (s.r * 0.2 + 0.05);
        if (s.x < -20) { s.x = W + 20; s.y = Math.random() * H; }
      }
    }

    maybeShoot(accumulatedTime);
    requestAnimationFrame(draw);
  }

  window.addEventListener('resize', resize);
  document.addEventListener('mousemove', e => { mouse.x = e.clientX / window.innerWidth; mouse.y = e.clientY / window.innerHeight; });
  
  resize(); 
  window.spacePaused = false;
  window.starfieldMode = 0; // 0: Drift, 1: Warp, 2: Warpspeed, 3: Hyperspace
  requestAnimationFrame(draw);

  // Global toggle function for Title Engine to call
  window.toggleStarfieldMode = function() {
    window.starfieldMode = (window.starfieldMode + 1) % 4;
    console.log("🌌 Starfield Mode:", window.starfieldMode);
    return window.starfieldMode;
  };
})();
