/**
 * Jolly Space Cow - Sound Engine
 * Hooks into TitleEngine.triggerInteraction() and shakeScreen()
 * to play matching sound effects.
 */

const SoundEngine = {
  ctx: null,
  buffers: {},
  unlocked: false,

  // Map each interaction to an audio file in /assets/audio/
  sounds: {
    J:         'Boing_SeResourceStd2nd_00000281.ogg',              // J jumps up
    ll:        'Bup.mp3',                                          // ll toggles space pause
    o:         'Coin_(dropping)_SeResourceStd2nd_00000270.ogg',    // O's orbit swap
    p_explode: 'Bang_SeResourceStd2nd_00001014.ogg',               // p explodes letters
    p_return:  'Plop_SeResourceStd2nd_00000273.ogg',               // p returns letters
    w_fall:    'Plop_SeResourceStd2nd_00000275.ogg',               // w falls down
    w_reverse: 'Plop_SeResourceStd2nd_00000837.ogg',               // w reverses
    S:         'Siren_SeResourceStd2nd_00001028.ogg',              // S rocket launch
    y:         'Whistling_Whistle_SeResourceStd2nd_00001034.ogg',  // y swing + hue
    c:         'Bell_SeResourceStdSystem_00000134.ogg',            // c starfield toggle
    shake:     'Unknown_Sound_SeResourceStdSystem_00000133.ogg',   // screen shake boom
    moo:       'Moo.mp3',                                          // 🐄 moo kicker
    vineboom:  'vineboom.mp3',                                     // bonus
  },

  init() {
    // Create AudioContext on first user interaction (browser requirement)
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

  play(key, volume = 1.0) {
    if (!this.ctx || !this.buffers[key]) return;
    const source = this.ctx.createBufferSource();
    source.buffer = this.buffers[key];
    const gain = this.ctx.createGain();
    gain.gain.value = volume;
    source.connect(gain);
    gain.connect(this.ctx.destination);
    source.start(0);
  },

  // Monkey-patch TitleEngine methods to fire sounds alongside interactions
  patchTitleEngine() {
    // Wait for TitleEngine to be ready
    const wait = setInterval(() => {
      if (typeof TitleEngine === 'undefined') return;
      clearInterval(wait);

      // --- triggerInteraction ---
      const origTrigger = TitleEngine.triggerInteraction.bind(TitleEngine);
      TitleEngine.triggerInteraction = (letter, yBase, fontSize) => {
        const char = letter.char;
        const idx  = letter.index;

        if (char === 'J' && idx === 0) {
          SoundEngine.play('J');
        } else if (char === 'w') {
          const mode = letter.anim.mode;
          SoundEngine.play(mode === 'fall' ? 'w_reverse' : 'w_fall');
        } else if (char === 'p' && idx === 7) {
          const inPhysics = TitleEngine.interactiveLetters.some(l => l.anim.mode === 'physics');
          SoundEngine.play(inPhysics ? 'p_return' : 'p_explode');
        } else if (char === 'y') {
          SoundEngine.play('y');
        } else if (char.toLowerCase() === 'o') {
          SoundEngine.play('o');
        } else if (char === 'l' && (idx === 2 || idx === 3)) {
          SoundEngine.play('ll');
        } else if (char === 'c' && idx === 9) {
          SoundEngine.play('c');
        } else if (char === 'S') {
          SoundEngine.play('S', 0.6);
        }

        origTrigger(letter, yBase, fontSize);
      };

      // --- shakeScreen ---
      const origShake = TitleEngine.shakeScreen.bind(TitleEngine);
      TitleEngine.shakeScreen = () => {
        SoundEngine.play('shake', 0.7);
        origShake();
      };

      console.log('🔊 TitleEngine patched with sounds');
    }, 50);
  }
};

SoundEngine.init();
