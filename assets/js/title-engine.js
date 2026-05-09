/**
 * Jolly Space Cow - Title Interaction Engine
 * Manages the animated, interactive title with WebGL backgrounds and physics-based hit detection.
 */

const TitleEngine = {
  canvas: null,
  ctx: null,
  webgl: { canvas: null, gl: null, program: null, timeLoc: null, resLoc: null },
  
  metrics: { font: '', spacing: '0px', dpr: 1, textJ: 0, textMid: 0, textRight: 0, totalWidth: 0, y: 0, startX: 0 },
  interactiveLetters: [], // Array of { char: 'J', x: 0, y: 0, width: 0, hull: [], anim: {} }
  
  // Animation state for "J" and "w" (preserved for compatibility)
  jAnim: { mode: 'idle', start: 0 },
  wAnim: { mode: 'idle', start: 0, fallDist: 0, timeout1: null, timeout2: null },

  init() {
    this.canvas = document.getElementById('voronoi-canvas');
    if (!this.canvas) return;
    this.ctx = this.canvas.getContext('2d');
    
    // Ensure canvas is fixed to viewport for correct coordinate mapping
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
    
    // Initial resize to setup canvas
    this.handleResize();

    // Ensure fonts are loaded before measuring metrics
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

    this.webgl = { canvas: webglCanvas, gl, program, timeLoc: gl.getUniformLocation(program, "u_time"), resLoc: gl.getUniformLocation(program, "u_resolution") };
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
    
    this.updateHulls();
    
    // Cache text widths (expensive)
    const tempCtx = this.ctx;
    tempCtx.font = this.metrics.font;
    tempCtx.letterSpacing = this.metrics.spacing;
    
    const textJ = "J", textMid = "olly Space Co", textRight = "w";
    
    const spacingPx = parseFloat(this.metrics.spacing) || 0;

    // Use cumulative measurements and manually add the missing trailing spacing gap
    this.metrics.textJ = tempCtx.measureText(textJ).width;
    this.metrics.midOffset = this.metrics.textJ + spacingPx;
    this.metrics.wOffset = tempCtx.measureText(textJ + textMid).width + spacingPx;
    this.metrics.totalWidth = tempCtx.measureText(textJ + textMid + textRight).width;
    this.metrics.textRight = tempCtx.measureText(textRight).width;
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
      
      // Optimization: WebGL can render at a lower resolution for a blurred background
      const scale = 0.5; 
      this.webgl.canvas.width = Math.floor(width * scale);
      this.webgl.canvas.height = Math.floor(height * scale);
      this.webgl.gl.viewport(0, 0, this.webgl.canvas.width, this.webgl.canvas.height);
      
      this.updateMetrics();
    }
  },

  updateHulls() {
    if (!this.metrics.font) return;
    // For now, we specifically cache J and w. In the future, we can loop all letters.
    this.cachedHulls = {
      'J': this.calculateHullForLetter('J'),
      'w': this.calculateHullForLetter('w')
    };
  },

  calculateHullForLetter(letter) {
    const font = this.metrics.font;
    if (!font) return [];
    const parts = font.split(' ');
    if (parts.length < 3) return [];
    
    const fontSize = parseFloat(parts[1]);
    if (isNaN(fontSize) || fontSize <= 0) return [];

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
    const ctx = this.ctx;
    const dpr = this.metrics.dpr;
    const metrics = this.metrics;
    
    if (!this.cachedHulls || !this.cachedHulls['J']) {
      this.updateHulls();
    }
    
    const seoTitle = document.getElementById('seo-title');
    if (!seoTitle) return;
    const rect = seoTitle.getBoundingClientRect();

    // 1. Draw WebGL Background to hidden canvas
    const { gl, timeLoc, resLoc } = this.webgl;
    gl.uniform1f(timeLoc, time * 0.001);
    // Scale resolution by 0.5 to match the optimized canvas size
    gl.uniform2f(resLoc, this.webgl.canvas.width, rect.height * dpr * 0.5); 
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    
    // 2. Draw Text to visible canvas
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.font = metrics.font;
    ctx.letterSpacing = metrics.spacing;
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fff';

    const fontParts = metrics.font.split(' ');
    const fontSize = fontParts.length >= 3 ? parseFloat(fontParts[1]) : 0;

    const y = (rect.top + rect.height / 2) * dpr + (fontSize * 0.05);
    const startX = (rect.left + rect.width / 2) * dpr - (metrics.totalWidth / 2);
    
    const jWidth = metrics.textJ;
    const midOffset = metrics.midOffset;
    const wOffset = metrics.wOffset;
    const rightWidth = metrics.textRight;
    const textJ = "J", textMid = "olly Space Co", textRight = "w";

    // Render "J"
    ctx.save();
    let jY = y, jScaleX = 1, jScaleY = 1;
    if (this.jAnim.mode === 'jump') {
      const p = (performance.now() - this.jAnim.start) / 1000;
      if (p <= 0.9) {
        const res = this.getJumpParams(p / 0.9);
        jY += res.ty * dpr; jScaleX = res.sx; jScaleY = res.sy;
      } else { this.jAnim.mode = 'idle'; }
    }
    ctx.translate(startX + jWidth / 2, jY); ctx.scale(jScaleX, jScaleY);
    ctx.fillText(textJ, -jWidth / 2, 0); ctx.restore();

    // Render "olly Space Co"
    ctx.fillText(textMid, startX + midOffset, y);

    // Render "w"
    ctx.save();
    let wY = y, wRot = 0, wScaleX = 1;
    if (this.wAnim.mode === 'fall') {
      const p = (performance.now() - this.wAnim.start) / 1000;
      if (p <= 1.0) { const res = this.getFallParams(p, this.wAnim.fallDist); wY += res.ty * dpr; wRot = res.rot * Math.PI / 180; }
      else if (p <= 2.4) { wY += this.wAnim.fallDist * dpr; }
      else if (p <= 2.7) { wY += this.wAnim.fallDist * dpr; wScaleX = Math.cos((p - 2.4) / 0.3 * Math.PI / 2); }
      else if (p <= 2.8) { wY += this.wAnim.fallDist * dpr; wScaleX = 0; }
      else if (p <= 3.1) { wScaleX = Math.sin((p - 2.8) / 0.3 * Math.PI / 2); }
      else { this.wAnim.mode = 'idle'; }
    } else if (this.wAnim.mode === 'reverse') {
      const p = (performance.now() - this.wAnim.start) / 1000;
      if (p <= 1.0) { const res = this.getFallParams(p, this.wAnim.fallDist); wY += (this.wAnim.fallDist - res.ty) * dpr; wRot = -res.rot * Math.PI / 180; }
      else { this.wAnim.mode = 'idle'; }
    }
    ctx.translate(startX + wOffset + rightWidth / 2, wY); ctx.rotate(wRot); ctx.scale(wScaleX, 1);
    ctx.fillText(textRight, -rightWidth / 2, 0); ctx.restore();
    
    // 3. Composite WebGL onto Text
    ctx.globalCompositeOperation = 'source-in';
    // Optimization: Draw the lower-res WebGL canvas stretched to full size
    ctx.drawImage(this.webgl.canvas, 0, 0, this.canvas.width, this.canvas.height);
    ctx.globalCompositeOperation = 'source-over';
    
    requestAnimationFrame((t) => this.render(t));
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

  bindEvents() {
    window.addEventListener('click', (e) => this.handleClick(e));
    window.addEventListener('resize', () => this.handleResize());
  },

  handleClick(e) {
    if (!this.metrics.font || this.wAnim.mode === 'reverse') return;
    const dpr = this.metrics.dpr;
    const metrics = this.metrics;
    const mx = e.clientX * dpr, my = e.clientY * dpr;
    
    const rect = document.getElementById('seo-title').getBoundingClientRect();
    const fontSize = parseFloat(metrics.font.split(' ')[1]);
    const yCanvas = (rect.top + rect.height / 2) * dpr + (fontSize * 0.05);
    const startXCanvas = (rect.left + rect.width / 2) * dpr - (metrics.totalWidth / 2);

    const jWidth = metrics.textJ;
    const midOffset = metrics.midOffset;
    const wOffset = metrics.wOffset;
    const rightWidth = metrics.textRight;

    // --- J Hit Detection ---
    let curJY = yCanvas, curJSX = 1, curJSY = 1;
    if (this.jAnim.mode === 'jump') {
      const p = (performance.now() - this.jAnim.start) / 1000;
      if (p <= 0.9) { const res = this.getJumpParams(p / 0.9); curJY += res.ty * dpr; curJSX = res.sx; curJSY = res.sy; }
    }
    const hullJ = Physics.getTransformedHull(this.cachedHulls['J'], startXCanvas + jWidth / 2, curJY, curJSX, curJSY, 0, -jWidth / 2, 0);
    if (Physics.isPointInPolygon({x: mx, y: my}, hullJ)) {
      if (this.jAnim.mode === 'idle') {
        this.jAnim.mode = 'jump'; this.jAnim.start = performance.now();
        MrFinance.spawn();
      }
    }

    // --- w Hit Detection ---
    let curWY = yCanvas, curWRot = 0, curWSX = 1;
    if (this.wAnim.mode === 'fall') {
      const p = (performance.now() - this.wAnim.start) / 1000;
      if (p < 1.0 || p > 2.4) {} // ignore clicks during transition
      else { curWY += this.wAnim.fallDist * dpr; }
    }
    const hullW = Physics.getTransformedHull(this.cachedHulls['w'], startXCanvas + wOffset + rightWidth / 2, curWY, curWSX, 1, curWRot, -rightWidth / 2, 0);
    if (Physics.isPointInPolygon({x: mx, y: my}, hullW)) {
      this.handleWInteraction(yCanvas, fontSize);
    }
  },

  handleWInteraction(yCanvas, fontSize) {
    if (this.wAnim.mode === 'idle') {
      this.wAnim.mode = 'fall'; this.wAnim.start = performance.now();
      const baselineScreenY = yCanvas / this.metrics.dpr;
      this.wAnim.fallDist = window.innerHeight - baselineScreenY - (fontSize / this.metrics.dpr) * 0.3;
      
      clearTimeout(this.wAnim.timeout1); clearTimeout(this.wAnim.timeout2);
      this.wAnim.timeout1 = setTimeout(() => {
        this.shakeScreen();
        this.wAnim.timeout2 = setTimeout(() => { if(this.wAnim.mode === 'fall') this.wAnim.mode = 'idle'; }, 2500);
      }, 600);
    } else if (this.wAnim.mode === 'fall') {
      const p = (performance.now() - this.wAnim.start) / 1000;
      if (p >= 1.0 && p <= 2.4) {
        this.wAnim.mode = 'reverse'; this.wAnim.start = performance.now();
        clearTimeout(this.wAnim.timeout1); clearTimeout(this.wAnim.timeout2);
        this.wAnim.timeout1 = setTimeout(() => {
          this.shakeScreen();
          this.wAnim.timeout2 = setTimeout(() => { if(this.wAnim.mode === 'reverse') this.wAnim.mode = 'idle'; }, 400);
        }, 600);
      }
    }
  },

  shakeScreen() {
    document.body.style.transition = 'transform 0.05s';
    document.body.style.transform = 'translateY(-4px)';
    setTimeout(() => {
      document.body.style.transform = 'translateY(3px)';
      setTimeout(() => { document.body.style.transform = ''; }, 80);
    }, 50);
  }
};

// Start the engine when the script loads
TitleEngine.init();
