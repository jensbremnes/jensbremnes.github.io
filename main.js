'use strict';


window.oceanState = { particleDepthFactor: 0, particleSlowFactor: 1, scrollT: 0 };


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
    { yFrac: 0.72, amp: 18 * ampMult, freq: 0.008, speed: 0.0004, color: 'rgba(10,22,40,0.85)',  type: 'fill' },
    { yFrac: 0.78, amp: 12 * ampMult, freq: 0.013, speed: 0.0007, color: 'rgba(0,60,90,0.70)',   type: 'fill' },
    { yFrac: 0.83, amp:  8 * ampMult, freq: 0.019, speed: 0.0011, color: 'rgba(0,229,176,0.25)', type: 'foam' },
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
  const causticCvs  = document.getElementById('caustic-canvas');

  let scrollDirty = false;
  let lastT = -1;
  let heroH = hero.offsetHeight || window.innerHeight;  // Fix 1: cache, avoid layout in RAF

  window.addEventListener('resize', () => {
    heroH = hero.offsetHeight || window.innerHeight;
  }, { passive: true });
  window.addEventListener('scroll', () => { scrollDirty = true; }, { passive: true });

  function update() {
    if (scrollDirty) {
      scrollDirty = false;
      const t = Math.min(1, window.scrollY / heroH);

      if (Math.abs(t - lastT) > 0.0005) {
        lastT = t;
        window.oceanState.scrollT = t;

        // Water fill tint + backdrop blur
        if (waterFill) {
          let fillAlpha = 0;
          let blur = 0;
          if (t > 0.15) {
            fillAlpha = Math.min(0.12, (t - 0.15) / 0.35 * 0.12);
            if (t > 0.70) fillAlpha = Math.min(0.18, fillAlpha + (t - 0.70) / 0.30 * 0.06);
            if (t > 0.40) blur = Math.min(0.8, (t - 0.40) / 0.15 * 0.8);
          }
          const fa  = fillAlpha.toFixed(3);
          const fa2 = fillAlpha.toFixed(3);
          waterFill.style.background          = `linear-gradient(to bottom, rgba(0,20,50,${fa}), rgba(5,10,18,${fa2}))`;
          // Fix 5: CSS custom property avoids per-frame style recalc storms
          waterFill.style.setProperty('--blur', blur > 0 ? `${blur.toFixed(2)}px` : '0px');
        }

        // Caustic canvas opacity
        if (causticCvs) {
          causticCvs.style.opacity = t > 0.40
            ? Math.min(1, (t - 0.40) / 0.30).toFixed(3)
            : '0';
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
  const cellCount = isMobile ? 32 : 120;  // Fix 4: ~60% mobile / ~40% desktop reduction

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
   UNDERWATER LIFE CANVAS
   ============================================= */
function initUnderwaterLife() {
  const canvas = document.getElementById('underwater-life');
  if (!canvas) return null;
  const ctx = canvas.getContext('2d');
  const isMobile = window.innerWidth < 768;

  // --- Plankton ---
  const PLANKTON_COUNT = isMobile ? 20 : 50;
  const plankton = Array.from({ length: PLANKTON_COUNT }, () => ({
    x:          Math.random(),
    y:          0.4 + Math.random() * 0.6,
    r:          1 + Math.random() * 2,
    speed:      0.00004 + Math.random() * 0.00006,
    wobbleFreq: 0.0008  + Math.random() * 0.001,
    wobbleAmp:  0.008   + Math.random() * 0.012,
    phase:      Math.random() * Math.PI * 2,
    isCyan:     Math.random() > 0.4,
    _lastTs:    null,
  }));

  // --- Fish ---
  const FISH_COUNT = isMobile ? 3 : 5;
  function makeFish(exitedGoingRight) {
    const goingRight = exitedGoingRight === undefined
      ? Math.random() > 0.5
      : !exitedGoingRight;
    return {
      x:          goingRight ? -0.15 : 1.15,
      y:          0.15 + Math.random() * 0.70,
      vx:         (0.000015 + Math.random() * 0.00002) * (goingRight ? 1 : -1),
      vy:         (Math.random() - 0.5) * 0.000004,
      width:      60 + Math.random() * 120,
      opacity:    0.04 + Math.random() * 0.04,
      goingRight,
      _lastTs:    null,
    };
  }
  const fish = Array.from({ length: FISH_COUNT }, () => makeFish());

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    canvas.width  = window.innerWidth  * dpr;
    canvas.height = window.innerHeight * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function drawFishShape(cx, cy, w, facingRight) {
    const bw   = w * 0.75;
    const bh   = w * 0.13;
    const tailW = w * 0.28;
    const tailL = w * 0.22;
    const dir  = facingRight ? 1 : -1;
    // Body
    ctx.beginPath();
    ctx.ellipse(cx + dir * w * 0.04, cy, bw, bh, 0, 0, Math.PI * 2);
    ctx.fill();
    // Tail
    const rearX = cx - dir * (bw - w * 0.04);
    ctx.beginPath();
    ctx.moveTo(rearX,                cy - tailW);
    ctx.lineTo(rearX,                cy + tailW);
    ctx.lineTo(rearX - dir * tailL,  cy);
    ctx.closePath();
    ctx.fill();
  }

  function draw(ts) {
    const depth = window.oceanState.particleDepthFactor;
    const W = window.innerWidth;
    const H = window.innerHeight;
    ctx.clearRect(0, 0, W, H);
    if (depth <= 0) return;

    // ---- Plankton ----
    for (const p of plankton) {
      const dt = p._lastTs !== null ? ts - p._lastTs : 0;
      p._lastTs = ts;
      p.y -= p.speed * dt;
      if (p.y < -0.02) { p.y = 1.02; p.x = Math.random(); }

      const px = (p.x + Math.sin(ts * p.wobbleFreq + p.phase) * p.wobbleAmp) * W;
      const py = p.y * H;
      const alpha = depth * (p.isCyan ? 0.12 : 0.09);
      const [r, g, b] = p.isCyan ? [0, 229, 176] : [126, 179, 255];

      const grad = ctx.createRadialGradient(px, py, 0, px, py, p.r * 3);
      grad.addColorStop(0,   `rgba(${r},${g},${b},${alpha.toFixed(3)})`);
      grad.addColorStop(0.4, `rgba(${r},${g},${b},${(alpha * 0.4).toFixed(3)})`);
      grad.addColorStop(1,   `rgba(${r},${g},${b},0)`);

      ctx.beginPath();
      ctx.arc(px, py, p.r * 3, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();

      ctx.beginPath();
      ctx.arc(px, py, p.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${r},${g},${b},${(depth * 0.2).toFixed(3)})`;
      ctx.fill();
    }

    // ---- Fish ----
    for (const f of fish) {
      const dt = f._lastTs !== null ? ts - f._lastTs : 0;
      f._lastTs = ts;
      f.x += f.vx * dt * window.oceanState.particleSlowFactor;
      f.y += f.vy * dt;
      if (f.y < 0.10) { f.y = 0.10; f.vy =  Math.abs(f.vy); }
      if (f.y > 0.90) { f.y = 0.90; f.vy = -Math.abs(f.vy); }

      const exited = f.goingRight ? f.x > 1.15 : f.x < -0.15;
      if (exited) { Object.assign(f, makeFish(f.goingRight)); continue; }

      ctx.fillStyle = `rgba(2,8,18,${(f.opacity * depth).toFixed(3)})`;
      drawFishShape(f.x * W, f.y * H, f.width, f.goingRight);
    }
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

  const drawWaves         = initWaveCanvas();
  const drawCaustics      = initCausticCanvas();
  const drawUnderwaterLife = initUnderwaterLife();

  let rafId = null;
  function loop(ts) {
    if (drawWaves)         drawWaves(ts);
    if (drawCaustics)      drawCaustics(ts);
    if (drawUnderwaterLife) drawUnderwaterLife(ts);
    rafId = requestAnimationFrame(loop);
  }

  // Fix 2: pause RAF when hero is completely off-screen
  const heroEl = document.getElementById('hero');
  if (heroEl) {
    new IntersectionObserver((entries) => {
      const visible = entries[0].isIntersecting;
      if (visible && rafId === null) {
        rafId = requestAnimationFrame(loop);
      } else if (!visible && rafId !== null && window.oceanState.particleDepthFactor <= 0) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
    }, { threshold: 0 }).observe(heroEl);
  } else {
    rafId = requestAnimationFrame(loop);
  }
})();

/* =============================================
   PUBLICATION SORT TOGGLE
   ============================================= */
(function initPubSort() {
  const btnDate      = document.getElementById('pub-sort-date');
  const btnCitations = document.getElementById('pub-sort-citations');
  if (!btnDate || !btnCitations) return;

  const lists = document.querySelectorAll('.pub-list');
  const originals = Array.from(lists).map(list =>
    Array.from(list.querySelectorAll('li.pub-entry'))
  );

  function applySort(byCitations) {
    btnDate.setAttribute('aria-pressed', !byCitations);
    btnCitations.setAttribute('aria-pressed', byCitations);

    lists.forEach((list, i) => {
      const items = byCitations
        ? [...originals[i]].sort((a, b) =>
            parseInt(b.dataset.citations, 10) - parseInt(a.dataset.citations, 10))
        : [...originals[i]];
      items.forEach(li => list.appendChild(li));
    });
  }

  btnDate.addEventListener('click',      () => applySort(false));
  btnCitations.addEventListener('click', () => applySort(true));
})();



/* =============================================
   PAUSE OFF-SCREEN CSS ANIMATIONS (Fix 6)
   ============================================= */
(function initAnimationVisibility() {
  const hero  = document.getElementById('hero');
  const about = document.getElementById('about');

  if (hero) {
    const heroTargets = [
      document.querySelector('.scroll-line'),
      document.getElementById('surface-shimmer-overlay'),
    ].filter(Boolean);

    new IntersectionObserver((entries) => {
      const visible = entries[0].isIntersecting;
      heroTargets.forEach(el => el.classList.toggle('is-playing', visible));
    }, { threshold: 0 }).observe(hero);
  }

  if (about) {
    const photoRing = about.querySelector('.photo-ring');
    if (photoRing) {
      new IntersectionObserver((entries) => {
        photoRing.classList.toggle('is-playing', entries[0].isIntersecting);
      }, { threshold: 0 }).observe(about);
    }
  }
})();
