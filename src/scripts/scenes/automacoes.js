// Cena 3 · Automações: o caminho cinza do trabalho manual vira um circuito aceso, e as tarefas
// passam a correr sozinhas. Cada chegada em "Pronto" soma 1 no contador.
import gsap from 'gsap';
import { samplePath, odometer, seeded, idle } from './engine.js';

const ROTINAS = [
  { names: ['Chegou um pedido', 'Gerar a cobrança', 'Emitir a nota', 'Avisar o cliente', 'Atualizar o estoque', 'Pronto'], bubble: 'Quero 2 caixas de café para amanhã' },
  { names: ['Vídeo gravado', 'Cortar os trechos', 'Pôr legendas', 'Postar no Instagram', 'Postar no YouTube', 'Publicado'] },
  { names: ['Ver os concorrentes', 'Ler os preços', 'Comparar com os seus', 'Montar o resumo', 'Avisar quem decide', 'Pronto'] },
];

export function createAutomacoes(root, light, env) {
  const $ = (s) => root.querySelector(s);
  const $$ = (s) => [...root.querySelectorAll(s)];
  const tall = () => env.tall();
  const fmt = () => (tall() ? 't' : 'w');
  const rnd = seeded(41);

  const mode = $('[data-mode]');
  const count = odometer($('[data-count]'), 1247);
  const bubble = $('[data-bubble]'), bubbleText = $('[data-bubble-text]');
  const sts = $$('[data-st]');
  const lbls = $$('[data-lbl]');
  const manual = $('[data-manual]');
  let tab = 0;

  /* ---------- trilhos ---------- */
  let tabs = null, tf = null;
  function rails() {
    if (tabs && tf === fmt()) return tabs;
    tf = fmt();
    tabs = {};
    for (const p of $$(`.sc__svg--${tf} [data-rail]`)) tabs[p.dataset.rail] = samplePath(p);
    // onde cada estação dos ramos fica ao longo do trilho (para acender na hora certa)
    for (const k of ['a', 'b']) {
      const t = tabs[k], st = stCenter(k === 'a' ? 3 : 4);
      let best = 0, bd = Infinity;
      for (let i = 0; i < t.n; i++) {
        const d = Math.hypot(t.pts[i * 2] - st[0], t.pts[i * 2 + 1] - st[1]);
        if (d < bd) { bd = d; best = i; }
      }
      t.stAt = best / (t.n - 1);
    }
    return tabs;
  }
  function stCenter(i) {
    const s = sts[i].style, f = fmt();
    return [parseFloat(s.getPropertyValue(`--x${f}`)) + 30, parseFloat(s.getPropertyValue(`--y${f}`)) + 30];
  }
  const onPaths = () => $$(`.sc__svg--${fmt()} [data-on]`);
  const onPath = (k) => $(`.sc__svg--${fmt()} [data-on="${k}"]`);

  /* ---------- estado ---------- */
  function hit(i) {
    const el = sts[i];
    el.classList.add('is-hit');
    setTimeout(() => el.classList.remove('is-hit'), 180);
  }
  function setNames(r, instant) {
    lbls.forEach((l, i) => {
      if (instant) { l.textContent = ROTINAS[r].names[i]; return; }
      gsap.timeline()
        .to(l, { autoAlpha: 0, y: -10, duration: 0.25, ease: 'power2.in' })
        .call(() => { l.textContent = ROTINAS[r].names[i]; })
        .fromTo(l, { autoAlpha: 0, y: 12 }, { autoAlpha: 1, y: 0, duration: 0.4, ease: 'expo.out' });
    });
  }
  let tabBoxes = {};
  function moveTabHi(i, instant) {
    for (const [wrap, hi] of [[$('[data-tabs]'), $('[data-tabhi]')], [$('[data-tabs-t]'), $('[data-tabhi-t]')]]) {
      if (!wrap || (wrap === $('[data-tabs]')) === tall()) continue; // só a barra de abas do formato visível
      const items = [...wrap.querySelectorAll('.au-tab')];
      const key = fmt();
      // mede uma vez por formato (as abas não mudam de tamanho)
      if (!tabBoxes[key] || !tabBoxes[key][0][1]) tabBoxes[key] = items.map((t) => [t.offsetLeft, t.offsetWidth]);
      items.forEach((t, k) => t.classList.toggle('is-on', k === i));
      const [left, width] = tabBoxes[key][i];
      if (instant) hi.style.transition = 'none';
      hi.style.width = width + 'px';
      hi.style.transform = `translateX(${left}px)`;
      if (instant) { void hi.offsetWidth; hi.style.transition = ''; }
    }
  }

  function arm() {
    mode.classList.add('is-manual');
    sts.forEach((s) => s.classList.remove('is-done', 'is-hit'));
    lbls.forEach((l) => l.classList.add('is-gray'));
    onPaths().forEach((p) => gsap.set(p, { drawSVG: '0%' }));
    $$(`.sc__svg--${tall() ? 'w' : 't'} [data-on]`).forEach((p) => gsap.set(p, { drawSVG: '0%' }));
    gsap.set([...sts, ...lbls], { autoAlpha: 0 });
    gsap.set(bubble, { autoAlpha: 0 });
    gsap.set(manual, { autoAlpha: 0 });
    count.set(1246, true);
    tab = 0;
    setNames(0, true);
    requestAnimationFrame(() => moveTabHi(0, true));
    // a linha do tempo nasce no ócio: quando a cena aparecer, só falta dar o play
    idle(() => { if (!master) build(); });
  }

  /* ---------- uma tarefa percorre o circuito ---------- */
  const speed = () => (tall() ? 300 : 460);
  const durOf = (t) => Math.max(0.24, t.L / speed());
  function task(tl, at, o = {}) {
    const T = rails();
    const alpha = o.alpha ?? 0.5;
    const big = alpha > 0.8;
    let t = at;
    tl.call(() => hit(0), null, t);
    for (const [k, next] of [['s1', 1], ['s2', 2], ['s3', null]]) {
      const d = durOf(T[k]);
      tl.add(light.comet(T[k], { dur: d, ease: 'none', alpha, tail: o.tail ?? 120, size: big ? 1 : 0.8 }), t);
      if (next !== null) tl.call(() => hit(next), null, t + d);
      t += d;
    }
    // divide em dois e junta em "Pronto"
    const da = durOf(T.a);
    for (const [k, si] of [['a', 3], ['b', 4]]) {
      tl.add(light.comet(T[k], { dur: da, ease: 'none', alpha: alpha * 0.85, tail: o.tail ?? 120, size: big ? 0.95 : 0.75 }), t);
      tl.call(() => hit(si), null, t + da * T[k].stAt);
    }
    t += da;
    tl.call(() => {
      hit(5);
      count.set(count.value + 1);
      const [x, y] = stCenter(5);
      light.flash(x, y, { r: big ? 110 : 70, alpha: big ? 0.85 : 0.45 });
      if (big) light.burst(x, y, 2, { dir: tall() ? Math.PI / 2 : 0 });
    }, null, t);
    return t;
  }

  /* ---------- montagem: da mão para o sistema ---------- */
  function assembly() {
    const tl = gsap.timeline();
    const T = rails();
    tl.to(sts, { autoAlpha: 1, duration: 0.5, ease: 'expo.out', stagger: 0.05 }, 0);
    tl.to(lbls, { autoAlpha: 1, duration: 0.5, ease: 'expo.out', stagger: 0.05 }, 0.05);
    // a tarefa feita na mão: anda, para, hesita
    const ax = tall() ? '--yt' : '--xw';
    const a0 = parseFloat(manual.style.getPropertyValue(ax));
    tl.to(manual, { autoAlpha: 1, duration: 0.25 }, 0.25);
    tl.to(manual, { [ax]: a0 + 34, duration: 0.35, ease: 'power1.inOut' }, 0.3);
    tl.to(manual, { [ax]: a0 + 58, duration: 0.3, ease: 'power1.inOut' }, 0.8);
    // conversão: um risco de luz acelera por cima do caminho cinza
    const segs = [['s1', 0.3, 1], ['s2', 0.2, 2], ['s3', 0.1, null]];
    let t = 1.0;
    tl.call(() => { sts[0].classList.add('is-done'); lbls[0].classList.remove('is-gray'); hit(0); }, null, t);
    for (const [k, d, next] of segs) {
      tl.to(onPath(k), { drawSVG: '100%', duration: d, ease: k === 's1' ? 'power2.in' : 'none' }, t);
      tl.add(light.comet(T[k], { dur: d, ease: k === 's1' ? 'power2.in' : 'none', tail: 160 }), t);
      if (k === 's1') {
        // a luz passa pela tarefa cinza, que vira faísca
        tl.call(() => {
          const [x0, y0] = stCenter(0);
          const x = tall() ? x0 : x0 + 58, y = tall() ? y0 + 58 : y0;
          light.flash(x, y, { r: 60, alpha: 0.7 });
          light.burst(x, y, 2);
        }, null, t + d * 0.72);
        tl.to(manual, { autoAlpha: 0, scale: 0.4, duration: 0.2 }, t + d * 0.72);
      }
      if (next !== null) tl.call(() => { sts[next].classList.add('is-done'); lbls[next].classList.remove('is-gray'); hit(next); }, null, t + d);
      t += d;
    }
    const db = 0.32;
    for (const [k, si] of [['a', 3], ['b', 4]]) {
      tl.to(onPath(k), { drawSVG: '100%', duration: db, ease: 'none' }, t);
      tl.add(light.comet(T[k], { dur: db, ease: 'none', tail: 160, alpha: 0.95 }), t);
      tl.call(() => { sts[si].classList.add('is-done'); lbls[si].classList.remove('is-gray'); hit(si); }, null, t + db * T[k].stAt);
    }
    t += db;
    tl.call(() => mode.classList.remove('is-manual'), null, 1.45);
    tl.call(() => {
      sts[5].classList.add('is-done');
      lbls[5].classList.remove('is-gray');
      hit(5);
      const [x, y] = stCenter(5);
      light.flash(x, y, { r: 150, alpha: 0.9, decay: 1.4 });
      light.burst(x, y, 3, { dir: tall() ? Math.PI / 2 : 0 });
      count.set(count.value + 1);
    }, null, t);
    return tl;
  }

  /* ---------- ciclo de 30 s: pedidos (com a rajada), vídeos, concorrentes ---------- */
  function cycle(first) {
    const tl = gsap.timeline();
    let n = 0;
    for (let r = 0; r < 3; r++) {
      const base = r * 10;
      if (r > 0 || !first) {
        tl.call(() => {
          tab = r;
          moveTabHi(r);
          setNames(r);
        }, null, base);
        // um traço de luz corre o circuito inteiro na troca de rotina
        onPaths().forEach((p) => tl.fromTo(p, { drawSVG: '0%' }, { drawSVG: '100%', duration: 0.6, ease: 'power2.inOut', immediateRender: false }, base + 0.1));
      }
      let t = base + (r === 0 && first ? 0.2 : 0.8);
      if (r === 0 && ROTINAS[0].bubble) {
        // o pedido chega pelo WhatsApp e entra na primeira etapa
        const b0 = t;
        tl.call(() => { bubbleText.textContent = ROTINAS[0].bubble; }, null, b0);
        tl.fromTo(bubble, { autoAlpha: 0, y: 14, scale: 0.96 }, { autoAlpha: 1, y: 0, scale: 1, duration: 0.45, ease: 'expo.out', immediateRender: false }, b0);
        tl.to(bubble, { autoAlpha: 0, scale: 0.4, x: tall() ? 30 : 60, y: tall() ? 10 : 70, duration: 0.4, ease: 'power2.in' }, b0 + 1.7);
        tl.set(bubble, { x: 0, y: 0, scale: 1 }, b0 + 2.2);
        task(tl, b0 + 2.0, { alpha: 1, tail: 170 });
        t = b0 + 3.0;
      }
      if (r === 0) {
        tl.call(() => root.classList.add('is-rush'), null, base + 4.6);
        tl.call(() => root.classList.remove('is-rush'), null, base + 9.4);
      }
      while (t < base + 9.4) {
        // rajada: na rotina de pedidos, o ritmo sobe até cerca de 3 tarefas por segundo e volta
        const inRush = r === 0 && t > base + 4.2 && t < base + 8.6;
        const gap = inRush ? (tall() ? 0.5 : 0.34) + Math.abs(t - (base + 6.4)) * 0.18 : 1.05 + (rnd() - 0.5) * 0.5;
        task(tl, t, { alpha: n % 4 === 0 && !inRush ? 1 : inRush ? 0.55 : 0.5, tail: inRush ? 100 : 120 });
        n++;
        t += gap;
      }
    }
    tl.set({}, {}, 30);
    return tl;
  }

  let master = null;
  function build() {
    master = gsap.timeline({ paused: true });
    master.add(assembly(), 0);
    master.add(cycle(true), 1.9);
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

  let pausedAt = 0;
  // quadro completo e parado: usado quando a pausa é ligada antes de a cena tocar
  function settle() {
    if (!master) build();
    master.pause();
    master.seek(2.8, false);
  }
  return {
    name: 'automacoes',
    arm,
    start() { if (!master) build(); master.play(); },
    pause() { master?.pause(); pausedAt = performance.now(); },
    // o sistema não para: ao voltar, o contador alcança o que foi feito enquanto a cena esteve parada
    resume() {
      const gone = pausedAt ? (performance.now() - pausedAt) / 1000 : 0;
      pausedAt = 0;
      if (gone > 2) count.set(count.value + Math.round(gone / 1.1));
      if (!master) build();
      master.play();
    },
    settle,
    // mudou o formato (16:10 ↔ 4:5): refaz com os trilhos do formato novo, no mesmo estado
    reformat(state) {
      tabs = null;
      tabBoxes = {};
      if (master) { master.kill(); master = null; }
      light.clear();
      arm();
      if (state === 'running') { build(); master.play(); }
      else if (state === 'paused') settle();
    },
    get timeline() { return master; },
  };
}
