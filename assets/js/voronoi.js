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

window.addEventListener('resize', updateMetrics);
updateMetrics();

function render(time) {
  if (!seoTitle) return;
  
  const rect = seoTitle.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  
  if (visibleCanvas.width !== Math.floor(rect.width * dpr) || visibleCanvas.height !== Math.floor(rect.height * dpr)) {
    visibleCanvas.width = rect.width * dpr;
    visibleCanvas.height = rect.height * dpr;
    visibleCanvas.style.width = rect.width + 'px';
    visibleCanvas.style.height = rect.height + 'px';
    
    webglCanvas.width = visibleCanvas.width;
    webglCanvas.height = visibleCanvas.height;
    gl.viewport(0, 0, webglCanvas.width, webglCanvas.height);
    updateMetrics(); // Ensure font scales with container
  }
  
  gl.uniform1f(timeLoc, time * 0.001);
  gl.uniform2f(resLoc, webglCanvas.width, webglCanvas.height);
  gl.drawArrays(gl.TRIANGLES, 0, 6);
  
  ctx.clearRect(0, 0, visibleCanvas.width, visibleCanvas.height);
  ctx.font = cachedFont;
  ctx.letterSpacing = cachedSpacing;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';
  ctx.fillStyle = '#fff';
  
  const fontSize = parseFloat(cachedFont.split(' ')[1]);
  ctx.fillText("Jolly Space Cow", visibleCanvas.width / 2, (visibleCanvas.height / 2) + (fontSize * 0.05));
  
  ctx.globalCompositeOperation = 'source-in';
  ctx.drawImage(webglCanvas, 0, 0);
  ctx.globalCompositeOperation = 'source-over';
  
  requestAnimationFrame(render);
}
requestAnimationFrame(render);
