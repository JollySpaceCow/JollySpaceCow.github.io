/**
 * Jolly Space Cow - Games Logic
 * Manages interactive "games" and sequence scrubbers.
 */

(function() {
  const SCRUBBERS = [{ name: 'Beef', frames: 26 }];

  const GameApp = {
    init() {
      this.initPatGame();
      this.initWideGame();
      this.initScrubbers();
    },

    /* ── PAT THE CAT ── */
    initPatGame() {
      let pats = parseInt(localStorage.getItem('jsc_pats') || '0');
      const msgs = [
        'Awaiting pats.', 'Good.', 'More.', 'The cat approves.', 
        'Keep going.', 'Outstanding.', 'The cat is pleased.', 
        'Incredible form.', 'You pat with great skill.', 
        'The cat vibrates with joy.', 'Transcendent patting.', 'You have ascended.'
      ];

      const countEl = document.getElementById('pat-count');
      const msgEl = document.getElementById('pat-msg');
      const btn = document.getElementById('cat-btn');
      if (!btn) return;

      const updateDisplay = () => {
        countEl.textContent = pats.toLocaleString();
        const idx = Math.min(Math.floor(Math.log2(pats + 1)), msgs.length - 1);
        msgEl.textContent = msgs[idx];
        localStorage.setItem('jsc_pats', pats);
      };

      btn.addEventListener('click', (e) => {
        pats++;
        updateDisplay();

        // Ripple effect
        const rect = btn.getBoundingClientRect();
        const rip = document.createElement('div');
        rip.className = 'ripple';
        const size = 40;
        rip.style.cssText = `width:${size}px;height:${size}px;left:${e.clientX - rect.left - size/2}px;top:${e.clientY - rect.top - size/2}px;`;
        btn.appendChild(rip);
        setTimeout(() => rip.remove(), 500);

        // Shake effect
        btn.style.transform = `rotate(${(Math.random() - 0.5) * 8}deg) scale(1.05)`;
        setTimeout(() => { btn.style.transform = ''; btn.style.transition = 'transform 0.3s ease'; }, 100);

        // Float number
        const fl = document.createElement('div');
        fl.className = 'float-num';
        fl.textContent = '+1';
        fl.style.cssText = `left:${e.clientX - 12}px;top:${e.clientY - 20}px;`;
        document.body.appendChild(fl);
        setTimeout(() => fl.remove(), 800);
      });

      updateDisplay();
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
      const resetBtn = document.querySelector('[onclick="resetWide()"]'); // We'll replace this listener

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
        resetBtn.removeAttribute('onclick'); // Clean up old attribute
        resetBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          scale = 1.0;
          update();
        });
      }
    },

    /* ── SCRUBBERS ── */
    initScrubbers() {
      const grid = document.getElementById('scrub-grid');
      if (!grid) return;

      grid.innerHTML = SCRUBBERS.map((s, idx) => {
        const firstFrame = `assets/images/sequences/${s.name}/frame_001.webp`;
        return `
          <div class="scrub-card" data-index="${idx}">
            <img src="${firstFrame}" alt="${s.name}" class="scrub-frame" id="scrub-img-${idx}" draggable="false">
            <div class="scrub-counter" id="scrub-counter-${idx}">1 / ${s.frames}</div>
            <div class="scrub-progress" id="scrub-progress-${idx}"></div>
            <div class="scrub-info">
              <span class="scrub-title">${s.name}</span>
              <span class="scrub-hint">← hover to scrub →</span>
            </div>
          </div>`;
      }).join('');

      SCRUBBERS.forEach((s, idx) => {
        const frames = [];
        for (let i = 1; i <= s.frames; i++) {
          const img = new Image();
          img.src = `assets/images/sequences/${s.name}/frame_${String(i).padStart(3, '0')}.webp`;
          frames.push(img);
        }

        const card = document.querySelector(`[data-index="${idx}"]`);
        const imgEl = document.getElementById(`scrub-img-${idx}`);
        const counter = document.getElementById(`scrub-counter-${idx}`);
        const progress = document.getElementById(`scrub-progress-${idx}`);

        card.addEventListener('mousemove', e => {
          const rect = card.getBoundingClientRect();
          const x = (e.clientX - rect.left) / rect.width;
          const frameIdx = Math.min(Math.floor(x * s.frames), s.frames - 1);
          if (frames[frameIdx].complete) imgEl.src = frames[frameIdx].src;
          counter.textContent = `${frameIdx + 1} / ${s.frames}`;
          progress.style.width = `${((frameIdx + 1) / s.frames) * 100}%`;
        });

        card.addEventListener('mouseleave', () => {
          imgEl.src = frames[0].src;
          counter.textContent = `1 / ${s.frames}`;
          progress.style.width = '0%';
        });
      });
    }
  };

  document.addEventListener('DOMContentLoaded', () => GameApp.init());
})();
