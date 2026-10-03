// Cena 4 · Dados: a planilha corre, a faixa de luz lê tudo e as células sobem como luz até o
// painel. Depois a IA responde perguntas acendendo a resposta no próprio painel.
import gsap from 'gsap';
import { lineTab, odometer, seeded, wordsHTML, revealWords, typeText, idle } from './engine.js';

const DATA = [180, 205, 196, 238, 262, 231, 214, 249, 281, 305, 274, 322, 358, 412, 341, 306, 333, 352, 318, 371, 389, 286];
const MAX = 450;
const GW = { x: 72, y: 336, w: 920, h: 420 };
const GT = { x: 56, y: 404, w: 688, h: 330 };
const PERGUNTAS = [
  { q: 'Como estamos em relação à meta?', a: 'Já batemos 87% da meta do mês, e faltam 8 dias.', target: 'meta' },
  // a resposta sai dos dados do momento (se hoje passar do dia 14, a resposta acompanha)
  { q: 'Qual foi o melhor dia do mês?', a: 'best', target: 'best' },
  { q: 'Quantos pedidos entraram hoje?', a: (n) => `Até agora, ${n.toLocaleString('pt-BR')} pedidos.`, target: 'pedidos' },
];
const COLS = ['Data', 'Pedido', 'Produto', 'Qtd', 'Região', 'Canal', 'Pagamento', 'Status', 'Cidade', 'Entrega', 'Cliente', 'Obs.'];
const PROD = ['Mochila', 'Garrafa', 'Boné', 'Camiseta', 'Caneca'];
const REG = ['Sudeste', 'Sul', 'Nordeste', 'Centro-Oeste', 'Norte'];
const CAN = ['Site', 'Loja', 'WhatsApp', 'Instagram'];
const PAG = ['Pix', 'Cartão', 'Boleto'];
const STA = ['Pago', 'Enviado', 'Entregue', 'Separando'];
const CID = ['Campinas', 'Curitiba', 'Recife', 'Goiânia', 'Belém', 'Santos'];

export function createDados(root, light, env) {
  const $ = (s) => root.querySelector(s);
  const $$ = (s) => [...root.querySelectorAll(s)];
  const tall = () => env.tall();
  const fmt = () => (tall() ? 't' : 'w');
  const G = () => (tall() ? GT : GW);
  const rnd = seeded(77);

  const sheet = $('[data-sheet]'), sheetCv = $('[data-sheet-cv]'), scan = $('[data-scan]');
  const rowcount = $('[data-rowcount]');
  const film = $('[data-film]');
  const ask = $('[data-ask]'), qEl = $('[data-q]'), aEl = $('[data-a]'), send = $('[data-send]'), core = $('[data-core]');
  const today = odometer($('[data-today]'), 286);
  const ring = $('[data-ring]');
  const tip = $('[data-tip]');
  const cards = { pedidos: $('[data-card="pedidos"]'), meta: $('[data-card="meta"]'), novos: $('[data-card="novos"]') };
  const panels = $$('[data-panel]');
  const svg = () => $(`.sc__svg--${fmt()}`);
  const lineEl = () => svg().querySelector('[data-line]');
  const areaEl = () => svg().querySelector('[data-area]');
  const beamEl = () => svg().querySelector('[data-beam]');
  const chartG = () => svg().querySelector('[data-chart]');
  const data = DATA.slice();
  let qi = 0, todayN = 286, max = MAX;
  const fmtN = (n) => Math.round(n).toLocaleString('pt-BR');
  const bestIdx = () => data.indexOf(Math.max(...data));

  /* ---------- gráfico: só o último trecho muda (o resto fica parado) ---------- */
  const px = (i) => G().x + (i / (data.length - 1)) * G().w;
  const py = (v) => G().y + G().h - (v / max) * G().h;
  function drawLine() {
    const d = data.map((v, i) => `${i ? 'L' : 'M'}${px(i).toFixed(1)} ${py(v).toFixed(1)}`).join(' ');
    lineEl().setAttribute('d', d);
    areaEl().setAttribute('d', `${d} L${G().x + G().w} ${G().y + G().h} L${G().x} ${G().y + G().h} Z`);
  }
  const tipXY = () => [px(data.length - 1), py(data[data.length - 1])];

  /* ---------- planilha desenhada uma vez (em resolução 1: ela corre e é cinza) ---------- */
  let off = null, offH = 0, rowH = 0, colW = 0, headH = 0;
  function paintSheet() {
    const W = Math.max(1, sheet.offsetWidth), H = Math.max(1, sheet.offsetHeight);
    sheetCv.width = W;
    sheetCv.height = H;
    const ncol = tall() ? 6 : 12;
    colW = W / (ncol + 0.6);
    rowH = Math.max(16, H / 22);
    headH = rowH * 1.1;
    offH = Math.round(H * 1.6);
    off = document.createElement('canvas');
    off.width = W;
    off.height = offH;
    const g = off.getContext('2d');
    g.fillStyle = '#0a0d14';
    g.fillRect(0, 0, W, offH);
    g.font = `${Math.max(10, Math.round(rowH * 0.42))}px -apple-system, BlinkMacSystemFont, 'Inter Variable', sans-serif`;
    g.textBaseline = 'middle';
    const rows = Math.ceil(offH / rowH);
    for (let r0 = 0; r0 < rows; r0++) {
      const y = r0 * rowH;
      g.fillStyle = 'rgba(255,255,255,0.05)';
      g.fillRect(0, y + rowH - 1, W, 1);
      g.fillStyle = '#6b7080';
      g.fillText(String(21700 + r0), 6, y + rowH / 2);
      for (let c = 0; c < ncol; c++) {
        const x = colW * 0.6 + c * colW;
        if (r0 === 0) { g.fillStyle = 'rgba(255,255,255,0.05)'; g.fillRect(x, 0, 1, offH); }
        const v = cellText(c, r0);
        g.fillStyle = c === 1 || c === 3 ? '#c4c7cf' : '#9da1ab';
        g.fillText(v, x + 6, y + rowH / 2, colW - 10);
      }
    }
  }
  function cellText(c, r) {
    const k = (r * 7 + c * 13) % 97;
    switch (c) {
      case 0: return `${String(1 + (r % 28)).padStart(2, '0')}/08`;
      case 1: return (4100 + r).toLocaleString('pt-BR');
      case 2: return PROD[k % PROD.length];
      case 3: return String(1 + (k % 6));
      case 4: return REG[(k >> 1) % REG.length];
      case 5: return CAN[(k >> 2) % CAN.length];
      case 6: return PAG[k % PAG.length];
      case 7: return STA[(k >> 1) % STA.length];
      case 8: return CID[k % CID.length];
      case 9: return `${String(2 + (k % 26)).padStart(2, '0')}/08`;
      case 10: return `#${1000 + ((k * 37) % 900)}`;
      default: return k % 3 ? '' : 'ok';
    }
  }
  // desenha a planilha rolada e, durante a leitura, só o que está abaixo da faixa
  function renderSheet(scroll, cut) {
    if (!off) return;
    const g = sheetCv.getContext('2d');
    const W = sheetCv.width, H = sheetCv.height;
    g.clearRect(0, 0, W, H);
    const top = Math.max(headH, cut);
    if (top < H) {
      g.drawImage(off, 0, scroll + top - headH, W, H - top, 0, top, W, H - top);
    }
    if (cut <= headH) {
      // cabeçalho com os nomes das colunas
      g.fillStyle = '#121722';
      g.fillRect(0, 0, W, headH);
      g.fillStyle = 'rgba(255,255,255,0.08)';
      g.fillRect(0, headH - 1, W, 1);
      g.fillStyle = '#c9ccd3';
      g.font = `600 ${Math.max(10, Math.round(rowH * 0.42))}px -apple-system, BlinkMacSystemFont, 'Inter Variable', sans-serif`;
      g.textBaseline = 'middle';
      const ncol = tall() ? 6 : 12;
      for (let c = 0; c < ncol; c++) g.fillText(COLS[c], colW * 0.6 + c * colW + 6, headH / 2, colW - 10);
    }
  }

  /* ---------- estado inicial: a planilha cobre a tela ---------- */
  function arm() {
    sheet.style.visibility = 'visible';
    gsap.set(scan, { opacity: 0, y: 0 });
    gsap.set(panels, { autoAlpha: 0.25 });
    gsap.set(ask, { autoAlpha: 0, y: 20 });
    $$('[data-line], [data-beam]').forEach((p) => gsap.set(p, { drawSVG: '0%' }));
    gsap.set($$('[data-area]'), { opacity: 0 });
    gsap.set($$('.da-track i'), { scaleX: 0 });
    gsap.set(tip, { opacity: 0 });
    gsap.set(film, { opacity: 0 });
    ring.style.strokeDashoffset = String(2 * Math.PI * 46);
    today.set(286, true);
    qEl.textContent = 'Pergunte ao painel';
    aEl.textContent = '';
    ask.classList.remove('has-answer', 'is-thinking');
    // desenha a planilha quando o navegador estiver folgado (a cena ainda está fora da tela)
    const run = () => { if (!off && sheet.offsetWidth) { paintSheet(); renderSheet(0, 0); } };
    if ('requestIdleCallback' in window) requestIdleCallback(run, { timeout: 3000 }); else setTimeout(run, 500);
    // a linha do tempo nasce no ócio: quando a cena aparecer, só falta dar o play
    idle(() => { if (!master) build(); });
  }

  /* ---------- montagem ---------- */
  function assembly() {
    const tl = gsap.timeline();
    const sh = { s: 0, cut: 0, rows: 21000 };
    let H = 0;
    tl.call(() => {
      if (!off || sheet.offsetWidth !== sheetCv.width) paintSheet();
      H = sheetCv.height;
      renderSheet(0, 0);
    }, null, 0);
    // a planilha corre acelerando; o contador de linhas gira
    tl.to(sh, {
      s: () => offH - sheetCv.height - rowH, duration: 1.0, ease: 'power2.in',
      onUpdate: () => renderSheet(sh.s, 0),
    }, 0.05);
    tl.to(sh, { rows: 21730, duration: 1.0, ease: 'power2.in', onUpdate: () => { rowcount.textContent = Math.round(sh.rows).toLocaleString('pt-BR'); } }, 0.05);
    // a faixa de luz desce: acima dela, a planilha já virou painel
    const S = 1.05, D = 1.15;
    tl.to(scan, { opacity: 1, duration: 0.1 }, S);
    tl.fromTo(scan, { y: 0 }, { y: () => sheetCv.height, duration: D, ease: 'power1.inOut', immediateRender: false }, S);
    tl.to(sh, { cut: () => sheetCv.height, duration: D, ease: 'power1.inOut', onUpdate: () => renderSheet(sh.s, sh.cut) }, S);
    tl.to(scan, { opacity: 0, duration: 0.2 }, S + D - 0.15);
    tl.call(() => { sheet.style.visibility = 'hidden'; sheetCv.width = 0; off = null; }, null, S + D + 0.05);
    // cada painel acende quando a faixa passa por ele
    panels.forEach((p) => {
      const y = parseFloat(p.style.getPropertyValue(`--y${fmt()}`)) || 0;
      tl.to(p, { autoAlpha: 1, duration: 0.5, ease: 'expo.out' }, S + (y / 1000) * D);
    });
    // enxame: as células sobem como luz até o lugar delas no painel
    tl.add(light.swarm(swarmParts(S, D), { total: D + 1.2 }), S);
    // o gráfico se desenha com a luz na ponta; o anel corre até 87%
    tl.to(lineEl(), { drawSVG: '100%', duration: 1.0, ease: 'power2.out' }, S + 0.55);
    tl.to(areaEl(), { opacity: 1, duration: 0.8 }, S + 0.9);
    tl.to(ring, { strokeDashoffset: 2 * Math.PI * 46 * 0.13, duration: 1.1, ease: 'expo.out' }, S + 0.3);
    tl.to($$('.da-track i'), { scaleX: 1, duration: 0.9, ease: 'expo.out', stagger: 0.08 }, S + 0.6);
    tl.to(ask, { autoAlpha: 1, y: 0, duration: 0.6, ease: 'expo.out' }, S + D - 0.1);
    return tl;
  }
  function swarmParts(S, D) {
    const n = tall() ? 80 : 140;
    const parts = [];
    const vbw = tall() ? 800 : 1600;
    // alvos: pontos da linha do gráfico e os cartões
    const targets = [];
    for (let i = 0; i < data.length; i++) targets.push([px(i), py(data[i])]);
    for (const c of Object.values(cards)) {
      if (!c || !c.offsetParent) continue;
      const s = c.style, f = fmt();
      const x = parseFloat(s.getPropertyValue(`--x${f}`)), y = parseFloat(s.getPropertyValue(`--y${f}`));
      const w = parseFloat(s.getPropertyValue(`--w${f}`)), h = parseFloat(s.getPropertyValue(`--h${f}`));
      for (let k = 0; k < 4; k++) targets.push([x + w * (0.2 + 0.2 * k), y + h * 0.62]);
    }
    for (let i = 0; i < n; i++) {
      const delay = (i / n) * D * 0.9;
      const by = (delay / D) * 1000; // linha da faixa nesse instante
      const ok = targets.filter((t) => t[1] < by + 40);
      const tgt = (ok.length ? ok : targets)[Math.floor(rnd() * (ok.length || targets.length))];
      const x0 = rnd() * vbw;
      parts.push({
        x0, y0: by, x1: tgt[0], y1: tgt[1],
        cx: (x0 + tgt[0]) / 2 + (rnd() - 0.5) * 120, cy: Math.min(by, tgt[1]) - 60 - rnd() * 80,
        delay, dur: 0.55 + rnd() * 0.35, s: 6 + rnd() * 6, a: 0.55 + rnd() * 0.4,
      });
    }
    return parts;
  }

  /* ---------- dados novos chegam e sobem a ponta do gráfico ---------- */
  // o mesmo número move o cartão e a ponta do gráfico: hoje = "Pedidos hoje"
  function arrival(tl, at) {
    const [tx, ty] = tipXY();
    const n = 3 + Math.floor(rnd() * 3);
    for (let i = 0; i < n; i++) {
      const y0 = ty + (rnd() - 0.5) * 160;
      tl.add(light.comet(lineTab(-20, y0, tx, ty), { dur: 0.7 + rnd() * 0.25, tail: 120, alpha: 0.45, size: 0.7 }), at + i * 0.07);
    }
    tl.call(() => {
      todayN += 1;
      today.set(todayN);
      const card = cards.pedidos;
      card.classList.add('is-bump');
      setTimeout(() => card.classList.remove('is-bump'), 300);
      const from = data[data.length - 1];
      const pr = { v: from, m: max };
      // se hoje encostar no topo, a escala do gráfico abre um pouco (todos os pontos acompanham)
      const m = todayN > max * 0.92 ? todayN * 1.12 : max;
      gsap.to(pr, {
        v: todayN, m, duration: 0.6, ease: 'power3.out',
        onUpdate: () => { data[data.length - 1] = pr.v; max = pr.m; drawLine(); },
      });
      const [x1, y1] = tipXY();
      light.flash(x1, y1, { r: 50, alpha: 0.6 });
    }, null, at + 0.95);
  }

  /* ---------- uma pergunta: digitada, pensada e respondida no painel ---------- */
  function pergunta(tl, at, p) {
    let t = at;
    const answer = typeof p.a === 'function' ? null : p.a; // 'best' é calculada na hora
    tl.call(() => {
      ask.classList.remove('has-answer');
      aEl.textContent = '';
      qEl.textContent = '';
      qEl.style.color = 'var(--s-text)';
    }, null, t);
    tl.add(typeText(qEl, p.q, 30), t + 0.05);
    t += 0.05 + p.q.length / 30 + 0.25;
    tl.to(send, { scale: 0.9, duration: 0.1, yoyo: true, repeat: 1 }, t);
    tl.call(() => { ask.classList.add('is-thinking'); core.classList.add('is-thinking'); }, null, t + 0.1);
    t += 0.6;
    // a luz vai da barra até o alvo
    const [x0, y0] = askXY();
    const [x1, y1] = targetXY(p.target);
    tl.add(light.comet(lineTab(x0, y0, x1, y1), { dur: 0.55, tail: 160, onArrive: () => light.flash(x1, y1, { r: 90, alpha: 0.8 }) }), t);
    t += 0.55;
    tl.call(() => highlight(p.target, true), null, t);
    tl.call(() => {
      ask.classList.remove('is-thinking');
      core.classList.remove('is-thinking');
      qEl.style.color = '';
      const text = answer === 'best' ? bestText() : answer || p.a(todayN);
      // a pergunta sobe para dar lugar à resposta (mede antes e depois e anima a diferença)
      const before = qEl.getBoundingClientRect().top;
      aEl.innerHTML = wordsHTML(text);
      ask.classList.add('has-answer');
      const after = qEl.getBoundingClientRect().top;
      gsap.fromTo(qEl, { y: before - after }, { y: 0, duration: 0.45, ease: 'expo.out' });
      revealWords(aEl);
    }, null, t + 0.1);
    t += 0.1 + 2.0 + 3.0;
    tl.call(() => highlight(p.target, false), null, t);
    return t + 0.8;
  }
  function bestText() {
    const i = bestIdx();
    return i === data.length - 1
      ? `O melhor dia foi hoje, com ${fmtN(data[i])} pedidos.`
      : `O melhor dia foi o dia ${i + 1}, com ${fmtN(data[i])} pedidos.`;
  }
  function askXY() {
    const s = ask.style, f = fmt();
    return [parseFloat(s.getPropertyValue(`--x${f}`)) + 50, parseFloat(s.getPropertyValue(`--y${f}`))];
  }
  function targetXY(k) {
    if (k === 'best') { const i = bestIdx(); return [px(i), py(data[i])]; }
    const c = cards[k === 'meta' ? 'meta' : 'pedidos'];
    const s = c.style, f = fmt();
    const x = parseFloat(s.getPropertyValue(`--x${f}`)), y = parseFloat(s.getPropertyValue(`--y${f}`));
    const w = parseFloat(s.getPropertyValue(`--w${f}`)), h = parseFloat(s.getPropertyValue(`--h${f}`));
    return k === 'meta' ? [x + w - 80, y + h - 6] : [x + w * 0.3, y + h - 6];
  }
  function highlight(k, on) {
    gsap.to(film, { opacity: on ? 1 : 0, duration: on ? 0.5 : 0.8 });
    if (k === 'best') {
      if (on) {
        // feixe e etiqueta no ponto mais alto de agora
        const i = bestIdx(), x = px(i), y = py(data[i]);
        beamEl().setAttribute('d', `M${x.toFixed(1)} ${G().y + G().h} V${y.toFixed(1)}`);
        tip.style.setProperty(tall() ? '--tx2' : '--tx', x.toFixed(1));
        tip.style.setProperty(tall() ? '--ty2' : '--ty', y.toFixed(1));
        tip.textContent = i === data.length - 1 ? `Hoje · ${fmtN(data[i])} pedidos` : `Dia ${i + 1} · ${fmtN(data[i])} pedidos`;
      }
      gsap.to(chartG(), { opacity: 1, duration: 0.3 });
      gsap.to(beamEl(), { drawSVG: on ? '100%' : '0%', opacity: on ? 1 : 0, duration: on ? 0.5 : 0.6 });
      gsap.to(tip, { opacity: on ? 1 : 0, duration: 0.4, delay: on ? 0.3 : 0 });
    } else {
      const c = cards[k];
      c.classList.toggle('is-hl', on);
      c.style.zIndex = on ? '3' : '';
      gsap.to(chartG(), { opacity: on ? 0.4 : 1, duration: on ? 0.5 : 0.8 });
    }
  }

  /* ---------- ciclo de ~30 s: perguntas a cada 10 s, dados a cada 2,4 s ---------- */
  function cycle(first) {
    const tl = gsap.timeline();
    const qs = tall() ? 2 : 3;
    let t = first ? 0.3 : 0.6;
    const end0 = t + qs * 10;
    for (let a = t + 1.6; a < end0; a += 2.4 + (rnd() - 0.5) * 0.8) arrival(tl, a);
    for (let k = 0; k < qs; k++) {
      pergunta(tl, t + k * 10, PERGUNTAS[(qi + k) % PERGUNTAS.length]);
    }
    tl.call(() => { qi = (qi + qs) % PERGUNTAS.length; }, null, end0 - 0.1);
    tl.set({}, {}, end0);
    return tl;
  }

  let master = null;
  function build() {
    master = gsap.timeline({ paused: true });
    master.add(assembly(), 0);
    master.add(cycle(true), master.duration() + 0.2);
    queue();
  }
  function queue() {
    master.call(() => {
      const now = master.time();
      master.getChildren(false, true, true).forEach((ch) => { if (ch.endTime() < now - 20) master.remove(ch); });
      master.add(cycle(false), master.duration());
      queue();
    }, null, master.duration());
  }

  // quadro completo e parado: usado quando a pausa é ligada antes de a cena tocar
  function settle() {
    if (!master) build();
    master.pause();
    master.seek(3.0, false);
  }
  return {
    name: 'dados',
    arm,
    start() { if (!master) build(); master.play(); },
    pause() { master?.pause(); },
    resume() { if (!master) build(); master.play(); },
    settle,
    // mudou o formato (16:10 ↔ 4:5): refaz com os trilhos do formato novo, no mesmo estado
    reformat(state) {
      drawLine();
      if (master) { master.kill(); master = null; }
      light.clear();
      arm();
      if (state === 'running') { build(); master.play(); }
      else if (state === 'paused') settle();
    },
    get timeline() { return master; },
  };
}
