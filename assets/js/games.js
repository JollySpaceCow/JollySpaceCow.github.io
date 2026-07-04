/**
 * Jolly Space Cow - Games Logic
 * Manages interactive "games" and sequence scrubbers.
 */

(function() {
  const SCRUBBERS = [
    { id: 'beef', name: "Amber's Beef", folder: 'Beef', frames: 26, target: 'beef-scrubber-container' }
  ];

  const GameApp = {
    init() {
      this.initWideGame();
      this.initScrubbers();
    },

    /* ── WIDE = WISE (TOBLE EFFECT) ── */
    /* Credit: Adapted from the Toble slinky effect on onemillionpats.com featuring Tofu Chan */
    initWideGame() {
      const container = document.getElementById('toble-container');
      if (!container) return;

      const NUM_CIRCLES = 180;
      const MAX_RADIUS = 180;
      const FRICTION = 0.98;
      const SPEED_DIVISOR = 150;
      const WEIGHT_1 = 7.0;
      const WEIGHT_2 = 4.0;

      let loader;
      let imgTexture;
      let stage;
      let target;
      let renderer;
      let mouseDown = false;
      const circles = [];
      let sw = container.clientWidth || 400;
      let sh = container.clientHeight || 400;
      let mouseX = 0;
      let mouseY = 0;

      const mapVal = (val, in_min, in_max, out_min, out_max) => {
        return in_min === in_max ? out_min : (val - in_min) * (out_max - out_min) / (in_max - in_min) + out_min;
      };

      const resizeIt = () => {
        sw = container.clientWidth;
        sh = container.clientHeight;
        if (renderer) {
          renderer.resize(sw, sh);
          if (stage) {
            stage.hitArea = new PIXI.Rectangle(0, 0, sw, sh);
          }
        }
        if (target) {
          target.position.x = sw / 2;
          target.position.y = sh / 2;
        }
      };

      let lastTime = null;
      const TARGET_FPS = 60;
      const TARGET_FRAME_MS = 1000 / TARGET_FPS;

      const animate = (now) => {
        if (lastTime === null) lastTime = now;
        const delta = Math.min(now - lastTime, 50); // cap at 50ms to avoid huge jumps
        const factor = delta / TARGET_FRAME_MS;
        lastTime = now;

        for (let i = circles.length - 1; i >= 0; i--) {
          const circle = circles[i];
          circle.distX = Math.floor(circle.position.x - mouseX);
          circle.distY = Math.floor(circle.position.y - mouseY);
          circle.speedX += (circle.distX / SPEED_DIVISOR) * factor;
          circle.speedY += (circle.distY / SPEED_DIVISOR) * factor;
          circle.position.x -= circle.speedX * circle.weight * factor;
          circle.position.y -= circle.speedY * circle.weight * factor;
          circle.speedX *= Math.pow(FRICTION, factor);
          circle.speedY *= Math.pow(FRICTION, factor);
        }
        if (renderer && stage) {
          renderer.render(stage);
        }
        requestAnimationFrame(animate);
      };

      const addCircles = () => {
        imgTexture = PIXI.utils.TextureCache['assets/images/Amber.webp'];
        if (!imgTexture) return;

        for (let i = 0; i < NUM_CIRCLES; i++) {
          const radius = mapVal(i, 0, NUM_CIRCLES - 1, MAX_RADIUS, 12);
          const circleContainer = new PIXI.Container();
          const sprite = new PIXI.Sprite(imgTexture);
          sprite.anchor.x = sprite.anchor.y = 0.5;
          // All sprites scale to fill the largest circle — the mask handles the crop
          const fillDiameter = MAX_RADIUS * 2;
          const scale = fillDiameter / Math.min(imgTexture.width, imgTexture.height);
          sprite.scale.set(scale);
          circleContainer.addChild(sprite);

          const maskGraphics = new PIXI.Graphics();
          maskGraphics.beginFill(0xff0000);
          maskGraphics.drawCircle(0, 0, radius);
          maskGraphics.endFill();
          circleContainer.addChild(maskGraphics);
          sprite.mask = maskGraphics;

          circleContainer.speedX = 0;
          circleContainer.speedY = 0;
          circleContainer.distX = 0;
          circleContainer.distY = 0;
          circleContainer.weight = mapVal(i, 0, NUM_CIRCLES - 1, WEIGHT_1, WEIGHT_2);
          circleContainer.cacheAsBitmap = true;

          circles.push(circleContainer);
          target.addChild(circleContainer);
        }
        requestAnimationFrame(animate);
      };

      const onMouseDown = (e) => {
        mouseDown = true;
        container.style.cursor = 'grabbing';
        const localPos = e.data.getLocalPosition(stage);
        mouseX = localPos.x - sw / 2;
        mouseY = localPos.y - sh / 2;
      };

      const onMouseMove = (e) => {
        if (mouseDown) {
          const localPos = e.data.getLocalPosition(stage);
          mouseX = localPos.x - sw / 2;
          mouseY = localPos.y - sh / 2;
        }
      };

      const onMouseUp = () => {
        mouseDown = false;
        container.style.cursor = 'grab';
      };

      // Initialise PixiJS stage & renderer
      stage = new PIXI.Container();
      renderer = PIXI.autoDetectRenderer(sw, sh, { transparent: true });
      renderer.view.style.display = 'block';
      renderer.view.style.width = '100%';
      renderer.view.style.height = '100%';
      
      container.appendChild(renderer.view);

      stage.on('mousedown', onMouseDown);
      stage.on('touchstart', onMouseDown);
      stage.on('mousemove', onMouseMove);
      stage.on('touchmove', onMouseMove);
      stage.on('mouseup', onMouseUp);
      stage.on('touchend', onMouseUp);
      stage.interactive = true;
      stage.hitArea = new PIXI.Rectangle(0, 0, sw, sh);

      target = new PIXI.Container();
      target.position.x = sw / 2;
      target.position.y = sh / 2;
      stage.addChild(target);

      window.addEventListener('resize', resizeIt);
      resizeIt();

      loader = new PIXI.loaders.Loader();
      loader.add('assets/images/Amber.webp', 'assets/images/Amber.webp');
      loader.once('complete', addCircles);
      loader.load();
    },

    /* ── SCRUBBERS ── */
    initScrubbers() {
      SCRUBBERS.forEach((s, idx) => {
        const container = document.getElementById(s.target);
        if (!container) return;

        const firstFrame = `assets/images/sequences/${s.folder}/frame_0000.webp`;
        container.innerHTML = `
          <div class="scrub-card" style="border:none; border-radius:0; height: 100%; min-height: 400px; display: flex; flex-direction: column;">
            <div class="scrub-viewport" style="flex: 1; position: relative; overflow: hidden; background: #000; display: flex; align-items: center; justify-content: center; cursor: ew-resize;">
              <img src="${firstFrame}" alt="${s.name}" class="scrub-frame" id="scrub-img-${idx}" draggable="false" style="max-width: 100%; max-height: 100%; object-fit: contain;">
              <div class="scrub-counter" id="scrub-counter-${idx}">1 / ${s.frames}</div>
              <div class="scrub-progress" id="scrub-progress-${idx}"></div>
            </div>
            <div class="scrub-info" style="background: var(--bg-2); border-top: 1px solid var(--border);">
              <span class="scrub-title">${s.name}</span>
              <span class="scrub-hint" id="scrub-hint-${idx}">← slide to scrub →</span>
            </div>
          </div>`;

        const imgEl = document.getElementById(`scrub-img-${idx}`);
        const counter = document.getElementById(`scrub-counter-${idx}`);
        const progress = document.getElementById(`scrub-progress-${idx}`);
        const hint = document.getElementById(`scrub-hint-${idx}`);
        const viewport = container.querySelector('.scrub-viewport');

        if (!imgEl || !viewport) return;

        const updateTarget = (e) => {
          clearTimeout(idleTimer);
          isIdling = false;
          returnVelocity = 0.2;

          const rect = viewport.getBoundingClientRect();
          const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
          targetFrame = Math.min(Math.floor(x * s.frames), s.frames - 1);
          
          // If the distance is small (normal smooth scrubbing), stay instant
          // If it's a large jump (7+ frames), let the animation catch up
          if (Math.abs(targetFrame - currentFrame) < 7) {
            currentFrame = targetFrame;
            renderFrame(currentFrame);
          }
        };

        let currentFrame = 0;
        let targetFrame = 0;
        let lastTick = 0;
        let idleTimer = null;
        let isIdling = false;
        let returnVelocity = 0.2;

        const renderFrame = (f) => {
          const frameIdx = Math.max(0, Math.min(s.frames - 1, f));
          const frameStr = String(frameIdx).padStart(4, '0');
          imgEl.src = `assets/images/sequences/${s.folder}/frame_${frameStr}.webp`;
          if (counter) counter.textContent = `${frameIdx + 1} / ${s.frames}`;
          if (progress) progress.style.width = `${((frameIdx + 1) / s.frames) * 100}%`;
        };

        const animate = (timestamp) => {
          const delta = timestamp - lastTick;
          
          if (isIdling) {
            if (currentFrame > 0) {
              // Ease-In Return: Start slow, get faster
              currentFrame -= returnVelocity;
              returnVelocity *= 1.08; // Exponential acceleration
              renderFrame(Math.floor(currentFrame));
              if (hint) hint.textContent = 'IDLING...';
            } else {
              currentFrame = 0;
              renderFrame(0);
              if (hint) hint.textContent = 'RESTING';
            }
          } else {
            // Normal Catch-up logic (linear/fast)
            if (delta >= 8) { // 8ms tick for catch-up
              if (Math.abs(currentFrame - targetFrame) > 0.1) {
                if (currentFrame < targetFrame) currentFrame++;
                else currentFrame--;
                renderFrame(Math.round(currentFrame));
                if (hint) {
                  hint.textContent = 'CATCHING UP...';
                  hint.style.color = 'var(--accent)';
                }
              } else if (hint && hint.textContent === 'CATCHING UP...') {
                hint.textContent = 'MATCHED';
                hint.style.color = '';
              }
              lastTick = timestamp;
            }
          }
          requestAnimationFrame(animate);
        };

        requestAnimationFrame(animate);

        viewport.addEventListener('mousemove', updateTarget);
        viewport.addEventListener('mouseenter', updateTarget);
        
        viewport.addEventListener('mouseleave', () => {
          if (hint) {
            hint.textContent = 'IDLE IN 1s...';
            hint.style.color = '';
          }
          clearTimeout(idleTimer);
          idleTimer = setTimeout(() => {
            isIdling = true;
            targetFrame = 0;
          }, 1000);
        });

        imgEl.onerror = () => {
          if (hint) {
            hint.textContent = 'Error: Frame not found';
            hint.style.color = '#ff6b6b';
          }
        };
      });
    }
  };

  document.addEventListener('DOMContentLoaded', () => GameApp.init());
})();
