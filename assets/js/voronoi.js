const visibleCanvas = document.getElementById('voronoi-canvas');
const ctx = visibleCanvas.getContext('2d');

const webglCanvas = document.createElement('canvas');
const gl = webglCanvas.getContext('webgl');

const vs = `
  attribute vec2 position;
  void main() {
    gl_Position = vec4(position, 0.0, 1.0);
  }
`;

const fs = `
  precision mediump float;
  uniform float u_time;
  uniform vec2 u_resolution;

  vec3 hash33(vec3 p) {
    p = vec3(dot(p, vec3(127.1, 311.7, 74.7)),
             dot(p, vec3(269.5, 183.3, 246.1)),
             dot(p, vec3(113.5, 271.9, 124.6)));
    return fract(sin(p) * 43758.5453123);
  }

  float voronoi(vec3 x) {
    vec3 p = floor(x);
    vec3 f = fract(x);
    float res = 100.0;
    for (int k = -1; k <= 1; k++) {
      for (int j = -1; j <= 1; j++) {
        for (int i = -1; i <= 1; i++) {
          vec3 b = vec3(float(i), float(j), float(k));
          vec3 r = vec3(b) - f + hash33(p + b);
          float d = dot(r, r);
          if (d < res) res = d;
        }
      }
    }
    return sqrt(res);
  }

  void main() {
    vec2 st = gl_FragCoord.xy / u_resolution.y;
    float t = u_time;
    
    // Layer 1: Large, slow-drifting cells
    float v1 = voronoi(vec3(st * 3.5 + vec2(t * 0.08, t * 0.06), t * 0.25));
    
    // Layer 2: Medium cells, opposite drift
    float v2 = voronoi(vec3(st * 5.0 - vec2(t * 0.12, t * -0.07), t * 0.35 + 50.0));
    
    // Layer 3: Fine detail layer for crystalline sparkle
    float v3 = voronoi(vec3(st * 8.0 + vec2(t * 0.05, t * 0.1), t * 0.2 + 200.0));
    
    // Sharp caustic edges — high power isolates the bright ridges
    float edge1 = pow(v1 * 1.4, 5.0);
    float edge2 = pow(v2 * 1.3, 4.0);
    float edge3 = pow(v3 * 1.2, 3.5);
    
    // Combine layers — additive blending creates brilliant intersection nodes
    float caustic = (edge1 + edge2 * 0.8 + edge3 * 0.35) * 0.7;
    
    // Bloom/glow pass — softened version for a luminous halo
    float glow = (pow(v1 * 1.1, 2.0) + pow(v2 * 1.0, 2.0)) * 0.25;
    
    caustic = clamp(caustic, 0.0, 1.0);
    glow = clamp(glow, 0.0, 1.0);
    
    // Rich saturated base blue → icy cyan → brilliant white
    vec3 deepBlue = vec3(0.08, 0.42, 0.95);
    vec3 icyCyan  = vec3(0.45, 0.82, 1.0);
    vec3 white    = vec3(1.0, 1.0, 1.0);
    
    // Two-stage gradient: deep blue base → icy cyan in mid-tones → white at caustic peaks
    vec3 color = mix(deepBlue, icyCyan, glow);
    color = mix(color, white, caustic);
    
    // Boost overall brightness/luminosity for that glowing gem look
    color = color * 1.1 + vec3(0.02, 0.04, 0.08);
    color = clamp(color, 0.0, 1.0);
    
    gl_FragColor = vec4(color, 1.0);
  }
`;

function compileShader(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  return shader;
}

const program = gl.createProgram();
gl.attachShader(program, compileShader(gl, gl.VERTEX_SHADER, vs));
gl.attachShader(program, compileShader(gl, gl.FRAGMENT_SHADER, fs));
gl.linkProgram(program);
gl.useProgram(program);

const positionBuffer = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
  -1, -1,  1, -1,  -1,  1,
  -1,  1,  1, -1,   1,  1
]), gl.STATIC_DRAW);

const positionLocation = gl.getAttribLocation(program, "position");
gl.enableVertexAttribArray(positionLocation);
gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

const timeLoc = gl.getUniformLocation(program, "u_time");
const resLoc = gl.getUniformLocation(program, "u_resolution");

const seoTitle = document.getElementById('seo-title');
let cachedFont = '';
let cachedSpacing = '0px';

function updateMetrics() {
  if (!seoTitle) return;
  const dpr = window.devicePixelRatio || 1;
  const comp = window.getComputedStyle(seoTitle);
  const fontSize = parseFloat(comp.fontSize) * dpr;
  cachedFont = `${comp.fontWeight} ${fontSize}px ${comp.fontFamily}`;
  const letterSpacingPx = parseFloat(comp.letterSpacing);
  cachedSpacing = isNaN(letterSpacingPx) ? '0px' : (letterSpacingPx * dpr) + 'px';
}

function render(time) {
  if (!seoTitle) return;
  
  const rect = seoTitle.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  
  if (visibleCanvas.width !== Math.floor(window.innerWidth * dpr) || visibleCanvas.height !== Math.floor(window.innerHeight * dpr)) {
    if (visibleCanvas.parentElement !== document.body) {
      document.body.appendChild(visibleCanvas);
    }
    visibleCanvas.style.position = 'fixed';
    visibleCanvas.style.top = '0px';
    visibleCanvas.style.left = '0px';
    visibleCanvas.style.zIndex = '50';
    visibleCanvas.style.pointerEvents = 'none';
    
    visibleCanvas.width = window.innerWidth * dpr;
    visibleCanvas.height = window.innerHeight * dpr;
    visibleCanvas.style.width = window.innerWidth + 'px';
    visibleCanvas.style.height = window.innerHeight + 'px';
    
    webglCanvas.width = visibleCanvas.width;
    webglCanvas.height = visibleCanvas.height;
    gl.viewport(0, 0, webglCanvas.width, webglCanvas.height);
    updateMetrics(); // Ensure font scales with container
  }
  
  gl.uniform1f(timeLoc, time * 0.001);
  // Pass rect.height * dpr for Y to preserve the original texture scale!
  gl.uniform2f(resLoc, webglCanvas.width, rect.height * dpr);
  gl.drawArrays(gl.TRIANGLES, 0, 6);
  
  ctx.clearRect(0, 0, visibleCanvas.width, visibleCanvas.height);
  ctx.font = cachedFont;
  ctx.letterSpacing = cachedSpacing;
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#fff';
  
  const fontSize = parseFloat(cachedFont.split(' ')[1]);
  const y = (rect.top + rect.height / 2) * dpr + (fontSize * 0.05);
  
  const textJ = "J";
  const textMid = "olly Space Co";
  const textRight = "w";
  
  ctx.textAlign = 'left';
  const totalWidth = ctx.measureText(textJ + textMid + textRight).width;
  const jWidth = ctx.measureText(textJ).width;
  const midWidth = ctx.measureText(textMid).width;
  const rightWidth = ctx.measureText(textRight).width;
  
  const startX = (rect.left + rect.width / 2) * dpr - (totalWidth / 2);

  ctx.save();
  let jY = y;
  let jScaleX = 1;
  let jScaleY = 1;

  if (jAnimMode === 'jump') {
      const p = (performance.now() - jAnimStart) / 1000;
      if (p <= 0.9) {
          const res = getJumpParams(p / 0.9);
          jY += res.ty * dpr;
          jScaleX = res.sx;
          jScaleY = res.sy;
      } else {
          jAnimMode = 'idle';
      }
  }

  ctx.translate(startX + jWidth / 2, jY);
  ctx.scale(jScaleX, jScaleY);
  ctx.fillText(textJ, -jWidth / 2, 0);
  ctx.restore();

  ctx.fillText(textMid, startX + jWidth, y);

  ctx.save();
  let wY = y;
  let wRot = 0;
  let wScaleX = 1;
  
  if (wAnimMode === 'fall') {
      const p = (performance.now() - wAnimStart) / 1000;
      let ty = 0;
      let rot = 0;
      
      if (p <= 1.0) {
          const res = getFallParams(p, wFallDist);
          ty = res.ty; rot = res.rot;
      } else if (p <= 2.4) {
          ty = wFallDist;
          rot = 0;
      } else if (p <= 2.7) {
          ty = wFallDist;
          rot = 0;
          let flipP = (p - 2.4) / 0.3;
          wScaleX = Math.cos(flipP * Math.PI / 2);
      } else if (p <= 2.8) {
          ty = wFallDist;
          rot = 0;
          wScaleX = 0;
      } else if (p <= 3.1) {
          ty = 0;
          rot = 0;
          let flipP = (p - 2.8) / 0.3;
          wScaleX = Math.sin(flipP * Math.PI / 2);
      } else {
          wAnimMode = 'idle';
      }
      wY += ty * dpr;
      wRot = rot * Math.PI / 180;
  } else if (wAnimMode === 'reverse') {
      const p = (performance.now() - wAnimStart) / 1000;
      let ty = 0;
      let rot = 0;
      if (p <= 1.0) {
          const res = getFallParams(p, wFallDist);
          ty = wFallDist - res.ty;
          rot = -res.rot;
      } else {
          wAnimMode = 'idle';
      }
      wY += ty * dpr;
      wRot = rot * Math.PI / 180;
  }
  
  ctx.translate(startX + jWidth + midWidth + rightWidth / 2, wY);
  ctx.rotate(wRot);
  ctx.scale(wScaleX, 1);
  ctx.fillText(textRight, -rightWidth / 2, 0);
  ctx.restore();
  
  ctx.globalCompositeOperation = 'source-in';
  ctx.drawImage(webglCanvas, 0, 0);
  ctx.globalCompositeOperation = 'source-over';
  
  requestAnimationFrame(render);
}
requestAnimationFrame(render);

function getFallParams(p, fallDist) {
    let ty = 0;
    let rot = 0;
    if (p <= 0.6) {
        let t = p / 0.6;
        t = t * t * t;
        ty = t * fallDist;
        rot = -3 + t * 7;
    } else if (p <= 0.75) {
        let t = (p - 0.6) / 0.15;
        t = t * t;
        ty = fallDist - t * 24;
        rot = 4 - t * 6;
    } else if (p <= 0.88) {
        let t = (p - 0.75) / 0.13;
        t = t * t;
        ty = (fallDist - 24) + t * 24;
        rot = -2 + t * 4;
    } else {
        let t = (p - 0.88) / 0.12;
        ty = fallDist;
        rot = 2 - t * 2;
    }
    return {ty, rot};
}

function getJumpParams(t) {
    let ty = 0, sx = 1, sy = 1;
    if (t <= 0.25) {
        let p = t / 0.25; p = Math.sin(p * Math.PI / 2);
        ty = -90 * p; sx = 1 - 0.1 * p; sy = 1 + 0.1 * p;
    } else if (t <= 0.5) {
        let p = (t - 0.25) / 0.25; p = 1 - Math.cos(p * Math.PI / 2);
        ty = -90 * (1 - p); sx = 0.9 + 0.4 * p; sy = 1.1 - 0.4 * p;
    } else if (t <= 0.65) {
        let p = (t - 0.5) / 0.15; p = Math.sin(p * Math.PI / 2);
        ty = -30 * p; sx = 1.3 - 0.35 * p; sy = 0.7 + 0.35 * p;
    } else if (t <= 0.8) {
        let p = (t - 0.65) / 0.15; p = 1 - Math.cos(p * Math.PI / 2);
        ty = -30 * (1 - p); sx = 0.95 + 0.15 * p; sy = 1.05 - 0.15 * p;
    } else {
        let p = (t - 0.8) / 0.2; p = Math.sin(p * Math.PI / 2);
        ty = 0; sx = 1.1 - 0.1 * p; sy = 0.9 + 0.1 * p;
    }
    return {ty, sx, sy};
}

let wAnimMode = 'idle';
let wAnimStart = 0;
let wFallDist = 0;
let wTimeout1 = null;
let wTimeout2 = null;

let jAnimMode = 'idle';
let jAnimStart = 0;

window.addEventListener('click', (e) => {
  if (!cachedFont || wAnimMode === 'reverse') return;
  if (wAnimMode === 'fall') {
      const p = (performance.now() - wAnimStart) / 1000;
      if (p < 1.0 || p > 2.4) return;
  }
  
  const seoTitle = document.getElementById('seo-title');
  if (!seoTitle) return;
  const rect = seoTitle.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  
  ctx.font = cachedFont;
  ctx.letterSpacing = cachedSpacing;
  
  const textJ = "J";
  const textMid = "olly Space Co";
  const textRight = "w";
  
  const totalWidth = ctx.measureText(textJ + textMid + textRight).width;
  const jWidth = ctx.measureText(textJ).width;
  const midWidth = ctx.measureText(textMid).width;
  const rightWidth = ctx.measureText(textRight).width;
  
  const startXCanvas = (rect.left + rect.width / 2) * dpr - (totalWidth / 2);
  const fontSize = parseFloat(cachedFont.split(' ')[1]);
  const yCanvas = (rect.top + rect.height / 2) * dpr + (fontSize * 0.05);
  
  let wTopCanvas = yCanvas - fontSize * 0.5;
  let wBottomCanvas = yCanvas + fontSize * 0.5;
  
  if (wAnimMode === 'fall') {
      wTopCanvas += wFallDist * dpr;
      wBottomCanvas += wFallDist * dpr;
  }
  
  const wLeftCanvas = startXCanvas + jWidth + midWidth;
  const wRightCanvas = wLeftCanvas + rightWidth;
  
  const wLeftClient = wLeftCanvas / dpr;
  const wRightClient = wRightCanvas / dpr;
  const wTopClient = wTopCanvas / dpr;
  const wBottomClient = wBottomCanvas / dpr;
  
  const wCenterX = (wLeftClient + wRightClient) / 2;
  const wCenterY = (wTopClient + wBottomClient) / 2;
  const wDx = e.clientX - wCenterX;
  const wDy = e.clientY - wCenterY;
  
  const inBoxW = (e.clientX >= wLeftClient - 20 && e.clientX <= wRightClient + 20 &&
                 e.clientY >= wTopClient - 20 && e.clientY <= wBottomClient + 20);

  let jTopCanvas = yCanvas - fontSize * 0.5;
  let jBottomCanvas = yCanvas + fontSize * 0.5;
  
  const jLeftCanvas = startXCanvas;
  const jRightCanvas = startXCanvas + jWidth;
  
  const jLeftClient = jLeftCanvas / dpr;
  const jRightClient = jRightCanvas / dpr;
  const jTopClient = jTopCanvas / dpr;
  const jBottomClient = jBottomCanvas / dpr;
  
  const jCenterX = (jLeftClient + jRightClient) / 2;
  const jCenterY = (jTopClient + jBottomClient) / 2;
  const jDx = e.clientX - jCenterX;
  const jDy = e.clientY - jCenterY;
  
  const inBoxJ = (e.clientX >= jLeftClient - 20 && e.clientX <= jRightClient + 20 &&
                 e.clientY >= jTopClient - 20 && e.clientY <= jBottomClient + 20);

  if (inBoxW || (wDx * wDx + wDy * wDy < 70 * 70)) {
      if (wAnimMode === 'idle') {
          wAnimMode = 'fall';
          wAnimStart = performance.now();
          const baselineScreenY = yCanvas / dpr;
          wFallDist = window.innerHeight - baselineScreenY - (fontSize / dpr) * 0.3;
          
          clearTimeout(wTimeout1); clearTimeout(wTimeout2);
          wTimeout1 = setTimeout(()=>{
            document.body.style.transition='transform 0.05s';
            document.body.style.transform='translateY(-4px)';
            setTimeout(()=>{document.body.style.transform='translateY(3px)';
              setTimeout(()=>{document.body.style.transform='';},80);
            },50);
            wTimeout2 = setTimeout(()=>{
              if(wAnimMode === 'fall') wAnimMode = 'idle';
            },2500);
          },600);
      } else if (wAnimMode === 'fall') {
          wAnimMode = 'reverse';
          wAnimStart = performance.now();
          
          clearTimeout(wTimeout1); clearTimeout(wTimeout2);
          wTimeout1 = setTimeout(()=>{
            document.body.style.transition='transform 0.05s';
            document.body.style.transform='translateY(-4px)';
            setTimeout(()=>{document.body.style.transform='translateY(3px)';
              setTimeout(()=>{document.body.style.transform='';},80);
            },50);
            wTimeout2 = setTimeout(()=>{
              if(wAnimMode === 'reverse') wAnimMode = 'idle';
            },400);
          },600);
      }
  }

  if (inBoxJ || (jDx * jDx + jDy * jDy < 70 * 70)) {
      if (jAnimMode === 'idle') {
          jAnimMode = 'jump';
          jAnimStart = performance.now();
          
          if (!window.mrFinanceSpawned) {
              window.mrFinanceSpawned = true;
              setTimeout(spawnMrFinanceNPC, 800);
          }
      }
  }
});

function spawnMrFinanceNPC() {
    if (!document.querySelector('script[src*="model-viewer"]')) {
        const script = document.createElement('script');
        script.type = 'module';
        script.src = 'https://ajax.googleapis.com/ajax/libs/model-viewer/3.4.0/model-viewer.min.js';
        document.head.appendChild(script);
    }

    const fin = document.createElement('model-viewer');
    fin.setAttribute('src', 'assets/3d/FinanCharacter34BakermanGrooving.glb');
    fin.setAttribute('autoplay', 'true');
    fin.setAttribute('animation-name', 'Idle');
    fin.setAttribute('orientation', '0deg 0deg 0deg');
    fin.style.position = 'fixed';
    fin.style.bottom = '0px';
    fin.style.left = '0px';
    fin.style.width = '150px';
    fin.style.height = '150px';
    fin.style.zIndex = '500';
    fin.style.cursor = 'crosshair';
    document.body.appendChild(fin);

    let state = 'idle';
    let x = 50;
    let y = 0;
    let facingRight = true;
    let stateTimer = null;
    let walkSpeed = 120;
    let lastTime = performance.now();

    function setState(newState, animName, orientation) {
        state = newState;
        fin.setAttribute('animation-name', animName);
        if (orientation !== undefined) {
            fin.setAttribute('orientation', orientation);
        }
        if (stateTimer) clearTimeout(stateTimer);
    }

    function loop(time) {
        if (!fin.isConnected) return;
        let dt = (time - lastTime) / 1000;
        lastTime = time;
        if (dt > 0.1) dt = 0.1;

        if (state === 'walk') {
            if (facingRight) {
                x += walkSpeed * dt;
                if (x > window.innerWidth + 100) {
                    x = -150;
                }
            } else {
                x -= walkSpeed * dt;
                if (x < -150) {
                    x = window.innerWidth + 100;
                }
            }
        } else if (state === 'falling_through') {
            y += 300 * dt;
            if (y > 250) {
                y = -window.innerHeight + 150;
                setState('hanging', 'Hanging Idle', '0deg 0deg 0deg');
                stateTimer = setTimeout(() => {
                    setState('falling_from_ceiling', 'Falling', '0deg 0deg 0deg');
                }, 4000);
            }
        } else if (state === 'falling_from_ceiling') {
            y += 500 * dt;
            if (y >= 0) {
                y = 0;
                setState('impact', 'Falling Flat Impact', '0deg 0deg 0deg');
                stateTimer = setTimeout(() => {
                    setState('idle', 'Idle', '0deg 0deg 0deg');
                    think();
                }, 2000);
            }
        }
        
        fin.style.transform = `translateX(${x}px) translateY(${y}px)`;
        requestAnimationFrame(loop);
    }
    requestAnimationFrame(loop);

    function think() {
        if (state === 'idle' || state === 'walk') {
            const rand = Math.random();
            if (rand < 0.2) {
                setState('idle', Math.random() > 0.5 ? 'Idle' : 'Dancing Twerk', '0deg 0deg 0deg');
                stateTimer = setTimeout(think, 3000 + Math.random() * 4000);
            } else if (rand < 0.7) {
                facingRight = Math.random() > 0.5;
                setState('walk', 'Walking', facingRight ? '0deg 0deg 90deg' : '0deg 0deg -90deg');
                stateTimer = setTimeout(think, 4000 + Math.random() * 5000);
            } else if (rand < 0.85) {
                setState('falling_through', 'Falling', '0deg 0deg 0deg');
            } else {
                setState('idle', 'Sad Idle', '0deg 0deg 0deg');
                stateTimer = setTimeout(think, 3000);
            }
        }
    }
    
    stateTimer = setTimeout(think, 2000);

    fin.addEventListener('pointerdown', (e) => {
        if (state === 'falling_through' || state === 'falling_from_ceiling' || state === 'hanging' || state === 'impact') return;
        
        const rect = fin.getBoundingClientRect();
        const clickY = e.clientY - rect.top;
        
        if (clickY < 50) {
            setState('punched', 'Receiving An Uppercut', '0deg 0deg 0deg');
        } else if (clickY < 100) {
            setState('punched', 'Kidney Hit', '0deg 0deg 0deg');
        } else {
            setState('punched', 'Sweep Fall', '0deg 0deg 0deg');
        }
        
        stateTimer = setTimeout(() => {
            setState('idle', 'Idle', '0deg 0deg 0deg');
            think();
        }, 1500);
    });
}

