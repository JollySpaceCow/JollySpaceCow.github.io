/**
 * Jolly Space Cow - NPC Engine
 * Manages the "Mr. Finance" character behavior and animations.
 */

window.MrFinance = {
  isSpawned: false,

  spawn() {
    if (this.isSpawned) return;
    this.isSpawned = true;

    // Ensure model-viewer is loaded
    if (!document.querySelector('script[src*="model-viewer"]')) {
      const script = document.createElement('script');
      script.type = 'module';
      script.src = 'https://ajax.googleapis.com/ajax/libs/model-viewer/3.4.0/model-viewer.min.js';
      document.head.appendChild(script);
    }

    const fin = document.createElement('model-viewer');
    fin.setAttribute('src', 'assets/3d/FinanCharacter34BakermanGrooving.glb');
    fin.setAttribute('autoplay', '');
    fin.setAttribute('animation-name', 'Walking');
    fin.setAttribute('orientation', '0deg 0deg 90deg');
    
    // Performance optimizations
    fin.setAttribute('shadow-intensity', '0');
    fin.setAttribute('environment-image', 'neutral');
    fin.setAttribute('interaction-prompt', 'none');
    fin.setAttribute('disable-zoom', '');
    fin.setAttribute('disable-pan', '');
    fin.setAttribute('disable-tap', '');
    fin.setAttribute('animation-crossfade-duration', '300');

    fin.style.cssText = `
        position: fixed; bottom: 0; left: 0;
        width: 150px; height: 150px;
        z-index: 500; cursor: crosshair;
        transform: translate3d(-150px, 0px, 0px);
        visibility: hidden;
        will-change: transform;
        contain: layout style paint;
    `;
    document.body.appendChild(fin);

    this.initBehavior(fin);
  },

  initBehavior(fin) {
    let state = 'walk';
    let x = -150;
    let y = 0;
    let facingRight = true;
    let stateTimer = null;
    let loopId = 0;
    let loopRunning = false;
    let fallVelocity = 0;
    let lastTime = 0;
    let revealed = false;
    let cachedWidth = window.innerWidth;
    
    const walkSpeed = 120;
    const gravity = 1200;
    const movingStates = new Set(['walk', 'falling_through', 'falling_from_ceiling', 'hanging_enter']);

    window.addEventListener('resize', () => { cachedWidth = window.innerWidth; }, { passive: true });

    const setState = (newState, animName, orientation) => {
      state = newState;
      fin.setAttribute('animation-name', animName);
      if (orientation !== undefined) {
        fin.setAttribute('orientation', orientation);
      }
      if (stateTimer) clearTimeout(stateTimer);
    };

    const applyTransform = () => {
      fin.style.transform = `translate3d(${x | 0}px, ${y | 0}px, 0px)`;
      if (!revealed) { revealed = true; fin.style.visibility = 'visible'; }
    };

    let hangStartTime = 0;

    const loop = (time) => {
      if (!fin.isConnected) { loopRunning = false; return; }
      let dt = (time - lastTime) * 0.001;
      lastTime = time;
      if (dt > 0.1) dt = 0.1;

      if (state === 'walk') {
        if (facingRight) {
          x += walkSpeed * dt;
          if (x > cachedWidth + 100) x = -150;
        } else {
          x -= walkSpeed * dt;
          if (x < -150) x = cachedWidth + 100;
        }
      } else if (state === 'falling_through') {
        fallVelocity += gravity * dt;
        y += fallVelocity * dt;
        if (y > 250) {
          y = -window.innerHeight + 150;
          fallVelocity = 0;
          hangStartTime = time; 
          setState('hanging_enter', 'Hanging Idle', '0deg 0deg 0deg');
        }
      } else if (state === 'hanging_enter') {
        const elapsed = (time - hangStartTime) * 0.001;
        const duration = 1.2;
        const p = elapsed / duration;
        if (p >= 1.0) {
          y = -window.innerHeight + 150;
          setState('hanging', 'Hanging Idle', '0deg 0deg 0deg');
          applyTransform();
          stopLoop();
          stateTimer = setTimeout(() => {
            setState('falling_from_ceiling', 'Falling', '0deg 0deg 0deg');
            fallVelocity = 0;
            startLoop();
          }, 3000);
          return; // Exit here as we called stopLoop
        }
        const baseY = -window.innerHeight + 150;
        const amplitude = 60 * (1 - p);
        y = baseY + Math.sin(p * Math.PI * 8) * amplitude;
      } else if (state === 'falling_from_ceiling') {
        fallVelocity += gravity * dt;
        y += fallVelocity * dt;
        if (y >= 0) {
          y = 0;
          fallVelocity = 0;
          setState('impact', 'Falling Flat Impact', '0deg 0deg 0deg');
          applyTransform();
          stopLoop();
          stateTimer = setTimeout(() => {
            if (state === 'impact') {
              setState('standing_up', 'Standing Up', '0deg 0deg 0deg');
              stateTimer = setTimeout(() => {
                if (state === 'standing_up') {
                  setState('idle', 'Idle', '0deg 0deg 0deg');
                  think();
                }
              }, 2200);
            }
          }, 1000);
          return; // Exit here as we called stopLoop
        }
      } else {
        applyTransform();
        stopLoop();
        return;
      }

      applyTransform();
      loopId = requestAnimationFrame(loop);
    };

    const startLoop = () => {
      if (!loopRunning) {
        loopRunning = true;
        lastTime = performance.now();
        loopId = requestAnimationFrame(loop);
      }
    };

    const stopLoop = () => {
      if (loopRunning) {
        loopRunning = false;
        cancelAnimationFrame(loopId);
      }
    };

    const think = () => {
      if (state === 'idle' || state === 'walk') {
        const edgeMargin = 120;
        const nearEdge = x < edgeMargin || x > cachedWidth - edgeMargin;

        if (nearEdge) {
          if (state !== 'walk') {
            setState('walk', 'Walking', facingRight ? '0deg 0deg 90deg' : '0deg 0deg -90deg');
            startLoop();
          }
          stateTimer = setTimeout(think, 2000 + Math.random() * 2000);
        } else {
          const rand = Math.random();
          if (rand < 0.2) {
            const idleAnims = ['Idle', 'Dancing Twerk', 'Salsa Dance'];
            const anim = idleAnims[Math.floor(Math.random() * idleAnims.length)];
            setState('idle', anim, '0deg 0deg 0deg');
            stopLoop();
            stateTimer = setTimeout(think, 3000 + Math.random() * 4000);
          } else if (rand < 0.7) {
            facingRight = Math.random() > 0.5;
            setState('walk', 'Walking', facingRight ? '0deg 0deg 90deg' : '0deg 0deg -90deg');
            startLoop();
            stateTimer = setTimeout(think, 4000 + Math.random() * 5000);
          } else if (rand < 0.85) {
            setState('falling_through', 'Falling', '0deg 0deg 0deg');
            startLoop();
          } else {
            setState('idle', 'Sad Idle', '0deg 0deg 0deg');
            stopLoop();
            stateTimer = setTimeout(think, 3000);
          }
        }
      }
    };

    fin.addEventListener('pointerdown', (e) => {
      const forbidden = ['falling_through', 'falling_from_ceiling', 'hanging', 'impact', 'sweep'];
      if (forbidden.includes(state)) return;

      const rect = fin.getBoundingClientRect();
      const clickY = e.clientY - rect.top;

      if (clickY < 50) {
        setState('punched', 'Receiving An Uppercut', '0deg 0deg 0deg');
        stopLoop();
        stateTimer = setTimeout(() => { setState('idle', 'Idle', '0deg 0deg 0deg'); think(); }, 1500);
      } else if (clickY < 100) {
        setState('punched', 'Kidney Hit', '0deg 0deg 0deg');
        stopLoop();
        stateTimer = setTimeout(() => { setState('idle', 'Idle', '0deg 0deg 0deg'); think(); }, 1500);
      } else {
        setState('sweep', 'Sweep Fall', '0deg 0deg 0deg');
        stopLoop();
        stateTimer = setTimeout(() => {
          if (state === 'sweep') {
            fallVelocity = 0;
            state = 'falling_through';
            startLoop();
          }
        }, 1500);
      }
    });

    startLoop();
    stateTimer = setTimeout(think, 4000 + Math.random() * 3000);
  }
};
