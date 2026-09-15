'use strict';

/* =============================================
   THEME TOGGLE
   ============================================= */
(function initThemeToggle() {
  const STORAGE_KEY = 'cv-theme';
  const root = document.documentElement;

  const btn = document.getElementById('theme-toggle');
  if (!btn) return;

  btn.addEventListener('click', function () {
    const isDark = root.getAttribute('data-theme') === 'dark';
    if (isDark) {
      root.removeAttribute('data-theme');
      localStorage.setItem(STORAGE_KEY, 'light');
    } else {
      root.setAttribute('data-theme', 'dark');
      localStorage.setItem(STORAGE_KEY, 'dark');
    }
  });
})();


/* =============================================
   ACTIVE NAV LINK (IntersectionObserver)
   ============================================= */
(function initActiveNav() {
  const sections = document.querySelectorAll('main section[id]');
  const navLinks = document.querySelectorAll('#nav a');
  if (!sections.length || !navLinks.length) return;

  function setActive(id) {
    navLinks.forEach((link) => {
      link.classList.toggle('active', link.getAttribute('href') === `#${id}`);
    });
  }

  const visible = new Map();

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        visible.set(entry.target.id, entry.isIntersecting ? entry.intersectionRatio : 0);
      });
      let bestId = null;
      let bestRatio = 0;
      visible.forEach((ratio, id) => {
        if (ratio > bestRatio) {
          bestRatio = ratio;
          bestId = id;
        }
      });
      if (bestId) setActive(bestId);
    },
    { threshold: [0.1, 0.3, 0.6], rootMargin: '-10% 0px -20% 0px' }
  );

  sections.forEach((s) => observer.observe(s));
})();


/* =============================================
   PUBLICATION SORT TOGGLE
   ============================================= */
(function initPubSort() {
  const btnDate = document.getElementById('pub-sort-date');
  const btnCitations = document.getElementById('pub-sort-citations');
  if (!btnDate || !btnCitations) return;

  const lists = document.querySelectorAll('.pub-list');
  const originals = Array.from(lists).map((list) =>
    Array.from(list.querySelectorAll('li.pub-entry'))
  );

  // Prefer the live badge text (kept current by the weekly citation
  // update workflow) over the static data-citations attribute.
  function citationCount(li) {
    const badge = li.querySelector('.pub-citations');
    if (badge) {
      const n = parseInt(badge.textContent, 10);
      if (!Number.isNaN(n)) return n;
    }
    return parseInt(li.dataset.citations, 10) || 0;
  }

  function applySort(byCitations) {
    btnDate.setAttribute('aria-pressed', String(!byCitations));
    btnCitations.setAttribute('aria-pressed', String(byCitations));

    lists.forEach((list, i) => {
      const items = byCitations
        ? [...originals[i]].sort((a, b) => citationCount(b) - citationCount(a))
        : [...originals[i]];
      items.forEach((li) => list.appendChild(li));
    });
  }

  btnDate.addEventListener('click', () => applySort(false));
  btnCitations.addEventListener('click', () => applySort(true));
})();


/* =============================================
   HERO SCENE
   Minimalist line-art canvas: drones in the sky,
   a USV riding the waves, an AUV below — all in
   the site's accent palette. Vehicles steer away
   from the cursor. Reduced motion gets a single
   static frame; the loop pauses off-screen.
   ============================================= */
(function initHeroScene() {
  const canvas = document.getElementById('hero-scene-canvas');
  if (!canvas || !canvas.getContext) return;
  const ctx = canvas.getContext('2d');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let W = 0;
  let H = 0;
  let dpr = 1;
  let colors = {};
  let pointer = null; // {x, y} in canvas coords, or null

  function hexToRgb(hex) {
    let h = hex.trim().replace('#', '');
    if (h.length === 3) h = h.replace(/./g, (c) => c + c);
    const n = parseInt(h, 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
  }

  function rgba(rgb, a) {
    return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${a})`;
  }

  function readColors() {
    const style = getComputedStyle(document.documentElement);
    colors = {
      accent: hexToRgb(style.getPropertyValue('--accent')),
      accent2: hexToRgb(style.getPropertyValue('--accent-2')),
      accent3: hexToRgb(style.getPropertyValue('--accent-3')),
      faint: hexToRgb(style.getPropertyValue('--text-faint')),
    };
  }

  function resize() {
    const rect = canvas.parentElement.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = rect.width;
    H = rect.height;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  /* Water surface: two overlapping travelling sines. */
  function waterBase() {
    return H * 0.58;
  }

  function waterY(x, t) {
    return (
      waterBase() +
      Math.sin(x * 0.011 + t * 0.7) * 4.5 +
      Math.sin(x * 0.021 - t * 1.1) * 2.5
    );
  }

  /* ---- Actors ---- */
  const rand = (a, b) => a + Math.random() * (b - a);

  /* Each aerial/underwater type is a small fleet; `s` scales the
     sprite and negative `cruise` means it travels leftwards. */
  const quads = [
    { x: 0, y: 0, vx: 0, vy: 0, cruise: 26, phase: rand(0, 9), s: 1 },
    { x: 0, y: 0, vx: 0, vy: 0, cruise: -18, phase: rand(0, 9), s: 0.7 },
  ];
  const wings = [
    { x: 0, y: 0, vx: 0, vy: 0, cruise: 52, phase: rand(0, 9), s: 1 },
    { x: 0, y: 0, vx: 0, vy: 0, cruise: -38, phase: rand(0, 9), s: 0.75 },
  ];
  const usv = { x: 0, vx: 0, cruise: 14 };
  const auvs = [
    { x: 0, y: 0, vx: 0, vy: 0, cruise: -26, phase: rand(0, 9), s: 1 },
    { x: 0, y: 0, vx: 0, vy: 0, cruise: 18, phase: rand(0, 9), s: 0.7 },
  ];
  const clouds = [];
  const bubbles = [];

  function placeActors() {
    quads[0].x = W * 0.22;
    quads[0].y = H * 0.2;
    quads[1].x = W * 0.55;
    quads[1].y = H * 0.12;
    wings[0].x = W * 0.65;
    wings[0].y = H * 0.32;
    wings[1].x = W * 0.1;
    wings[1].y = H * 0.42;
    usv.x = W * 0.78;
    usv.vx = usv.cruise;
    auvs[0].x = W * 0.4;
    auvs[0].y = H * 0.82;
    auvs[1].x = W * 0.72;
    auvs[1].y = H * 0.68;
    for (const a of [...quads, ...wings, ...auvs]) a.vx = a.cruise;
    clouds.length = 0;
    for (let i = 0; i < 3; i++) {
      clouds.push({
        x: W * (0.12 + i * 0.34) + rand(-30, 30),
        y: H * rand(0.08, 0.24),
        s: rand(0.8, 1.25),
        v: rand(3, 6),
      });
    }
  }

  /* Cursor avoidance: a soft vertical nudge only — vehicles keep
     their speed and gently drift up or down away from the pointer.
     Graceful motion matters more than actually escaping. */
  function avoid(actor, dt, radius, push) {
    if (!pointer) return;
    const dx = actor.x - pointer.x;
    const dy = actor.y - pointer.y;
    const d = Math.hypot(dx, dy);
    if (d > radius || d < 0.001) return;
    const f = push * Math.pow(1 - d / radius, 2);
    actor.vy += Math.sign(dy || 1) * f * dt;
  }

  /* Horizontal escape: lets an actor brake and reverse away from
     the pointer instead of ploughing through it. `y` is passed in
     because the USV has no y of its own (it rides the waterline). */
  function avoidX(actor, y, dt, radius, push) {
    if (!pointer) return;
    const dx = actor.x - pointer.x;
    const dy = y - pointer.y;
    const d = Math.hypot(dx, dy);
    if (d > radius || d < 0.001) return;
    const f = push * Math.pow(1 - d / radius, 2);
    actor.vx += Math.sign(dx || 1) * f * dt;
  }

  const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);
  const relax = (v, target, dt, rate) => v + (target - v) * Math.min(1, rate * dt);

  let tNow = 0;

  function update(dt, t) {
    tNow = t;
    const wb = waterBase();

    // Quadrotors: slow cruise + gentle vertical wander, above the waves.
    for (const quad of quads) {
      const lim = Math.abs(quad.cruise) * 2;
      avoid(quad, dt, 150, 120);
      avoidX(quad, quad.y, dt, 150, 140);
      quad.vx = relax(quad.vx, quad.cruise, dt, 1.2);
      quad.vx = clamp(quad.vx, -lim, lim);
      quad.vy = relax(quad.vy, Math.sin(t * 0.45 + quad.phase) * 7, dt, 1.2);
      quad.vy = clamp(quad.vy, -16, 16);
      quad.x += quad.vx * dt;
      quad.y += quad.vy * dt;
      quad.y = Math.min(Math.max(quad.y, H * 0.08), wb - 26);
      if (quad.x > W + 40) quad.x = -40;
      if (quad.x < -60) quad.x = W + 40;
    }

    // Fixed-wings: faster, shallower wander.
    for (const wing of wings) {
      avoid(wing, dt, 150, 100);
      wing.vx = relax(wing.vx, wing.cruise, dt, 1.0);
      wing.vy = relax(wing.vy, Math.sin(t * 0.3 + wing.phase) * 5, dt, 1.0);
      wing.vy = clamp(wing.vy, -12, 12);
      wing.x += wing.vx * dt;
      wing.y += wing.vy * dt;
      wing.y = Math.min(Math.max(wing.y, H * 0.08), wb - 22);
      if (wing.x > W + 50) wing.x = -50;
      if (wing.x < -60) wing.x = W + 50;
    }

    // USV: rides the surface; brakes and reverses away from the pointer.
    avoidX(usv, waterY(usv.x, t), dt, 150, 90);
    usv.vx = relax(usv.vx, usv.cruise, dt, 0.8);
    usv.vx = clamp(usv.vx, -usv.cruise * 2, usv.cruise * 2);
    usv.x += usv.vx * dt;
    if (usv.x > W + 50) usv.x = -50;
    if (usv.x < -60) usv.x = W + 50;

    // AUVs: cruise underwater with slow depth changes.
    for (const auv of auvs) {
      avoid(auv, dt, 150, 100);
      auv.vx = relax(auv.vx, auv.cruise, dt, 1.0);
      auv.vy = relax(auv.vy, Math.sin(t * 0.35 + auv.phase) * 5, dt, 1.0);
      auv.vy = clamp(auv.vy, -12, 12);
      auv.x += auv.vx * dt;
      auv.y += auv.vy * dt;
      auv.y = Math.min(Math.max(auv.y, wb + 26), H - 14);
      if (auv.x < -60) auv.x = W + 50;
      if (auv.x > W + 60) auv.x = -50;
    }

    for (const c of clouds) {
      c.x += c.v * dt;
      if (c.x - 70 * c.s > W) c.x = -80 * c.s;
    }

    // Occasional bubbles from the AUVs' tails (tail is opposite the direction of travel).
    if (Math.random() < dt * 2 * auvs.length && bubbles.length < 14) {
      const auv = auvs[Math.floor(Math.random() * auvs.length)];
      const tail = (auv.cruise < 0 ? 20 : -20) * auv.s;
      bubbles.push({ x: auv.x + tail, y: auv.y - 2, r: rand(1, 2.2), life: 1 });
    }
    for (let i = bubbles.length - 1; i >= 0; i--) {
      const b = bubbles[i];
      b.y -= 12 * dt;
      b.life -= dt * 0.45;
      if (b.life <= 0 || b.y < waterY(b.x, t)) bubbles.splice(i, 1);
    }
  }

  /* ---- Drawing ---- */

  function drawCloud(c) {
    ctx.fillStyle = rgba(colors.faint, 0.16);
    ctx.beginPath();
    ctx.ellipse(c.x, c.y, 34 * c.s, 10 * c.s, 0, 0, Math.PI * 2);
    ctx.ellipse(c.x - 18 * c.s, c.y + 4 * c.s, 22 * c.s, 8 * c.s, 0, 0, Math.PI * 2);
    ctx.ellipse(c.x + 20 * c.s, c.y + 5 * c.s, 20 * c.s, 7 * c.s, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawQuad(quad) {
    const bank = Math.max(-0.3, Math.min(0.3, (quad.vx - quad.cruise) * 0.012 + quad.vy * 0.008));
    ctx.save();
    ctx.translate(quad.x, quad.y);
    ctx.scale(quad.s, quad.s);
    ctx.rotate(bank);
    ctx.strokeStyle = rgba(colors.accent2, 0.95);
    ctx.fillStyle = rgba(colors.accent2, 0.95);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-11, 0);
    ctx.lineTo(11, 0);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 1.5, 2.6, 0, Math.PI * 2);
    ctx.fill();
    // Rotor strokes; blur hinted by paired lines.
    for (const sx of [-11, 11]) {
      ctx.beginPath();
      ctx.moveTo(sx - 6, -3);
      ctx.lineTo(sx + 6, -3);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawWing(wing) {
    const pitch = Math.max(-0.25, Math.min(0.25, wing.vy * 0.01));
    ctx.save();
    ctx.translate(wing.x, wing.y);
    // Sprite is drawn nose-right; mirror it when cruising left.
    ctx.scale((wing.cruise < 0 ? -1 : 1) * wing.s, wing.s);
    ctx.rotate(pitch);
    ctx.strokeStyle = rgba(colors.accent3, 0.95);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(14, 0);
    ctx.lineTo(-12, 0);
    ctx.stroke();
    // Swept main wing + tail.
    ctx.beginPath();
    ctx.moveTo(2, 0);
    ctx.lineTo(-6, -6);
    ctx.moveTo(2, 0);
    ctx.lineTo(-6, 6);
    ctx.moveTo(-12, 0);
    ctx.lineTo(-15, -4);
    ctx.stroke();
    ctx.restore();
  }

  function drawUsv(t) {
    const y = waterY(usv.x, t);
    const slope = (waterY(usv.x + 8, t) - waterY(usv.x - 8, t)) / 16;
    ctx.save();
    ctx.translate(usv.x, y);
    ctx.rotate(Math.atan(slope));
    ctx.strokeStyle = rgba(colors.accent, 0.95);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-13, -3);
    ctx.lineTo(13, -3);
    ctx.lineTo(8, 3);
    ctx.lineTo(-9, 3);
    ctx.closePath();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(2, -3);
    ctx.lineTo(2, -10);
    ctx.stroke();
    ctx.fillStyle = rgba(colors.accent, 0.95);
    ctx.beginPath();
    ctx.arc(2, -11.5, 1.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawAuv(auv) {
    const pitch = Math.max(-0.2, Math.min(0.2, -auv.vy * 0.01));
    ctx.save();
    ctx.translate(auv.x, auv.y);
    // Sprite is drawn nose-left; mirror it when cruising right.
    ctx.scale((auv.cruise < 0 ? 1 : -1) * auv.s, auv.s);
    ctx.rotate(pitch);
    ctx.strokeStyle = rgba(colors.accent, 0.85);
    ctx.lineWidth = 1.5;
    // Torpedo hull, nose to the left (it cruises left).
    ctx.beginPath();
    ctx.moveTo(-18, 0);
    ctx.quadraticCurveTo(-18, -5, -10, -5);
    ctx.lineTo(14, -5);
    ctx.lineTo(18, 0);
    ctx.lineTo(14, 5);
    ctx.lineTo(-10, 5);
    ctx.quadraticCurveTo(-18, 5, -18, 0);
    ctx.closePath();
    ctx.stroke();
    // Tail fins.
    ctx.beginPath();
    ctx.moveTo(14, -5);
    ctx.lineTo(17, -9);
    ctx.moveTo(14, 5);
    ctx.lineTo(17, 9);
    ctx.stroke();
    ctx.restore();
  }

  function drawWater(t) {
    // Crest line.
    ctx.strokeStyle = rgba(colors.accent2, 0.55);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let x = 0; x <= W; x += 6) {
      const y = waterY(x, t);
      x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.stroke();
    // Fill fades to transparent so the hero melts into the page bg.
    const grad = ctx.createLinearGradient(0, waterBase(), 0, H);
    grad.addColorStop(0, rgba(colors.accent2, 0.1));
    grad.addColorStop(1, rgba(colors.accent2, 0));
    ctx.fillStyle = grad;
    ctx.beginPath();
    for (let x = 0; x <= W; x += 6) {
      const y = waterY(x, t);
      x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.lineTo(W, H);
    ctx.lineTo(0, H);
    ctx.closePath();
    ctx.fill();
  }

  function draw(t) {
    ctx.clearRect(0, 0, W, H);
    for (const c of clouds) drawCloud(c);
    drawWater(t);
    ctx.fillStyle = rgba(colors.accent, 0.5);
    for (const b of bubbles) {
      ctx.globalAlpha = Math.max(0, b.life);
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    for (const q of quads) drawQuad(q);
    for (const w of wings) drawWing(w);
    drawUsv(t);
    for (const a of auvs) drawAuv(a);
  }

  /* ---- Boot ---- */
  readColors();
  resize();
  placeActors();

  new MutationObserver(readColors).observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-theme'],
  });

  if (reduceMotion) {
    draw(0);
    new MutationObserver(() => draw(0)).observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });
    if ('ResizeObserver' in window) {
      new ResizeObserver(() => {
        resize();
        placeActors();
        draw(0);
      }).observe(canvas.parentElement);
    }
    return;
  }

  if ('ResizeObserver' in window) {
    let firstResize = true;
    new ResizeObserver(() => {
      if (firstResize) {
        firstResize = false;
        return;
      }
      resize();
      placeActors();
    }).observe(canvas.parentElement);
  }

  window.addEventListener('pointermove', (e) => {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    // Track the cursor a bit beyond the strip so vehicles react early.
    pointer =
      y > -80 && y < rect.height + 40 && x > -40 && x < rect.width + 40 ? { x, y } : null;
  });
  window.addEventListener('pointerleave', () => (pointer = null));

  let running = true;
  let visible = true;
  let last = null;
  let rafId = 0;

  function frame(ms) {
    if (last === null) last = ms;
    const dt = Math.min((ms - last) / 1000, 0.05);
    last = ms;
    const t = ms / 1000;
    update(dt, t);
    draw(t);
    rafId = requestAnimationFrame(frame);
  }

  function setRunning(next) {
    if (next === running) return;
    running = next;
    if (running) {
      last = null;
      rafId = requestAnimationFrame(frame);
    } else {
      cancelAnimationFrame(rafId);
    }
  }

  if ('IntersectionObserver' in window) {
    new IntersectionObserver(
      (entries) => {
        visible = entries[0].isIntersecting;
        setRunning(visible && !document.hidden);
      },
      { threshold: 0 }
    ).observe(canvas);
  }

  document.addEventListener('visibilitychange', () => {
    setRunning(visible && !document.hidden);
  });

  rafId = requestAnimationFrame(frame);
})();


/* =============================================
   SCROLL REVEAL
   Elements opt in via [data-reveal]; the .reveal
   class is only added here, so without JS (or with
   reduced motion) everything stays visible.
   ============================================= */
(function initScrollReveal() {
  const targets = document.querySelectorAll('[data-reveal]');
  if (!targets.length) return;
  if (!('IntersectionObserver' in window)) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.1, rootMargin: '0px 0px -5% 0px' }
  );

  targets.forEach((el) => {
    el.classList.add('reveal');
    observer.observe(el);
  });
})();
