/* AGROVANT — interactions (todos os dados são demonstrativos) */
(function () {
  'use strict';
  const A = window.AGV;
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = window.matchMedia('(pointer: fine)').matches;
  const { fmt1, fmt2, fmtInt } = A;

  function onView(el, cb, opts = {}) {
    if (!('IntersectionObserver' in window)) { cb(); return; }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) { cb(e); io.disconnect(); } });
    }, { threshold: opts.threshold || 0.25, rootMargin: opts.margin || '0px 0px -8% 0px' });
    io.observe(el);
  }

  /* ---------------- header / nav ---------------- */
  const header = $('.site-header');
  const onScroll = () => header.classList.toggle('is-scrolled', window.scrollY > 24);
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  const burger = $('.burger');
  const drawer = $('#drawer');
  function setDrawer(open) {
    burger.setAttribute('aria-expanded', String(open));
    burger.setAttribute('aria-label', open ? 'Fechar menu' : 'Abrir menu');
    burger.querySelector('use').setAttribute('href', open ? '#i-close' : '#i-menu');
    if (open) {
      drawer.hidden = false;
      requestAnimationFrame(() => drawer.classList.add('is-open'));
      document.body.style.overflow = 'hidden';
      setTimeout(() => $('a', drawer).focus(), 80);
    } else {
      drawer.classList.remove('is-open');
      document.body.style.overflow = '';
      setTimeout(() => { if (!drawer.classList.contains('is-open')) drawer.hidden = true; }, 560);
    }
  }
  burger.addEventListener('click', () => setDrawer(burger.getAttribute('aria-expanded') !== 'true'));
  $$('a', drawer).forEach((a) => a.addEventListener('click', () => setDrawer(false)));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && burger.getAttribute('aria-expanded') === 'true') { setDrawer(false); burger.focus(); }
  });

  const navLinks = $$('.nav a');
  if ('IntersectionObserver' in window) {
    const navIO = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) navLinks.forEach((a) => a.classList.toggle('is-active', a.getAttribute('href') === '#' + (e.target.dataset.nav || '')));
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    $$('[data-nav], .hero, .metrics').forEach((s) => navIO.observe(s));
  }

  /* repaint a farm map in the order a scan line passes over it */
  function sweepLayer(api, layer, host) {
    const P = A.PROPS[api.prop];
    host.classList.remove('is-sweeping'); void host.offsetWidth; host.classList.add('is-sweeping');
    api.setLayer(layer, !reduce);
    if (reduce) return;
    api.polys.forEach((p, i) => setTimeout(() => p.setAttribute('fill', A.fillFor(api.data[i], layer, P)), (api.geo.cells[i].cx / api.geo.w) * 850));
  }

  /* ---------------- farm maps ---------------- */
  $$('svg[data-farm]').forEach((svg) => A.render(svg));

  /* ---------------- hero band processing ---------------- */
  const scene = $('[data-scene]');
  const sweepLabel = $('[data-sweep-label]');
  const sceneLayers = { rgb: $('.scene__img--rgb', scene), ndvi: $('.scene__img--ndvi', scene), umid: $('.scene__img--umid', scene) };
  const shData = A.talhoes('santa-helena', 18);
  const shNdvi = fmt2(shData.reduce((a, t) => a + t.ndvi, 0) / shData.length);
  const shUmid = Math.round(shData.reduce((a, t) => a + t.umid, 0) / shData.length) + '%';
  const BANDS = {
    rgb: { sweep: 'RGB', layer: 'sat', name: 'RGB', desc: 'Cor natural, como o olho vê.', label: 'RGB · Sentinel-2 · 10 m' },
    ndvi: { sweep: 'NDVI', layer: 'ndvi', name: 'NDVI · ' + shNdvi, desc: 'Vigor da lavoura: quanto mais perto de 1, mais saudável.', label: 'NDVI · ' + shNdvi + ' média' },
    umid: { sweep: 'UMIDADE', layer: 'umid', name: 'Umidade · ' + shUmid, desc: 'Água no solo, estimada por sensores e satélite.', label: 'Umidade do solo · ' + shUmid + ' média' }
  };
  const heroMap = $('.hd-map');
  const heroFarm = heroMap && $('svg[data-farm]', heroMap)._farm;
  if (heroMap) { const s = document.createElement('div'); s.className = 'hd-sweep'; s.setAttribute('aria-hidden', 'true'); heroMap.appendChild(s); }
  const paintBand = (b, sweepMap) => {
    const B = BANDS[b];
    sweepLabel.textContent = B.sweep;
    $('[data-band-name]').textContent = B.name;
    $('[data-band-desc]').textContent = B.desc;
    $('[data-hd-label]').textContent = B.label;
    if (heroFarm) { if (sweepMap) sweepLayer(heroFarm, B.layer, heroMap); else heroFarm.setLayer(B.layer); }
  };
  let band = 'rgb';
  paintBand('rgb', false);
  let bandTouched = false;
  function setBand(next) {
    if (next === band) return;
    const prev = sceneLayers[band], nl = sceneLayers[next];
    Object.values(sceneLayers).forEach((l) => { l.classList.remove('is-prev'); if (l !== prev) l.classList.remove('is-on'); });
    prev.classList.remove('is-on'); prev.classList.add('is-prev');
    void nl.offsetWidth;
    nl.classList.add('is-on');
    paintBand(next, true);
    scene.classList.remove('is-sweeping'); void scene.offsetWidth; scene.classList.add('is-sweeping');
    band = next;
    $$('[data-band-btn]').forEach((b) => { const on = b.dataset.bandBtn === next; b.classList.toggle('is-on', on); b.setAttribute('aria-pressed', String(on)); });
  }
  $$('[data-band-btn]').forEach((b) => b.addEventListener('click', () => { bandTouched = true; setBand(b.dataset.bandBtn); }));
  if (!reduce) setTimeout(() => { if (!bandTouched) setBand('ndvi'); }, 2300);

  /* ---------------- charts ---------------- */
  function barChart(box, values, o = {}) {
    box.innerHTML = '';
    const max = (o.max || Math.max(...values)) * 1.08;
    const min = o.min || 0;
    const tip = document.createElement('div');
    tip.className = 'ctip'; tip.hidden = true;
    const bars = values.map((v, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'bar' + (o.hi === i ? ' is-hi' : '');
      b.style.setProperty('--h', Math.max(1.5, ((v - min) / (max - min)) * 100) + '%');
      b.setAttribute('aria-label', o.aria ? o.aria(v, i) : String(v));
      b.innerHTML = '<i></i>' + (o.labels && o.showLabels ? `<span>${o.labels[i]}</span>` : '');
      const show = () => {
        tip.innerHTML = o.tip(v, i);
        tip.hidden = false;
        const br = b.getBoundingClientRect(), cr = box.getBoundingClientRect();
        const ih = b.querySelector('i').getBoundingClientRect();
        let x = br.left - cr.left + br.width / 2;
        x = Math.max(50, Math.min(cr.width - 50, x));
        tip.style.left = x + 'px';
        tip.style.top = (ih.top - cr.top) + 'px';
      };
      b._show = show;
      b.addEventListener('pointerenter', show);
      b.addEventListener('focus', show);
      b.addEventListener('pointerleave', () => (tip.hidden = true));
      b.addEventListener('blur', () => (tip.hidden = true));
      if (o.onPick) b.addEventListener('click', () => o.onPick(i));
      box.appendChild(b);
      return b;
    });
    box.appendChild(tip);
    // one tab stop per chart; arrows walk the bars
    box.setAttribute('role', 'group');
    if (o.label) box.setAttribute('aria-label', o.label + ' (use as setas)');
    const start = o.hi != null ? o.hi : bars.length - 1;
    bars.forEach((b, i) => (b.tabIndex = i === start ? 0 : -1));
    box.onkeydown = (e) => {
      const i = bars.indexOf(document.activeElement);
      if (i < 0) return;
      const n = { ArrowRight: i + 1, ArrowUp: i + 1, ArrowLeft: i - 1, ArrowDown: i - 1, Home: 0, End: bars.length - 1 }[e.key];
      if (n == null) return;
      e.preventDefault();
      const t = Math.max(0, Math.min(bars.length - 1, n));
      bars[i].tabIndex = -1; bars[t].tabIndex = 0; bars[t].focus();
    };
    // touch: drag across the chart instead of aiming at 7px bars
    if (!finePointer) {
      box.style.touchAction = 'pan-y';
      box.onpointerdown = box.onpointermove = (e) => {
        if (e.pointerType === 'mouse') return;
        const r = box.getBoundingClientRect();
        const i = Math.max(0, Math.min(bars.length - 1, Math.floor(((e.clientX - r.left) / r.width) * bars.length)));
        bars.forEach((b, k) => b.classList.toggle('is-scrub', k === i));
        bars[i]._show();
      };
    }
    if (!box.dataset.seen) {
      box.classList.add('is-pre');
      onView(box, () => { box.dataset.seen = '1'; requestAnimationFrame(() => box.classList.remove('is-pre')); });
      bars.forEach((b, i) => (b.querySelector('i').style.transitionDelay = (i * 18) + 'ms'));
    }
    return bars;
  }

  const DAYS = A.days30();
  const ICON = (id) => `<svg aria-hidden="true"><use href="#${id}"/></svg>`;
  function renderWeek(box) {
    box.innerHTML = A.WEEK.map((d, i) => `
      <div class="day${i === 0 ? ' is-today' : ''}">
        <span class="day__n">${d.n}</span>${ICON(d.ic)}
        <span class="day__max">${d.max}°</span><span class="day__min">${d.min}°</span>
        <span class="day__p">${d.p}%</span>
      </div>`).join('');
  }
  $$('[data-week]').forEach(renderWeek);

  const bigRain = $('[data-chart="rain30-big"]');
  if (bigRain) {
    const vals = A.rain30('santa-helena');
    barChart(bigRain, vals, {
      label: 'Precipitação diária, últimos 30 dias',
      tip: (v, i) => `${DAYS[i]} · <b>${fmt1(v)} mm</b>`,
      aria: (v, i) => `${DAYS[i]}: ${fmt1(v)} milímetros`
    });
  }

  /* ---------------- selection panels ---------------- */
  function fillSel(key, t) {
    const box = $(`[data-sel="${key}"]`);
    if (!box || !t) return;
    const map = {
      id: t.id, area: fmt1(t.area) + ' ha', crop: t.crop, ndvi: fmt2(t.ndvi),
      umid: t.umid + '%', status: t.cls.label, prod: fmt1(t.prod) + ' sc/ha'
    };
    $$('[data-s]', box).forEach((n) => {
      const v = map[n.dataset.s];
      if (v != null && n.textContent !== v) {
        n.textContent = v;
        n.classList.add('flash');
        setTimeout(() => n.classList.remove('flash'), 500);
      }
    });
  }

  function bindFarm(svg, opts) {
    const api = svg._farm;
    if (!api) return;
    const n = api.polys.length, cols = api.geo.cols;
    const setTab = (i) => api.polys.forEach((p, k) => p.setAttribute('tabindex', k === i ? '0' : '-1'));
    setTab(opts.initial != null ? opts.initial : 0);
    const pick = (i) => { setTab(i); opts.onSelect(i); };
    api.polys.forEach((p, i) => {
      p.addEventListener('click', () => pick(i));
      p.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(i); return; }
        let t = { ArrowRight: (i + 1) % cols ? i + 1 : i, ArrowLeft: i % cols ? i - 1 : i, ArrowDown: i + cols, ArrowUp: i - cols, Home: 0, End: n - 1 }[e.key];
        if (t == null) return;
        e.preventDefault();
        if (t < 0 || t >= n) t = i;
        setTab(t); api.polys[t].focus();
      });
      p.addEventListener('pointerenter', (e) => { api.hover(i); opts.onHover && opts.onHover(i, e); });
      p.addEventListener('pointermove', (e) => opts.onMove && opts.onMove(i, e));
      p.addEventListener('pointerleave', () => { api.hover(null); opts.onLeave && opts.onLeave(); });
      p.addEventListener('focus', () => { api.hover(i); opts.onHover && opts.onHover(i, null); });
      p.addEventListener('blur', () => { api.hover(null); opts.onLeave && opts.onLeave(); });
    });
  }

  /* ---------------- platform app ---------------- */
  const app = $('[data-app]');
  if (app) {
    let propKey = 'santa-helena';
    let selIdx = 7;
    const appFarms = () => $$('svg[data-farm]', app);

    function setField(name, val) { $$(`[data-f="${name}"]`, app).forEach((n) => (n.textContent = val)); }

    function selectApp(i) {
      selIdx = i;
      const data = A.talhoes(propKey, 18);
      appFarms().forEach((s) => s._farm && s._farm.select(i));
      fillSel('app', data[i]);
      $$('[data-chart="talhao"] .bar', app).forEach((b, k) => b.classList.toggle('is-hi', k === i));
    }

    function renderProp() {
      const P = A.PROPS[propKey];
      const data = A.talhoes(propKey, 18);
      setField('safra', P.safra);
      setField('full', P.full);
      setField('total', fmtInt(P.total));
      setField('cult', fmtInt(P.cult));
      setField('crop', P.crop);
      setField('forecast', fmt1(P.forecast));
      setField('rainsum', P.rainSum + ' mm');
      setField('temp', P.temp + '°C');
      const avg = data.reduce((a, t) => a + t.ndvi, 0) / data.length;
      setField('ndviavg', 'média ' + fmt2(avg));
      const st = $('[data-f="status"]', app);
      st.dataset.tone = P.tone; st.querySelector('span').textContent = P.status;
      renderAlerts(P, data);

      appFarms().forEach((s) => { s.dataset.prop = propKey; A.render(s); bindFarm(s, { onSelect: selectApp, initial: selIdx }); });

      barChart($('[data-chart="talhao"]', app), data.map((t) => t.prod), {
        label: 'Produtividade por talhão',
        labels: data.map((t) => t.id), showLabels: true, hi: selIdx, max: Math.max(...data.map((t) => t.prod)), min: Math.min(...data.map((t) => t.prod)) * 0.82,
        tip: (v, i) => `Talhão ${data[i].id} · <b>${fmt1(v)} sc/ha</b>`,
        aria: (v, i) => `Talhão ${data[i].id}: ${fmt1(v)} sacas por hectare`,
        onPick: selectApp
      });
      const rv = A.rain30(propKey);
      barChart($('[data-chart="rain30"]', app), rv, {
        label: 'Precipitação diária, últimos 30 dias',
        tip: (v, i) => `${DAYS[i]} · <b>${fmt1(v)} mm</b>`,
        aria: (v, i) => `${DAYS[i]}: ${fmt1(v)} milímetros`
      });

      // crops table
      const rows = data.slice().sort((a, b) => b.ndvi - a.ndvi);
      $('[data-table="crops"]', app).innerHTML = `<table class="t"><thead><tr><th>Talhão</th><th>Cultura</th><th>Área</th><th>NDVI</th><th>Umidade</th><th>Produtiv.</th></tr></thead><tbody>${
        rows.map((t) => `<tr><td data-label="Talhão">${t.id}</td><td data-label="Cultura">${t.crop}</td><td data-label="Área">${fmt1(t.area)} ha</td><td data-label="NDVI"><span class="pill" style="--c:${t.cls.color}">${fmt2(t.ndvi)} · ${t.cls.label}</span></td><td data-label="Umidade"><span class="meter${t.umid < 40 ? ' hi' : ''}" style="--w:${t.umid}%"></span> ${t.umid}%</td><td data-label="Produtiv.">${fmt1(t.prod)} sc/ha</td></tr>`).join('')
      }</tbody></table>`;

      // machines
      $('[data-table="machines"]', app).innerHTML = `<table class="t"><thead><tr><th>Máquina</th><th>Tipo</th><th>Horas</th><th>Utilização</th><th>Status</th></tr></thead><tbody>${
        A.MACHINES.map((m) => `<tr><td data-label="Máquina">${m.id}</td><td data-label="Tipo">${m.type}</td><td data-label="Horas">${m.h} h</td><td data-label="Utilização"><span class="meter${m.use > 90 ? ' hi' : ''}" style="--w:${m.use}%"></span> ${m.use}%</td><td data-label="Status"><span class="pill" style="--c:${m.st.startsWith('Manut') ? '#E0B24A' : m.st === 'Em operação' ? '#B6F23A' : '#8E978F'}">${m.st}</span></td></tr>`).join('')
      }</tbody></table>`;

      // seasons
      const k = P.forecast / 74.8;
      const seasons = [61.8, 66.4, 71.2, 74.8].map((v) => v * k);
      barChart($('[data-chart="seasons-mini"]', app), seasons, {
        label: 'Produtividade média por safra',
        labels: ['23/24', '24/25', '25/26', '26/27'], showLabels: true, hi: 3, min: seasons[0] * 0.7,
        tip: (v, i) => `Safra ${['23/24', '24/25', '25/26', '26/27'][i]} · <b>${fmt1(v)} sc/ha</b>`,
        aria: (v, i) => `Safra ${['23/24', '24/25', '25/26', '26/27'][i]}: ${fmt1(v)} sacas por hectare`
      });

      // indicators
      const crit = data.filter((t) => t.cls.key === 'crit' || t.cls.key === 'att').length;
      const inds = [
        ['Eficiência operacional', '+18,4%', 'vs. safra anterior', 78, false],
        ['Custo por hectare', '−9,8%', 'vs. safra anterior', 62, false],
        ['Utilização de máquinas', '+14,2%', 'média da frota', 71, false],
        ['NDVI médio', fmt2(avg), `${crit} talhões em atenção`, avg * 100, crit > 4],
        ['Chuva acumulada', P.rainSum + ' mm', 'últimos 30 dias', P.rainSum, false],
        ['Área cultivada', Math.round((P.cult / P.total) * 100) + '%', fmtInt(P.cult) + ' de ' + fmtInt(P.total) + ' ha', (P.cult / P.total) * 100, false]
      ];
      $('[data-indicators]', app).innerHTML = inds.map(([l, v, d, w, neg]) => `<div class="panel ind"><span class="k-l">${l}</span><span class="ind__v">${v}</span><span class="ind__d${neg ? ' neg' : ''}">${d}</span><span class="ind__m"><i style="--w:${Math.min(100, w)}%"></i></span></div>`).join('');

      // reports
      const reps = [
        ['Relatório semanal · Semana 40', '04 out 2026', 'PDF'],
        ['Produtividade por talhão · ' + P.name, '01 out 2026', 'XLSX'],
        ['Chuvas e janelas de aplicação', '30 set 2026', 'PDF'],
        ['Horas de máquina · setembro', '30 set 2026', 'XLSX'],
        ['Monitoramento NDVI · quinzena', '27 set 2026', 'PDF']
      ];
      $('[data-reports]', app).innerHTML = reps.map(([n, dt, f]) => `<li>${ICON('i-file')}<span>${n}</span><span class="mono">${dt}</span><span class="fmt">${f}</span></li>`).join('');

      selectApp(Math.min(selIdx, data.length - 1));
    }

    function renderAlerts(P, data) {
      const lowU = data.slice().sort((a, b) => a.umid - b.umid)[0];
      const lowN = data.slice().sort((a, b) => a.ndvi - b.ndvi)[0];
      const rain = ['info', 'Chuva intensa', 'Próximas 12 h'];
      const list = {
        'santa-helena': [rain, ['warn', `Umidade do solo · Talhão ${lowU.id}`, `${lowU.umid}% · há 6 min`], ['lime', 'Manutenção · Trator JD-08', '324 h trabalhadas']],
        'boa-esperanca': [['warn', `NDVI em queda · Talhão ${lowN.id}`, `${fmt2(lowN.ndvi)} · −0,11 em 14 dias`], ['warn', `Umidade do solo · Talhão ${lowU.id}`, `${lowU.umid}% · há 22 min`], rain, ['lime', 'Manutenção · Pulverizador PV-01', 'em 18 h de uso']],
        'sao-lucas': [['info', 'Colheita em andamento', '41% da área colhida'], ['lime', 'Colheitadeira CS-02', '251 h na safra']]
      }[propKey];
      $('[data-bell]', app).textContent = list.length;
      $('[data-bell-btn]', app).setAttribute('aria-label', `Alertas da propriedade: ${list.length}`);
      $('[data-bell-h]', app).textContent = `Alertas · ${P.name}`;
      $('[data-bell-list]', app).innerHTML = list.map(([tone, h, d]) => `<li><i class="dot dot--${tone}"></i><span><b>${h}</b><small>${d}</small></span></li>`).join('');
    }

    const bellBtn = $('[data-bell-btn]', app), bellPop = $('[data-bell-pop]', app);
    const setBell = (open) => { bellBtn.setAttribute('aria-expanded', String(open)); bellPop.hidden = !open; };
    bellBtn.addEventListener('click', (e) => { e.stopPropagation(); setBell(bellPop.hidden); });
    document.addEventListener('click', (e) => { if (!bellPop.hidden && !bellPop.contains(e.target)) setBell(false); });
    app.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !bellPop.hidden) { setBell(false); bellBtn.focus(); } });

    function showView(v) {
      $$('[data-view]', app).forEach((x) => { const on = x.dataset.view === v; x.classList.toggle('is-on', on); x.setAttribute('aria-pressed', String(on)); });
      $$('[data-panel]', app).forEach((p) => (p.hidden = p.dataset.panel !== v));
    }

    const sForm = $('[data-app-search]', app), sIn = $('input', sForm);
    sForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const q = sIn.value.trim().toUpperCase().replace(/[\s-]/g, '');
      if (!q) return;
      const m = A.MACHINES.find((x) => x.id.replace('-', '') === q || x.type.toUpperCase().startsWith(q));
      const num = parseInt(q.replace(/\D/g, ''), 10);
      if (m) {
        showView('machines');
        $$('[data-table="machines"] tbody tr', app).forEach((tr) => tr.classList.toggle('is-hit', tr.firstElementChild.textContent === m.id));
      } else if (num >= 1 && num <= 18) {
        showView('overview'); selectApp(num - 1);
      } else {
        sForm.classList.remove('is-miss'); void sForm.offsetWidth; sForm.classList.add('is-miss');
        return;
      }
      sIn.value = '';
    });

    $$('[data-prop]', $('.seg', app)).forEach((b) => b.addEventListener('click', () => {
      if (b.dataset.prop === propKey) return;
      propKey = b.dataset.prop;
      $$('[data-prop]', $('.seg', app)).forEach((x) => { const on = x === b; x.classList.toggle('is-on', on); x.setAttribute('aria-pressed', String(on)); });
      renderProp();
    }));

    $$('[data-view]', app).forEach((b) => b.addEventListener('click', () => showView(b.dataset.view)));

    renderProp();
  }

  /* ---------------- features ---------------- */
  const flist = $('[data-flist]');
  if (flist) {
    const rows = $$('.frow', flist);
    const views = $$('[data-fv]');
    const tag = $('[data-fview-tag]');
    const names = ['LAVOURA', 'CLIMA', 'MÁQUINAS', 'MAPAS', 'INDICADORES', 'RELATÓRIOS'];
    let cur = 0;
    const setF = (i) => {
      if (i === cur) return; cur = i;
      rows.forEach((r, k) => { const on = k === i; r.classList.toggle('is-on', on); r.setAttribute('aria-pressed', String(on)); });
      views.forEach((v) => v.classList.toggle('is-on', +v.dataset.fv === i));
      tag.textContent = `MÓDULO 0${i + 1} · ${names[i]}`;
    };
    $$('[data-open-f]').forEach((a) => a.addEventListener('click', () => setF(+a.dataset.openF)));
    rows.forEach((r, i) => {
      r.addEventListener('click', () => setF(i));
      r.addEventListener('focus', () => setF(i));
      if (finePointer) r.addEventListener('pointerenter', () => setF(i));
    });
  }

  /* ---------------- interactive field map ---------------- */
  const stageEl = $('[data-stage]');
  if (stageEl) {
    const svg = $('svg[data-farm]', stageEl);
    const api = svg._farm;
    const tip = $('[data-tip]', stageEl);
    const legend = $('[data-legend]');
    const data = api.data;
    const paintLegend = (layer) => {
      legend.innerHTML = A.LEGENDS[layer].map(([l, c]) => `<li><i style="--c:${c}"></i>${l}</li>`).join('');
    };
    let layerNow = 'ndvi';
    const NOTES = {
      ndvi: 'O NDVI mede o vigor da lavoura pela luz que as folhas refletem. Quanto mais perto de 1, mais saudável.',
      sat: 'Imagem de drone em cor natural, com o limite de cada talhão.',
      umid: 'Umidade do solo estimada por sensores e satélite. Abaixo de 40% pede atenção.',
      prod: 'Produtividade estimada de cada talhão, em sacas por hectare, comparada à média da propriedade.'
    };
    const tipHTML = (t) => `<p class="tip__h">TALHÃO ${t.id}</p><dl>${[
      ['Área', fmt1(t.area) + ' ha'], ['Cultura', t.crop], ['NDVI', fmt2(t.ndvi), 'ndvi'], ['Umidade', t.umid + '%', 'umid'],
      ['Produtividade', fmt1(t.prod) + ' sc/ha', 'prod'], ['Status', `<span style="color:${t.cls.color}">${t.cls.label}</span>`]
    ].map(([k, v, l]) => `<div${l === layerNow ? ' class="is-layer"' : ''}><dt>${k}</dt><dd>${v}</dd></div>`).join('')}</dl>`;
    const place = (e) => {
      const r = stageEl.getBoundingClientRect();
      let x = e.clientX - r.left + 16, y = e.clientY - r.top + 16;
      const tw = tip.offsetWidth, th = tip.offsetHeight;
      if (x + tw > r.width - 8) x = e.clientX - r.left - tw - 16;
      if (y + th > r.height - 8) y = e.clientY - r.top - th - 16;
      tip.style.left = x + 'px'; tip.style.top = y + 'px';
    };
    bindFarm(svg, {
      onSelect: (i) => { api.select(i); fillSel('map', data[i]); },
      onHover: (i, e) => {
        if (!finePointer) return; // touch: the selection panel carries the details
        tip.innerHTML = tipHTML(data[i]); tip.hidden = false;
        if (e) place(e);
        else {
          const c = api.geo.cells[i], r = stageEl.getBoundingClientRect();
          const sx = r.width / 600, sy = r.height / 360;
          tip.style.left = Math.min(r.width - 220, c.cx * sx + 12) + 'px'; tip.style.top = Math.min(r.height - 150, c.cy * sy + 12) + 'px';
        }
      },
      onMove: (i, e) => { if (finePointer) place(e); },
      onLeave: () => (tip.hidden = true)
    });
    api.select(7); fillSel('map', data[7]);
    $$('.t', svg).forEach((p, k) => p.setAttribute('tabindex', k === 7 ? '0' : '-1'));

    $$('[data-layer-btn]').forEach((b) => b.addEventListener('click', () => {
      const layer = b.dataset.layerBtn;
      $$('[data-layer-btn]').forEach((x) => { const on = x === b; x.classList.toggle('is-on', on); x.setAttribute('aria-pressed', String(on)); });
      layerNow = layer;
      sweepLayer(api, layer, stageEl);
      $('[data-layer-note]').textContent = NOTES[layer];
      $('.s-br', stageEl).textContent = { ndvi: 'NDVI · SENTINEL-2 · 10 m', sat: 'RGB · DRONE · 3 cm', umid: 'UMIDADE DO SOLO · SENSORES', prod: 'PRODUTIVIDADE · MAPA DE COLHEITA' }[layer];
      paintLegend(layer);
    }));
    // progressive load
    if (!reduce) {
      svg.classList.add('is-pre');
      $$('.t, .tr, .tl', svg).forEach((n, k) => (n.style.transitionDelay = ((k % 18) * 45) + 'ms'));
      onView(stageEl, () => {
        svg.classList.remove('is-pre');
        setTimeout(() => $$('.t, .tr, .tl', svg).forEach((n) => (n.style.transitionDelay = '')), 1600);
      });
    }
  }

  /* ---------------- AI chat ---------------- */
  const chat = $('[data-chat]');
  if (chat) {
    const log = $('[data-chat-log]', chat);
    const form = $('[data-chat-form]', chat);
    const input = $('input', form);
    const ANSWERS = [
      {
        q: 'Quais talhões tiveram queda de produtividade nesta safra?',
        a: 'Foram identificadas quedas relevantes nos talhões 04, 12 e 17 em comparação com a safra anterior.',
        head: ['Talhão', 'Variação'],
        rows: [['Talhão 04', '−8,4%', 90, 'neg'], ['Talhão 12', '−6,7%', 72, 'neg'], ['Talhão 17', '−9,3%', 100, 'neg']],
        src: 'Fontes: colheita 25/26 · NDVI · estação SH-01'
      },
      {
        q: 'Quando é a melhor janela para pulverizar?',
        a: 'A melhor janela nos próximos 7 dias é segunda-feira, entre 7h e 11h: vento fraco e baixa chance de chuva nas 6 horas seguintes. Quarta e quinta têm previsão de chuva intensa.',
        head: ['Janela', 'Condição'],
        rows: [['Seg · 07h–11h', 'vento 7 km/h · chuva 5%', 100, 'pos'], ['Ter · 08h–10h', 'vento 11 km/h · chuva 22%', 62, 'pos'], ['Sáb · 09h–12h', 'vento 9 km/h · chuva 15%', 74, 'pos']],
        src: 'Fontes: previsão 7 dias · estação SH-01'
      },
      {
        q: 'Quais máquinas precisam de manutenção?',
        a: 'O trator JD-08 atingiu o intervalo previsto de manutenção. A colheitadeira CS-02 entra na janela em cerca de 29 horas de trabalho.',
        head: ['Máquina', 'Horas'],
        rows: [['Trator JD-08', '324 h', 100, 'neg'], ['Colheitadeira CS-02', '251 h', 78, 'pos'], ['Plantadeira PL-05', '198 h', 52, 'pos']],
        src: 'Fontes: telemetria da frota · plano de manutenção'
      }
    ];
    const GENERIC = {
      a: 'Nesta demonstração eu respondo sobre produtividade, clima e máquinas da Santa Helena. Experimente uma das perguntas sugeridas.',
      rows: null, src: 'Modo demonstração · respostas simuladas'
    };
    let busy = false;
    const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    const scrollLog = () => log.scrollTo({ top: log.scrollHeight, behavior: reduce ? 'auto' : 'smooth' });

    function ask(text, ans) {
      if (busy) return;
      busy = true;
      const u = document.createElement('div');
      u.className = 'msg msg--user'; u.innerHTML = `<p>${esc(text)}</p>`;
      log.appendChild(u);
      const m = document.createElement('div');
      m.className = 'msg msg--ai'; m.innerHTML = '<span class="typing" aria-label="Analisando"><i></i><i></i><i></i></span>';
      log.appendChild(m); scrollLog();
      setTimeout(() => {
        m.innerHTML = '<p></p>';
        const p = m.querySelector('p');
        let k = 0;
        const step = () => {
          k += reduce ? ans.a.length : 3;
          p.textContent = ans.a.slice(0, k);
          if (k < ans.a.length) { requestAnimationFrame(step); return; }
          if (ans.rows) {
            const tbl = document.createElement('table');
            tbl.className = 'dtable';
            tbl.innerHTML = `<thead><tr><th scope="col">${ans.head[0]}</th><th scope="col">${ans.head[1]}</th><th scope="col"><span class="sr-only">Gráfico</span></th></tr></thead><tbody>${
              ans.rows.map(([a, b, w, c]) => `<tr><th scope="row">${a}</th><td class="${c}">${b}</td><td><i class="dbar ${c}" style="--w:${w}%"></i></td></tr>`).join('')}</tbody>`;
            m.appendChild(tbl);
          }
          const s = document.createElement('p'); s.className = 'msg__src mono'; s.textContent = ans.src; m.appendChild(s);
          scrollLog();
          busy = false;
        };
        step();
      }, reduce ? 50 : 900);
    }
    $$('.chip').forEach((c) => c.addEventListener('click', () => {
      $$('.chip').forEach((x) => x.classList.toggle('is-on', x === c));
      const a = ANSWERS[+c.dataset.q];
      ask(a.q, a);
    }));
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const q = input.value.trim();
      if (!q) { input.focus(); return; }
      const l = q.toLowerCase();
      let a = GENERIC;
      if (/chuv|clima|pulveri|aplica|vento|tempo/.test(l)) a = ANSWERS[1];
      else if (/m[aá]quin|trator|manuten|colheitadeira|frota/.test(l)) a = ANSWERS[2];
      else if (/produtiv|talh|queda|safra|rendimento/.test(l)) a = ANSWERS[0];
      ask(q, a);
      input.value = '';
    });
  }

  /* ---------------- hub (connectivity) ---------------- */
  const hub = $('[data-hub]');
  function drawHub() {
    if (!hub) return;
    const svg = $('[data-hub-lines]', hub);
    if (getComputedStyle(svg).display === 'none') return;
    const hr = hub.getBoundingClientRect();
    const core = $('[data-hub-core]', hub).getBoundingClientRect();
    const cx = core.left - hr.left + core.width / 2, cy = core.top - hr.top + core.height / 2;
    svg.setAttribute('viewBox', `0 0 ${hr.width} ${hr.height}`);
    svg.innerHTML = $$('.hnode', hub).map((n, i) => {
      const r = n.getBoundingClientRect();
      const x = r.left - hr.left + r.width / 2, y = r.top - hr.top + r.height / 2;
      const mx = (x + cx) / 2 + (y - cy) * 0.08, my = (y + cy) / 2 - (x - cx) * 0.08;
      const path = `M${x.toFixed(1)} ${y.toFixed(1)} Q ${mx.toFixed(1)} ${my.toFixed(1)} ${cx.toFixed(1)} ${cy.toFixed(1)}`;
      return `<path class="hl" d="${path}"/><path class="hl-f" d="${path}" style="animation-delay:${(i * -0.23).toFixed(2)}s"/>`;
    }).join('');
  }

  /* ---------------- yield chart line ---------------- */
  const ych = $('[data-ychart]');
  function drawYield() {
    if (!ych) return;
    const svg = $('.ychart__line', ych);
    const sr = svg.getBoundingClientRect();
    if (!sr.width) return;
    svg.setAttribute('viewBox', `0 0 ${sr.width} ${sr.height}`);
    svg.setAttribute('preserveAspectRatio', 'none');
    const pts = $$('.ycol', ych).map((c) => {
      const li = c.parentElement.getBoundingClientRect();
      const h = (parseFloat(c.parentElement.style.getPropertyValue('--v')) - 50) / 30 * li.height;
      return `${(li.left - sr.left + li.width / 2).toFixed(1)},${(li.bottom - sr.top - h).toFixed(1)}`;
    });
    $('[data-yline]', ych).setAttribute('points', pts.join(' '));
  }

  let rz;
  window.addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(() => { drawHub(); drawYield(); }, 120); });
  window.addEventListener('load', () => { drawHub(); drawYield(); });
  drawHub(); drawYield();

  /* ---------------- lead form ---------------- */
  const form = $('[data-form]');
  if (form) {
    const ok = $('[data-form-ok]');
    const phone = $('[data-mask="phone"]', form);
    phone.addEventListener('input', () => {
      const d = phone.value.replace(/\D/g, '').slice(0, 11);
      let v = d;
      if (d.length > 2) v = `(${d.slice(0, 2)}) ${d.slice(2)}`;
      if (d.length > 7) v = `(${d.slice(0, 2)}) ${d.slice(2, d.length === 11 ? 7 : 6)}-${d.slice(d.length === 11 ? 7 : 6)}`;
      phone.value = v;
    });
    const chan = () => form.querySelector('input[name="canal"]:checked').value;
    const mailOk = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);
    const rules = {
      nome: (f) => f.nome.value.trim().length >= 2,
      empresa: (f) => f.empresa.value.trim().length >= 2,
      // the chosen channel is required; the other is optional but must be valid if filled
      whatsapp: (f) => { const d = f.whatsapp.value.replace(/\D/g, '').length; return chan() === 'whatsapp' ? d >= 10 : (d === 0 || d >= 10); },
      email: (f) => { const v = f.email.value.trim(); return chan() === 'email' ? mailOk(v) : (!v || mailOk(v)); },
      area: (f) => !!f.area.value,
      interesse: (f) => !!form.querySelector('input[name="interesse"]:checked')
    };
    const errId = { nome: 'e-nome', empresa: 'e-empresa', whatsapp: 'e-whats', email: 'e-email', area: 'e-area', interesse: 'e-interesse' };
    let tried = false;
    const syncChan = () => {
      const c = chan();
      $$('[data-opt]', form).forEach((o) => (o.hidden = o.dataset.opt === c));
      form.elements.whatsapp.required = c === 'whatsapp';
      form.elements.email.required = c === 'email';
      if (tried) { check('whatsapp'); check('email'); }
    };
    $$('input[name="canal"]', form).forEach((r) => r.addEventListener('change', syncChan));
    $$('[data-channel]').forEach((a) => a.addEventListener('click', () => {
      const r = $(`input[name="canal"][value="${a.dataset.channel}"]`, form);
      if (r) { r.checked = true; syncChan(); }
    }));
    syncChan();
    function check(name) {
      const valid = rules[name](form.elements);
      const err = document.getElementById(errId[name]);
      const field = err.closest('.field');
      field.classList.toggle('is-err', !valid);
      const ctrl = name === 'interesse' ? $$('input[name="interesse"]', form) : [form.elements[name]];
      ctrl.forEach((c) => { c.setAttribute('aria-invalid', String(!valid)); if (!valid) c.setAttribute('aria-describedby', errId[name]); else c.removeAttribute('aria-describedby'); });
      return valid;
    }
    Object.keys(rules).forEach((n) => {
      const ctrls = n === 'interesse' ? $$('input[name="interesse"]', form) : [form.elements[n]];
      ctrls.forEach((c) => {
        c.addEventListener('blur', () => { if (tried) check(n); });
        c.addEventListener('change', () => { if (tried) check(n); });
        c.addEventListener('input', () => { if (tried) check(n); });
      });
    });
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      tried = true;
      const bad = Object.keys(rules).filter((n) => !check(n));
      if (bad.length) {
        const first = bad[0] === 'interesse' ? $('input[name="interesse"]', form) : form.elements[bad[0]];
        first.focus({ preventScroll: true });
        first.closest('.field').scrollIntoView({ block: 'center', behavior: reduce ? 'auto' : 'smooth' });
        return;
      }
      const btn = $('button[type="submit"]', form);
      btn.classList.add('is-loading');
      $('.btn__label', btn).textContent = 'Enviando…';
      setTimeout(() => {
        btn.classList.remove('is-loading');
        $('.btn__label', btn).textContent = 'Solicitar demonstração';
        const f = form.elements, viaW = chan() === 'whatsapp';
        const area = f.area.value, int = form.querySelector('input[name="interesse"]:checked').value;
        const now = new Date();
        $('[data-ok-id]', ok).textContent = `AGV-${1000 + Math.floor(Math.random() * 9000)} · ${now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
        $('[data-ok-h]', ok).textContent = `Pronto, ${f.nome.value.trim().split(/\s+/)[0]}.`;
        $('[data-ok-msg]', ok).textContent = viaW
          ? `Um especialista vai chamar você no WhatsApp ${f.whatsapp.value} em até 1 dia útil.`
          : `Um especialista vai escrever para ${f.email.value.trim()} em até 1 dia útil.`;
        $('[data-ok-s1]', ok).textContent = `Combinamos ${viaW ? 'pelo WhatsApp' : 'por e-mail'} o melhor horário para você.`;
        $('[data-ok-s3]', ok).textContent = `Dados de uma operação parecida com a da ${f.empresa.value.trim()} (${area.charAt(0).toLowerCase() + area.slice(1)}), com foco em ${int.toLowerCase()}.`;
        form.hidden = true; ok.hidden = false; ok.focus();
      }, 900);
    });
    $('[data-form-reset]').addEventListener('click', () => {
      form.reset(); tried = false; syncChan();
      $$('.field', form).forEach((f) => f.classList.remove('is-err'));
      ok.hidden = true; form.hidden = false; form.elements.nome.focus();
    });
  }

  /* ---------------- counters ---------------- */
  function fmtCount(v, f) {
    if (f === 'int') return fmtInt(v);
    if (f === 'dec1') return fmt1(v);
    if (f === 'dec1sign') return (v >= 0 ? '+' : '−') + fmt1(Math.abs(v));
    return String(v);
  }
  function runCount(el, delay = 0) {
    const target = parseFloat(el.dataset.count), f = el.dataset.format;
    if (reduce || !window.gsap) { el.textContent = fmtCount(target, f); return; }
    const o = { v: 0 };
    window.gsap.to(o, { v: target, duration: 1.6, delay, ease: 'power3.out', onUpdate: () => (el.textContent = fmtCount(o.v, f)) });
  }

  /* ---------------- GSAP motion ---------------- */
  function motion() {
    const gsap = window.gsap, ST = window.ScrollTrigger;
    if (!gsap || !ST || reduce) {
      document.documentElement.classList.remove('pre-motion');
      $$('[data-count]').forEach((el) => onView(el, () => runCount(el)));
      $$('.step').forEach((s) => s.classList.add('is-lit'));
      $('[data-steps]') && $('[data-steps]').style.setProperty('--p', 1);
      if (ych) ych.classList.remove('is-pre');
      return;
    }
    gsap.registerPlugin(ST);
    document.documentElement.classList.remove('pre-motion');

    // hero intro
    const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
    tl.from('.site-header__in > *', { y: -14, opacity: 0, duration: .7, stagger: .08 })
      .from('[data-hero-in]', { y: 26, opacity: 0, duration: .9, stagger: .09 }, '-=.4')
      .from('.hdash [data-plate]', { y: 46, opacity: 0, duration: 1.1, stagger: .16, ease: 'expo.out' }, '-=.85')
      .from('.bands > *', { opacity: 0, y: 8, duration: .5, stagger: .05 }, '-=.6')
      .from('.hero__meta span, .gt', { opacity: 0, duration: .8, stagger: .05 }, '-=.6');
    $$('.hero [data-count]').forEach((el) => runCount(el, .9));

    // generic reveals
    gsap.set('[data-reveal]', { opacity: 0, y: 28 });
    ST.batch('[data-reveal]', {
      start: 'top 90%', once: true,
      onEnter: (b) => gsap.to(b, { opacity: 1, y: 0, duration: .9, stagger: b.length > 6 ? 0 : .08, ease: 'power3.out', overwrite: true })
    });

    // counters outside hero
    $$('[data-count]').filter((el) => !el.closest('.hero')).forEach((el) => {
      ST.create({ trigger: el, start: 'top 92%', once: true, onEnter: () => runCount(el) });
    });

    // image reveals
    $$('[data-clip]').forEach((el) => {
      const img = $('img', el);
      gsap.fromTo(el, { clipPath: 'inset(14% 6% 14% 6%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.4, ease: 'expo.out', scrollTrigger: { trigger: el, start: 'top 85%', once: true } });
      if (img) gsap.fromTo(img, { scale: 1.2 }, { scale: 1.08, duration: 1.8, ease: 'expo.out', scrollTrigger: { trigger: el, start: 'top 85%', once: true } });
    });
    gsap.from('.mark', { opacity: 0, y: 12, duration: .7, stagger: .18, ease: 'power3.out', scrollTrigger: { trigger: '[data-survey]', start: 'top 60%', once: true } });

    // parallax
    $$('[data-parallax]').forEach((img) => {
      gsap.fromTo(img, { yPercent: -5 }, { yPercent: 5, ease: 'none', scrollTrigger: { trigger: img.closest('section'), start: 'top bottom', end: 'bottom top', scrub: true } });
    });
    gsap.to('.scene', { yPercent: 12, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true } });

    // alerts arriving
    gsap.from('.note', { x: 48, opacity: 0, duration: .9, stagger: .28, ease: 'expo.out', scrollTrigger: { trigger: '[data-notes]', start: 'top 75%', once: true } });

    // phones
    gsap.from('[data-phone]', { y: 70, opacity: 0, duration: 1.1, stagger: .12, ease: 'expo.out', scrollTrigger: { trigger: '[data-phones]', start: 'top 85%', once: true } });

    // hub nodes
    gsap.from('.hnode', { opacity: 0, scale: .9, duration: .7, stagger: .06, ease: 'power3.out', scrollTrigger: { trigger: '[data-hub]', start: 'top 75%', once: true } });

    // yield chart
    if (ych) {
      ych.classList.add('is-pre');
      gsap.set('[data-yline]', { opacity: 0 });
      ST.create({
        trigger: ych, start: 'top 75%', once: true, onEnter: () => {
          $$('.ycol', ych).forEach((c, i) => (c.style.transitionDelay = (i * 0.12) + 's'));
          ych.classList.remove('is-pre');
          gsap.to('[data-yline]', { opacity: 1, duration: .8, delay: .9 });
        }
      });
    }

    // steps line
    const steps = $('[data-steps]');
    if (steps) {
      const items = $$('.step', steps);
      ST.create({
        trigger: steps, start: 'top 75%', end: 'bottom 55%', scrub: .6,
        onUpdate: (s) => {
          steps.style.setProperty('--p', s.progress.toFixed(3));
          items.forEach((it, i) => it.classList.toggle('is-lit', s.progress >= i / (items.length - 1) - 0.02));
        }
      });
    }

    // pipeline stages
    gsap.from('.pipe__stage', { opacity: 0, y: 24, duration: .8, stagger: .18, ease: 'power3.out', scrollTrigger: { trigger: '[data-pipe]', start: 'top 80%', once: true } });

    window.addEventListener('load', () => ST.refresh());
  }
  motion();
})();
