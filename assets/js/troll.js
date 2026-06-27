/**
 * TrollScroll - Chaotic Glitch & Stretch-Jump
 * Trolls users with custom effects depending on scroll direction.
 */
const TrollScroll = {
    element: null,
    
    // Jump physics (Scroll Down)
    jumpY: 0,
    velocity: 0,
    gravity: 0.85, // Stronger pull back down
    bounce: 0.45,  // Slightly less bouncy
    
    // Squish & Stretch spring system
    squishX: 1,
    squishY: 1,
    squishXVel: 0,
    squishYVel: 0,
    stiffness: 0.15,
    damping: 0.8,

    // Jitter physics (Scroll Up)
    evadeX: 0,
    evadeY: 0,
    vx: 0,
    vy: 0,
    evadeStiffness: 0.08,
    evadeDamping: 0.78,
    
    isAnimating: false,
    isActive: true,

    wheelHandler: null,
    touchStartHandler: null,
    touchMoveHandler: null,

    init() {
        if (!document.body.classList.contains('is-home')) return;
        this.element = document.querySelector('.hero-title-wrapper');
        if (!this.element) return;

        this.resetState();

        setTimeout(() => {
            if (this.isActive && !this.isAnimating) {
                this.element.style.animation = 'none';
                this.element.style.opacity = '1';
            }
        }, 2000);

        this.wheelHandler = (e) => {
            if (!this.isActive) return;
            if (e.deltaY > 0) {
                // Scroll down: stretch-jump
                this.jump(e.deltaY);
            } else if (e.deltaY < 0) {
                // Scroll up: trigger jitter/glitch
                this.triggerJitter(Math.abs(e.deltaY));
            }
        };
        window.addEventListener('wheel', this.wheelHandler, { passive: true });

        // Touch event mapping
        let touchStart = 0;
        this.touchStartHandler = (e) => {
            if (!this.isActive) return;
            touchStart = e.touches[0].clientY;
        };
        window.addEventListener('touchstart', this.touchStartHandler, { passive: true });

        this.touchMoveHandler = (e) => {
            if (!this.isActive) return;
            const touchY = e.touches[0].clientY;
            const deltaY = touchStart - touchY;
            if (Math.abs(deltaY) > 5) {
                if (deltaY > 0) {
                    this.jump(deltaY);
                } else {
                    this.triggerJitter(Math.abs(deltaY));
                }
                touchStart = touchY;
            }
        };
        window.addEventListener('touchmove', this.touchMoveHandler, { passive: true });

        console.log("😜 TrollScroll active: Scroll UP to glitch/jitter, Scroll DOWN to stretch-jump.");
    },

    resetState() {
        this.jumpY = 0;
        this.velocity = 0;
        this.squishX = 1;
        this.squishY = 1;
        this.squishXVel = 0;
        this.squishYVel = 0;
        this.evadeX = 0;
        this.evadeY = 0;
        this.vx = 0;
        this.vy = 0;
    },

    destroy() {
        this.isActive = false;
        this.isAnimating = false;
        
        window.removeEventListener('wheel', this.wheelHandler);
        window.removeEventListener('touchstart', this.touchStartHandler);
        window.removeEventListener('touchmove', this.touchMoveHandler);

        if (this.element) {
            this.element.style.transform = '';
            this.element.style.animation = '';
            this.element.style.filter = '';
        }
    },

    jump(intensity) {
        if (!this.element) return;
        this.element.style.animation = 'none';
        this.element.style.opacity = '1';

        const normalizedIntensity = Math.min(intensity, 120);
        const jumpForce = Math.pow(normalizedIntensity, 0.5) * 1.25;
        
        this.velocity -= jumpForce;

        // Apply initial jump stretch (squish horizontal, stretch vertical)
        this.squishXVel -= jumpForce * 0.035;
        this.squishYVel += jumpForce * 0.035;

        if (!this.isAnimating) {
            this.isAnimating = true;
            this.update();
        }
    },

    triggerJitter(intensity) {
        if (!this.element) return;
        this.element.style.animation = 'none';
        this.element.style.opacity = '1';

        // Add a random jitter push
        const scale = Math.min(intensity, 150) * 0.25;
        this.vx += (Math.random() - 0.5) * scale;
        this.vy += (Math.random() - 0.5) * scale;

        // Glitch visuals
        this.element.style.filter = `hue-rotate(${Math.random() * 360}deg) skewX(${(Math.random() - 0.5) * 12}deg)`;
        setTimeout(() => {
            if (this.isActive && this.element) this.element.style.filter = '';
        }, 120);

        if (!this.isAnimating) {
            this.isAnimating = true;
            this.update();
        }
    },

    update() {
        if (!this.isActive || !this.isAnimating) return;

        // --- 1. Jump Physics ---
        this.velocity += this.gravity;
        this.jumpY += this.velocity;

        // Ceiling cap
        const maxHeight = -window.innerHeight * 0.75;
        if (this.jumpY < maxHeight) {
            this.jumpY = maxHeight;
            if (this.velocity < 0) this.velocity = 2;
        }

        // Landing bounce
        if (this.jumpY >= 0) {
            this.jumpY = 0;
            if (Math.abs(this.velocity) > 2.5) {
                this.velocity = -this.velocity * this.bounce;
                // Squish vertically, stretch horizontally on landing impact
                this.squishYVel -= Math.abs(this.velocity) * 0.09;
                this.squishXVel += Math.abs(this.velocity) * 0.09;
            } else {
                this.velocity = 0;
            }
        }

        // --- 2. Squish & Stretch Springs ---
        const springForceX = (1 - this.squishX) * this.stiffness;
        this.squishXVel += springForceX;
        this.squishXVel *= this.damping;
        this.squishX += this.squishXVel;

        const springForceY = (1 - this.squishY) * this.stiffness;
        this.squishYVel += springForceY;
        this.squishYVel *= this.damping;
        this.squishY += this.squishYVel;

        this.squishX = Math.max(0.1, Math.min(this.squishX, 2.0));
        this.squishY = Math.max(0.1, Math.min(this.squishY, 2.0));

        // Calculate dynamic velocity-based stretch-jump scales
        let displayScaleX = this.squishX;
        let displayScaleY = this.squishY;
        if (this.jumpY < 0) {
            const stretchAmount = Math.min(Math.abs(this.velocity) * 0.02, 0.45);
            displayScaleY += stretchAmount;
            displayScaleX -= stretchAmount * 0.85; // squished horizontally, stretched vertically
        }

        // --- 3. Jitter Springs ---
        const centerForceX = (0 - this.evadeX) * this.evadeStiffness;
        const centerForceY = (0 - this.evadeY) * this.evadeStiffness;

        this.vx += centerForceX;
        this.vy += centerForceY;

        this.vx *= this.evadeDamping;
        this.vy *= this.evadeDamping;

        this.evadeX += this.vx;
        this.evadeY += this.vy;

        // Cap maximum drift
        const maxDrift = 280;
        const currDrift = Math.sqrt(this.evadeX * this.evadeX + this.evadeY * this.evadeY);
        if (currDrift > maxDrift) {
            this.evadeX = (this.evadeX / currDrift) * maxDrift;
            this.evadeY = (this.evadeY / currDrift) * maxDrift;
        }

        // --- 4. Apply Render State ---
        if (this.element) {
            const totalX = this.evadeX;
            const totalY = this.jumpY + this.evadeY;
            this.element.style.transform = `translate3d(${totalX}px, ${totalY}px, 0) scale(${displayScaleX}, ${displayScaleY})`;
        }

        // Check settlement
        const isJumpSettled = Math.abs(this.jumpY) < 0.1 && Math.abs(this.velocity) < 0.1;
        const isSquishSettled = Math.abs(1 - this.squishX) < 0.005 && Math.abs(this.squishXVel) < 0.005 &&
                                Math.abs(1 - this.squishY) < 0.005 && Math.abs(this.squishYVel) < 0.005;
        const isEvadeSettled = Math.abs(this.evadeX) < 0.1 && Math.abs(this.evadeY) < 0.1 &&
                               Math.abs(this.vx) < 0.1 && Math.abs(this.vy) < 0.1;

        if (isJumpSettled && isSquishSettled && isEvadeSettled) {
            this.resetState();
            if (this.element) {
                this.element.style.transform = 'none';
            }
            this.isAnimating = false;
        }

        if (this.isAnimating && this.isActive) {
            requestAnimationFrame(() => this.update());
        }
    }
};

// Initialize
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => TrollScroll.init());
} else {
    TrollScroll.init();
}
