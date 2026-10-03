// Motor de luz das cenas de Soluções.
// Tudo que é acontecimento (cometa, clarão, faísca, enxame) é desenhado num canvas em 'lighter',
// com sprites pré-desenhados e objetos reaproveitados: nada é criado a cada quadro.
// O canvas só desenha enquanto há luz se mexendo; parado, ele dorme.
import gsap from 'gsap';

const MAX_DPR = 2;

/* ------------------------------------------------------------------ */
/* sprites: degradês radiais desenhados uma vez                        */
/* ------------------------------------------------------------------ */
let SPR = null;
function radial(size, stops) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const r = size / 2;
  const grd = g.createRadialGradient(r, r, 0, r, r, r);
  for (const [o, col] of stops) grd.addColorStop(o, col);
  g.fillStyle = grd;
  g.fillRect(0, 0, size, size);
  return c;
}
function sprites() {
  if (SPR) return SPR;
  SPR = {
    core: radial(64, [[0, 'rgba(255,255,255,1)'], [0.22, 'rgba(217,243,255,0.95)'], [0.55, 'rgba(0,168,255,0.28)'], [1, 'rgba(0,168,255,0)']]),
    halo: radial(128, [[0, 'rgba(0,168,255,0.5)'], [0.3, 'rgba(0,140,255,0.2)'], [0.65, 'rgba(46,107,255,0.06)'], [1, 'rgba(46,107,255,0)']]),
    tail: radial(64, [[0, 'rgba(127,212,255,0.85)'], [0.35, 'rgba(46,107,255,0.4)'], [1, 'rgba(46,107,255,0)']]),
    spark: radial(32, [[0, 'rgba(255,255,255,1)'], [0.3, 'rgba(217,243,255,0.75)'], [1, 'rgba(0,168,255,0)']]),
    body: radial(64, [[0, 'rgba(217,243,255,0.9)'], [0.3, 'rgba(0,168,255,0.55)'], [1, 'rgba(0,168,255,0)']]),
    dot: radial(32, [[0, 'rgba(255,255,255,0.95)'], [0.35, 'rgba(191,234,255,0.6)'], [1, 'rgba(127,212,255,0)']]),
  };
  return SPR;
}

/* ------------------------------------------------------------------ */
/* trilhos: tabela de pontos por comprimento de arco                   */
/* ------------------------------------------------------------------ */
export function samplePath(pathEl, step = 4) {
  const L = pathEl.getTotalLength();
  const n = Math.max(2, Math.ceil(L / step) + 1);
  const pts = new Float32Array(n * 2);
  for (let i = 0; i < n; i++) {
    const p = pathEl.getPointAtLength((i / (n - 1)) * L);
    pts[i * 2] = p.x;
    pts[i * 2 + 1] = p.y;
  }
  return { L, n, pts };
}
// trilho reto entre dois pontos, sem SVG
export function lineTab(x0, y0, x1, y1) {
  const L = Math.hypot(x1 - x0, y1 - y0);
  return { L, n: 2, pts: new Float32Array([x0, y0, x1, y1]) };
}
// trilho invertido (para a luz voltar pelo mesmo fio)
export function reverseTab(t) {
  const pts = new Float32Array(t.pts.length);
  for (let i = 0; i < t.n; i++) {
    pts[i * 2] = t.pts[(t.n - 1 - i) * 2];
    pts[i * 2 + 1] = t.pts[(t.n - 1 - i) * 2 + 1];
  }
  return { L: t.L, n: t.n, pts };
}
const _p = [0, 0];
export function pointAt(t, d, out = _p) {
  const f = Math.max(0, Math.min(1, d / t.L)) * (t.n - 1);
  const i = Math.min(t.n - 2, Math.floor(f));
  const k = f - i;
  out[0] = t.pts[i * 2] + (t.pts[i * 2 + 2] - t.pts[i * 2]) * k;
  out[1] = t.pts[i * 2 + 1] + (t.pts[i * 2 + 3] - t.pts[i * 2 + 1]) * k;
  return out;
}

// em quanto tempo a cabeça de um cometa chega ao destino (a cauda ainda entra depois)
export function arriveAt(tab, { dur, ease = 'power2.inOut', tail = 170 }) {
  const e = gsap.parseEase(ease);
  const target = tab.L / (tab.L + tail);
  let lo = 0, hi = 1;
  for (let i = 0; i < 24; i++) { const m = (lo + hi) / 2; if (e(m) < target) lo = m; else hi = m; }
  return dur * hi;
}

// roda quando o navegador estiver folgado (para preparar a cena antes de ela aparecer)
export const idle = (fn) => ('requestIdleCallback' in window ? requestIdleCallback(fn, { timeout: 1500 }) : setTimeout(fn, 200));

/* ------------------------------------------------------------------ */
/* aleatório com semente: a cena varia, mas igual em toda captura      */
/* ------------------------------------------------------------------ */
export function seeded(seed = 7) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ------------------------------------------------------------------ */
/* camada de luz                                                       */
/* ------------------------------------------------------------------ */
export function createLight(canvas, { vbw = () => 1600 } = {}) {
  const ctx = canvas.getContext('2d', { alpha: true });
  const S = sprites();
  // nasce sem bitmap (o padrão do canvas é 300 x 150, que esticado mostraria lixo): só ganha tamanho ao tocar
  canvas.width = 0;
  canvas.height = 0;
  let W = 0, H = 0, scale = 1, dpr = 1;
  let quality = 1; // 1 completo, 0.6 leve
  let running = false, dirty = false, lastDraw = 0, hibernating = false;

  const comets = [];
  const flashes = [];
  const sparks = [];
  const swarms = [];
  const glows = []; // pontos de luz parados que respiram (ponta de gráfico etc.)

  function size() {
    // tamanho de layout (sem a escala de 1,5% da troca de telas, que o getBoundingClientRect incluiria)
    const host = canvas.parentElement;
    const w = host.offsetWidth, h = host.offsetHeight;
    if (!w) return false;
    dpr = Math.min(window.devicePixelRatio || 1, quality < 1 ? 1.25 : MAX_DPR);
    W = Math.round(w * dpr);
    H = Math.round(h * dpr);
    if (canvas.width !== W || canvas.height !== H) { canvas.width = W; canvas.height = H; }
    scale = W / vbw();
    hibernating = false;
    dirty = true;
    return true;
  }

  function wake() {
    if (hibernating || !canvas.width) size();
    if (!running) { running = true; gsap.ticker.add(tick); }
  }

  /* cometa: cabeça branca, halo ciano e cauda azul que afina.
     p vai de 0 a 1; a cauda entra inteira no destino quando p = 1 */
  const keep = (arr, o) => { if (!arr.includes(o)) arr.push(o); };
  const drop = (arr, o) => { const i = arr.indexOf(o); if (i >= 0) arr.splice(i, 1); };

  function comet(tab, o = {}) {
    const c = { tab, p: 0, on: false, alpha: o.alpha ?? 1, tail: o.tail ?? 170, size: o.size ?? 1, arrived: false, onArrive: o.onArrive };
    const dur = o.dur ?? Math.max(0.3, Math.min(0.95, tab.L / 1100));
    return c.tw = gsap.to(c, {
      p: 1,
      duration: dur,
      ease: o.ease || 'power2.inOut',
      onStart() { c.arrived = false; keep(comets, c); wake(); },
      onUpdate() {
        keep(comets, c);
        c.on = c.p > 0 && c.p < 1;
        const head = c.p * (c.tab.L + c.tail);
        if (!c.arrived && head >= c.tab.L) {
          c.arrived = true;
          if (c.onArrive) c.onArrive();
        }
        if (head < c.tab.L) c.arrived = false;
        dirty = true;
        wake();
      },
      onComplete() { c.on = false; drop(comets, c); dirty = true; },
      onReverseComplete() { c.on = false; drop(comets, c); dirty = true; },
    });
  }

  /* clarão de chegada: ataque rápido e queda longa */
  function flash(x, y, o = {}) {
    const f = { x, y, r: o.r ?? 90, a: 0 };
    const peak = o.alpha ?? 0.9;
    const tl = gsap.timeline({
      onStart: () => { keep(flashes, f); wake(); },
      onUpdate: () => { keep(flashes, f); dirty = true; wake(); },
      onComplete: () => { drop(flashes, f); dirty = true; },
      onReverseComplete: () => { drop(flashes, f); dirty = true; },
    });
    tl.to(f, { a: peak, duration: 0.12, ease: 'power1.out' })
      .to(f, { a: 0, duration: o.decay ?? 1.2, ease: 'expo.out' });
    f.tw = tl;
    return tl;
  }

  /* faíscas: no máximo 3, só em chegada que gera resultado */
  function burst(x, y, n = 3, o = {}) {
    n = Math.min(3, Math.round(n * (quality < 1 ? 0.67 : 1)));
    for (let i = 0; i < n; i++) {
      const ang = (o.dir ?? -Math.PI / 2) + (i - (n - 1) / 2) * 0.9 + (Math.random() - 0.5) * 0.4;
      const sp = 140 + Math.random() * 120;
      sparks.push({ x, y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, life: 0, max: 0.5 + Math.random() * 0.3 });
    }
    wake();
  }

  /* brilho fixo que respira (ex.: ponta do gráfico) */
  function glow(x, y, o = {}) {
    const g = { x, y, r: o.r ?? 40, a: o.alpha ?? 0.6, on: true };
    glows.push(g);
    dirty = true;
    wake();
    return g;
  }
  function unglow(g) { drop(glows, g); dirty = true; wake(); }

  /* enxame: partículas que voam em curva até o lugar; um único valor de tempo move todas */
  function swarm(parts, o = {}) {
    const sw = { parts, t: 0 };
    const total = o.total ?? 1.6;
    return sw.tw = gsap.to(sw, {
      t: total,
      duration: total,
      ease: 'none',
      onStart: () => { keep(swarms, sw); wake(); },
      onUpdate: () => { keep(swarms, sw); dirty = true; wake(); },
      onComplete: () => { drop(swarms, sw); dirty = true; },
      onReverseComplete: () => { drop(swarms, sw); dirty = true; },
    });
  }

  let prevT = 0;
  function tick(time) {
    const now = time;
    const dt = Math.min(0.05, prevT ? now - prevT : 0.016);
    prevT = now;
    // física das faíscas mesmo entre desenhos
    for (let i = sparks.length - 1; i >= 0; i--) {
      const s = sparks[i];
      s.life += dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.vx *= 0.9;
      s.vy *= 0.9;
      if (s.life >= s.max) sparks.splice(i, 1);
      dirty = true;
    }
    // com a cena pausada, as animações param (isActive vira falso) e o canvas dorme com a luz congelada
    const live = (o) => o.tw && o.tw.isActive();
    const busy = comets.some((c) => c.on && live(c)) || flashes.some(live) || sparks.length || swarms.some(live);
    // no máximo 60 desenhos por segundo, mesmo em telas de 120 Hz
    if (dirty && now - lastDraw >= 0.0155) {
      draw();
      lastDraw = now;
      dirty = busy ? true : false;
    }
    if (!busy && !dirty) {
      running = false;
      gsap.ticker.remove(tick);
      prevT = 0;
    }
  }

  function stamp(img, x, y, s, a) {
    if (a <= 0.003) return;
    ctx.globalAlpha = a > 1 ? 1 : a;
    ctx.drawImage(img, x - s / 2, y - s / 2, s, s);
  }

  function draw() {
    if (!W) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.clearRect(0, 0, W, H);
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.globalCompositeOperation = 'lighter';

    // brilhos fixos
    for (const g of glows) if (g.on) stamp(S.halo, g.x, g.y, g.r * 2, g.a * 0.8);

    // enxames
    for (const sw of swarms) {
      const t = sw.t;
      for (const p of sw.parts) {
        const k = (t - p.delay) / p.dur;
        if (k <= 0 || k >= 1.25) continue;
        const e = k >= 1 ? 1 : 1 - Math.pow(1 - k, 3);
        const u = 1 - e;
        const x = u * u * p.x0 + 2 * u * e * p.cx + e * e * p.x1;
        const y = u * u * p.y0 + 2 * u * e * p.cy + e * e * p.y1;
        const fade = k >= 1 ? 1 - (k - 1) / 0.25 : Math.min(1, k * 5);
        stamp(S.dot, x, y, p.s, p.a * fade);
      }
    }

    // cometas
    for (const c of comets) {
      if (!c.on) continue;
      const tab = c.tab;
      const total = tab.L + c.tail;
      const headD = Math.min(tab.L, c.p * total);
      const tailD = Math.max(0, c.p * total - c.tail);
      const span = headD - tailD;
      if (span <= 0.5) continue;
      const step = quality < 1 ? 8 : 5;
      for (let d = tailD; d < headD; d += step) {
        const k = (d - tailD) / c.tail; // 0 na ponta da cauda, perto de 1 na cabeça
        pointAt(tab, d);
        stamp(S.tail, _p[0], _p[1], (10 + 26 * k) * c.size, Math.pow(k, 1.4) * 0.62 * c.alpha);
      }
      // a cabeça só existe enquanto não chegou
      if (c.p * total <= tab.L + 2) {
        pointAt(tab, headD);
        stamp(S.halo, _p[0], _p[1], 120 * c.size, 0.85 * c.alpha);
        stamp(S.body, _p[0], _p[1], 46 * c.size, 0.7 * c.alpha);
        stamp(S.core, _p[0], _p[1], 26 * c.size, c.alpha);
      }
    }

    // clarões
    for (const f of flashes) {
      stamp(S.halo, f.x, f.y, f.r * 2, f.a * 0.75);
      stamp(S.core, f.x, f.y, f.r * 0.32, f.a * 0.6);
    }

    // faíscas
    for (const s of sparks) {
      const k = 1 - s.life / s.max;
      stamp(S.spark, s.x, s.y, 10 * (0.6 + 0.4 * k), k);
    }
    ctx.globalAlpha = 1;
  }

  function clear() {
    comets.length = 0;
    flashes.length = 0;
    sparks.length = 0;
    swarms.length = 0;
    glows.length = 0;
    if (W) { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, W, H); }
  }

  return {
    size,
    comet,
    flash,
    burst,
    glow,
    unglow,
    swarm,
    clear,
    redraw() { dirty = true; wake(); },
    // para de desenhar já (a cena pausou); o último quadro fica na tela
    sleep() {
      if (!running) return;
      if (dirty) draw();
      dirty = false;
      running = false;
      gsap.ticker.remove(tick);
      prevT = 0;
    },
    setQuality(q) { quality = q; size(); },
    // libera a memória do canvas quando a cena fica muito tempo parada
    hibernate() { if (!running) { canvas.width = 0; canvas.height = 0; W = H = 0; hibernating = true; } },
    get quality() { return quality; },
    get canvas() { return canvas; },
  };
}

/* ------------------------------------------------------------------ */
/* odômetro: cada dígito é uma coluna que desliza (só transform)       */
/* ------------------------------------------------------------------ */
const fmtNum = (n) => Math.round(n).toLocaleString('pt-BR');
// value pode ser número (vira "1.247") ou texto já pronto (ex.: "23:47").
// Cada coluna tem 0 a 9 e mais um 0 no fim: de 9 para 0 o dígito anda uma casa para frente
// (até o 0 de baixo) e depois volta sem animação, em vez de girar por todos os números.
export function odometer(el, value) {
  el.classList.add('odo');
  let cur = null, val = value;
  const str = (v) => (typeof v === 'number' ? fmtNum(v) : String(v));
  const H = 100 / 11;
  function build(s) {
    el.textContent = '';
    for (const ch of s) {
      if (/\d/.test(ch)) {
        const d = document.createElement('span');
        d.className = 'odo__d';
        const col = document.createElement('span');
        col.className = 'odo__s';
        for (let i = 0; i <= 10; i++) {
          const n = document.createElement('span');
          n.textContent = i % 10;
          col.appendChild(n);
        }
        col.addEventListener('transitionend', () => {
          // chegou no 0 de baixo: volta para o 0 de cima sem ninguém ver
          if (col.dataset.pos === '10') {
            col.style.transition = 'none';
            col.style.transform = 'translateY(0)';
            col.dataset.pos = '0';
            void col.offsetHeight;
            col.style.transition = '';
          }
        });
        d.appendChild(col);
        el.appendChild(d);
      } else {
        const c = document.createElement('span');
        c.className = 'odo__c';
        c.textContent = ch;
        el.appendChild(c);
      }
    }
  }
  function set(v, instant = false) {
    const s = str(v);
    const up = typeof v === 'number' && typeof val === 'number' && v > val;
    if (cur === null || cur.length !== s.length || cur.replace(/\d/g, '0') !== s.replace(/\d/g, '0')) { build(s); instant = true; }
    const cols = el.querySelectorAll('.odo__s');
    const plan = [];
    let di = 0, snap = false;
    for (const ch of s) {
      if (!/\d/.test(ch)) continue;
      const col = cols[di++];
      const n = Number(ch);
      const prev = Number(col.dataset.pos ?? n);
      const pos = !instant && up && n === 0 && prev === 9 ? 10 : n;
      // instantâneo, ou ainda no 0 de baixo (troca rápida): reposiciona sem animação antes de andar
      if (instant || (prev === 10 && pos !== 10)) {
        col.style.transition = 'none';
        col.style.transform = `translateY(${instant ? -pos * H : 0}%)`;
        snap = true;
      }
      plan.push([col, pos]);
    }
    if (snap) void el.offsetHeight; // uma leitura de layout só, para todas as colunas
    for (const [col, pos] of plan) {
      col.style.transition = '';
      col.style.transform = `translateY(${-pos * H}%)`;
      col.dataset.pos = String(pos);
    }
    cur = s;
    val = v;
  }
  set(value, true);
  return { set, get value() { return val; } };
}

/* ------------------------------------------------------------------ */
/* texto fantasma: as palavras já ocupam o lugar e acendem uma a uma   */
/* ------------------------------------------------------------------ */
export function wordsHTML(text) {
  return text.split(' ').map((w) => `<span class="w">${w}</span>`).join(' ');
}
export function revealWords(el, { stagger = 0.055, fresh = true } = {}) {
  const ws = [...el.querySelectorAll('.w')];
  const tl = gsap.timeline();
  ws.forEach((w, i) => {
    tl.call(() => {
      if (fresh) w.classList.add('fresh');
      w.classList.add('on');
    }, null, i * stagger);
    if (fresh) tl.call(() => w.classList.remove('fresh'), null, i * stagger + 0.32);
  });
  return tl;
}
export function showAllWords(el) {
  el.querySelectorAll('.w').forEach((w) => { w.classList.add('on'); w.classList.remove('fresh'); });
}

/* digitação letra a letra (só para o que a pessoa digita) */
export function typeText(el, text, cps = 28) {
  const proxy = { n: 0 };
  return gsap.to(proxy, {
    n: text.length,
    duration: text.length / cps,
    ease: 'none',
    onUpdate: () => { el.textContent = text.slice(0, Math.round(proxy.n)); },
  });
}
