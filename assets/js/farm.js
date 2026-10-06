/* AGROVANT — farm map generator + mock data (dados demonstrativos) */
(function () {
  'use strict';

  const NS = 'http://www.w3.org/2000/svg';
  const fmt1 = (n) => n.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const fmt2 = (n) => n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fmtInt = (n) => Math.round(n).toLocaleString('pt-BR');

  function rng(seed) {
    let s = seed % 2147483647; if (s <= 0) s += 2147483646;
    return () => (s = (s * 16807) % 2147483647) / 2147483647;
  }

  /* ---------- properties ---------- */
  const PROPS = {
    'santa-helena': {
      name: 'Santa Helena', full: 'Propriedade Santa Helena', safra: 'Safra 2026/27',
      total: 1284, cult: 1087, crop: 'Soja', forecast: 74.8, status: 'Operação normal', tone: 'ok',
      seed: 11, cropMix: ['Soja'], rainSeed: 5, rainSum: 72, temp: 26
    },
    'boa-esperanca': {
      name: 'Boa Esperança', full: 'Propriedade Boa Esperança', safra: 'Safra 2026/27',
      total: 2310, cult: 1962, crop: 'Soja', forecast: 69.3, status: '2 alertas críticos', tone: 'warn',
      seed: 29, cropMix: ['Soja'], rainSeed: 17, rainSum: 54, temp: 28
    },
    'sao-lucas': {
      name: 'São Lucas', full: 'Propriedade São Lucas', safra: 'Safra 2026/27',
      total: 846, cult: 731, crop: 'Milho', forecast: 128.6, status: 'Colheita em andamento', tone: 'info',
      seed: 47, cropMix: ['Milho'], rainSeed: 23, rainSum: 81, temp: 25
    }
  };

  function ndviClass(v) {
    v = Math.round(v * 100) / 100; // classify what the reader sees (0,70 is Saudável)
    if (v >= 0.85) return { key: 'exc', label: 'Excelente', color: '#B6F23A' };
    if (v >= 0.7) return { key: 'ok', label: 'Saudável', color: '#6F9C2C' };
    if (v >= 0.55) return { key: 'att', label: 'Atenção', color: '#D7B14A' };
    return { key: 'crit', label: 'Crítico', color: '#C8573C' };
  }

  /* ---------- geometry: jittered tessellation with shared vertices ---------- */
  function geometry(seed, cols, rows, w, h) {
    const r = rng(seed * 7 + cols * 13 + rows);
    const mx = w * 0.035, my = h * 0.05;
    const iw = w - mx * 2, ih = h - my * 2;
    const V = [];
    for (let j = 0; j <= rows; j++) {
      V[j] = [];
      for (let i = 0; i <= cols; i++) {
        let x = mx + (iw * i) / cols, y = my + (ih * j) / rows;
        if (i > 0 && i < cols) x += (r() - 0.5) * (iw / cols) * 0.42;
        if (j > 0 && j < rows) y += (r() - 0.5) * (ih / rows) * 0.36;
        if (i === 0 || i === cols) x += (r() - 0.5) * 6;
        if (j === 0 || j === rows) y += (r() - 0.5) * 6;
        V[j][i] = [x, y];
      }
    }
    const cells = [];
    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < cols; i++) {
        const p = [V[j][i], V[j][i + 1], V[j + 1][i + 1], V[j + 1][i]];
        // shrink toward centroid a little: gaps read as farm roads/terraces
        const cx = p.reduce((a, b) => a + b[0], 0) / 4, cy = p.reduce((a, b) => a + b[1], 0) / 4;
        const s = 0.972;
        const q = p.map(([x, y]) => [cx + (x - cx) * s, cy + (y - cy) * s]);
        let area = 0;
        for (let k = 0; k < 4; k++) { const a = q[k], b = q[(k + 1) % 4]; area += a[0] * b[1] - b[0] * a[1]; }
        cells.push({ pts: q, cx, cy, area: Math.abs(area) / 2, angle: [0, 90, 28, -34, 62, -12][Math.floor(r() * 6)] });
      }
    }
    // road along an internal vertex column
    const rc = Math.max(1, Math.floor(cols / 2));
    const road = V.map((row) => row[rc]);
    return { cells, road, V, w, h, cols, rows };
  }

  /* ---------- talhão data ---------- */
  const cache = {};
  function talhoes(propKey, count) {
    const k = propKey + ':' + count;
    if (cache[k]) return cache[k];
    const P = PROPS[propKey];
    const r = rng(P.seed * 31 + count);
    const base = P.forecast;
    let list = [];
    for (let n = 0; n < count; n++) {
      const ndvi = Math.min(0.93, Math.max(0.47, 0.69 + r() * 0.23 - (r() < 0.14 ? 0.17 : 0)));
      const crop = P.cropMix[Math.floor(r() * P.cropMix.length)];
      const cropBase = crop === 'Milho' ? (P.crop === 'Milho' ? base : 124) : (P.crop === 'Soja' ? base : 68);
      list.push({
        id: String(n + 1).padStart(2, '0'),
        ndvi,
        umid: Math.round(40 + r() * 36 - (ndvi < 0.6 ? 8 : 0)),
        prod: cropBase * (0.86 + (ndvi - 0.46) * 0.48),
        crop,
        w: 0.75 + r() * 0.5
      });
    }
    // area distribution to match cultivated area
    const tw = list.reduce((a, t) => a + t.w, 0);
    list.forEach((t) => (t.area = (t.w / tw) * P.cult));
    if (propKey === 'santa-helena') {
      const t4 = list[3], t8 = list[7], t12 = list[11];
      if (t4) { t4.umid = 34; t4.ndvi = 0.63; t4.crop = 'Soja'; t4.prod = 66.1; }
      if (t8) { t8.area = 46.2; t8.crop = 'Soja'; t8.ndvi = 0.82; t8.umid = 67; t8.prod = 75.1; }
      if (t12) { t12.ndvi = 0.58; t12.crop = 'Soja'; t12.prod = 68.4; }
      if (list[0]) { list[0].ndvi = 0.89; list[0].crop = 'Soja'; }
    }
    list.forEach((t) => (t.cls = ndviClass(t.ndvi)));
    cache[k] = list;
    return list;
  }

  /* ---------- layer colouring ---------- */
  function lerp(a, b, t) { return a + (b - a) * t; }
  function mix(c1, c2, t) {
    const p = (c) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
    const a = p(c1), b = p(c2);
    return '#' + a.map((v, i) => Math.round(lerp(v, b[i], t)).toString(16).padStart(2, '0')).join('');
  }
  function ramp(stops, t) {
    t = Math.max(0, Math.min(1, t));
    const seg = (stops.length - 1) * t, i = Math.min(stops.length - 2, Math.floor(seg));
    return mix(stops[i], stops[i + 1], seg - i);
  }
  const UMID = ['#B98E4E', '#8C8A5C', '#4F8378', '#2E6B80'];
  const PROD = ['#6B4A2B', '#A08A45', '#6F9C2C', '#C2F04E'];

  function fillFor(t, layer, P) {
    if (layer === 'sat') return 'rgba(0,0,0,0)';
    if (layer === 'umid') return ramp(UMID, (t.umid - 30) / 50);
    if (layer === 'prod') {
      const lo = P.forecast * 0.84, hi = P.forecast * 1.08;
      return ramp(PROD, (t.prod - lo) / (hi - lo));
    }
    return t.cls.color;
  }

  const LEGENDS = {
    ndvi: [['Excelente', '#B6F23A'], ['Saudável', '#6F9C2C'], ['Atenção', '#D7B14A'], ['Crítico', '#C8573C']],
    umid: [['Muito seco', UMID[0]], ['Seco', UMID[1]], ['Adequado', UMID[2]], ['Úmido', UMID[3]]],
    prod: [['Abaixo', PROD[0]], ['Média', PROD[1]], ['Acima', PROD[2]], ['Topo', PROD[3]]],
    sat: [['Imagem RGB', '#8E978F'], ['Limite do talhão', '#F4F6F1']]
  };

  /* ---------- render ---------- */
  let uid = 0;
  function el(name, attrs, parent) {
    const n = document.createElementNS(NS, name);
    for (const k in attrs) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  }
  const d = (pts) => 'M' + pts.map((p) => p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join('L') + 'Z';

  function render(svg) {
    const vb = svg.viewBox.baseVal;
    const w = vb.width || 600, h = vb.height || 360;
    const prop = svg.dataset.prop || 'santa-helena';
    const P = PROPS[prop];
    const portrait = h > w;
    const cols = parseInt(svg.dataset.cols, 10) || (portrait ? 3 : 6);
    const rows = portrait ? 6 : 3;
    const geo = geometry(P.seed, cols, rows, w, h);
    const data = talhoes(prop, cols * rows);
    const id = 'fm' + (++uid);
    const interactive = svg.hasAttribute('data-interactive');
    const labels = interactive || svg.hasAttribute('data-labels');
    svg.innerHTML = '';
    // a role="img" would hide the focusable plots from assistive tech
    if (interactive) svg.setAttribute('role', 'group');

    const defs = el('defs', {}, svg);
    [0, 90, 28, -34, 62, -12].forEach((a) => {
      const pat = el('pattern', { id: `${id}-r${a}`, width: 5, height: 5, patternUnits: 'userSpaceOnUse', patternTransform: `rotate(${a})` }, defs);
      el('rect', { width: 1.2, height: 5, fill: 'rgba(0,0,0,.2)' }, pat);
    });

    el('rect', { width: w, height: h, fill: '#0F140F' }, svg);
    const small = window.matchMedia && window.matchMedia('(max-width: 760px)').matches;
    // talhoes-m is already loaded by the hero map (desktop) and the survey photo (mobile)
    const photo = (small && svg.dataset.photoM) || svg.dataset.photo || 'assets/img/talhoes-m.webp';
    const img = el('image', { href: photo, x: 0, y: 0, width: w, height: h, preserveAspectRatio: 'xMidYMid slice', class: 'fphoto' }, svg);
    // processed band texture, clipped to the plots: gives each talhão real in-field variation
    const clip = el('clipPath', { id: `${id}-clip` }, defs);
    geo.cells.forEach((c) => el('path', { d: d(c.pts) }, clip));
    const tex = el('image', { href: photo, x: 0, y: 0, width: w, height: h, preserveAspectRatio: 'xMidYMid slice', class: 'ftex', 'clip-path': `url(#${id}-clip)` }, svg);
    // river + riparian buffer (APP)
    const rv = rng(P.seed + 3);
    const ry = h * (0.62 + rv() * 0.2);
    const riverD = portrait
      ? `M${w * 0.1} -10 C ${w * 0.32} ${h * 0.25}, ${w * -0.05} ${h * 0.55}, ${w * 0.22} ${h + 10}`
      : `M -10 ${ry} C ${w * 0.08} ${ry - 30}, ${w * 0.12} ${h + 10}, ${w * 0.2} ${h + 20}`;
    el('path', { d: riverD, class: 'river-buf' }, svg);

    const gT = el('g', {}, svg);
    const gR = el('g', {}, svg);
    const gL = el('g', {}, svg);
    const polys = geo.cells.map((c, i) => {
      const t = data[i];
      const p = el('path', { d: d(c.pts), class: 't', fill: fillFor(t, svg.dataset.layer || 'ndvi', P), 'data-i': i }, gT);
      el('path', { d: d(c.pts), class: 'tr', fill: `url(#${id}-r${c.angle})` }, gR);
      if (labels) {
        const tx = el('text', { x: c.cx, y: c.cy + 4, 'text-anchor': 'middle', class: 'tl' }, gL);
        tx.textContent = t.id;
      }
      if (interactive) {
        p.setAttribute('tabindex', '0');
        p.setAttribute('role', 'button');
        p.setAttribute('aria-label', `Talhão ${t.id}, ${t.crop}, ${fmt1(t.area)} hectares, NDVI ${fmt2(t.ndvi)}, ${t.cls.label}`);
      }
      return p;
    });
    el('path', { d: riverD, class: 'river' }, svg);
    el('path', { d: 'M' + geo.road.map((p) => p.join(' ')).join('L'), class: 'road' }, svg);
    el('path', { d: 'M' + geo.road.map((p) => p.join(' ')).join('L'), class: 'road-c' }, svg);
    const hq = geo.road[Math.floor(geo.road.length / 2)];
    el('rect', { x: hq[0] - 5, y: hq[1] - 5, width: 10, height: 10, class: 'hq' }, svg);

    const hov = el('path', { class: 't-hov', d: '' }, svg);
    const sel = el('path', { class: 't-sel', d: '' }, svg);

    const api = {
      svg, prop, data, geo, polys,
      setLayer(layer, keepFills) {
        svg.dataset.layer = layer;
        if (!keepFills) polys.forEach((p, i) => p.setAttribute('fill', fillFor(data[i], layer, P)));
        gT.style.fillOpacity = { sat: 0, ndvi: 0.6, umid: 0.62, prod: 0.74 }[layer];
        img.style.opacity = layer === 'sat' ? 1 : 0.22;
        img.style.filter = layer === 'sat' ? 'saturate(.85) brightness(.88)' : 'grayscale(1) brightness(.45)';
        tex.style.display = layer === 'sat' ? 'none' : '';
        if (layer === 'ndvi') tex.setAttribute('filter', 'url(#f-ndvi)');
        else if (layer === 'umid') tex.setAttribute('filter', 'url(#f-umid)');
        else tex.removeAttribute('filter');
        tex.style.filter = layer === 'prod' ? 'grayscale(1) brightness(.7)' : '';
        gR.style.opacity = layer === 'sat' ? 0 : 0.8;
      },
      select(i) {
        sel.setAttribute('d', i == null ? '' : polys[i].getAttribute('d'));
        api.selected = i;
      },
      hover(i) { hov.setAttribute('d', i == null ? '' : polys[i].getAttribute('d')); }
    };
    api.setLayer(svg.dataset.layer || 'ndvi');
    svg._farm = api;
    return api;
  }

  /* ---------- climate / series data ---------- */
  function rain30(propKey) {
    const P = PROPS[propKey];
    const r = rng(P.rainSeed * 101);
    let vals = Array.from({ length: 30 }, () => (r() < 0.55 ? 0 : Math.pow(r(), 1.6) * 18));
    const sum = vals.reduce((a, b) => a + b, 0) || 1;
    vals = vals.map((v) => (v / sum) * P.rainSum);
    return vals;
  }
  function days30() {
    const end = new Date(2026, 9, 4);
    return Array.from({ length: 30 }, (_, i) => {
      const dt = new Date(end); dt.setDate(end.getDate() - (29 - i));
      return dt.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '');
    });
  }
  const WEEK = [
    { n: 'Hoje', ic: 'i-partly', max: 31, min: 20, p: 18 },
    { n: 'Seg', ic: 'i-sun', max: 32, min: 19, p: 5 },
    { n: 'Ter', ic: 'i-partly', max: 30, min: 20, p: 22 },
    { n: 'Qua', ic: 'i-rain', max: 26, min: 19, p: 74 },
    { n: 'Qui', ic: 'i-storm', max: 24, min: 18, p: 88 },
    { n: 'Sex', ic: 'i-rain', max: 25, min: 18, p: 61 },
    { n: 'Sáb', ic: 'i-partly', max: 28, min: 18, p: 15 }
  ];
  const MACHINES = [
    { id: 'JD-08', type: 'Trator', h: 324, use: 92, st: 'Manutenção prevista' },
    { id: 'CS-02', type: 'Colheitadeira', h: 251, use: 71, st: 'Em operação' },
    { id: 'PL-05', type: 'Plantadeira', h: 198, use: 58, st: 'Em operação' },
    { id: 'PV-01', type: 'Pulverizador', h: 152, use: 44, st: 'Disponível' },
    { id: 'JD-11', type: 'Trator', h: 133, use: 39, st: 'Disponível' }
  ];

  window.AGV = { fillFor, PROPS, talhoes, render, ndviClass, LEGENDS, rain30, days30, WEEK, MACHINES, fmt1, fmt2, fmtInt, rng };
})();
