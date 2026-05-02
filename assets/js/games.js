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

    /* ── WIDE = WISE ── */
    initWideGame() {
      let scale = 1.0;
      const wisdomWords = [
        'Expand its wisdom.', 'A little wide.', 'Getting there.', 'Notable width.',
        'Considerable wisdom.', 'Very wide. Very wise.', 'The cat knows things.',
        'Almost too wise.', 'Dangerously wide.', 'Maximum wisdom achieved.',
        'Beyond wisdom.', 'Everything.'
      ];

      const valEl = document.getElementById('wisdom-val');
      const msgEl = document.getElementById('wide-msg');
      const img = document.getElementById('wide-cat-img');
      const fb = document.getElementById('wide-fallback');
      const wrap = document.querySelector('.wide-cat-wrap');
      const resetBtn = document.querySelector('.btn-ghost');

      if (!wrap) return;

      const update = () => {
        const pct = Math.round((scale - 1) / 3.5 * 100);
        if (img) img.style.transform = `scaleX(${scale})`;
        if (fb) fb.style.transform = `scaleX(${scale})`;
        if (valEl) valEl.textContent = pct + '%';
        const idx = Math.min(Math.floor(pct / 10), wisdomWords.length - 1);
        if (msgEl) msgEl.textContent = wisdomWords[idx];
      };

      wrap.addEventListener('click', () => {
        scale = Math.min(scale + 0.12, 4.5);
        update();
      });

      if (resetBtn) {
        resetBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          scale = 1.0;
          update();
        });
      }
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
