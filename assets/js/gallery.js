/**
 * Jolly Space Cow - Gallery Logic
 * Manages wallpaper rendering and lightbox interactions.
 */

(function() {
  const WALLPAPERS = [
    { id: 'Kawoosh', format: 'JPEG XL' },
    { id: 'Table',   format: 'JPEG XL' }
  ];

  const Gallery = {
    init() {
      this.grid = document.getElementById('wall-grid');
      this.lb = document.getElementById('lb');
      if (!this.grid) return;

      this.render();
      this.bindEvents();
    },

    toTitle(name) {
      return name.replace(/([a-z])([A-Z])/g, '$1 $2')
                 .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2');
    },

    render() {
      this.grid.innerHTML = WALLPAPERS.map(wall => {
        const title = this.toTitle(wall.id);
        const thumb = `assets/images/thumbnails/${wall.id}720px.webp`;
        const full  = `assets/images/wallpapers/${wall.id}.jxl`;
        
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
      this.grid.addEventListener('click', (e) => {
        const card = e.target.closest('.wall-card');
        if (card) {
          const { thumb, full, title, format } = card.dataset;
          this.openLB(thumb, full, title, format);
        }
      });

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
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') this.closeLB();
      });
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

  document.addEventListener('DOMContentLoaded', () => Gallery.init());
})();
