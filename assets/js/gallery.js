/**
 * Jolly Space Cow - Gallery Logic
 * Manages wallpaper rendering, automatic discovery, and lightbox interactions.
 */

(function() {
  // Default list of wallpapers to use as a fallback.
  // Includes 'Rings' which is already present in the assets.
  const FALLBACK_WALLPAPERS = [
    { id: 'Kawoosh', filename: 'Kawoosh.jxl', format: 'JPEG XL' },
    { id: 'Rings',   filename: 'Rings.jxl',   format: 'JPEG XL' },
    { id: 'Table',   filename: 'Table.jxl',   format: 'JPEG XL' },
    { id: 'Tank',    filename: 'Tank.jxl',    format: 'JPEG XL' }
  ];

  const Gallery = {
    wallpapers: [],

    async initialise() {
      this.grid = document.getElementById('wall-grid');
      this.lb = document.getElementById('lb');
      if (!this.grid) return;

      // Load cached list or use fallback first to ensure fast render
      this.loadCachedWallpapers();
      this.render();
      this.bindEvents();

      // Asynchronously discover new wallpapers and update the UI
      await this.discoverWallpapers();
    },

    loadCachedWallpapers() {
      try {
        const cached = localStorage.getItem('jsc_wallpapers');
        if (cached) {
          this.wallpapers = JSON.parse(cached);
          return;
        }
      } catch (e) {
        console.warn('Could not read cached wallpapers:', e);
      }
      this.wallpapers = [...FALLBACK_WALLPAPERS];
    },

    saveCachedWallpapers() {
      try {
        localStorage.setItem('jsc_wallpapers', JSON.stringify(this.wallpapers));
      } catch (e) {
        console.warn('Could not cache wallpapers:', e);
      }
    },

    async discoverWallpapers() {
      let filenames = null;

      // 1. Try discovering wallpapers from local directory (useful for local development servers)
      filenames = await this.discoverLocalFiles();

      // 2. Fall back to GitHub API (useful for GitHub Pages deployment)
      if (!filenames || filenames.length === 0) {
        filenames = await this.discoverGitHubFiles();
      }

      if (filenames && filenames.length > 0) {
        const discovered = filenames.map(filename => {
          const lastDot = filename.lastIndexOf('.');
          const id = lastDot !== -1 ? filename.substring(0, lastDot) : filename;
          const ext = lastDot !== -1 ? filename.substring(lastDot + 1) : '';
          
          let format = ext.toUpperCase();
          if (ext.toLowerCase() === 'jxl') {
            format = 'JPEG XL';
          }

          return {
            id,
            filename,
            format
          };
        });

        // Check if there are differences before re-rendering to prevent unnecessary layout shifts
        const currentIds = this.wallpapers.map(w => w.filename).sort().join(',');
        const discoveredIds = discovered.map(w => w.filename).sort().join(',');

        if (currentIds !== discoveredIds) {
          this.wallpapers = discovered;
          this.saveCachedWallpapers();
          this.render();
        }
      }
    },

    async discoverLocalFiles() {
      try {
        const response = await fetch('assets/images/wallpapers/');
        if (!response.ok) return null;

        const text = await response.text();
        // Check if response contains HTML/directory structure typical of local development servers
        if (text.includes('<html') || text.includes('<pre>') || text.includes('href=')) {
          const parser = new DOMParser();
          const doc = parser.parseFromString(text, 'text/html');
          const links = Array.from(doc.querySelectorAll('a'));
          const files = links
            .map(a => a.getAttribute('href'))
            .filter(href => href && !href.startsWith('/') && !href.startsWith('?') && !href.startsWith('..'))
            .map(href => {
              const segments = href.split('/');
              return decodeURIComponent(segments[segments.length - 1]);
            })
            .filter(filename => {
              const lower = filename.toLowerCase();
              return lower.endsWith('.jxl') || lower.endsWith('.png') || lower.endsWith('.webp') || lower.endsWith('.jpg') || lower.endsWith('.jpeg');
            });

          const uniqueFiles = Array.from(new Set(files));
          if (uniqueFiles.length > 0) {
            return uniqueFiles;
          }
        }
      } catch (e) {
        // Expected to fail with CORS if loaded via file:// protocol
        console.debug('Failed to fetch local directory listing:', e);
      }
      return null;
    },

    async discoverGitHubFiles() {
      let owner = 'JollySpaceCow';
      let repo = 'JollySpaceCow.github.io';

      // Dynamically adapt to forks or custom domain hosting on GitHub Pages
      if (window.location.hostname.endsWith('.github.io')) {
        owner = window.location.hostname.split('.')[0];
        repo = `${owner}.github.io`;
      }

      const url = `https://api.github.com/repos/${owner}/${repo}/contents/assets/images/wallpapers`;

      try {
        const response = await fetch(url);
        if (!response.ok) {
          console.warn(`GitHub API returned status ${response.status} when listing wallpapers`);
          return null;
        }
        const data = await response.json();
        if (Array.isArray(data)) {
          return data
            .filter(item => item.type === 'file' && (
              item.name.endsWith('.jxl') ||
              item.name.endsWith('.png') ||
              item.name.endsWith('.webp') ||
              item.name.endsWith('.jpg') ||
              item.name.endsWith('.jpeg')
            ))
            .map(item => item.name);
        }
      } catch (e) {
        console.error('Error fetching wallpapers from GitHub API:', e);
      }
      return null;
    },

    toTitle(name) {
      return name.replace(/([a-z])([A-Z])/g, '$1 $2')
                 .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2');
    },

    render() {
      this.grid.innerHTML = this.wallpapers.map(wall => {
        const title = this.toTitle(wall.id);
        const thumb = `assets/images/thumbnails/${wall.id}720px.webp`;
        const full  = `assets/images/wallpapers/${wall.filename}`;
        
        return `
          <div class="wall-card" data-thumb="${thumb}" data-full="${full}" data-title="${title}" data-format="${wall.format}">
            <img src="${thumb}" alt="${title}" class="wall-thumb" loading="lazy">
            <div class="wall-overlay"><span class="wall-overlay-text">↓ Preview & Download</span></div>
            <div class="wall-info">
              <span class="wall-title">${title}</span>
              <span class="wall-meta">${wall.format}</span>
            </div>
          </div>`;
      }).join('');
    },

    bindEvents() {
      // Gallery item clicks
      this.grid.onclick = (e) => {
        const card = e.target.closest('.wall-card');
        if (card) {
          const { thumb, full, title, format } = card.dataset;
          this.openLB(thumb, full, title, format);
        }
      };

      // Lightbox close buttons
      const closeBtn = document.getElementById('lb-close-btn');
      const closeAction = document.getElementById('lb-close-action');
      if (closeBtn) closeBtn.onclick = () => this.closeLB();
      if (closeAction) closeAction.onclick = () => this.closeLB();

      // Close on outside click
      this.lb.onclick = (e) => {
        if (e.target === this.lb) this.closeLB();
      };

      // Close on Escape key
      document.onkeydown = (e) => {
        if (e.key === 'Escape') this.closeLB();
      };
    },

    openLB(preview, hq, title, format) {
      const img = document.getElementById('lb-img');
      const lbTitle = document.getElementById('lb-title');
      const lbSub = document.getElementById('lb-sub');
      const lbDl = document.getElementById('lb-dl');

      if (img) img.src = preview;
      if (lbTitle) lbTitle.textContent = title;
      if (lbSub) lbSub.textContent = format;
      if (lbDl) {
        lbDl.href = hq;
        lbDl.download = hq.split('/').pop();
      }
      
      this.lb.classList.add('open');
      document.body.style.overflow = 'hidden';
    },

    closeLB() {
      this.lb.classList.remove('open');
      document.body.style.overflow = '';
    }
  };

  document.addEventListener('DOMContentLoaded', () => Gallery.initialise());
})();
