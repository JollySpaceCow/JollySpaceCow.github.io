/**
 * Jolly Space Cow - Sound Engine
 * Hooks into TitleEngine.triggerInteraction() and shakeScreen()
 * to play matching sound effects.
 */

const SoundEngine = {
  ctx: null,
  buffers: {},
  unlocked: false,

  // ll toggle state
  llToggle: false,

  // y + c pitch - random each click, subtle range
  yPitchMin: 0.9,
  yPitchMax: 1.1,
  cPitchMin: 0.9,
  cPitchMax: 1.1,

  // O spinning whoosh nodes (Web Audio, not a buffer)
  oSpinNodes: null,

  // Map each interaction to an audio file in /assets/audio/
  sounds: {
    J:         'Boing_SeResourceStd2nd_00001029.ogg',
    ll_a:      'Sound_effect_SeResourceStd2nd_00000267.ogg',
    ll_b:      'Sound_effect_SeResourceStd2nd_00000271.ogg',
    p_explode: 'Music_SeResourceStd2nd_00000133.ogg',
    p_return:  'Plop_SeResourceStd2nd_00000273.ogg',
    w_land:    'Bang_SeResourceStd2nd_00001014.ogg',
    S:         'Siren_SeResourceStd2nd_00001028.ogg',
    y:         'Whistling_Whistle_SeResourceStd2nd_00001034.ogg',
    c:         'Boing_SeResourceStd2nd_00001029.ogg',
    shake:     'Unknown_Sound_SeResourceStdSystem_00000133.ogg',
    moo:       'Moo.mp3',
    vineboom:  'vineboom.mp3',

    fin_head:  'Unknown_Sound_SeResourceStd2nd_00000836.ogg',
    fin_mid:   'Plop_SeResourceStd2nd_00000273.ogg',
    fin_legs:  'Plop_SeResourceStd2nd_00000837.ogg',
    fin_fall:  'Sound_effect_SeResourceStd2nd_00001033.ogg',
    fin_land:  'Bang_SeResourceStd2nd_00001014.ogg',
  },

  init() {
    const unlock = () => {
      if (this.unlocked) return;
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.unlocked = true;
      this.preload();
      window.removeEventListener('click', unlock);
      window.removeEventListener('keydown', unlock);
    };
    window.addEventListener('click', unlock);
    window.addEventListener('keydown', unlock);

    this.patchTitleEngine();
    this.patchMrFinance();
    console.log('🔊 Sound Engine Initialized');
  },

  async preload() {
    const base = 'assets/audio/';
    for (const [key, file] of Object.entries(this.sounds)) {
      try {
        const res = await fetch(base + file);
        if (!res.ok) { console.warn(`🔇 Missing: ${file}`); continue; }
        const arrayBuffer = await res.arrayBuffer();
        this.buffers[key] = await this.ctx.decodeAudioData(arrayBuffer);
      } catch (e) {
        console.warn(`🔇 Could not load sound "${key}": ${file}`, e);
      }
    }
    console.log('🔊 Sounds preloaded:', Object.keys(this.buffers));
  },

  play(key, volume = 1.0, pitch = 1.0) {
    if (!this.ctx || !this.buffers[key]) return;
    const source = this.ctx.createBufferSource();
    source.buffer = this.buffers[key];
    source.playbackRate.value = pitch;
    const gain = this.ctx.createGain();
    gain.gain.value = volume;
    source.connect(gain);
    gain.connect(this.ctx.destination);
    source.start(0);
  },

  // --- Procedural O spin sound ---
  // Drives an oscillator whose frequency and volume track oSwapState.omega
  startOSpin() {
    if (!this.ctx) return;
    this.stopOSpin();

    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = 150;

    const gain = this.ctx.createGain();
    gain.gain.value = 0;

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();

    this.oSpinNodes = { osc, gain };

    const drive = () => {
      if (!this.oSpinNodes) return;
      const state = TitleEngine.oSwapState;

      if (!state || !TitleEngine.oSwapping) {
        gain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.2);
        setTimeout(() => this.stopOSpin(), 600);
        return;
      }

      const omega = Math.abs(state.omega); // rad/s, starts ~6.8, decays to 0
      // Map omega (0–12) → freq (120–900 Hz) and volume (0–0.2)
      const freq = 120 + (omega / 12) * 780;
      const vol  = Math.min(omega / 12, 1) * 0.2;

      osc.frequency.setTargetAtTime(freq, this.ctx.currentTime, 0.04);
      gain.gain.setTargetAtTime(vol, this.ctx.currentTime, 0.04);

      requestAnimationFrame(drive);
    };

    requestAnimationFrame(drive);
  },

  stopOSpin() {
    if (!this.oSpinNodes) return;
    try {
      this.oSpinNodes.osc.stop();
      this.oSpinNodes.osc.disconnect();
      this.oSpinNodes.gain.disconnect();
    } catch (_) {}
    this.oSpinNodes = null;
  },

  // --- Mr Finance sounds ---
  // npc.js drives animations by setting the `animation-name` attribute on the
  // model-viewer element. We don't touch npc.js — just watch that attribute.
  patchMrFinance() {
    let finEl = null;
    let lastAnim = null;

    const animSoundMap = {
      'Receiving An Uppercut': () => SoundEngine.play('fin_head', 0.35),
      'Kidney Hit':            () => SoundEngine.play('fin_mid', 0.35),
      'Sweep Fall':            () => {
        SoundEngine.play('fin_legs', 0.35);
        // npc.js switches to falling_through 1500ms after Sweep Fall,
        // but doesn't update animation-name when it does — so we schedule
        // the fall sound to match that fixed delay.
        setTimeout(() => SoundEngine.play('fin_fall', 0.3), 1500);
      },
      'Falling':               () => SoundEngine.play('fin_fall', 0.3),
      'Falling Flat Impact':   () => SoundEngine.play('fin_land', 0.35),
    };

    const watchAttr = (el) => {
      const obs = new MutationObserver(() => {
        const anim = el.getAttribute('animation-name');
        if (anim !== lastAnim) {
          lastAnim = anim;
          if (animSoundMap[anim]) animSoundMap[anim]();
        }
      });
      obs.observe(el, { attributes: true, attributeFilter: ['animation-name'] });
    };

    // Watch for the model-viewer being added to the page (MrFinance.spawn())
    const bodyObs = new MutationObserver(() => {
      if (finEl) return;
      const el = document.querySelector('model-viewer[src*="FinanCharacter"]');
      if (el) {
        finEl = el;
        lastAnim = el.getAttribute('animation-name');
        watchAttr(el);
      }
    });
    bodyObs.observe(document.body, { childList: true, subtree: true });
  },

  patchTitleEngine() {
    const wait = setInterval(() => {
      if (typeof TitleEngine === 'undefined') return;
      clearInterval(wait);

      // --- triggerInteraction ---
      const origTrigger = TitleEngine.triggerInteraction.bind(TitleEngine);
      TitleEngine.triggerInteraction = (letter, yBase, fontSize) => {
        const char = letter.char;
        const idx  = letter.index;

        if (char === 'J' && idx === 0) {
          const pitch = 0.9 + Math.random() * 0.2;
          SoundEngine.play('J', 0.3, pitch);

        } else if (char === 'w') {
          // Sound plays on landing via shakeScreen patch, not on click

        } else if (char === 'p' && idx === 7) {
          const inPhysics = TitleEngine.interactiveLetters.some(l => l.anim.mode === 'physics');
          if (inPhysics) {
            SoundEngine.play('p_return', 0.3);
          } else {
            SoundEngine.play('p_explode', 0.3);
          }

        } else if (char === 'y') {
          const pitch = SoundEngine.yPitchMin + Math.random() * (SoundEngine.yPitchMax - SoundEngine.yPitchMin);
          SoundEngine.play('y', 0.3, pitch);

        } else if (char.toLowerCase() === 'o') {
          SoundEngine.startOSpin();

        } else if (char === 'l' && (idx === 2 || idx === 3)) {
          SoundEngine.llToggle = !SoundEngine.llToggle;
          SoundEngine.play(SoundEngine.llToggle ? 'll_a' : 'll_b', 0.3);

        } else if (char === 'c' && idx === 9) {
          const pitch = SoundEngine.cPitchMin + Math.random() * (SoundEngine.cPitchMax - SoundEngine.cPitchMin);
          SoundEngine.play('c', 0.3, pitch);

        } else if (char === 'S') {
          const pitch = 0.9 + Math.random() * 0.2;
          SoundEngine.play('S', 0.25, pitch);
        }

        origTrigger(letter, yBase, fontSize);
      };

      // --- handleWInteraction ---
      const origWInteraction = TitleEngine.handleWInteraction.bind(TitleEngine);
      TitleEngine.handleWInteraction = (letter, yCanvas, fontSize) => {
        const wasInFall = letter.anim.mode === 'fall';
        const p = (performance.now() - letter.anim.start) / 1000;
        const isClickingBackUp = wasInFall && p >= 1.0 && p <= 2.4;
        origWInteraction(letter, yCanvas, fontSize);
        if (isClickingBackUp) {
          setTimeout(() => SoundEngine.play('w_land', 0.3, 0.88), 600);
        }
      };

      // --- shakeScreen ---
      // Called by both w landing and p explosion — detect which by checking w mode
      const origShake = TitleEngine.shakeScreen.bind(TitleEngine);
      TitleEngine.shakeScreen = () => {
        const wIsFalling = TitleEngine.interactiveLetters.some(l => l.char === 'w' && (l.anim.mode === 'fall' || l.anim.mode === 'reverse'));
        if (wIsFalling) {
          SoundEngine.play('w_land', 0.3, 1.15);
        } else {
          SoundEngine.play('shake', 0.25);
        }
        origShake();
      };

      console.log('🔊 TitleEngine patched with sounds');
    }, 50);
  }
};

SoundEngine.init();
