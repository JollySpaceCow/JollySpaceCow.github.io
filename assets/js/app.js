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
  }
};

// Initialize on DOM Load
document.addEventListener('DOMContentLoaded', () => App.init());
