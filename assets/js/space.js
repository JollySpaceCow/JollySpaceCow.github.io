/* ── SPACE BACKGROUND ENGINE ── */

(function() {
  const cv = document.getElementById('space-canvas');
  if (!cv) return;
  const cx = cv.getContext('2d');
  let W, H, stars = [], mouse = { x: 0.5, y: 0.5 }, smoothMouse = { x: 0.5, y: 0.5 };

  function resize() {
    W = cv.width = window.innerWidth;
    H = cv.height = window.innerHeight;
  }

  function mkStar(forcePos) {
    return {
      x: forcePos ? Math.random() * W : Math.random() * W,
      y: Math.random() * H,
      r: Math.random() * 1.6 + 0.15,
      speed: Math.random() * 0.018 + 0.003,
      opacity: Math.random() * 0.75 + 0.1,
      twinkle: Math.random() * Math.PI * 2,
      ts: Math.random() * 0.025 + 0.005,
      drift: (Math.random() - 0.5) * 0.025,
      hue: Math.random() < 0.08 ? (Math.random() < 0.5 ? 210 : 45) : 0,
      sat: Math.random() < 0.08 ? 80 : 0,
    };
  }

  function initStars(n = 380) {
    stars = Array.from({ length: n }, () => mkStar(true));
  }

  function drawMilkyWay() {
    const cx2 = W * 0.5, cy2 = H * 0.48;
    const gr = cx.createLinearGradient(0, cy2 - H * 0.18, 0, cy2 + H * 0.18);
    gr.addColorStop(0, 'transparent');
    gr.addColorStop(0.5, 'rgba(160,180,255,0.028)');
    gr.addColorStop(1, 'transparent');
    cx.save();
    cx.translate(cx2, cy2);
    cx.rotate(-0.18);
    cx.fillStyle = gr;
    cx.fillRect(-W * 0.8, -H * 0.18, W * 1.6, H * 0.36);
    cx.restore();
  }

  const nebulae = [
    { x: 0.15, y: 0.25, r: 0.22, h: 220, o: 0.04 },
    { x: 0.82, y: 0.55, r: 0.2, h: 260, o: 0.032 },
    { x: 0.48, y: 0.78, r: 0.18, h: 195, o: 0.03 },
    { x: 0.68, y: 0.18, r: 0.15, h: 30, o: 0.025 },
  ];

  function drawNebulae(t) {
    nebulae.forEach(b => {
      const px = (b.x + Math.sin(t * 0.00025 + b.h) * 0.015) * W;
      const py = (b.y + Math.cos(t * 0.0003 + b.h) * 0.015) * H;
      const gr = cx.createRadialGradient(px, py, 0, px, py, b.r * Math.max(W, H));
      gr.addColorStop(0, `hsla(${b.h},65%,62%,${b.o})`);
      gr.addColorStop(0.5, `hsla(${b.h},55%,50%,${b.o * 0.3})`);
      gr.addColorStop(1, 'transparent');
      cx.fillStyle = gr;
      cx.beginPath(); cx.arc(px, py, b.r * Math.max(W, H), 0, Math.PI * 2); cx.fill();
    });
  }

  function drawMouseGlow() {
    const px = smoothMouse.x * W, py = smoothMouse.y * H;
    const gr = cx.createRadialGradient(px, py, 0, px, py, 280);
    gr.addColorStop(0, 'rgba(200,169,110,0.045)');
    gr.addColorStop(1, 'transparent');
    cx.fillStyle = gr; cx.fillRect(0, 0, W, H);
  }

  let shoot = null, shootStart = 0;
  function maybeShoot(t) {
    if (!shoot && Math.random() < 0.0008) {
      shoot = {
        x: Math.random() * W * 0.75,
        y: Math.random() * H * 0.45,
        len: Math.random() * 140 + 70,
        angle: Math.PI / 5 + (Math.random() - 0.5) * 0.25,
      };
      shootStart = t;
    }
    if (shoot) {
      const p = (t - shootStart) / 900;
      if (p > 1) { shoot = null; return; }
      const tail = Math.min(p * 2, 1);
      const fade = p > 0.55 ? 1 - (p - 0.55) / 0.45 : 1;
      const ex = shoot.x + Math.cos(shoot.angle) * shoot.len * tail;
      const ey = shoot.y + Math.sin(shoot.angle) * shoot.len * tail;
      const sx = ex - Math.cos(shoot.angle) * shoot.len * Math.min(tail, 0.38);
      const sy = ey - Math.sin(shoot.angle) * shoot.len * Math.min(tail, 0.38);
      const gr = cx.createLinearGradient(sx, sy, ex, ey);
      gr.addColorStop(0, 'transparent');
      gr.addColorStop(1, `rgba(255,255,248,${0.95 * fade})`);
      cx.strokeStyle = gr; cx.lineWidth = 1.4;
      cx.beginPath(); cx.moveTo(sx, sy); cx.lineTo(ex, ey); cx.stroke();
    }
  }

  function draw(t) {
    cx.clearRect(0, 0, W, H);
    cx.fillStyle = 'rgba(4,4,14,0.18)';
    cx.fillRect(0, 0, W, H);

    smoothMouse.x += (mouse.x - smoothMouse.x) * 0.04;
    smoothMouse.y += (mouse.y - smoothMouse.y) * 0.04;

    drawMilkyWay();
    drawNebulae(t);
    drawMouseGlow();

    stars.forEach(s => {
      s.twinkle += s.ts;
      const op = s.opacity * (0.65 + 0.35 * Math.sin(s.twinkle));
      const px = s.x + (smoothMouse.x - 0.5) * s.r * 15;
      const py = s.y + (smoothMouse.y - 0.5) * s.r * 15;

      if (s.r > 1.2 && op > 0.5) {
        const gr = cx.createRadialGradient(px, py, 0, px, py, s.r * 5);
        const col = s.sat > 0 ? `hsla(${s.hue},${s.sat}%, 85%, ` : 'rgba(255,255,248, ';
        gr.addColorStop(0, col + (op * 0.4) + ')');
        gr.addColorStop(1, 'transparent');
        cx.fillStyle = gr;
        cx.beginPath(); cx.arc(px, py, s.r * 5, 0, Math.PI * 2); cx.fill();
      }

      const col = s.sat > 0 ? `hsla(${s.hue},${s.sat}%, 90%, ${op})` : `rgba(245,245,255, ${op})`;

      if (window.warpMode) {
        let dx = s.x - W / 2;
        let dy = s.y - H / 2;
        let f = s.r * 0.0004 + 0.0001;
        let vx = dx * f;
        let vy = dy * f;
        s.x += vx;
        s.y += vy;

        let distFromCenter = Math.hypot(dx, dy);
        let warpOp = op * Math.min(1, Math.max(0, (distFromCenter - 15) / 60));
        const warpCol = s.sat > 0 ? `hsla(${s.hue},${s.sat}%, 90%, ${warpOp})` : `rgba(245,245,255, ${warpOp})`;

        if (s.x < -50 || s.x > W + 50 || s.y < -50 || s.y > H + 50) {
          let angle = Math.random() * Math.PI * 2;
          let dist = Math.random() * Math.min(W, H) * 0.05 + 1;
          s.x = W / 2 + Math.cos(angle) * dist;
          s.y = H / 2 + Math.sin(angle) * dist;
        }

        if (Math.abs(vx) > 0.5 || Math.abs(vy) > 0.5) {
          cx.strokeStyle = warpCol;
          cx.lineWidth = Math.max(0.5, s.r * 0.8);
          cx.beginPath();
          cx.moveTo(px, py);
          cx.lineTo(px - vx * 1.5, py - vy * 1.5);
          cx.stroke();
        } else {
          cx.fillStyle = warpCol;
          cx.beginPath(); cx.arc(px, py, s.r, 0, Math.PI * 2); cx.fill();
        }
      } else {
        cx.fillStyle = col;
        cx.beginPath(); cx.arc(px, py, s.r, 0, Math.PI * 2); cx.fill();
        s.x -= (Math.pow(s.r, 1.5) * 0.3 + 0.05);
        if (s.x < -20) {
          s.x = W + 20;
          s.y = Math.random() * H;
        }
      }
    });

    maybeShoot(t);
    requestAnimationFrame(draw);
  }

  window.addEventListener('resize', () => { resize(); initStars(); });
  document.addEventListener('mousemove', e => { mouse.x = e.clientX / W; mouse.y = e.clientY / H; });
  
  resize(); 
  initStars(); 
  requestAnimationFrame(draw);

  // Dev Menu Logic
  window.warpMode = false;
  let devKeys = '';
  window.addEventListener('keydown', (e) => {
    devKeys += e.key;
    if (devKeys.length > 2) devKeys = devKeys.slice(-2);
    if (devKeys === '69') {
      const dm = document.getElementById('dev-menu');
      if (dm) dm.style.display = dm.style.display === 'none' ? 'block' : 'none';
    }
  });

  document.addEventListener('DOMContentLoaded', () => {
    const wt = document.getElementById('warp-toggle');
    if (wt) wt.addEventListener('change', e => { window.warpMode = e.target.checked; });
  });
})();
