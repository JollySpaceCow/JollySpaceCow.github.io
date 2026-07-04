/**
 * Jolly Space Cow - Title Interaction Engine
 * Manages the animated, interactive title with WebGL backgrounds and physics-based hit detection.
 */

const TitleEngine = {
  canvas: null,
  ctx: null,
  webgl: { canvas: null, gl: null, program: null, timeLoc: null, resLoc: null },
  
  metrics: { font: '', spacing: '0px', dpr: 1, totalWidth: 0, y: 0, startX: 0 },
  interactiveLetters: [], // Array of { char, index, relX, width, anim: { mode, start, ... } }
  particles: [], // Array of active smoke particles
  cachedHulls: {}, 
  isSpacePaused: false,
  playTransition: 0, // 0 = playing (ll), 1 = paused (triangle)
  oSwapping: false,
  oSwapState: null,
  colorMode: 0, 
  yClickCount: 0,
  currentHue: 0,

  // --- Jelly Easter Egg ---
  jellyMode: false,       // True once the jelly easter egg is activated
  jellyTint: 0,           // 0→1 blend of jelly green overlay (animates in)

  // --- Configuration ---
  config: {
    physics: {
      gravity: 800,
      bounce: 0.72,
      airFriction: 0.985,
      floorFriction: 0.75,
      rotFriction: 0.8,
      stagnationTime: 800, // ms
      stillThreshold: 10,   // px/s
      floorThreshold: 5     // px
    },
    durations: {
      jump: 0.9,
      fall: 3.1, // Full cycle including flip
      reverse: 1.0,
      explode: 1.2,
      return: 0.8,
      swing: 2.0,
      flipShrink: 0.3,
      flipPause: 0.1,
      flipGrow: 0.3,
      swap: 0.9
    }
  },

  init() {
    this.canvas = document.getElementById('voronoi-canvas');
    if (!this.canvas) return;
    this.ctx = this.canvas.getContext('2d');
    
    if (this.canvas.parentElement !== document.body) {
      document.body.appendChild(this.canvas);
    }
    this.canvas.style.position = 'fixed';
    this.canvas.style.top = '0px';
    this.canvas.style.left = '0px';
    this.canvas.style.zIndex = '50';
    this.canvas.style.pointerEvents = 'none';

    this.initWebGL();
    this.bindEvents();
    this.handleResize();

    document.fonts.ready.then(() => {
      this.updateMetrics();
      console.log("🎨 Title Engine Metrics Updated (Fonts Loaded)");
    });

    requestAnimationFrame((t) => this.render(t));
    console.log("🎨 Title Engine Initialized");
  },

  initWebGL() {
    const webglCanvas = document.createElement('canvas');
    const gl = webglCanvas.getContext('webgl');
    if (!gl) return;

    const vs = `attribute vec2 position; void main() { gl_Position = vec4(position, 0.0, 1.0); }`;
    const fs = `
      precision mediump float;
      uniform float u_time;
      uniform vec2 u_resolution;
      uniform float u_hue;

      vec3 hueShift(vec3 color, float hue) {
        const vec3 k = vec3(0.57735);
        float cosAngle = cos(hue);
        return color * cosAngle + cross(k, color) * sin(hue) + k * dot(k, color) * (1.0 - cosAngle);
      }

      vec3 hash33(vec3 p) {
        p = vec3(dot(p, vec3(127.1, 311.7, 74.7)), dot(p, vec3(269.5, 183.3, 246.1)), dot(p, vec3(113.5, 271.9, 124.6)));
        return fract(sin(p) * 43758.5453123);
      }
      float voronoi(vec3 x) {
        vec3 p = floor(x); vec3 f = fract(x); float res = 100.0;
        for (int k = -1; k <= 1; k++) for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
          vec3 b = vec3(float(i), float(j), float(k));
          vec3 r = vec3(b) - f + hash33(p + b);
          float d = dot(r, r); if (d < res) res = d;
        }
        return sqrt(res);
      }
      void main() {
        vec2 st = gl_FragCoord.xy / u_resolution.y;
        float t = u_time;
        float v1 = voronoi(vec3(st * 3.5 + vec2(t * 0.08, t * 0.06), t * 0.25));
        float v2 = voronoi(vec3(st * 5.0 - vec2(t * 0.12, t * -0.07), t * 0.35 + 50.0));
        float v3 = voronoi(vec3(st * 8.0 + vec2(t * 0.05, t * 0.1), t * 0.2 + 200.0));
        float edge1 = pow(v1 * 1.4, 5.0); float edge2 = pow(v2 * 1.3, 4.0); float edge3 = pow(v3 * 1.2, 3.5);
        float caustic = (edge1 + edge2 * 0.8 + edge3 * 0.35) * 0.7;
        float glow = (pow(v1 * 1.1, 2.0) + pow(v2 * 1.0, 2.0)) * 0.25;
        caustic = clamp(caustic, 0.0, 1.0); glow = clamp(glow, 0.0, 1.0);
        vec3 deepBlue = vec3(0.08, 0.42, 0.95); vec3 icyCyan = vec3(0.45, 0.82, 1.0); vec3 white = vec3(1.0, 1.0, 1.0);
        vec3 color = mix(deepBlue, icyCyan, glow); color = mix(color, white, caustic);
        
        if (abs(u_hue) > 0.001) {
          color = hueShift(color, u_hue);
          float gray = dot(color, vec3(0.299, 0.587, 0.114));
          color = mix(color, vec3(gray), 0.4); 
          color *= 0.85; 
        }
        
        color = color * 1.1 + vec3(0.02, 0.04, 0.08); gl_FragColor = vec4(clamp(color, 0.0, 1.0), 1.0);
      }
    `;

    const compile = (type, src) => {
      const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return s;
    };

    const program = gl.createProgram();
    gl.attachShader(program, compile(gl.VERTEX_SHADER, vs));
    gl.attachShader(program, compile(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(program);
    gl.useProgram(program);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, -1,1, 1,-1, 1,1]), gl.STATIC_DRAW);

    const pos = gl.getAttribLocation(program, "position");
    gl.enableVertexAttribArray(pos);
    gl.vertexAttribPointer(pos, 2, gl.FLOAT, false, 0, 0);

    this.webgl = { 
      canvas: webglCanvas, gl, program, 
      timeLoc: gl.getUniformLocation(program, "u_time"), 
      resLoc: gl.getUniformLocation(program, "u_resolution"),
      hueLoc: gl.getUniformLocation(program, "u_hue")
    };
  },

  updateMetrics() {
    const seoTitle = document.getElementById('seo-title');
    if (!seoTitle) return;
    this.metrics.dpr = window.devicePixelRatio || 1;
    const comp = window.getComputedStyle(seoTitle);
    const fontSize = parseFloat(comp.fontSize) * this.metrics.dpr;
    this.metrics.font = `${comp.fontWeight} ${fontSize}px ${comp.fontFamily}`;
    const letterSpacingPx = parseFloat(comp.letterSpacing);
    this.metrics.spacing = isNaN(letterSpacingPx) ? '0px' : (letterSpacingPx * this.metrics.dpr) + 'px';
    
    const tempCtx = this.ctx;
    tempCtx.font = this.metrics.font;
    tempCtx.letterSpacing = this.metrics.spacing;
    
    const text = seoTitle.textContent.replace(/\s+/g, ' ').trim();
    this.metrics.totalWidth = tempCtx.measureText(text).width;

    const oldLetters = this.interactiveLetters;
    this.interactiveLetters = [];
    
    const spacingPx = parseFloat(this.metrics.spacing) || 0;

    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      const x = tempCtx.measureText(text.substring(0, i)).width;
      const nextX = tempCtx.measureText(text.substring(0, i + 1)).width;
      const charWidth = nextX - x - spacingPx;
      const existing = oldLetters[i] && oldLetters[i].char === char ? oldLetters[i].anim : { mode: 'idle', start: 0 };

      this.interactiveLetters.push({ char, index: i, relX: x, width: charWidth, anim: existing });
    }
    this.updateHulls();
  },

  handleResize() {
    const dpr = window.devicePixelRatio || 1;
    this.metrics.dpr = dpr;
    const width = window.innerWidth * dpr;
    const height = window.innerHeight * dpr;
    
    if (this.canvas.width !== Math.floor(width) || this.canvas.height !== Math.floor(height)) {
      this.canvas.width = Math.floor(width);
      this.canvas.height = Math.floor(height);
      this.canvas.style.width = window.innerWidth + 'px';
      this.canvas.style.height = window.innerHeight + 'px';
      
      const scale = 0.5; 
      this.webgl.canvas.width = Math.floor(width * scale);
      this.webgl.canvas.height = Math.floor(height * scale);
      this.webgl.gl.viewport(0, 0, this.webgl.canvas.width, this.webgl.canvas.height);
      this.updateMetrics();
    }
  },

  updateHulls() {
    if (!this.metrics.font) return;
    const uniqueChars = [...new Set(this.interactiveLetters.map(l => l.char))];
    this.cachedHulls = {};
    uniqueChars.forEach(char => {
      if (char.trim()) this.cachedHulls[char] = this.calculateHullForLetter(char);
    });
  },

  calculateHullForLetter(letter) {
    const font = this.metrics.font;
    if (!font) return [];
    const parts = font.split(' ');
    if (parts.length < 3) return [];
    
    const fontSize = parseFloat(parts[1]);
    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d');
    tempCtx.font = font;
    const metrics = tempCtx.measureText(letter);
    const width = Math.ceil(metrics.width) || 1;
    const height = Math.ceil(fontSize * 2) || 1;
    tempCanvas.width = width; tempCanvas.height = height;
    tempCtx.font = font; tempCtx.textBaseline = 'middle'; tempCtx.fillStyle = 'white';
    tempCtx.fillText(letter, 0, height / 2);

    const data = tempCtx.getImageData(0, 0, width, height).data;
    const points = [];
    const step = Math.max(1, Math.floor(fontSize / 60));
    const padding = 12;
    
    for (let y = 0; y < height; y += step) {
      for (let x = 0; x < width; x += step) {
        if (data[(y * width + x) * 4 + 3] > 10) {
          points.push({ x: x - padding, y: (y - height / 2) - padding });
          points.push({ x: x + padding, y: (y - height / 2) - padding });
          points.push({ x: x - padding, y: (y - height / 2) + padding });
          points.push({ x: x + padding, y: (y - height / 2) + padding });
        }
      }
    }
    return Physics.getConvexHull(points);
  },

  render(time) {
    const { ctx, metrics, webgl } = this;
    const dpr = metrics.dpr;
    if (!this.interactiveLetters.length) return;
    
    const seoTitle = document.getElementById('seo-title');
    if (!seoTitle) return;
    const rect = seoTitle.getBoundingClientRect();

    // 1. WebGL Background
    if (!this.lastTime) this.lastTime = time;
    if (!this.accumulatedTime) this.accumulatedTime = 0;
    if (!this.isSpacePaused) this.accumulatedTime += (time - this.lastTime);
    this.lastTime = time;

    // Update play transition progress
    const target = this.isSpacePaused ? 1 : 0;
    const diff = target - this.playTransition;
    if (Math.abs(diff) > 0.001) {
      this.playTransition += diff * 0.16; // Smooth transition
    } else {
      this.playTransition = target;
    }

    // Animate jelly tint blend-in (0 → 1 over ~0.8s)
    if (this.jellyMode && this.jellyTint < 1) {
      this.jellyTint = Math.min(1, this.jellyTint + 0.016);
    }

    const { gl, timeLoc, resLoc, hueLoc } = webgl;
    gl.uniform1f(timeLoc, this.accumulatedTime * 0.001);
    gl.uniform2f(resLoc, webgl.canvas.width, rect.height * dpr * 0.5); 
    // Jelly mode: shift hue toward green (~2.1 rad)
    gl.uniform1f(hueLoc, this.jellyMode ? 2.1 + Math.sin(this.accumulatedTime * 0.001) * 0.15 : this.currentHue); 
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    
    // 2. Text Rendering
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.font = metrics.font;
    ctx.letterSpacing = metrics.spacing;
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fff';

    const fontSize = parseFloat(metrics.font.split(' ')[1]) || 0;
    const y = (rect.top + rect.height / 2) * dpr + (fontSize * 0.05);
    const startX = (rect.left + rect.width / 2) * dpr - (metrics.totalWidth / 2);
    const floor = (window.innerHeight - 50) * dpr;

    if (!this.lastPhysTime) this.lastPhysTime = time;
    const dt = Math.min((time - this.lastPhysTime) / 1000, 0.1); 
    this.lastPhysTime = time;

    if (this.oSwapping && this.oSwapState) {
      this.updateOSwapState(dt);
    }

    const states = this.interactiveLetters.map((letter, i) => {
      if (letter.char === 'l' && (i === 2 || i === 3)) return null;
      return { letter, state: this.updateLetterState(letter, dt, y, startX, floor) };
    });

    // 2. Background Pass (z <= 0)
    states.forEach(item => {
      if (!item || item.state.z > 0) return;
      ctx.save();
      ctx.translate(item.state.x, item.state.y);
      ctx.rotate(item.state.rot);
      ctx.scale(item.state.scaleX, item.state.scaleY);
      ctx.fillText(item.letter.char, -item.letter.width / 2, 0);
      ctx.restore();
    });

    if (this.interactiveLetters[2].char === 'l') {
      this.renderPlayPauseTransition(this.interactiveLetters[2], this.interactiveLetters[3], startX, y, fontSize, dt, floor);
    }
    
    // Composite background letters
    ctx.globalCompositeOperation = 'source-in';
    ctx.drawImage(webgl.canvas, 0, 0, this.canvas.width, this.canvas.height);

    // --- NEW: Masked Shadow Pass ---
    // This ensures the shadow ONLY affects the background letters
    ctx.globalCompositeOperation = 'source-atop';
    states.forEach(item => {
      if (!item || item.state.z <= 0 || item.state.shadow <= 0) return;
      
      const offX = 10000, offY = 10000;
      const shadowAmt = item.state.shadow;
      
      // Multi-pass for extreme darkening of the caustics
      for (let j = 0; j < 4; j++) {
        ctx.save();
        ctx.shadowColor = `rgba(0, 0, 0, ${shadowAmt * 0.9})`;
        ctx.shadowBlur = (20 + j * 15) * shadowAmt * dpr;
        ctx.shadowOffsetX = (item.state.x - offX) + (10 * shadowAmt * dpr);
        ctx.shadowOffsetY = (item.state.y - offY) + (50 * shadowAmt * dpr);
        
        ctx.translate(offX, offY);
        ctx.rotate(item.state.rot);
        ctx.scale(item.state.scaleX, item.state.scaleY);
        ctx.fillText(item.letter.char, -item.letter.width / 2, 0);
        ctx.restore();
      }
    });

    ctx.globalCompositeOperation = 'source-over';

    // 3. Foreground Pass (z > 0)
    if (!this.offscreen) {
      this.offscreen = document.createElement('canvas');
      this.offscreenCtx = this.offscreen.getContext('2d');
    }
    if (this.offscreen.width !== this.canvas.width) {
      this.offscreen.width = this.canvas.width;
      this.offscreen.height = this.canvas.height;
    }

    states.forEach(item => {
      if (!item || item.state.z <= 0) return;
      
      // Draw Colored Letter to Main Canvas (Isolated via offscreen)
      const oCtx = this.offscreenCtx;
      oCtx.clearRect(0, 0, this.offscreen.width, this.offscreen.height);
      oCtx.save();
      oCtx.font = metrics.font;
      oCtx.letterSpacing = metrics.spacing;
      oCtx.textBaseline = 'middle';
      oCtx.translate(item.state.x, item.state.y);
      oCtx.rotate(item.state.rot);
      oCtx.scale(item.state.scaleX, item.state.scaleY);
      oCtx.fillStyle = '#fff';
      oCtx.fillText(item.letter.char, -item.letter.width / 2, 0);
      oCtx.restore();

      oCtx.globalCompositeOperation = 'source-in';
      oCtx.drawImage(webgl.canvas, 0, 0, this.offscreen.width, this.offscreen.height);
      oCtx.globalCompositeOperation = 'source-over';

      // Final draw back to main canvas
      ctx.drawImage(this.offscreen, 0, 0);
    });

    // Update and render smoke particles
    if (this.particles && this.particles.length > 0) {
      this.particles.forEach(p => {
        // Once a particle hits its splay ground level, switch to horizontal flow
        if (!p.splayed && p.vy > 0 && p.y >= p.groundY) {
          p.splayed = true;
          p.vy = 0;
          // Preserve horizontal momentum and add a strong outward kick
          const dir = Math.sign(p.splayDir);
          p.vx = dir * (180 + Math.random() * 260) * p.dpr;
        }

        if (p.splayed) {
          // Spread outward; decelerate fairly quickly so it pools
          p.vx *= 0.90;
          p.vy = 0;
          p.growth *= 0.80; // puff up less once on the ground
        } else {
          p.vx *= 0.95;
          p.vy *= 0.95;
        }

        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.size += p.growth * dt;
        p.life -= p.decay * dt;
      });

      this.particles = this.particles.filter(p => p.life > 0);

      this.particles.forEach(p => {
        ctx.save();
        ctx.globalAlpha = p.life * p.alpha;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        if (p.isFire) {
          ctx.fillStyle = p.color;
        } else {
          ctx.fillStyle = p.color + p.life + ')';
        }
        ctx.fill();
        ctx.restore();
      });
    }
    
    requestAnimationFrame((t) => this.render(t));
  },

  renderPlayPauseTransition(l1, l2, startX, y, fontSize, dt, floor) {
    const { ctx, playTransition, metrics } = this;
    const dpr = metrics.dpr;
    const t = playTransition;
    
    // Ease for smooth motion
    const easeIn = t * t;
    const easeOut = 1 - Math.pow(1 - t, 3);
    
    const combinedWidth = (l2.relX + l2.width) - l1.relX;
    const centerX = startX + l1.relX + combinedWidth / 2;
    // Shift slightly left (2px * dpr) to visually balance the triangle
    const visualCenterX = centerX - 2 * dpr;

    // Update physical states even if we draw them differently
    const s1 = this.updateLetterState(l1, dt, y, startX, floor);
    const s2 = this.updateLetterState(l2, dt, y, startX, floor);

    ctx.save();
    
    // 1. Render 'll' with transition
    if (t < 0.99) {
      ctx.globalAlpha = 1 - easeIn;
      
      [ {l:l1, s:s1, dir: -1}, {l:l2, s:s2, dir: 1} ].forEach(item => {
        ctx.save();
        // Lerp from current physical position to center transition point
        const targetX = startX + item.l.relX + item.l.width / 2;
        const tx = item.s.x + (targetX - item.s.x) * t;
        const ty = item.s.y + (y - item.s.y) * t;
        const trot = item.s.rot * (1 - t) + (item.dir * Math.PI * 0.4) * t;
        const ts = item.s.scaleX * (1 - t) + 0.6 * t;
        
        ctx.translate(tx, ty);
        ctx.rotate(trot);
        ctx.scale(ts, ts);
        ctx.fillText(item.l.char, -item.l.width / 2, 0);
        ctx.restore();
      });
    }
    
    // 2. Render Play Triangle with transition
    if (t > 0.01) {
      ctx.save();
      ctx.globalAlpha = easeOut;
      const scale = 0.4 + easeOut * 0.6;
      
      // Use average physical position and rotation of 'l's so triangle explodes too
      const physCenterX = (s1.x + s2.x) / 2;
      const physCenterY = (s1.y + s2.y) / 2;
      const physRot = (s1.rot + s2.rot) / 2;
      const offset = visualCenterX - centerX;

      const rot = (1 - easeOut) * -Math.PI * 0.5 + physRot;
      
      ctx.translate(physCenterX + offset, physCenterY);
      ctx.rotate(rot);
      ctx.scale(scale, scale);
      
      const size = fontSize * 0.4;
      ctx.beginPath();
      // Balanced and centered triangle points
      ctx.moveTo(-0.5 * size, -0.6 * size);
      ctx.lineTo(0.6 * size, 0);
      ctx.lineTo(-0.5 * size, 0.6 * size);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
    
    ctx.restore();
    ctx.globalAlpha = 1.0;
  },

  updateLetterState(letter, dt, yBase, startX, floor) {
    const dpr = this.metrics.dpr;
    const anim = letter.anim;
    const state = {
      x: startX + letter.relX + letter.width / 2,
      y: yBase,
      rot: 0,
      scaleX: 1,
      scaleY: 1,
      z: 0,
      shadow: 0
    };

    if (anim.mode === 'idle') return state;

    const p = (performance.now() - anim.start) / 1000;
    const durs = this.config.durations;

    switch (anim.mode) {
      case 'jump':
        if (p <= durs.jump) {
          const res = this.getJumpParams(p / durs.jump);
          state.y += res.ty * dpr; state.scaleX = res.sx; state.scaleY = res.sy;
        } else anim.mode = 'idle';
        break;

      case 'fall':
        if (p <= 1.0) {
          const res = this.getFallParams(p, anim.fallDist);
          state.y += res.ty * dpr; state.rot = res.rot * Math.PI / 180;
        } else if (p <= 2.4) {
          state.y += anim.fallDist * dpr;
        } else if (p <= 2.7) {
          state.y += anim.fallDist * dpr;
          state.scaleX = Math.cos((p - 2.4) / 0.3 * Math.PI / 2);
        } else if (p <= 2.8) {
          state.y += anim.fallDist * dpr; state.scaleX = 0;
        } else if (p <= 3.1) {
          state.scaleX = Math.sin((p - 2.8) / 0.3 * Math.PI / 2);
        } else anim.mode = 'idle';
        break;

      case 'reverse':
        if (p <= durs.reverse) {
          const res = this.getFallParams(p, anim.fallDist);
          state.y += (anim.fallDist - res.ty) * dpr; state.rot = -res.rot * Math.PI / 180;
        } else anim.mode = 'idle';
        break;

      case 'explode':
        if (p <= durs.explode) {
          const t = 1 - Math.pow(1 - (p / durs.explode), 3);
          state.x += anim.exX * t * dpr; state.y += anim.exY * t * dpr; state.rot = anim.exRot * t;
        } else {
          state.x += anim.exX * dpr; state.y += anim.exY * dpr; state.rot = anim.exRot;
        }
        break;

      case 'return':
        if (p <= durs.return) {
          const t = Math.pow(1 - (p / durs.return), 2);
          state.x += (anim.curX || 0) * t; state.y += (anim.curY || 0) * t; state.rot = (anim.curRot || 0) * t;
        } else {
          anim.mode = 'idle'; anim.curX = 0; anim.curY = 0; anim.curRot = 0;
        }
        break;

      case 'physics':
        this.updatePhysics(letter, dt, floor, yBase);
        state.x += anim.px; state.y += anim.py; state.rot = anim.prot;
        break;

      case 'jelly': {
        // Jelly physics: falls with gravity and bounces with a pronounced wobbly squish.
        // Uses the same physics engine but overlays a continuous jelly wobble on top.
        this.updatePhysics(letter, dt, floor, yBase);
        state.x += anim.px;
        state.y += anim.py;
        state.rot = anim.prot * 0.5; // Reduce rotation — jelly wobbles rather than spins

        // Persistent jelly wobble: sinusoidal squish driven by time + per-letter phase offset
        const jellyAge = (performance.now() - anim.jellyStart) / 1000;
        const wobbleFreq = 3.5 + (letter.index % 3) * 0.4;
        const wobbleDecay = Math.max(0.15, 1.0 - jellyAge * 0.12);
        const wobble = Math.sin(jellyAge * wobbleFreq * Math.PI * 2 + anim.jellyPhase) * 0.22 * wobbleDecay;
        state.scaleX = 1.0 + wobble;
        state.scaleY = 1.0 - wobble * 0.8;
        break;
      }

      case 'flip_return':
        const { flipShrink, flipPause, flipGrow } = durs;
        if (p <= flipShrink) {
          state.x += anim.curX; state.y += anim.curY; state.rot = anim.curRot;
          state.scaleX = Math.cos(p / flipShrink * Math.PI / 2);
        } else if (p <= flipShrink + flipPause) {
          state.x += anim.curX; state.y += anim.curY; state.rot = anim.curRot;
          state.scaleX = 0;
        } else if (p <= flipShrink + flipPause + flipGrow) {
          state.scaleX = Math.sin((p - flipShrink - flipPause) / flipGrow * Math.PI / 2);
        } else {
          anim.mode = 'idle'; anim.px = 0; anim.py = 0; anim.prot = 0;
        }
        break;

      case 'swing':
        if (p <= durs.swing) {
          state.rot = this.getSwingParams(p).rot * Math.PI / 180;
        } else anim.mode = 'idle';
        break;

      case 'swap': {
        const swapState = this.oSwapState;
        if (!swapState) { anim.mode = 'idle'; break; }

        const focal = 600, zArc = 350;
        const o1Orig = swapState.o1.anim.origRelX;
        const o2Orig = swapState.o2.anim.origRelX;
        
        // Find the centre and radius of the rotation path
        const leftOrig = Math.min(o1Orig, o2Orig);
        const rightOrig = Math.max(o1Orig, o2Orig);
        const centreRelX = (leftOrig + rightOrig) / 2;
        const radiusX = (rightOrig - leftOrig) / 2;

        const startsOnLeft = (anim.origRelX === leftOrig);
        const xRel = startsOnLeft
          ? centreRelX - radiusX * Math.cos(swapState.theta)
          : centreRelX + radiusX * Math.cos(swapState.theta);

        const zDir = anim.isPrimary ? -1 : 1;
        const z = zDir * zArc * Math.sin(swapState.theta);
        const pScale = focal / (focal - z);

        state.x = startX + xRel + letter.width / 2;
        state.scaleX = pScale;
        state.scaleY = pScale;
        state.z = z;
        state.shadow = z > 0 ? Math.abs(Math.sin(swapState.theta)) : 0;
        break;
      }

      case 'squishMorph': {
        const squishDuration = 0.45; // Time to perform the squish morph
        const stayDuration = 3.0;    // Time it stays as an unsquished 'e'
        const unsquishDuration = 0.45; // Time to perform the unsquish morph back to 'o'
        const totalDuration = squishDuration + stayDuration + unsquishDuration;

        // Helper to evaluate keyframe-based scale values matching the CSS squishMorph keyframes:
        // 0%   -> scaleX(1.0), scaleY(1.0)
        // 30%  -> scaleX(1.5), scaleY(0.6)
        // 55%  -> scaleX(0.8), scaleY(1.2)
        // 75%  -> scaleX(1.1), scaleY(0.95)
        // 100% -> scaleX(1.0), scaleY(1.0)
        const getSquishScales = (t) => {
          let sx = 1.0, sy = 1.0;
          if (t <= 0.3) {
            const p = t / 0.3;
            sx = 1.0 + 0.5 * p;
            sy = 1.0 - 0.4 * p;
          } else if (t <= 0.55) {
            const p = (t - 0.3) / 0.25;
            sx = 1.5 - 0.7 * p;
            sy = 0.6 + 0.6 * p;
          } else if (t <= 0.75) {
            const p = (t - 0.55) / 0.2;
            sx = 0.8 + 0.3 * p;
            sy = 1.2 - 0.25 * p;
          } else {
            const p = (t - 0.75) / 0.25;
            sx = 1.1 - 0.1 * p;
            sy = 0.95 + 0.05 * p;
          }
          return { sx, sy };
        };

        if (p <= totalDuration) {
          if (p <= squishDuration) {
            // Phase 1: Squishing and morphing 'o' -> 'e'
            const t = p / squishDuration;
            // Swap character at the peak squish (t = 0.3 matches the 30% CSS keyframe)
            if (t >= 0.3) {
              letter.char = 'e';
            }
            const scales = getSquishScales(t);
            state.scaleX = scales.sx;
            state.scaleY = scales.sy;
          } else if (p <= squishDuration + stayDuration) {
            // Phase 2: Stays as a normal 'e'
            letter.char = 'e';
            state.scaleX = 1;
            state.scaleY = 1;
          } else {
            // Phase 3: Unsquishing and morphing 'e' -> 'o'
            const t = (p - squishDuration - stayDuration) / unsquishDuration;
            // Swap character back at the peak squish (t = 0.3 matches the 30% CSS keyframe)
            if (t >= 0.3) {
              letter.char = 'o';
            }
            const scales = getSquishScales(t);
            state.scaleX = scales.sx;
            state.scaleY = scales.sy;
          }
        } else {
          letter.char = 'o';
          anim.mode = 'idle';
        }
        break;
      }

      case 'spin':
        if (p <= 0.6) {
          const ep = 1 - Math.pow(1 - (p / 0.6), 3);
          state.rot = ep * Math.PI * 2;
          const s = 1 + Math.sin(ep * Math.PI) * 0.3;
          state.scaleX = state.scaleY = s;
        } else {
          anim.mode = 'idle';
        }
        break;

      case 'rocket': {
        const durationRumble = 1.2;
        if (p <= durationRumble) {
          state.x += (Math.random() - 0.5) * 6 * dpr;
          state.y += (Math.random() - 0.5) * 6 * dpr;
          this.emitSmoke(state.x, state.y + letter.width * 0.2, dpr, 'rumble');
        } else {
          const tBlast = p - durationRumble;
          const accel = 2800; // pixels/sec^2
          const dy = -0.5 * accel * tBlast * tBlast;
          state.y += dy * dpr;
          this.emitSmoke(state.x, state.y + letter.width * 0.2, dpr, true);
          const isOffScreen = state.y < -150 * dpr;
          if (isOffScreen && !anim.returning) {
            anim.returning = true;
            setTimeout(() => {
              anim.mode = 'rocket_return';
              anim.start = performance.now();
              anim.returning = false;
            }, 3000);
          }
        }
        break;
      }

      case 'rocket_return': {
        const durationReturn = 1.8;
        if (p <= durationReturn) {
          const t = p / durationReturn;
          // Smooth glide-in ease-out (cubic)
          const ease = 1 - Math.pow(1 - t, 3);
          const startY = (window.innerHeight + 150) * dpr;
          const targetY = yBase;
          state.y = startY + (targetY - startY) * ease;
        } else {
          anim.mode = 'idle';
        }
        break;
      }
    }
    return state;
  },

  updatePhysics(letter, dt, floor, yBase) {
    const anim = letter.anim;
    const { physics: conf } = this.config;
    const dpr = this.metrics.dpr;

    anim.vy += conf.gravity * dpr * dt;
    anim.px += anim.vx * dt;
    anim.py += anim.vy * dt;
    anim.prot += anim.vrot * dt;
    
    anim.vx *= conf.airFriction;
    anim.vrot *= conf.airFriction;

    const absX = (this.metrics.startX || 0) + letter.relX + letter.width / 2 + anim.px; // Note: startX should be calculated or passed
    // To simplify, we use screen bounds directly for X
    const screenX = this.metrics.dpr * window.innerWidth;
    
    if (yBase + anim.py > floor) { 
      anim.py = floor - yBase; 
      anim.vy *= -conf.bounce; 
      anim.vx *= conf.floorFriction;
      anim.vrot *= conf.rotFriction;
      if (Math.abs(anim.vy) < 40 * dpr) anim.vy = 0;
    }
    
    // Bounds check
    const absScreenX = (window.innerWidth / 2) * dpr + (letter.relX - this.metrics.totalWidth / 2 + letter.width / 2) + anim.px;
    if (absScreenX > window.innerWidth * dpr) { anim.vx *= -conf.bounce; }
    if (absScreenX < 0) { anim.vx *= -conf.bounce; }

    // Stagnation
    const floorY = floor - yBase;
    const isOnFloor = Math.abs(anim.py - floorY) < conf.floorThreshold * dpr;
    const isStill = Math.abs(anim.vx) < conf.stillThreshold * dpr && Math.abs(anim.vy) < conf.stillThreshold * dpr;
    
    if (isOnFloor && isStill) {
      if (!anim.stagnantSince) anim.stagnantSince = performance.now();
      if (performance.now() - anim.stagnantSince > conf.stagnationTime) {
        anim.mode = 'flip_return';
        anim.start = performance.now();
        anim.curX = anim.px; anim.curY = anim.py; anim.curRot = anim.prot;
      }
    } else {
      anim.stagnantSince = null;
    }
    anim.curX = anim.px; anim.curY = anim.py; anim.curRot = anim.prot;
  },

  updateOSwapState(dt) {
    const swapState = this.oSwapState;
    if (!swapState) return;

    if (!swapState.settling) {
      swapState.omega *= Math.exp(-0.85 * dt);

      if (Math.abs(swapState.omega) < 1.2) {
        const lowerHome = Math.floor(swapState.theta / Math.PI) * Math.PI;
        const upperHome = lowerHome + Math.PI;
        swapState.targetTheta = upperHome;

        const settleDistance = Math.abs(swapState.targetTheta - swapState.theta);
        swapState.settleStartTheta = swapState.theta;
        swapState.settleElapsed = 0;
        swapState.settleDuration = Math.min(1.05, Math.max(0.24, settleDistance / 1.65));
        swapState.settleStartOmega = Math.min(Math.abs(swapState.omega), settleDistance * 1.8 / swapState.settleDuration);
        swapState.settling = true;
      } else {
        const lowerHome = Math.floor(swapState.theta / Math.PI) * Math.PI;
        const upperHome = lowerHome + Math.PI;
        const nextTheta = swapState.theta + Math.abs(swapState.omega) * dt;
        const willCrossHome = nextTheta >= upperHome;

        if (Math.abs(swapState.omega) < 1.6 && willCrossHome) {
          swapState.targetTheta = upperHome;
          const settleDistance = upperHome - swapState.theta;
          swapState.settleStartTheta = swapState.theta;
          swapState.settleElapsed = 0;
          swapState.settleDuration = Math.min(0.45, Math.max(0.18, settleDistance / 1.65));
          swapState.settleStartOmega = Math.min(Math.abs(swapState.omega), settleDistance * 1.8 / swapState.settleDuration);
          swapState.settling = true;
          return;
        }

        swapState.theta = nextTheta;
      }
    } else {
      swapState.settleElapsed += dt;
      const t = Math.min(swapState.settleElapsed / swapState.settleDuration, 1);
      const startTheta = swapState.settleStartTheta;
      const diff = swapState.targetTheta - startTheta;
      const startSlope = (swapState.settleStartOmega || 0) * swapState.settleDuration;
      const h00 = 2 * t * t * t - 3 * t * t + 1;
      const h10 = t * t * t - 2 * t * t + t;
      const h01 = -2 * t * t * t + 3 * t * t;

      swapState.theta = h00 * startTheta + h10 * startSlope + h01 * swapState.targetTheta;

      if (t >= 1) {
        swapState.theta = swapState.targetTheta;
        this.oSwapping = false;

        const targetIndex = Math.round(swapState.targetTheta / Math.PI);
        if (Math.abs(targetIndex % 2) === 1) {
          // Swap their home positions for layout purposes
          const tempRelX = swapState.o1.relX;
          swapState.o1.relX = swapState.o2.relX;
          swapState.o2.relX = tempRelX;

          const tempWidth = swapState.o1.width;
          swapState.o1.width = swapState.o2.width;
          swapState.o2.width = tempWidth;
        }

        swapState.o1.anim.mode = 'idle';
        swapState.o2.anim.mode = 'idle';
        this.oSwapState = null;
      }
    }
  },

  triggerOSwapSpeedUp() {
    if (!this.oSwapping || !this.oSwapState) return;
    
    this.oSwapState.omega = Math.abs(this.oSwapState.omega) + 8.5;
    
    this.oSwapState.settling = false;
  },

  getFallParams(p, fallDist) {
    let ty = 0, rot = 0;
    if (p <= 0.6) { let t = Math.pow(p / 0.6, 3); ty = t * fallDist; rot = -3 + t * 7; }
    else if (p <= 0.75) { let t = Math.pow((p - 0.6) / 0.15, 2); ty = fallDist - t * 24; rot = 4 - t * 6; }
    else if (p <= 0.88) { let t = Math.pow((p - 0.75) / 0.13, 2); ty = (fallDist - 24) + t * 24; rot = -2 + t * 4; }
    else { let t = (p - 0.88) / 0.12; ty = fallDist; rot = 2 - t * 2; }
    return { ty, rot };
  },

  getJumpParams(t) {
    let ty = 0, sx = 1, sy = 1;
    if (t <= 0.25) { let p = Math.sin(t / 0.25 * Math.PI / 2); ty = -90 * p; sx = 1 - 0.1 * p; sy = 1 + 0.1 * p; }
    else if (t <= 0.5) { let p = 1 - Math.cos((t - 0.25) / 0.25 * Math.PI / 2); ty = -90 * (1 - p); sx = 0.9 + 0.4 * p; sy = 1.1 - 0.4 * p; }
    else if (t <= 0.65) { let p = Math.sin((t - 0.5) / 0.15 * Math.PI / 2); ty = -30 * p; sx = 1.3 - 0.35 * p; sy = 0.7 + 0.35 * p; }
    else if (t <= 0.8) { let p = 1 - Math.cos((t - 0.65) / 0.15 * Math.PI / 2); ty = -30 * (1 - p); sx = 0.95 + 0.15 * p; sy = 1.05 - 0.15 * p; }
    else { let p = Math.sin((t - 0.8) / 0.2 * Math.PI / 2); ty = 0; sx = 1.1 - 0.1 * p; sy = 0.9 + 0.1 * p; }
    return { ty, sx, sy };
  },

  getSwingParams(p) {
    const amplitude = 35, frequency = 3, decay = 4;
    return { rot: amplitude * Math.exp(-decay * p) * Math.cos(frequency * Math.PI * 2 * p) };
  },

  bindEvents() {
    window.addEventListener('click', (e) => this.handleClick(e));
    window.addEventListener('resize', () => this.handleResize());
  },

  handleClick(e) {
    const dpr = this.metrics.dpr;
    const mx = e.clientX * dpr, my = e.clientY * dpr;
    const seoTitle = document.getElementById('seo-title');
    if (!seoTitle) return;
    const rect = seoTitle.getBoundingClientRect();
    const fontSize = parseFloat(this.metrics.font.split(' ')[1]) || 0;
    const y = (rect.top + rect.height / 2) * dpr + (fontSize * 0.05);
    const startX = (rect.left + rect.width / 2) * dpr - (this.metrics.totalWidth / 2);

    // Special detection for clicking the 'o' home locations during swap animation
    if (this.oSwapping) {
      const o1 = this.interactiveLetters[1];
      const o2 = this.interactiveLetters[13];
      let clickedOHome = false;
      [o1, o2].forEach(oLetter => {
        if (!oLetter || !this.cachedHulls[oLetter.char]) return;
        // Calculate home state
        const homeState = {
          x: startX + oLetter.relX + oLetter.width / 2,
          y: y,
          rot: 0,
          scaleX: 1,
          scaleY: 1
        };
        const homeHull = Physics.getTransformedHull(this.cachedHulls[oLetter.char], homeState.x, homeState.y, homeState.scaleX, homeState.scaleY, homeState.rot, -oLetter.width / 2, 0);
        if (Physics.isPointInPolygon({ x: mx, y: my }, homeHull)) {
          clickedOHome = true;
        }
      });
      if (clickedOHome) {
        this.triggerOSwapSpeedUp();
        return;
      }
    }

    // 'll' combined hitbox
    const l1 = this.interactiveLetters[2], l2 = this.interactiveLetters[3];
    if (l1 && l2 && l1.char === 'l' && l2.char === 'l') {
      const left = startX + l1.relX;
      const right = startX + l2.relX + l2.width;
      const vPadding = 20 * dpr;
      if (mx >= left && mx <= right && my >= y - fontSize * 0.6 - vPadding && my <= y + fontSize * 0.6 + vPadding) {
        this.triggerInteraction(l1, y, fontSize); return;
      }
    }

    this.interactiveLetters.forEach(letter => {
      if (letter.char === 'l' && (letter.index === 2 || letter.index === 3)) return;
      if (!this.cachedHulls[letter.char]) return;
      const state = this.updateLetterState(letter, 0, y, startX, (window.innerHeight - 50) * dpr);
      const hull = Physics.getTransformedHull(this.cachedHulls[letter.char], state.x, state.y, state.scaleX, state.scaleY, state.rot, -letter.width / 2, 0);
      if (Physics.isPointInPolygon({ x: mx, y: my }, hull)) this.triggerInteraction(letter, y, fontSize);
    });
  },

  triggerInteraction(letter, yBase, fontSize) {
    const anim = letter.anim;
    if (letter.char === 'J' && letter.index === 0) {
      if (anim.mode === 'idle') { anim.mode = 'jump'; anim.start = performance.now(); if (window.MrFinance) MrFinance.spawn(); }
    } else if (letter.char === 'w') {
      this.handleWInteraction(letter, yBase, fontSize);
    } else if (letter.char === 'p' && letter.index === 7) {
      this.handleExplosionInteraction();
    } else if (letter.char === 'y') {
      this.handleYInteraction(letter);
    } else if (letter.char.toLowerCase() === 'o') {
      this.handleOSwap(letter);
    } else if (letter.char === 'l' && (letter.index === 2 || letter.index === 3)) {
      this.toggleSpace();
    } else if (letter.char === 'c' && letter.index === 9) {
      this.handleStarfieldToggle(letter);
    } else if (letter.char === 'S') {
      this.handleSInteraction(letter, yBase, fontSize);
    } else if (letter.char === 'e' && letter.index === 10) {
      this.handleEInteraction();
    }
  },

  /**
   * Handles clicks on the 'e' letter (index 10, in 'Space').
   * First click: triggers the 'o' → 'e' squish morph on the 'J[o]lly' letter.
   * Second click (while 'o' is showing as 'e'): triggers the jelly easter egg!
   */
  handleEInteraction() {
    if (this.jellyMode) return; // Already in jelly mode

    const o1 = this.interactiveLetters[1]; // The 'o' in 'Jolly'
    
    // If the 'o' in Jolly is currently showing as an 'e' (squish morph in progress),
    // this second click on the 'e' in Space triggers JELLY MODE!
    if (o1 && o1.char === 'e') {
      this.triggerJellyMode();
      return;
    }

    // Otherwise: first click — trigger the squish morph on 'o' → 'e'
    if (!o1 || o1.anim.mode !== 'idle') return;
    o1.anim.mode = 'squishMorph';
    o1.anim.start = performance.now();
  },

  /**
   * Triggers jelly mode: all letters fall with wobbly jelly physics and a green tint.
   */
  triggerJellyMode() {
    if (this.jellyMode) return;
    this.jellyMode = true;
    this.jellyTint = 0;

    const dpr = this.metrics.dpr;
    const now = performance.now();

    this.interactiveLetters.forEach((letter, i) => {
      // Stagger the launch slightly so they cascade like falling jelly blobs
      const delay = i * 45;
      setTimeout(() => {
        letter.anim.mode = 'jelly';
        letter.anim.start = now;
        letter.anim.jellyStart = now;
        letter.anim.jellyPhase = Math.random() * Math.PI * 2; // Random wobble phase per letter
        // Give each letter a gentle random lateral shove so they spread out
        const angle = -Math.PI / 2 + (Math.random() - 0.5) * 1.2;
        const speed = (200 + Math.random() * 400) * dpr;
        letter.anim.vx = Math.cos(angle) * speed;
        letter.anim.vy = Math.sin(angle) * speed;
        letter.anim.vrot = (Math.random() - 0.5) * 8;
        letter.anim.px = 0;
        letter.anim.py = 0;
        letter.anim.prot = 0;
        letter.anim.stagnantSince = null;
      }, delay);
    });

    console.log('🟢 Jelly Mode Activated! Everything is jelly now!');
  },

  handleStarfieldToggle(letter) {
    if (window.toggleStarfieldMode) {
      window.toggleStarfieldMode();
    }
    letter.anim.mode = 'spin';
    letter.anim.start = performance.now();
  },

  handleOSwap(clickedLetter) {
    const o1 = this.interactiveLetters[1];
    const o2 = this.interactiveLetters[13];
    if (!o1 || !o2 || o1.char.toLowerCase() !== 'o' || o2.char.toLowerCase() !== 'o') return;

    if (!this.oSwapping) {
      this.oSwapping = true;
      this.oSwapState = {
        theta: 0,
        omega: 6.8, // Initial angular velocity (rad/s)
        settling: false,
        targetTheta: 0,
        o1: o1,
        o2: o2,
        clickedLetter: clickedLetter
      };

      [o1, o2].forEach(l => {
        l.anim.mode = 'swap';
        l.anim.origRelX = l.relX;
        l.anim.isPrimary = (l === clickedLetter);
      });
    } else {
      this.triggerOSwapSpeedUp();
    }
  },

  toggleSpace() {
    this.isSpacePaused = !this.isSpacePaused;
    window.spacePaused = this.isSpacePaused;
  },

  handleExplosionInteraction() {
    const isInPhysics = this.interactiveLetters.some(l => l.anim.mode === 'physics');
    const dpr = this.metrics.dpr;
    if (isInPhysics) {
      this.interactiveLetters.forEach(l => { if (l.anim.mode === 'physics' || l.anim.mode === 'fall') { l.anim.mode = 'return'; l.anim.start = performance.now(); } });
    } else {
      this.interactiveLetters.forEach(l => {
        l.anim.mode = 'physics'; l.anim.start = performance.now();
        const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI;
        const speed = (500 + Math.random() * 1000) * dpr;
        l.anim.vx = Math.cos(angle) * speed; l.anim.vy = Math.sin(angle) * speed; l.anim.vrot = (Math.random() - 0.5) * 15;
        l.anim.px = 0; l.anim.py = 0; l.anim.prot = 0;
      });
      this.shakeScreen();
    }
  },

  handleYInteraction(letter) {
    letter.anim.mode = 'swing'; letter.anim.start = performance.now();
    this.yClickCount++;
    if (this.yClickCount % 6 === 0) { this.currentHue = 0; this.lastHue = 0; }
    else {
      let nextHue; let attempts = 0;
      do { nextHue = 0.5 + Math.random() * (Math.PI * 2 - 0.5); attempts++; } while (attempts < 10 && Math.abs(nextHue - (this.lastHue || 0)) < 1.1);
      this.currentHue = nextHue; this.lastHue = nextHue;
    }
  },

  handleWInteraction(letter, yCanvas, fontSize) {
    const anim = letter.anim;
    if (anim.mode === 'idle') {
      anim.mode = 'fall'; anim.start = performance.now();
      anim.fallDist = window.innerHeight - (yCanvas / this.metrics.dpr) - (fontSize / this.metrics.dpr) * 0.3;
      clearTimeout(anim.t1); clearTimeout(anim.t2);
      anim.t1 = setTimeout(() => { this.shakeScreen(); anim.t2 = setTimeout(() => { if (anim.mode === 'fall') anim.mode = 'idle'; }, 3500); }, 600);
    } else if (anim.mode === 'fall') {
      const p = (performance.now() - anim.start) / 1000;
      if (p >= 1.0 && p <= 2.4) {
        anim.mode = 'reverse'; anim.start = performance.now();
        clearTimeout(anim.t1); clearTimeout(anim.t2);
        anim.t1 = setTimeout(() => { this.shakeScreen(); anim.t2 = setTimeout(() => { if (anim.mode === 'reverse') anim.mode = 'idle'; }, 400); }, 600);
      }
    }
  },

  handleSInteraction(letter, yBase, fontSize) {
    const anim = letter.anim;
    if (anim.mode === 'idle') {
      anim.mode = 'rocket';
      anim.start = performance.now();
      anim.returning = false;
    }
  },

  emitSmoke(x, y, dpr, mode) {
    // Avoid performance lag on lower-end devices by limiting active particles
    if (this.particles.length >= 45) return;
    
    // Throttle rate of particle creation (spawn roughly 25% of frames)
    if (Math.random() > 0.25) return;

    const isBlasting = mode === true || mode === 'blast';
    const isRumble = mode === 'rumble';

    // Generate fire and smoke particles with Australian spelling-compliant comments
    const count = isBlasting ? 2 : 1;
    // Ground level is just below the letter — blast smoke splays out here
    const groundY = y + 40 * dpr;

    for (let i = 0; i < count; i++) {
      const isFire = isBlasting && Math.random() < 0.45;
      // Random left/right direction for splay
      const splayDir = Math.random() < 0.5 ? -1 : 1;

      if (isRumble) {
        // During rumble the smoke shoots directly left or right, hugging the ground
        this.particles.push({
          x: x + splayDir * (5 + Math.random() * 8) * dpr,
          y: y,
          vx: splayDir * (120 + Math.random() * 180) * dpr,
          vy: (5 + Math.random() * 15) * dpr, // tiny downward drift to hug the baseline
          alpha: 0.5 + Math.random() * 0.3,
          size: (6 + Math.random() * 8) * dpr,
          growth: (10 + Math.random() * 14) * dpr,
          color: `rgba(${185 + Math.random() * 20}, ${185 + Math.random() * 20}, ${185 + Math.random() * 20}, `,
          isFire: false,
          splayed: true,   // already splayed — skip the fall phase
          splayDir: splayDir,
          groundY: groundY,
          dpr: dpr,
          life: 1.0,
          decay: 1.2 + Math.random() * 0.8
        });
      } else {
        this.particles.push({
          x: x + (Math.random() - 0.5) * 14 * dpr,
          y: y,
          // Small horizontal drift on spawn; splay direction assigned for when it hits ground
          vx: splayDir * (10 + Math.random() * 20) * dpr,
          // Downward velocity so it falls toward the figurative ground
          vy: (isBlasting ? (60 + Math.random() * 100) : (30 + Math.random() * 50)) * dpr,
          alpha: 0.55 + Math.random() * 0.3,
          size: (7 + Math.random() * 10) * dpr,
          growth: (12 + Math.random() * 18) * dpr,
          // Establish orange/yellow flame or grey smoke colour
          color: isFire 
            ? `hsl(${15 + Math.random() * 20}, 100%, ${55 + Math.random() * 15}%)` 
            : `rgba(${175 + Math.random() * 25}, ${175 + Math.random() * 25}, ${175 + Math.random() * 25}, `,
          isFire: isFire,
          splayed: false,
          splayDir: splayDir,
          groundY: groundY,
          dpr: dpr,
          life: 1.0,
          decay: 1.0 + Math.random() * 0.8
        });
      }
    }
  },

  shakeScreen() {
    document.body.style.transition = 'transform 0.05s';
    document.body.style.transform = 'translateY(-4px)';
    setTimeout(() => { document.body.style.transform = 'translateY(3px)'; setTimeout(() => { document.body.style.transform = ''; }, 80); }, 50);
  }
};

TitleEngine.init();
