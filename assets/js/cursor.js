(function() {
  // Inject CSS
  const style = document.createElement('style');
  style.textContent = `
    .cursor-dot {
      position: fixed; pointer-events: none; z-index: 9999;
      width: 6px; height: 6px; border-radius: 50%;
      background: var(--accent, #c8a96e);
      transform: translate(-50%,-50%);
      transition: transform 0.15s ease-out, background-color 0.15s ease-out;
    }
    #cursor-canvas {
      position: fixed; inset: 0; z-index: 9998; pointer-events: none;
    }
  `;
  document.head.appendChild(style);

  // Inject elements
  const dot = document.createElement('div');
  dot.className = 'cursor-dot';
  dot.id = 'cdot';
  document.body.appendChild(dot);

  const cursorCv = document.createElement('canvas');
  cursorCv.id = 'cursor-canvas';
  document.body.appendChild(cursorCv);

  const ccx = cursorCv.getContext('2d');
  let mx = -200, my = -200, rx = -200, ry = -200;
  let cursorHistory = [];
  let starParticles = [];
  let isHovering = false;
  let idleTimer = 0;
  let currentTrailScale = 1.0;

  function resizeCursor() {
    cursorCv.width = innerWidth;
    cursorCv.height = innerHeight;
  }
  window.addEventListener('resize', resizeCursor);
  resizeCursor();

  document.addEventListener('mousemove', e => { mx = e.clientX; my = e.clientY; });

  function tick() {
    dot.style.left = mx+'px'; dot.style.top = my+'px';
    
    let prx = rx, pry = ry;
    rx += (mx-rx)*0.25; ry += (my-ry)*0.25;
    
    // store sparse frame points
    cursorHistory.unshift({x: rx, y: ry, life: 1.0});
    
    // age points
    for (let i = 0; i < cursorHistory.length; i++) {
      cursorHistory[i].life -= 0.04;
    }
    cursorHistory = cursorHistory.filter(p => p.life > 0);
    
    let speed = Math.hypot(mx-prx, my-pry);
    
    if (speed < 0.5) {
      idleTimer++;
    } else {
      idleTimer = 0;
    }
    
    let targetTrailScale = 1.0;
    if (isHovering) {
      targetTrailScale = 0.0;
    } else if (idleTimer > 2) { // disappear almost instantly after stopping
      targetTrailScale = 0.0;
    }
    currentTrailScale += (targetTrailScale - currentTrailScale) * 0.25;
    
    if (speed > 2 && Math.random() < 0.8 && !isHovering) {
      // spawn sparks smoothly along the path to avoid clumps
      let t = Math.random();
      let sx = prx + (rx - prx) * t;
      let sy = pry + (ry - pry) * t;
      starParticles.push({
        x: sx + (Math.random()-0.5)*8,
        y: sy + (Math.random()-0.5)*8,
        vx: (Math.random()-0.5)*1.5 - (mx-prx)*0.04,
        vy: (Math.random()-0.5)*1.5 - (my-pry)*0.04,
        life: 1.0,
        size: Math.random()*2 + 0.5
      });
    }
    
    ccx.clearRect(0, 0, cursorCv.width, cursorCv.height);
    
    // Generate perfectly smooth curved spline from sparse frame points
    let smoothPoints = [];
    if (cursorHistory.length > 2) {
      for (let i = 0; i < cursorHistory.length - 1; i++) {
        let p0 = i === 0 ? cursorHistory[i] : {
          x: (cursorHistory[i-1].x + cursorHistory[i].x) / 2,
          y: (cursorHistory[i-1].y + cursorHistory[i].y) / 2,
          life: (cursorHistory[i-1].life + cursorHistory[i].life) / 2
        };
        let p1 = cursorHistory[i];
        let p2 = i === cursorHistory.length - 2 ? cursorHistory[i+1] : {
          x: (cursorHistory[i].x + cursorHistory[i+1].x) / 2,
          y: (cursorHistory[i].y + cursorHistory[i+1].y) / 2,
          life: (cursorHistory[i].life + cursorHistory[i+1].life) / 2
        };
        
        let curveDist = Math.hypot(p1.x - p0.x, p1.y - p0.y) + Math.hypot(p2.x - p1.x, p2.y - p1.y);
        let steps = Math.max(1, Math.ceil(curveDist / 2)); // 1 point per 2 pixels
        
        for (let s = 0; s < steps; s++) {
          let t = s / steps;
          let mt = 1 - t;
          smoothPoints.push({
            x: mt*mt*p0.x + 2*mt*t*p1.x + t*t*p2.x,
            y: mt*mt*p0.y + 2*mt*t*p1.y + t*t*p2.y,
            life: mt*mt*p0.life + 2*mt*t*p1.life + t*t*p2.life
          });
        }
      }
    } else if (cursorHistory.length > 0) {
      smoothPoints = [...cursorHistory];
    }
    
    if (smoothPoints.length > 1) {
      ccx.lineCap = 'round';
      ccx.lineJoin = 'round';
      for (let i = 0; i < smoothPoints.length - 1; i++) {
        const p1 = smoothPoints[i];
        const p2 = smoothPoints[i + 1];
        const life = p1.life;
        
        ccx.beginPath();
        ccx.moveTo(p1.x, p1.y);
        ccx.lineTo(p2.x, p2.y);
        ccx.strokeStyle = `rgba(255, 240, 200, ${life * 0.8})`;
        ccx.lineWidth = life * 4 * currentTrailScale;
        ccx.stroke();
        
        ccx.beginPath();
        ccx.moveTo(p1.x, p1.y);
        ccx.lineTo(p2.x, p2.y);
        ccx.strokeStyle = `rgba(200, 169, 110, ${life * 0.4})`;
        ccx.lineWidth = life * 12 * currentTrailScale;
        ccx.stroke();
      }
    }
    
    ccx.globalCompositeOperation = 'screen';
    for(let i=0; i<starParticles.length; i++) {
      let p = starParticles[i];
      p.x += p.vx; p.y += p.vy;
      p.life -= 0.03;
      if (p.life > 0) {
        let pSpeed = Math.hypot(p.vx, p.vy);
        ccx.beginPath();
        if (pSpeed > 1) { // stretch into lines when fast
          ccx.lineCap = 'round';
          ccx.moveTo(p.x, p.y);
          ccx.lineTo(p.x - p.vx*2, p.y - p.vy*2);
          ccx.lineWidth = p.size * p.life * currentTrailScale;
          ccx.strokeStyle = `rgba(255, 230, 150, ${p.life})`;
          ccx.stroke();
        } else {
          ccx.arc(p.x, p.y, p.size * p.life * currentTrailScale, 0, Math.PI * 2);
          ccx.fillStyle = `rgba(255, 230, 150, ${p.life})`;
          ccx.fill();
        }
      }
    }
    ccx.globalCompositeOperation = 'source-over';
    starParticles = starParticles.filter(p => p.life > 0);
    
    requestAnimationFrame(tick);
  }
  tick();

  const initHover = () => {
    document.querySelectorAll('a, button, .pill, .wide-cat-wrap, .cat-container, [onclick]').forEach(el => {
      if(el.dataset.cursorBound) return;
      el.dataset.cursorBound = "true";
      el.addEventListener('mouseenter', () => { isHovering = true; dot.style.transform='translate(-50%,-50%) scale(0.5)'; dot.style.backgroundColor='rgba(255,230,150,0.5)'; });
      el.addEventListener('mouseleave', () => { isHovering = false; dot.style.transform='translate(-50%,-50%) scale(1)'; dot.style.backgroundColor='var(--accent, #c8a96e)'; });
    });
  };
  initHover();
  const observer = new MutationObserver(initHover);
  observer.observe(document.body, { childList: true, subtree: true });
})();
