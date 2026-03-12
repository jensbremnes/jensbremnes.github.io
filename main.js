'use strict';

/* =============================================
   PARTICLE SYSTEM
   ============================================= */
(function initParticles() {
  const canvas = document.getElementById('particle-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  const PARTICLE_COUNT = 70;
  const particles = [];
  let animId;
  let time = 0;

  const COLORS = [
    { r: 0,  g: 229, b: 176 },  // --accent-bio
    { r: 59, g: 130, b: 246 },  // --accent-blue
    { r: 126,g: 179, b: 255 },  // --accent-light
  ];

  function resize() {
    canvas.width  = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
  }

  function makeParticle(i) {
    const c = COLORS[Math.floor(Math.random() * COLORS.length)];
    return {
      x:        Math.random() * canvas.width,
      y:        Math.random() * canvas.height,
      vx:       (Math.random() - 0.5) * 0.3,
      vy:       (Math.random() - 0.5) * 0.3,
      size:     1 + Math.random() * 2,
      opacity:  0.2 + Math.random() * 0.6,
      phaseX:   Math.random() * Math.PI * 2,
      phaseY:   Math.random() * Math.PI * 2,
      phaseO:   Math.random() * Math.PI * 2,
      color:    c,
      colorIdx: i % COLORS.length,
    };
  }

  function init() {
    resize();
    particles.length = 0;
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      particles.push(makeParticle(i));
    }
  }

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    time += 1;
    const t = time * 0.0003;

    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];

      // Sinusoidal drift
      const driftX = Math.sin(t * 1.3 + p.phaseX) * 0.4;
      const driftY = Math.cos(t * 1.1 + p.phaseY) * 0.4;
      p.x += p.vx + driftX;
      p.y += p.vy + driftY;

      // Wrap edges
      if (p.x < -10) p.x = canvas.width  + 10;
      if (p.x > canvas.width  + 10) p.x = -10;
      if (p.y < -10) p.y = canvas.height + 10;
      if (p.y > canvas.height + 10) p.y = -10;

      // Opacity pulse
      const pulsedOpacity = p.opacity * (0.6 + 0.4 * Math.sin(t * 80 + p.phaseO + i));

      const { r, g, b } = p.color;
      const alpha = Math.max(0, Math.min(1, pulsedOpacity));

      // Glow
      const gradient = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * 4);
      gradient.addColorStop(0,   `rgba(${r}, ${g}, ${b}, ${alpha})`);
      gradient.addColorStop(0.5, `rgba(${r}, ${g}, ${b}, ${alpha * 0.3})`);
      gradient.addColorStop(1,   `rgba(${r}, ${g}, ${b}, 0)`);

      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * 4, 0, Math.PI * 2);
      ctx.fillStyle = gradient;
      ctx.fill();

      // Core dot
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * 0.5, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
      ctx.fill();
    }

    animId = requestAnimationFrame(draw);
  }

  window.addEventListener('resize', () => {
    cancelAnimationFrame(animId);
    resize();
    draw();
  });

  init();
  draw();
})();


/* =============================================
   NAV SCROLL BEHAVIOR
   ============================================= */
(function initNav() {
  const nav = document.getElementById('nav');
  if (!nav) return;

  function onScroll() {
    if (window.scrollY > 60) {
      nav.classList.add('scrolled');
    } else {
      nav.classList.remove('scrolled');
    }
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
})();


/* =============================================
   ACTIVE NAV LINK (IntersectionObserver)
   ============================================= */
(function initActiveNav() {
  const sections = document.querySelectorAll('section[id]');
  const navLinks = document.querySelectorAll('.nav-links a');

  if (!sections.length || !navLinks.length) return;

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const id = entry.target.id;
          navLinks.forEach((link) => {
            link.classList.toggle('active', link.getAttribute('href') === `#${id}`);
          });
        }
      });
    },
    { threshold: 0.3 }
  );

  sections.forEach((s) => observer.observe(s));
})();


/* =============================================
   SCROLL-IN ANIMATIONS
   ============================================= */
(function initScrollAnimations() {
  const sections = document.querySelectorAll('.section');
  if (!sections.length) return;

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.15 }
  );

  sections.forEach((s) => observer.observe(s));
})();


/* =============================================
   TIMELINE ANIMATIONS
   ============================================= */
(function initTimeline() {
  const bubbles = document.querySelectorAll('.tl-bubble');
  if (!bubbles.length) return;

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.1 }
  );

  bubbles.forEach((bubble) => observer.observe(bubble));
})();
