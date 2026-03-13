'use strict';

// Scroll to top on page load / refresh, overriding any hash in the URL
if (history.scrollRestoration) history.scrollRestoration = 'manual';
window.addEventListener('load', () => {
  history.replaceState(null, '', window.location.pathname);
  window.scrollTo(0, 0);
});

/* =============================================
   PARTICLE SYSTEM
   ============================================= */
(function initParticles() {
  const canvas = document.getElementById('particle-canvas');
  if (!canvas) return;

  // Expose shared state so ocean modules can read it before they initialise
  window.oceanState = window.oceanState || { particleDepthFactor: 0, particleSlowFactor: 1, scrollT: 0 };
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
      p.x += (p.vx + driftX) * window.oceanState.particleSlowFactor;
      p.y += (p.vy + driftY) * window.oceanState.particleSlowFactor;

      // Wrap edges
      if (p.x < -10) p.x = canvas.width  + 10;
      if (p.x > canvas.width  + 10) p.x = -10;
      if (p.y < -10) p.y = canvas.height + 10;
      if (p.y > canvas.height + 10) p.y = -10;

      // Opacity pulse
      const pulsedOpacity = p.opacity * (0.6 + 0.4 * Math.sin(t * 80 + p.phaseO + i));

      const { r, g, b } = p.color;
      const alpha = Math.max(0, Math.min(1, pulsedOpacity * (1 - window.oceanState.particleDepthFactor * 0.6)));

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
  const items = document.querySelectorAll('.tl-item');
  if (!items.length) return;

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    items.forEach((item) => item.classList.add('visible'));
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      });
    },
    {
      threshold: 0.25,
      rootMargin: '0px 0px -60px 0px',
    }
  );

  items.forEach((item) => observer.observe(item));
})();


/* =============================================
   WAVE CANVAS
   ============================================= */
function initWaveCanvas() {
  const canvas = document.getElementById('wave-canvas');
  if (!canvas) return null;
  const ctx = canvas.getContext('2d');

  const isMobile  = window.innerWidth < 768;
  const ampMult   = isMobile ? 0.7 : 1.0;
  const foamStep  = isMobile ? 12 : 8;

  const layers = [
    { yFrac: 0.62, amp: 18 * ampMult, freq: 0.008, speed: 0.0004, color: 'rgba(10,22,40,0.85)',  type: 'fill' },
    { yFrac: 0.68, amp: 12 * ampMult, freq: 0.013, speed: 0.0007, color: 'rgba(0,60,90,0.70)',   type: 'fill' },
    { yFrac: 0.73, amp:  8 * ampMult, freq: 0.019, speed: 0.0011, color: 'rgba(0,229,176,0.25)', type: 'foam' },
  ];

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    canvas.width  = canvas.offsetWidth  * dpr;
    canvas.height = canvas.offsetHeight * dpr;
    ctx.scale(dpr, dpr);
  }

  function draw(ts) {
    const w = canvas.offsetWidth;
    const h = canvas.offsetHeight;
    if (!w || !h) return;
    ctx.clearRect(0, 0, w, h);

    for (const layer of layers) {
      const baseY  = h * layer.yFrac;
      const offset = ts * layer.speed;

      ctx.beginPath();
      ctx.moveTo(0, h);
      for (let x = 0; x <= w; x += 2) {
        ctx.lineTo(x, baseY + Math.sin(x * layer.freq + offset) * layer.amp);
      }
      ctx.lineTo(w, h);
      ctx.closePath();

      if (layer.type === 'foam') {
        const grad = ctx.createLinearGradient(0, baseY - layer.amp, 0, h);
        grad.addColorStop(0,   'rgba(0,229,176,0.25)');
        grad.addColorStop(0.3, 'rgba(0,229,176,0.08)');
        grad.addColorStop(1,   'rgba(0,229,176,0)');
        ctx.fillStyle = grad;
        ctx.fill();

        // Foam dots near wave crests
        ctx.fillStyle = 'rgba(200,255,240,0.5)';
        for (let x = 0; x <= w; x += foamStep) {
          const sinVal = Math.sin(x * layer.freq + offset);
          if (sinVal > 0.5) {
            const y = baseY + sinVal * layer.amp;
            ctx.beginPath();
            ctx.arc(x, y, 0.8 + (sinVal - 0.5) * 2.4, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      } else {
        ctx.fillStyle = layer.color;
        ctx.fill();
      }
    }
  }

  resize();
  window.addEventListener('resize', resize);
  return draw;
}


/* =============================================
   SUBMERGENCE SCROLL
   ============================================= */
function initSubmergenceScroll() {
  const hero    = document.getElementById('hero');
  const overlay = document.getElementById('submergence-overlay');
  if (!hero || !overlay) return;

  const waterFill   = overlay.querySelector('.sub-water-fill');
  const surfaceLine = overlay.querySelector('.sub-surface-line');
  const causticCvs  = document.getElementById('caustic-canvas');

  let scrollDirty = false;
  let lastT = -1;

  window.addEventListener('scroll', () => { scrollDirty = true; }, { passive: true });

  function update() {
    if (scrollDirty) {
      scrollDirty = false;
      const heroH = hero.offsetHeight || window.innerHeight;
      const t = Math.min(1, window.scrollY / heroH);

      if (Math.abs(t - lastT) > 0.0005) {
        lastT = t;
        window.oceanState.scrollT = t;

        // Surface line: sweeps from bottom (t=0.15) to top (t=0.40)
        if (surfaceLine) {
          if (t < 0.15) {
            surfaceLine.style.top     = '100%';
            surfaceLine.style.opacity = '0';
          } else if (t <= 0.40) {
            const ph = (t - 0.15) / 0.25;
            surfaceLine.style.top     = (100 - ph * 110) + '%';
            surfaceLine.style.opacity = String(Math.min(1, (t - 0.15) / 0.05));
          } else {
            surfaceLine.style.top     = '-2px';
            surfaceLine.style.opacity = String(Math.max(0, 1 - (t - 0.40) / 0.10));
          }
        }

        // Water fill tint + backdrop blur
        if (waterFill) {
          let fillAlpha = 0;
          let blur = 0;
          if (t > 0.15) {
            fillAlpha = Math.min(0.35, (t - 0.15) / 0.35 * 0.35);
            if (t > 0.70) fillAlpha = 0.35 + (t - 0.70) / 0.30 * 0.25;
            if (t > 0.40) blur = Math.min(1.5, (t - 0.40) / 0.15 * 1.5);
          }
          const fa  = fillAlpha.toFixed(3);
          const fa2 = (fillAlpha * 1.5).toFixed(3);
          waterFill.style.background          = `linear-gradient(to bottom, rgba(0,20,50,${fa}), rgba(5,10,18,${fa2}))`;
          const blurStr = blur > 0 ? `blur(${blur.toFixed(2)}px)` : '';
          waterFill.style.backdropFilter       = blurStr;
          waterFill.style.webkitBackdropFilter = blurStr;
        }

        // Caustic canvas opacity
        if (causticCvs) {
          causticCvs.style.opacity = t > 0.40
            ? Math.min(1, (t - 0.40) / 0.30).toFixed(3)
            : '0';
        }

        // surface-crossed class with hysteresis (add at t>0.27, remove at t<0.20)
        if (t > 0.27 && !document.body.classList.contains('surface-crossed')) {
          document.body.classList.add('surface-crossed');
        } else if (t < 0.20) {
          document.body.classList.remove('surface-crossed');
        }

        // Expose depth/slow factors for particle system
        window.oceanState.particleDepthFactor = t > 0.40 ? Math.min(1, (t - 0.40) / 0.40) : 0;
        window.oceanState.particleSlowFactor  = t > 0.15 ? Math.max(0.3, 1 - (t - 0.15) / 0.55 * 0.7) : 1;
      }
    }
    requestAnimationFrame(update);
  }
  requestAnimationFrame(update);
}


/* =============================================
   CAUSTIC + GOD-RAY CANVAS
   ============================================= */
function initCausticCanvas() {
  const canvas = document.getElementById('caustic-canvas');
  if (!canvas) return null;
  const ctx = canvas.getContext('2d');

  const isMobile  = window.innerWidth < 768;
  const cellCount = isMobile ? 80 : 200;

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    canvas.width  = window.innerWidth  * dpr;
    canvas.height = window.innerHeight * dpr;
    ctx.scale(dpr, dpr);
  }

  // Pre-generate caustic cells
  const cells = Array.from({ length: cellCount }, () => ({
    cx:    Math.random(),
    cy:    Math.random(),
    phase: Math.random() * Math.PI * 2,
    scale: 0.3 + Math.random() * 0.7,
  }));

  // Pre-generate god rays (6 tapered rays from top-center)
  const RAY_COUNT = 6;
  const godRays = Array.from({ length: RAY_COUNT }, (_, i) => ({
    angle:   -Math.PI / 2 + (i - RAY_COUNT / 2 + 0.5) * (Math.PI / 5),
    halfWid: 0.015 + Math.random() * 0.025,
    alpha:   0.04  + Math.random() * 0.05,
    phase:   Math.random() * Math.PI * 2,
  }));

  function draw(ts) {
    const t = window.oceanState.scrollT;
    if (t < 0.35) return;

    const w = window.innerWidth;
    const h = window.innerHeight;
    ctx.clearRect(0, 0, w, h);

    const intensity = Math.min(1, (t - 0.40) / 0.30);
    const time      = ts * 0.0006;

    // Pass 1: caustic shimmer triangles (source-over)
    ctx.globalCompositeOperation = 'source-over';
    for (const cell of cells) {
      const ph = cell.phase + time;
      const x  = (cell.cx + Math.sin(ph * 0.7) * 0.05) * w;
      const y  = (cell.cy + Math.cos(ph * 0.5) * 0.05) * h;
      const r  = 20 + cell.scale * 60;
      const a  = 0.03 * intensity * (0.5 + 0.5 * Math.sin(ph * 1.3));

      const a0 = ph;
      const a1 = ph + Math.PI * 2 / 3;
      const a2 = ph + Math.PI * 4 / 3;
      const M  = Math.PI / 3; // 60°

      const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
      grad.addColorStop(0,   'rgba(0,229,176,0.9)');
      grad.addColorStop(0.5, 'rgba(30,120,180,0.4)');
      grad.addColorStop(1,   'rgba(0,0,0,0)');

      ctx.globalAlpha = a;
      ctx.beginPath();
      ctx.moveTo(x + r * Math.cos(a0), y + r * Math.sin(a0));
      ctx.quadraticCurveTo(x + r * 0.5 * Math.cos(a0 + M), y + r * 0.5 * Math.sin(a0 + M), x + r * Math.cos(a1), y + r * Math.sin(a1));
      ctx.quadraticCurveTo(x + r * 0.5 * Math.cos(a1 + M), y + r * 0.5 * Math.sin(a1 + M), x + r * Math.cos(a2), y + r * Math.sin(a2));
      ctx.quadraticCurveTo(x + r * 0.5 * Math.cos(a2 + M), y + r * 0.5 * Math.sin(a2 + M), x + r * Math.cos(a0), y + r * Math.sin(a0));
      ctx.fillStyle = grad;
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Pass 2: god rays (screen blend, ramps in at t > 0.60)
    if (t > 0.60) {
      const rayInt = Math.min(1, (t - 0.60) / 0.20);
      ctx.globalCompositeOperation = 'screen';
      const ox = w * 0.5;
      const oy = -50;
      const len = h * 2.2;

      for (const ray of godRays) {
        const base = ray.angle + Math.sin(ts * 0.0002 + ray.phase) * 0.02;
        const lx = ox + Math.cos(base - ray.halfWid) * len;
        const ly = oy + Math.sin(base - ray.halfWid) * len;
        const rx = ox + Math.cos(base + ray.halfWid) * len;
        const ry = oy + Math.sin(base + ray.halfWid) * len;

        const a = (ray.alpha * rayInt).toFixed(3);
        const grad = ctx.createLinearGradient(ox, oy, ox, oy + h);
        grad.addColorStop(0,   `rgba(100,200,255,${a})`);
        grad.addColorStop(0.5, `rgba(0,229,176,${(ray.alpha * rayInt * 0.5).toFixed(3)})`);
        grad.addColorStop(1,   'rgba(0,0,0,0)');

        ctx.beginPath();
        ctx.moveTo(ox, oy);
        ctx.lineTo(lx, ly);
        ctx.lineTo(rx, ry);
        ctx.closePath();
        ctx.fillStyle = grad;
        ctx.fill();
      }
      ctx.globalCompositeOperation = 'source-over';
    }
    ctx.globalAlpha = 1;
  }

  resize();
  window.addEventListener('resize', resize);
  return draw;
}


/* =============================================
   MASTER OCEAN RAF LOOP
   ============================================= */
(function initOceanRAF() {
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Scroll-driven DOM updates always run (needed for orientation even under reduced motion)
  initSubmergenceScroll();

  if (reducedMotion) return;

  const drawWaves    = initWaveCanvas();
  const drawCaustics = initCausticCanvas();

  function loop(ts) {
    if (drawWaves)    drawWaves(ts);
    if (drawCaustics) drawCaustics(ts);
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
})();
