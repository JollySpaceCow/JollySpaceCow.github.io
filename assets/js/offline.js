/* ── OFFLINE GAME ENGINE ── */

(function() {
  const canvas = document.getElementById('game-canvas');
  if (!canvas) return;
  const c = canvas.getContext('2d');
  const scoreEl = document.getElementById('score');
  const hiScoreEl = document.getElementById('hi-score');
  const hintEl = document.getElementById('game-hint');

  function resizeCanvas() {
    const maxW = Math.min(window.innerWidth - 40, 600);
    canvas.style.width = maxW + 'px';
    canvas.style.height = (maxW * 200 / 600) + 'px';
  }
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);

  const GRAVITY = 0.6;
  const JUMP_FORCE = -10.5;
  const GROUND_Y = 165;
  let hiScore = parseInt(localStorage.getItem('jsc_offline_hiscore') || '0');
  if (hiScoreEl) hiScoreEl.textContent = hiScore;

  let cow, obstacles, particles, stars, score, speed, gameOver, started, frameCount;

  function init() {
    cow = { x: 70, y: GROUND_Y, vy: 0, jumping: false, rotation: 0 };
    obstacles = [];
    particles = [];
    stars = Array.from({ length: 40 }, () => ({
      x: Math.random() * 600,
      y: Math.random() * 140,
      r: Math.random() * 1.5 + 0.3,
      speed: Math.random() * 0.3 + 0.1,
      twinkle: Math.random() * Math.PI * 2,
    }));
    score = 0;
    speed = 3.5;
    gameOver = false;
    started = false;
    frameCount = 0;
    if (scoreEl) scoreEl.textContent = '0';
  }
  init();

  function jump() {
    if (gameOver) {
      init();
      started = true;
      if (hintEl) hintEl.textContent = 'Press SPACE or tap to jump';
      return;
    }
    if (!started) {
      started = true;
      if (hintEl) {
        hintEl.style.animation = 'none';
        hintEl.style.opacity = '0';
      }
    }
    if (!cow.jumping) {
      cow.vy = JUMP_FORCE;
      cow.jumping = true;
    }
  }

  document.addEventListener('keydown', e => {
    if (e.code === 'Space' || e.code === 'ArrowUp') { e.preventDefault(); jump(); }
  });
  canvas.addEventListener('click', jump);
  canvas.addEventListener('touchstart', e => { e.preventDefault(); jump(); }, { passive: false });

  function drawCow(x, y, rot) {
    c.save();
    c.translate(x, y);
    c.rotate(rot);
    c.fillStyle = '#f0f0f0';
    c.fillRect(-14, -10, 28, 16);
    c.fillStyle = '#333';
    c.fillRect(-8, -8, 7, 6);
    c.fillRect(4, -4, 6, 5);
    c.fillRect(-3, 2, 5, 4);
    c.fillStyle = '#f0f0f0';
    c.fillRect(14, -12, 12, 12);
    c.fillStyle = '#111';
    c.fillRect(21, -10, 3, 3);
    c.fillStyle = '#ffb6c1';
    c.fillRect(16, -4, 8, 5);
    c.fillStyle = '#c8a96e';
    c.fillRect(18, -16, 3, 5);
    c.fillRect(23, -16, 3, 5);
    c.fillStyle = '#ddd';
    c.fillRect(-10, 6, 4, 8); c.fillRect(-2, 6, 4, 8); c.fillRect(6, 6, 4, 8); c.fillRect(14, 6, 4, 8);
    c.fillStyle = '#555';
    c.fillRect(-10, 12, 4, 3); c.fillRect(-2, 12, 4, 3); c.fillRect(6, 12, 4, 3); c.fillRect(14, 12, 4, 3);
    c.fillStyle = '#ddd'; c.fillRect(-18, -8, 5, 3);
    c.fillStyle = '#c8a96e'; c.fillRect(-20, -10, 4, 4);
    c.strokeStyle = 'rgba(91, 163, 245, 0.5)';
    c.lineWidth = 1.5;
    c.beginPath(); c.arc(20, -6, 14, 0, Math.PI * 2); c.stroke();
    c.restore();
  }

  function drawAsteroid(x, y, size) {
    c.fillStyle = '#6b6b7b';
    c.beginPath();
    const points = 8;
    for (let i = 0; i < points; i++) {
      const angle = (i / points) * Math.PI * 2;
      const jitter = size * (0.7 + Math.sin(i * 2.7) * 0.3);
      const px = x + Math.cos(angle) * jitter;
      const py = y + Math.sin(angle) * jitter;
      i === 0 ? c.moveTo(px, py) : c.lineTo(px, py);
    }
    c.closePath(); c.fill();
  }

  function update() {
    if (!started || gameOver) return;
    frameCount++;
    speed = 3.5 + score * 0.003;
    cow.vy += GRAVITY;
    cow.y += cow.vy;
    if (cow.y >= GROUND_Y) { cow.y = GROUND_Y; cow.vy = 0; cow.jumping = false; }
    cow.rotation = cow.jumping ? Math.min(cow.vy * 0.03, 0.3) : 0;

    if (frameCount % Math.max(40, Math.floor(90 - score * 0.1)) === 0) {
      const size = Math.random() * 10 + 14;
      obstacles.push({ x: 620, y: GROUND_Y + 6 - size, size, passed: false });
    }

    for (let i = obstacles.length - 1; i >= 0; i--) {
      const o = obstacles[i];
      o.x -= speed;
      if (!o.passed && o.x + o.size < cow.x) {
        o.passed = true;
        score++;
        if (scoreEl) scoreEl.textContent = score;
      }
      if (Math.abs(cow.x - o.x) < o.size + 10 && Math.abs(cow.y - o.y) < o.size + 8) {
        gameOver = true;
        if (score > hiScore) {
          hiScore = score;
          localStorage.setItem('jsc_offline_hiscore', hiScore);
          if (hiScoreEl) hiScoreEl.textContent = hiScore;
        }
        if (hintEl) {
          hintEl.textContent = 'Press SPACE to retry';
          hintEl.style.animation = 'pulse 2s infinite';
          hintEl.style.opacity = '1';
        }
      }
      if (o.x < -30) obstacles.splice(i, 1);
    }

    stars.forEach(s => {
      s.x -= s.speed * speed * 0.3;
      s.twinkle += 0.03;
      if (s.x < -5) { s.x = 610; s.y = Math.random() * 140; }
    });
  }

  function draw() {
    c.fillStyle = '#0a0a18'; c.fillRect(0, 0, 600, 200);
    stars.forEach(s => {
      const op = 0.3 + 0.3 * Math.sin(s.twinkle);
      c.fillStyle = `rgba(200, 210, 255, ${op})`;
      c.beginPath(); c.arc(s.x, s.y, s.r, 0, Math.PI * 2); c.fill();
    });
    c.strokeStyle = 'rgba(255,255,255,0.06)';
    c.beginPath(); c.moveTo(0, GROUND_Y + 16); c.lineTo(600, GROUND_Y + 16); c.stroke();
    obstacles.forEach(o => drawAsteroid(o.x, o.y, o.size));
    drawCow(cow.x, cow.y, cow.rotation);
    if (gameOver) {
      c.fillStyle = 'rgba(7, 7, 15, 0.7)'; c.fillRect(0, 0, 600, 200);
      c.fillStyle = '#fff'; c.font = '900 24px Outfit, sans-serif'; c.textAlign = 'center';
      c.fillText('GAME OVER', 300, 85);
      c.font = '14px Outfit, sans-serif'; c.fillStyle = 'rgba(255,255,255,0.5)';
      c.fillText(`Score: ${score}`, 300, 115);
    }
  }

  function loop() { update(); draw(); requestAnimationFrame(loop); }
  loop();
})();
