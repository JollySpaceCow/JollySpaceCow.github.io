/**
 * Jolly Space Cow - Core Application Orchestrator
 * Handles shared UI components, service workers, and global state.
 */

const App = {
  init() {
    this.registerServiceWorker();
    this.initNavigation();
    this.initFooter();
    this.initDevTools();
    this.initMooSound();
    console.log("🚀 Jolly Space Cow App Initialized");
  },

  /**
   * Registers the Service Worker for offline support and caching.
   */
  registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
          .then(reg => console.log('✅ ServiceWorker active'))
          .catch(err => console.warn('❌ ServiceWorker failed:', err));
      });
    }
  },

  /**
   * Highlights the active navigation link based on the current URL.
   */
  initNavigation() {
    const currentPath = window.location.pathname.split('/').pop() || 'index.html';
    const navLinks = document.querySelectorAll('.nav-links a');
    
    navLinks.forEach(link => {
      const linkPath = link.getAttribute('href');
      if (linkPath === currentPath) {
        link.classList.add('active');
      } else {
        link.classList.remove('active');
      }
    });

    // Handle transparent nav on scroll for non-home pages if needed
    const nav = document.querySelector('nav');
    if (nav && !document.body.classList.contains('is-home')) {
      window.addEventListener('scroll', () => {
        if (window.scrollY > 20) {
          nav.classList.add('is-scrolled');
        } else {
          nav.classList.remove('is-scrolled');
        }
      });
    }
  },

  /**
   * Ensures the footer is consistent and has the correct year.
   */
  initFooter() {
    const footer = document.querySelector('.site-footer');
    if (footer) {
      footer.innerHTML = `© ${new Date().getFullYear()} Jolly Space Cow`;
    }
  },

  /**
   * Shared development tools (Warp Mode, etc.)
   */
  initDevTools() {
    const devMenu = document.getElementById('dev-menu');
    if (!devMenu) return;

    // Secret handshake to show dev menu: Press 'D' 3 times
    let dCount = 0;
    window.addEventListener('keydown', (e) => {
      if (e.key.toLowerCase() === 'd') {
        dCount++;
        if (dCount === 3) {
          devMenu.style.display = devMenu.style.display === 'none' ? 'block' : 'none';
          dCount = 0;
        }
      } else {
        dCount = 0;
      }
    });

    // Warp toggle logic (moved from inline)
    const warpToggle = document.getElementById('warp-toggle');
    if (warpToggle) {
      window.addEventListener('keydown', (e) => {
        if (e.key.toLowerCase() === 'e') {
          warpToggle.checked = !warpToggle.checked;
          warpToggle.dispatchEvent(new Event('change'));
        }
      });
    }
  },

  /**
   * Adds click listener to the 'moo' kicker to play the moo sound.
   * Supports polyphony (overlapping sounds) for spamming.
   */
  /**
   * High-performance Moo Interaction System
   * Optimized for "senior-grade" spamming and low memory churn.
   */
  initMooSound() {
    const kicker = document.querySelector('.hero-kicker');
    if (!kicker) return;

    const PATHS = ['assets/audio/moo.wav', 'assets/audio/Moo.mp3'];
    let workingPath = null;
    const POOL_SIZE = 8; // Audio object pool to prevent GC thrashing during spam
    const audioPool = [];
    let poolIndex = 0;

    // 1. Path Discovery: Find the first working audio path
    const discoverPath = async () => {
      for (const path of PATHS) {
        try {
          const testAudio = new Audio(path);
          await new Promise((resolve, reject) => {
            testAudio.oncanplaythrough = resolve;
            testAudio.onerror = reject;
            // Short timeout to avoid hanging if file is weird
            setTimeout(reject, 1000);
          });
          workingPath = path;
          // 2. Initialize Pool once path is found
          for (let i = 0; i < POOL_SIZE; i++) audioPool.push(new Audio(workingPath));
          console.log(`🔊 Moo System: Using ${workingPath}`);
          break;
        } catch (e) {
          continue;
        }
      }
    };

    discoverPath();

    kicker.addEventListener('click', (e) => {
      // 3. Optimized Playback
      if (workingPath && audioPool.length > 0) {
        const sound = audioPool[poolIndex];
        sound.currentTime = 0;
        sound.play().catch(() => {});
        poolIndex = (poolIndex + 1) % POOL_SIZE;
      }

      // 4. Visual Feedback: Floating Text
      const pop = document.createElement('div');
      pop.className = 'moo-pop';
      pop.innerText = 'moo!';
      pop.style.left = `${e.clientX}px`;
      pop.style.top = `${e.clientY}px`;
      document.body.appendChild(pop);
      setTimeout(() => pop.remove(), 800);

      // 5. Visual Feedback: Kicker Spring (Class-based for performance)
      kicker.classList.remove('is-popping');
      void kicker.offsetWidth; // Force reflow to restart animation
      kicker.classList.add('is-popping');
      setTimeout(() => kicker.classList.remove('is-popping'), 150);
    });
  }
};

// Initialize on DOM Load
document.addEventListener('DOMContentLoaded', () => App.init());
