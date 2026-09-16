'use strict';

/* =============================================
   GEOBN DEMO — Lyngen Alps avalanche risk
   geobn's bundled example, running in the
   browser: slope, aspect and forest cover come
   from Kartverket's terrain model (pre-computed
   by scripts/build_lyngen_demo.py); the weather
   sliders are scalar inputs. Cells are grouped by
   evidence combination and the network is
   queried once per group, like geobn does.
   Leaflet and the terrain data load only when
   the demo scrolls near.
   ============================================= */
(function initGeobnDemo() {
  const root = document.getElementById('geobn-demo');
  const mapEl = document.getElementById('geobn-map');
  if (!root || !mapEl) return;

  const LEAFLET = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/';
  const TERRAIN_SCRIPT = 'assets/data/lyngen-terrain.js?v=1';
  const TILES = 'https://cache.kartverket.no/v1/wmts/1.0.0/topograatone/default/webmercator/{z}/{y}/{x}.png';

  /* ---- Network: avalanche_risk.bif from geobn's Lyngen example ---- */
  const NODES = {
    slope_angle: { states: ['flat', 'gentle', 'steep', 'extreme'] },
    sun_exposure: { states: ['north', 'east', 'west', 'south'] },
    forest_cover: { states: ['sparse', 'moderate', 'dense'] },
    // Weather nodes carry a representative value per state (roughly the middle
    // of the .bif discretization bins, with the top state at the end of the
    // slider's range).
    recent_snow: { unit: 'cm', states: ['light', 'moderate', 'heavy'], reps: [7, 25, 80] },
    temperature: { unit: '°C', states: ['cold', 'moderate', 'warming'], reps: [-20, -5, 5] },
    wind_load: { unit: 'm/s', states: ['low', 'moderate', 'high'], reps: [2, 10, 25] },
  };

  /* P(terrain_factor | slope_angle, sun_exposure, forest_cover) as [low, medium, high],
     indexed [forest][slope][aspect] with aspect order north, east, west, south. */
  const TERRAIN = [
    [ // sparse (alpine zone: little snow anchoring)
      [[0.970, 0.020, 0.010], [0.980, 0.015, 0.005], [0.980, 0.015, 0.005], [0.990, 0.009, 0.001]],
      [[0.750, 0.180, 0.070], [0.820, 0.130, 0.050], [0.860, 0.110, 0.030], [0.900, 0.080, 0.020]],
      [[0.100, 0.350, 0.550], [0.180, 0.450, 0.370], [0.220, 0.500, 0.280], [0.250, 0.550, 0.200]],
      [[0.080, 0.270, 0.650], [0.120, 0.350, 0.530], [0.160, 0.400, 0.440], [0.200, 0.450, 0.350]],
    ],
    [ // moderate
      [[0.970, 0.023, 0.007], [0.980, 0.017, 0.003], [0.980, 0.017, 0.003], [0.990, 0.009, 0.001]],
      [[0.800, 0.170, 0.030], [0.860, 0.110, 0.030], [0.890, 0.090, 0.020], [0.920, 0.070, 0.010]],
      [[0.180, 0.440, 0.380], [0.270, 0.480, 0.250], [0.310, 0.500, 0.190], [0.350, 0.500, 0.150]],
      [[0.110, 0.350, 0.540], [0.160, 0.410, 0.430], [0.210, 0.440, 0.350], [0.260, 0.490, 0.250]],
    ],
    [ // dense
      [[0.975, 0.020, 0.005], [0.983, 0.015, 0.002], [0.983, 0.015, 0.002], [0.993, 0.006, 0.001]],
      [[0.870, 0.110, 0.020], [0.910, 0.070, 0.020], [0.930, 0.060, 0.010], [0.960, 0.030, 0.010]],
      [[0.280, 0.470, 0.250], [0.380, 0.440, 0.180], [0.430, 0.450, 0.120], [0.470, 0.420, 0.110]],
      [[0.150, 0.420, 0.430], [0.210, 0.460, 0.330], [0.270, 0.470, 0.260], [0.330, 0.480, 0.190]],
    ],
  ];

  /* P(weather_factor | recent_snow, temperature, wind_load) as [stable, elevated, dangerous],
     indexed [wind][snow][temperature]. */
  const WEATHER = [
    [ // low wind
      [[0.900, 0.085, 0.015], [0.830, 0.140, 0.030], [0.620, 0.310, 0.070]],
      [[0.470, 0.380, 0.150], [0.320, 0.430, 0.250], [0.140, 0.420, 0.440]],
      [[0.100, 0.280, 0.620], [0.050, 0.180, 0.770], [0.020, 0.080, 0.900]],
    ],
    [ // moderate wind
      [[0.860, 0.110, 0.030], [0.770, 0.180, 0.050], [0.550, 0.350, 0.100]],
      [[0.370, 0.400, 0.230], [0.220, 0.430, 0.350], [0.080, 0.370, 0.550]],
      [[0.060, 0.240, 0.700], [0.030, 0.150, 0.820], [0.010, 0.060, 0.930]],
    ],
    [ // high wind
      [[0.720, 0.210, 0.070], [0.600, 0.300, 0.100], [0.380, 0.430, 0.190]],
      [[0.230, 0.420, 0.350], [0.130, 0.380, 0.490], [0.050, 0.270, 0.680]],
      [[0.030, 0.180, 0.790], [0.015, 0.105, 0.880], [0.005, 0.045, 0.950]],
    ],
  ];

  /* P(avalanche_risk | terrain_factor, weather_factor) as [low, high]. */
  const RISK = [
    [[0.93, 0.07], [0.77, 0.23], [0.53, 0.47]],
    [[0.59, 0.41], [0.36, 0.64], [0.16, 0.84]],
    [[0.38, 0.62], [0.15, 0.85], [0.05, 0.95]],
  ];

  /* Soft evidence for the weather nodes: a value between two representative
     values is split between those two states. Hard discretization would make
     the map jump at a breakpoint and then stop responding, so the sliders
     would saturate long before their maximum. */
  function softWeights(value, reps) {
    const weights = new Array(reps.length).fill(0);
    const last = reps.length - 1;
    if (value <= reps[0]) {
      weights[0] = 1;
      return weights;
    }
    if (value >= reps[last]) {
      weights[last] = 1;
      return weights;
    }
    for (let i = 0; i < last; i++) {
      if (value <= reps[i + 1]) {
        const f = (value - reps[i]) / (reps[i + 1] - reps[i]);
        weights[i] = 1 - f;
        weights[i + 1] = f;
        break;
      }
    }
    return weights;
  }

  /* P(weather_factor) with the weather evidence mixed in. It doesn't depend on
     the terrain, so it is computed once per slider change. */
  function weatherFactor(snowW, tempW, windW) {
    const pw = [0, 0, 0];
    for (let w = 0; w < 3; w++) {
      if (!windW[w]) continue;
      for (let s = 0; s < 3; s++) {
        if (!snowW[s]) continue;
        for (let t = 0; t < 3; t++) {
          if (!tempW[t]) continue;
          const weight = windW[w] * snowW[s] * tempW[t];
          const row = WEATHER[w][s][t];
          pw[0] += weight * row[0];
          pw[1] += weight * row[1];
          pw[2] += weight * row[2];
        }
      }
    }
    return pw;
  }

  /* The terrain nodes are observed per cell, so inference is a short sum over
     the two intermediate nodes. Returns P(avalanche_risk = high). */
  function queryHighRisk(slope, aspect, forest, pw) {
    const pt = TERRAIN[forest][slope][aspect];
    let high = 0;
    for (let t = 0; t < 3; t++) {
      for (let w = 0; w < 3; w++) {
        high += pt[t] * pw[w] * RISK[t][w][1];
      }
    }
    return high;
  }

  /* "heavy", or "moderate → heavy" while a value sits between two states. */
  function stateLabel(weights, states) {
    const ranked = weights
      .map((w, i) => [w, i])
      .filter(([w]) => w > 0.005)
      .sort((a, b) => b[0] - a[0]);
    if (!ranked.length) return states[0];
    if (ranked[0][0] > 0.99 || ranked.length === 1) return states[ranked[0][1]];
    return ranked
      .slice(0, 2)
      .sort((a, b) => a[1] - b[1])
      .map(([, i]) => states[i])
      .join(' → ');
  }

  function entropyBits(p) {
    if (p <= 0 || p >= 1) return 0;
    return -(p * Math.log2(p) + (1 - p) * Math.log2(1 - p));
  }

  /* Terrain codes: slope * 12 + aspect * 3 + forest; 255 = sea or no data. */
  const NO_DATA = 255;
  const N_CODES = 48;
  const decodeSlope = (c) => Math.floor(c / 12);
  const decodeAspect = (c) => Math.floor(c / 3) % 4;
  const decodeForest = (c) => c % 3;

  /* ---- Colour ramps ----
     Sequential, one hue each, monotone in lightness. Over the map the
     alpha grows with the value, so low values let the map show through. */
  const RAMPS = {
    light: {
      risk: ['#fdf0e8', '#f6c3a3', '#eb8a57', '#c85a24', '#7f3310'],
      entropy: ['#f1effc', '#cbc3f3', '#9d8ce6', '#6a53c9', '#3b2a85'],
      input: ['#cde2fb', '#86b6ef', '#3987e5', '#1c5cab', '#0d366b'],
    },
    dark: {
      risk: ['#2b211c', '#6e3a1f', '#b8582a', '#eb8a57', '#ffc9a3'],
      entropy: ['#221f33', '#43357a', '#6d5bc4', '#a391f0', '#d9d0ff'],
      input: ['#16233a', '#184f95', '#2a78d6', '#6da7ec', '#b7d3f6'],
    },
  };

  const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);

  function hexToRgb(hex) {
    const n = parseInt(hex.replace('#', ''), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  const RAMP_RGB = {};
  for (const mode of Object.keys(RAMPS)) {
    RAMP_RGB[mode] = {};
    for (const name of Object.keys(RAMPS[mode])) RAMP_RGB[mode][name] = RAMPS[mode][name].map(hexToRgb);
  }

  function rampColor(stops, t) {
    const pos = clamp(t, 0, 1) * (stops.length - 1);
    const i = Math.min(Math.floor(pos), stops.length - 2);
    const f = pos - i;
    const a = stops[i];
    const b = stops[i + 1];
    return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
  }

  /* Only cells above a cutoff are painted, and the ramp spans the band above
     it. Worsening weather then makes the risk spread across the map instead
     of tinting everything at once. */
  const RISK_CUTOFF = 0.4;

  const LAYERS = {
    risk: {
      label: 'P(high risk)', ramp: 'risk', cutoff: RISK_CUTOFF,
      minLabel: `${RISK_CUTOFF} · below hidden`, maxLabel: '1',
      value: (c) => state.pHigh[c],
    },
    entropy: {
      label: 'Entropy', ramp: 'entropy', cutoff: 0.55,
      minLabel: '0.55 bits · below hidden', maxLabel: '1 bit',
      value: (c) => entropyBits(state.pHigh[c]),
    },
    slope: {
      label: 'Slope class', ramp: 'input', cutoff: 0.1,
      minLabel: 'gentle', maxLabel: 'extreme',
      value: (c) => decodeSlope(c) / 3,
    },
  };

  /* Fade in over the first stretch above the cutoff, so the edge of the
     painted area stays soft instead of showing a hard contour. */
  function alphaFor(u) {
    return u < 0.15 ? (u / 0.15) * 0.3 : 0.3 + 0.6 * ((u - 0.15) / 0.85);
  }

  const state = {
    layer: 'risk',
    pHigh: new Float64Array(N_CODES),
    weights: { snow: [1, 0, 0], temp: [1, 0, 0], wind: [1, 0, 0] },
  };

  /* ---- Loading ---- */
  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src;
      s.onload = resolve;
      s.onerror = () => reject(new Error(`Failed to load ${src}`));
      document.head.appendChild(s);
    });
  }

  function loadStylesheet(href) {
    return new Promise((resolve, reject) => {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = href;
      link.onload = resolve;
      link.onerror = () => reject(new Error(`Failed to load ${href}`));
      document.head.appendChild(link);
    });
  }

  async function decodeTerrain(data) {
    const bytes = Uint8Array.from(atob(data.codes), (ch) => ch.charCodeAt(0));
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate'));
    const codes = new Uint8Array(await new Response(stream).arrayBuffer());
    if (codes.length !== data.width * data.height) throw new Error('Terrain data has the wrong size');
    return codes;
  }

  function showFallback() {
    root.querySelector('.geobn-body').hidden = true;
    root.querySelector('.geobn-fallback').hidden = false;
  }

  let started = false;
  function start() {
    if (started) return;
    started = true;
    if (!('DecompressionStream' in window)) {
      showFallback();
      return;
    }
    Promise.all([
      loadStylesheet(`${LEAFLET}leaflet.min.css`),
      loadScript(`${LEAFLET}leaflet.min.js`),
      loadScript(TERRAIN_SCRIPT),
    ])
      .then(() => decodeTerrain(window.GEOBN_LYNGEN))
      .then((codes) => init(window.L, window.GEOBN_LYNGEN, codes))
      .catch(showFallback);
  }

  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          io.disconnect();
          start();
        }
      },
      { rootMargin: '600px 0px' }
    );
    io.observe(root);
  } else {
    start();
  }

  /* ---- The demo ---- */
  function init(L, data, codes) {
    const body = root.querySelector('.geobn-body');
    const legendBar = document.getElementById('geobn-legend-bar');
    const legendMin = document.getElementById('geobn-legend-min');
    const legendMax = document.getElementById('geobn-legend-max');
    const readout = document.getElementById('geobn-readout');
    const tableBody = document.getElementById('geobn-table-body');
    const inputs = {
      snow: document.getElementById('geobn-snow'),
      temp: document.getElementById('geobn-temp'),
      wind: document.getElementById('geobn-wind'),
    };
    const outputs = {
      snow: document.getElementById('geobn-snow-out'),
      temp: document.getElementById('geobn-temp-out'),
      wind: document.getElementById('geobn-wind-out'),
    };
    const layerBtns = root.querySelectorAll('[data-layer]');
    body.hidden = false;

    const W = data.width;
    const H = data.height;
    const [xmin, , , ymax] = data.extent3857;
    const res = data.resolution;

    // geobn-style batching: count cells per evidence combination once;
    // the weather is uniform, so combinations only differ in terrain.
    const counts = new Uint32Array(N_CODES);
    let cells = 0;
    for (let i = 0; i < codes.length; i++) {
      if (codes[i] === NO_DATA) continue;
      counts[codes[i]]++;
      cells++;
    }
    let queries = 0;
    for (let c = 0; c < N_CODES; c++) if (counts[c]) queries++;

    const map = L.map(mapEl, { scrollWheelZoom: false, minZoom: 7 });
    map.attributionControl.setPrefix('<a href="https://leafletjs.com">Leaflet</a>');
    L.tileLayer(TILES, {
      maxZoom: 16,
      attribution: '&copy; <a href="https://www.kartverket.no/">Kartverket</a>',
    }).addTo(map);
    map.fitBounds(data.bounds);
    // Page scroll shouldn't zoom the map until the visitor interacts with it.
    map.on('click', () => map.scrollWheelZoom.enable());
    map.on('mouseout', () => map.scrollWheelZoom.disable());

    const off = document.createElement('canvas');
    off.width = W;
    off.height = H;
    const offCtx = off.getContext('2d');
    const image = offCtx.createImageData(W, H);
    const overlay = L.imageOverlay(off.toDataURL(), data.bounds, { interactive: false }).addTo(map);
    const probeMarker = L.circleMarker([0, 0], { radius: 6, weight: 2, fill: false, interactive: false });
    let probe = null; // L.LatLng or null

    const themeMode = () => (document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light');

    function recompute() {
      state.weights = {
        snow: softWeights(Number(inputs.snow.value), NODES.recent_snow.reps),
        temp: softWeights(Number(inputs.temp.value), NODES.temperature.reps),
        wind: softWeights(Number(inputs.wind.value), NODES.wind_load.reps),
      };
      const pw = weatherFactor(state.weights.snow, state.weights.temp, state.weights.wind);
      for (let c = 0; c < N_CODES; c++) {
        state.pHigh[c] = counts[c]
          ? queryHighRisk(decodeSlope(c), decodeAspect(c), decodeForest(c), pw)
          : 0;
      }
    }

    function draw() {
      const mode = themeMode();
      const layer = LAYERS[state.layer];
      const stops = RAMP_RGB[mode][layer.ramp];

      // One colour per terrain code, then paint cells by lookup. Codes below
      // the cutoff keep alpha 0 and leave the map bare.
      const lut = new Uint8ClampedArray(N_CODES * 4);
      for (let c = 0; c < N_CODES; c++) {
        const u = (layer.value(c) - layer.cutoff) / (1 - layer.cutoff);
        if (u <= 0) continue;
        const t = clamp(u, 0, 1);
        const col = rampColor(stops, t);
        lut.set([col[0], col[1], col[2], Math.round(alphaFor(t) * 255)], c * 4);
      }
      const px = image.data;
      for (let i = 0; i < codes.length; i++) {
        const o = i * 4;
        const c = codes[i];
        if (c === NO_DATA) {
          px[o + 3] = 0;
          continue;
        }
        px[o] = lut[c * 4];
        px[o + 1] = lut[c * 4 + 1];
        px[o + 2] = lut[c * 4 + 2];
        px[o + 3] = lut[c * 4 + 3];
      }
      offCtx.putImageData(image, 0, 0);
      overlay.setUrl(off.toDataURL());

      const legendStops = [0, 0.25, 0.5, 0.75, 1].map((t) => {
        const col = rampColor(stops, t);
        return `rgba(${col.map(Math.round).join(', ')}, ${Math.max(alphaFor(t), 0.06).toFixed(2)})`;
      });
      legendBar.style.background = `linear-gradient(90deg, ${legendStops.join(', ')})`;
      legendMin.textContent = layer.minLabel;
      legendMax.textContent = layer.maxLabel;

      probeMarker.setStyle({ color: getComputedStyle(document.documentElement).getPropertyValue('--text').trim() });
    }

    function codeAt(latlng) {
      const R = 6378137;
      const x = (R * latlng.lng * Math.PI) / 180;
      const y = R * Math.log(Math.tan(Math.PI / 4 + (latlng.lat * Math.PI) / 360));
      const col = Math.floor((x - xmin) / res);
      const row = Math.floor((ymax - y) / res);
      if (col < 0 || row < 0 || col >= W || row >= H) return NO_DATA;
      return codes[row * W + col];
    }

    const fmtInt = (n) => n.toLocaleString('en-US');

    function describeProbe() {
      if (!probe) return 'Hover or tap the map to inspect a location.';
      const where = `${probe.lat.toFixed(3)}° N, ${probe.lng.toFixed(3)}° E`;
      const c = codeAt(probe);
      if (c === NO_DATA) return `${where}: sea, or outside the study area.`;
      const p = state.pHigh[c];
      return (
        `${where}: ${NODES.slope_angle.states[decodeSlope(c)]} slope, ` +
        `${NODES.sun_exposure.states[decodeAspect(c)]}-facing, ` +
        `${NODES.forest_cover.states[decodeForest(c)]} forest → ` +
        `P(high risk) ${p.toFixed(2)}, entropy ${entropyBits(p).toFixed(2)} bits.`
      );
    }

    function updateText() {
      // Not shown on the page; the map's aria-label describes it for screen readers.
      let shadedCells = 0;
      let weighted = 0;
      for (let c = 0; c < N_CODES; c++) {
        if (!counts[c]) continue;
        weighted += state.pHigh[c] * counts[c];
        if (state.pHigh[c] > RISK_CUTOFF) shadedCells += counts[c];
      }
      const pct = Math.round((shadedCells / cells) * 100);
      const mean = weighted / cells;
      mapEl.setAttribute(
        'aria-label',
        `${LAYERS[state.layer].label} map of the Lyngen Alps. Mean P(high risk) ${mean.toFixed(2)}, ` +
        `with ${pct}% of the land shaded above ${RISK_CUTOFF}.`
      );
      readout.textContent = describeProbe();

      outputs.snow.textContent = `${inputs.snow.value} cm · ${stateLabel(state.weights.snow, NODES.recent_snow.states)}`;
      outputs.temp.textContent = `${inputs.temp.value} °C · ${stateLabel(state.weights.temp, NODES.temperature.states)}`;
      outputs.wind.textContent = `${inputs.wind.value} m/s · ${stateLabel(state.weights.wind, NODES.wind_load.states)}`;

      // Table view: the lookup table geobn builds, one row per combination present.
      const rows = [];
      for (let c = 0; c < N_CODES; c++) if (counts[c]) rows.push(c);
      rows.sort((a, b) => counts[b] - counts[a]);
      tableBody.replaceChildren(
        ...rows.map((c) => {
          const tr = document.createElement('tr');
          const values = [
            NODES.slope_angle.states[decodeSlope(c)],
            NODES.sun_exposure.states[decodeAspect(c)],
            NODES.forest_cover.states[decodeForest(c)],
            fmtInt(counts[c]),
            state.pHigh[c].toFixed(2),
          ];
          for (const text of values) {
            const td = document.createElement('td');
            td.textContent = text;
            tr.appendChild(td);
          }
          return tr;
        })
      );
    }

    let pending = { data: false, text: false };
    let frame = 0;
    function schedule(redraw) {
      pending.text = true;
      if (redraw) pending.data = true;
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        if (pending.data) {
          recompute();
          draw();
        }
        updateText();
        pending = { data: false, text: false };
      });
    }

    layerBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        state.layer = btn.dataset.layer;
        layerBtns.forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
        schedule(true);
      });
    });
    Object.values(inputs).forEach((input) => input.addEventListener('input', () => schedule(true)));

    function setProbe(latlng) {
      probe = latlng;
      if (probe) probeMarker.setLatLng(probe).addTo(map);
      else probeMarker.remove();
      schedule(false);
    }
    map.on('mousemove', (e) => setProbe(e.latlng));
    map.on('click', (e) => setProbe(e.latlng));
    map.on('mouseout', () => setProbe(null));

    new MutationObserver(() => schedule(true)).observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });
    // The card may still be laying out when the map is created, so the first
    // fitBounds can use the wrong size. Re-fit once it has real dimensions.
    let fitted = false;
    function fitMap() {
      map.invalidateSize();
      if (!fitted && mapEl.clientWidth > 0) {
        map.fitBounds(data.bounds);
        fitted = true;
      }
    }
    requestAnimationFrame(fitMap);
    if ('ResizeObserver' in window) {
      new ResizeObserver(fitMap).observe(mapEl);
    }

    recompute();
    draw();
    updateText();
  }
})();
