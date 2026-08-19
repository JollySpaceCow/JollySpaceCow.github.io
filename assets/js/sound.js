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
    J:              'Boing_SeResourceStd2nd_00001029.ogg',
    ll_a:           'Sound_effect_SeResourceStd2nd_00000267.ogg',
    ll_b:           'Sound_effect_SeResourceStd2nd_00000271.ogg',
    p_explode:      'Music_SeResourceStd2nd_00000133.ogg',
    p_return:       'Plop_SeResourceStd2nd_00000273.ogg',
    w_land:         'Bang_SeResourceStd2nd_00001014.ogg',
    S:              'Siren_SeResourceStd2nd_00001028.ogg',
    y:              'Whistling_Whistle_SeResourceStd2nd_00001034.ogg',
    c:              'Boing_SeResourceStd2nd_00001029.ogg',
    shake:          'Unknown_Sound_SeResourceStdSystem_00000133.ogg',
    pop:            'Plop_SeResourceStd2nd_00000273.ogg',
    moo:            'Moo.mp3',
    vineboom:       'vineboom.mp3',
    bup:            'Bup.mp3',
    bell:           'Bell_SeResourceStdSystem_00000134.ogg',
    bicycle_bell:   'Bicycle_bell_Bell_SeResourceStd2nd_00000237.ogg',
    boing_281:      'Boing_SeResourceStd2nd_00000281.ogg',
    boing_282:      'Boing_SeResourceStd2nd_00000282.ogg',
    boing_303:      'Boing_SeResourceStd2nd_00000303.ogg',
    boing_1040:     'Boing_Sound_effect_SeResourceStd2nd_00001040.ogg',
    clang:          'Clang_SeResourceStd2nd_00000231.ogg',
    coin:           'Coin_(dropping)_SeResourceStd2nd_00000270.ogg',
    plop_275:       'Plop_SeResourceStd2nd_00000275.ogg',
    plop_837:       'Plop_SeResourceStd2nd_00000837.ogg',
    se_274:         'Sound_effect_SeResourceStd2nd_00000274.ogg',
    se_1030:        'Sound_effect_SeResourceStd2nd_00001030.ogg',
    se_1031:        'Sound_effect_SeResourceStd2nd_00001031.ogg',
    se_1033:        'Sound_effect_SeResourceStd2nd_00001033.ogg',
    car_horn:       'Sound_effect_Vehicle_horn_car_horn_honking_SeResourceStd2nd_00000272.ogg',
    unknown_232:    'Unknown_Sound_SeResourceStd2nd_00000232.ogg',
    unknown_233:    'Unknown_Sound_SeResourceStd2nd_00000233.ogg',
    unknown_836:    'Unknown_Sound_SeResourceStd2nd_00000836.ogg',
    unknown_1015:   'Unknown_Sound_SeResourceStd2nd_00001015.ogg',
    unknown_1032:   'Unknown_Sound_SeResourceStd2nd_00001032.ogg',
    unknown_1035:   'Unknown_Sound_SeResourceStd2nd_00001035.ogg',
    unknown_1036:   'Unknown_Sound_SeResourceStd2nd_00001036.ogg',
    unknown_1037:   'Unknown_Sound_SeResourceStd2nd_00001037.ogg',
    unknown_1038:   'Unknown_Sound_SeResourceStd2nd_00001038.ogg',
    unknown_1039:   'Unknown_Sound_SeResourceStd2nd_00001039.ogg',
    unknown_1041:   'Unknown_Sound_SeResourceStd2nd_00001041.ogg',

    fin_head:       'Unknown_Sound_SeResourceStd2nd_00000836.ogg',
    fin_mid:        'Plop_SeResourceStd2nd_00000273.ogg',
    fin_legs:       'Plop_SeResourceStd2nd_00000837.ogg',
    fin_fall:       'Sound_effect_SeResourceStd2nd_00001033.ogg',
    fin_land:       'Bang_SeResourceStd2nd_00001014.ogg',
  },

  init() {
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.unlocked = true;
    this.preload();

    const resume = () => {
      if (this.ctx.state === 'suspended') this.ctx.resume();
    };
    window.addEventListener('click', resume);
    window.addEventListener('keydown', resume);
    window.addEventListener('pointerdown', resume);
    document.addEventListener('pointerdown', resume, true);

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
    if (this.ctx.state === 'suspended') this.ctx.resume();
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
  startOSpin() {
    if (!this.ctx) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();
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

      const omega = Math.abs(state.omega);
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
  patchMrFinance() {
    let finEl = null;
    let lastAnim = null;

    const animSoundMap = {
      'Receiving An Uppercut': () => SoundEngine.play('fin_head', 0.35),
      'Kidney Hit':            () => SoundEngine.play('fin_mid', 0.35),
      'Sweep Fall':            () => {
        SoundEngine.play('fin_legs', 0.35);
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
          // No sound on click itself — crash-down and return-up sounds play
          // via the shakeScreen patch below, at the exact moment each happens.
          // Additionally: if this click starts a fresh fall (idle → fall) and
          // it's never clicked again, title-engine.js silently snaps it back
          // to idle with no animation or sound. Rather than guess the timing
          // with a setTimeout (unreliable — the rAF loop can push our timer
          // past the real reset), we poll every frame and catch the actual
          // fall → idle transition the instant it happens.
          if (letter.anim.mode === 'idle') {
            const watch = () => {
              const m = letter.anim.mode;
              if (m === 'reverse') return; // clicked again — handled by shakeScreen instead
              if (m !== 'fall') return; // safety bail
              const elapsed = (performance.now() - letter.anim.start) / 1000;
              // 2.4s is when title-engine.js starts the shrink/flip/reappear
              // visual (durations 2.4→3.1s) before finally setting mode idle.
              // Fire right as that visual starts, not when it finishes.
              if (elapsed >= 2.4) {
                SoundEngine.play('S', 0.3);
                return;
              }
              requestAnimationFrame(watch);
            };
            requestAnimationFrame(watch);
          }

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

      // --- shakeScreen ---
      // title-engine.js calls this both when w hits the ground (mode 'fall')
      // and when w arrives back home (mode 'reverse') — same 600ms delay
      // in both cases. Play the identical bang, same pitch, for both.
      const origShake = TitleEngine.shakeScreen.bind(TitleEngine);
      TitleEngine.shakeScreen = () => {
        const wFalling   = TitleEngine.interactiveLetters.some(l => l.char === 'w' && l.anim.mode === 'fall');
        const wReturning = TitleEngine.interactiveLetters.some(l => l.char === 'w' && l.anim.mode === 'reverse');
        if (wFalling) {
          SoundEngine.play('w_land', 0.3, 1.15);
        } else if (wReturning) {
          SoundEngine.play('w_land', 0.3, 0.85);
        } else {
          SoundEngine.play('shake', 0.25);
        }
        origShake();
      };

      console.log('🔊 TitleEngine patched with sounds');
    }, 50);
  }
};

window.SoundEngine = SoundEngine;
SoundEngine.init();
