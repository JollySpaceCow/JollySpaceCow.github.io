/* ── SPACE BACKGROUND ENGINE ── */

(function() {
  const cv = document.getElementById('space-canvas');
  if (!cv) return;
  const cx = cv.getContext('2d', { alpha: false }); // Optimization
  let W, H, stars = [], mouse = { x: 0.5, y: 0.5 }, smoothMouse = { x: 0.5, y: 0.5 };

  function resize() {
    W = cv.width = window.innerWidth;
    H = cv.height = window.innerHeight;
    initStars(300); // Reduced star count slightly for better perf
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

  function drawMilkyWay() {
    const cy2 = H * 0.48;
    const gr = cx.createLinearGradient(0, cy2 - H * 0.15, 0, cy2 + H * 0.15);
    gr.addColorStop(0, 'transparent');
    gr.addColorStop(0.5, 'rgba(160,180,255,0.015)'); // Subtle
    gr.addColorStop(1, 'transparent');
    cx.save();
    cx.translate(W * 0.5, cy2);
    cx.rotate(-0.18);
    cx.fillStyle = gr;
    cx.fillRect(-W * 0.8, -H * 0.15, W * 1.6, H * 0.3);
    cx.restore();
  }

  const nebulae = [
    { x: 0.15, y: 0.25, r: 0.22, h: 220, o: 0.03 },
    { x: 0.82, y: 0.55, r: 0.2, h: 260, o: 0.025 },
    { x: 0.48, y: 0.78, r: 0.18, h: 195, o: 0.02 },
    { x: 0.68, y: 0.18, r: 0.15, h: 30, o: 0.02 },
  ];

  function drawNebulae(t) {
    const maxDim = Math.max(W, H);
    for (let i = 0; i < nebulae.length; i++) {
      const b = nebulae[i];
      const px = (b.x + Math.sin(t * 0.0002 + b.h) * 0.01) * W;
      const py = (b.y + Math.cos(t * 0.00025 + b.h) * 0.01) * H;
      const radius = b.r * maxDim;
      
      const gr = cx.createRadialGradient(px, py, 0, px, py, radius);
      gr.addColorStop(0, `hsla(${b.h},60%,60%,${b.o})`);
      gr.addColorStop(1, 'transparent');
      cx.fillStyle = gr;
      cx.fillRect(px - radius, py - radius, radius * 2, radius * 2);
    }
  }

  function drawMouseGlow() {
    const px = smoothMouse.x * W, py = smoothMouse.y * H;
    const gr = cx.createRadialGradient(px, py, 0, px, py, 250);
    gr.addColorStop(0, 'rgba(200,169,110,0.03)');
    gr.addColorStop(1, 'transparent');
    cx.fillStyle = gr; cx.fillRect(px - 250, py - 250, 500, 500);
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

  function draw(t) {
    cx.fillStyle = 'rgb(4,4,12)'; 
    cx.fillRect(0, 0, W, H);
    cx.fillStyle = 'rgba(10,10,25,0.15)'; 
    cx.fillRect(0, 0, W, H);

    smoothMouse.x += (mouse.x - smoothMouse.x) * 0.05;
    smoothMouse.y += (mouse.y - smoothMouse.y) * 0.05;

    drawMilkyWay();
    drawNebulae(t);
    drawMouseGlow();

    const isWarp = window.warpMode;
    const centerX = W / 2, centerY = H / 2;

    for (let i = 0; i < stars.length; i++) {
      const s = stars[i];
      s.twinkle += s.ts;
      const op = s.opacity * (0.7 + 0.3 * Math.sin(s.twinkle));
      const px = s.x + (smoothMouse.x - 0.5) * s.r * 12;
      const py = s.y + (smoothMouse.y - 0.5) * s.r * 12;

      const col = s.sat > 0 ? `hsla(${s.hue},${s.sat}%, 90%, ${op})` : `rgba(240,240,255, ${op})`;

      if (isWarp) {
        let dx = s.x - centerX, dy = s.y - centerY;
        let f = s.r * 0.0005 + 0.0001;
        let vx = dx * f, vy = dy * f;
        s.x += vx; s.y += vy;

        if (s.x < -50 || s.x > W + 50 || s.y < -50 || s.y > H + 50) {
          let angle = Math.random() * Math.PI * 2;
          s.x = centerX + Math.cos(angle) * 20;
          s.y = centerY + Math.sin(angle) * 20;
        }

        cx.strokeStyle = col;
        cx.lineWidth = s.r;
        cx.beginPath(); cx.moveTo(px, py); cx.lineTo(px - vx * 2, py - vy * 2); cx.stroke();
      } else {
        cx.fillStyle = col;
        if (s.r > 1.1) {
          cx.beginPath(); cx.arc(px, py, s.r, 0, Math.PI * 2); cx.fill();
        } else {
          cx.fillRect(px - s.r, py - s.r, s.r * 2, s.r * 2);
        }
        
        s.x -= (s.r * 0.2 + 0.05);
        if (s.x < -20) { s.x = W + 20; s.y = Math.random() * H; }
      }
    }

    maybeShoot(t);
    requestAnimationFrame(draw);
  }

  window.addEventListener('resize', resize);
  document.addEventListener('mousemove', e => { mouse.x = e.clientX / window.innerWidth; mouse.y = e.clientY / window.innerHeight; });
  
  resize(); 
  requestAnimationFrame(draw);

  // Dev Menu
  window.warpMode = false;
  window.addEventListener('keydown', (e) => {
    if (e.key === 'e' || e.key === 'E') {
      const dm = document.getElementById('dev-menu');
      if (dm) dm.style.display = dm.style.display === 'none' ? 'block' : 'none';
    }
  });

  document.addEventListener('DOMContentLoaded', () => {
    const wt = document.getElementById('warp-toggle');
    if (wt) wt.addEventListener('change', e => { window.warpMode = e.target.checked; });
  });
})();
