// Cena 2 · Software sob medida: a caneta de luz desenha a planta, a faixa de luz a transforma
// em sistema e o sistema trabalha. A cada ciclo um módulo novo encaixa no menu.
import gsap from 'gsap';
import { samplePath, lineTab, odometer, seeded, idle } from './engine.js';

const MODULOS = ['Comissões', 'Agenda', 'Contratos'];
const LIGACOES = [
  { name: 'Juliana', initial: 'J' },
  { name: 'Pedro', initial: 'P' },
  { name: 'Renata', initial: 'R' },
];

export function createSoftware(root, light, env) {
  const $ = (s) => root.querySelector(s);
  const $$ = (s) => [...root.querySelectorAll(s)];
  const tall = () => env.tall();
  const fmt = () => (tall() ? 't' : 'w');
  const rnd = seeded(23);

  const plan = $('[data-plan]'), planIn = $('[data-plan-in]');
  const wrap = $('[data-reveal-wrap]'), wrapIn = $('[data-reveal-in]'), band = $('[data-band]');
  const grid = $('.sw-grid');
  const kpi = {
    pedidos: odometer($('[data-kpi="pedidos"]'), 86),
    pagamentos: odometer($('[data-kpi="pagamentos"]'), 32),
    notas: odometer($('[data-kpi="notas"]'), 79),
  };
  const kpiCard = (k) => $(`[data-kpi="${k}"]`).closest('.sw-kpi');
  const barEls = $$('[data-bar]');
  const todayBar = barEls[barEls.length - 1];
  const stockBar = (n) => $(`[data-stock="${n}"]`);
  const stockNum = (n) => $(`[data-stock-n="${n}"]`);
  const restock = $('[data-restock]');
  const call = $('[data-call]'), callTitle = $('[data-call-title]'), callSub = $('[data-call-sub]'), callAv = $('[data-call-av]');
  const timer = $('[data-timer]'), endBtn = $('[data-end]');
  const newmod = $('[data-newmod]'), newmodName = $('[data-newmod-name]');
  const newmodT = $('[data-newmod-t]'), newmodNameT = $('[data-newmod-name-t]');
  let mochila = 7, modIdx = 0, callIdx = 0, seconds = 134;

  const pens = () => $$(`.sc__svg--${fmt()} [data-pen]`);
  // percorrer o perímetro das peças custa caro num celular lento: calcula no ócio e guarda
  const penTabs = {};
  function penTab(p) {
    const k = fmt() + p.dataset.pen;
    return penTabs[k] || (penTabs[k] = samplePath(p, 8));
  }
  function warm() {
    const run = () => pens().forEach(penTab);
    if ('requestIdleCallback' in window) requestIdleCallback(run, { timeout: 2000 }); else setTimeout(run, 300);
  }
  const mmss = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  // centro de uma peça em u (a partir do estilo inline, sem medir nada na tela)
  function box(el) {
    const st = el.style, f = fmt();
    const g = (k) => parseFloat(st.getPropertyValue(`--${k}${f}`)) || 0;
    return { x: g('x'), y: g('y'), w: g('w'), h: g('h') };
  }

  /* ---------- estado inicial: só a planta fantasma ---------- */
  function arm() {
    plan.style.visibility = 'visible';
    gsap.set(grid, { opacity: 0 });
    $$('.sw-line, .sw-dim').forEach((p) => gsap.set(p, { drawSVG: '0%' }));
    gsap.set($$('.sw-tag, .sw-cota'), { autoAlpha: 0 });
    gsap.set(wrap, { xPercent: -100 });
    gsap.set(wrapIn, { xPercent: 100 });
    gsap.set([plan, planIn], { xPercent: 0 });
    gsap.set(band, { opacity: 0 });
    gsap.set(barEls, { scaleY: 0 });
    gsap.set($$('[data-stock]'), { scaleX: 0 });
    Object.values(kpi).forEach((o) => o.set(0, true));
    gsap.set([newmod, newmodT], { autoAlpha: 0, x: 30 });
    call.classList.remove('is-done');
    call.classList.add('is-ringing');
    callTitle.textContent = 'Ligando para Juliana';
    timer.textContent = '';
    warm();
    // a linha do tempo nasce no ócio: quando a cena aparecer, só falta dar o play
    idle(() => { if (!master) build(); });
  }

  /* ---------- montagem ---------- */
  function assembly() {
    const tl = gsap.timeline();
    const startY = tall() ? 104 : 104;
    // a energia entra pela borda e vira a caneta
    tl.add(light.comet(lineTab(-30, startY + 0.5, tall() ? 70 : 74, startY + 0.5), { dur: 0.32, ease: 'power2.in', tail: 90 }), 0);
    tl.to(grid, { opacity: 0.12, duration: 0.5 }, 0.05);
    // caneta de luz: no máximo 4 traços ao mesmo tempo, com a cabeça de luz na ponta
    pens().forEach((p, i) => {
      const at = 0.25 + (i < 4 ? i * 0.08 : 0.55 + (i - 4) * 0.08);
      tl.to(p, { drawSVG: '100%', duration: 0.6, ease: 'none' }, at);
      tl.add(light.comet(penTab(p), { dur: 0.6, ease: 'none', tail: 70, size: 0.75, alpha: 0.9 }), at);
    });
    tl.to($$(`.sc__svg--${fmt()} .sw-dim`), { drawSVG: '100%', duration: 0.5, ease: 'power2.out', stagger: 0.1 }, 0.55);
    tl.to($$('.sw-tag, .sw-cota').filter((e) => e.offsetParent), { autoAlpha: 1, duration: 0.4, stagger: 0.05 }, 0.55);
    // a faixa de luz passa: atrás dela, o sistema de verdade; na frente, a planta some
    const T = 1.45, D = 0.95;
    tl.to(band, { opacity: 1, duration: 0.12 }, T);
    tl.to(wrap, { xPercent: 0, duration: D, ease: 'power2.inOut' }, T);
    tl.to(wrapIn, { xPercent: 0, duration: D, ease: 'power2.inOut' }, T);
    tl.to(plan, { xPercent: 100, duration: D, ease: 'power2.inOut' }, T);
    tl.to(planIn, { xPercent: -100, duration: D, ease: 'power2.inOut' }, T);
    tl.to(band, { opacity: 0, duration: 0.25 }, T + D - 0.2);
    tl.set(plan, { visibility: 'hidden' }, T + D);
    // conteúdo: números, barras e a primeira ligação
    const C = T + D - 0.15;
    tl.call(() => { kpi.pedidos.set(86); kpi.pagamentos.set(32); kpi.notas.set(79); }, null, C);
    tl.to(barEls, { scaleY: 1, duration: 0.7, ease: 'expo.out', stagger: 0.06 }, C);
    tl.to($$('[data-stock]'), { scaleX: 1, duration: 0.8, ease: 'expo.out', stagger: 0.08 }, C + 0.1);
    tl.call(() => startCall(0, true), null, C + 0.5);
    return tl;
  }

  /* ---------- acontecimentos ---------- */
  function bump(k) {
    if (k === 'notas' && tall()) return; // esse cartão só existe no 16:10
    const card = kpiCard(k);
    card.classList.add('is-bump');
    setTimeout(() => card.classList.remove('is-bump'), 260);
  }
  function order() {
    kpi.pedidos.set(kpi.pedidos.value + 1);
    bump('pedidos');
    if (!tall() && rnd() < 0.55 && mochila > 3) {
      mochila -= 1;
      stockNum('Mochila').textContent = mochila;
      const b = stockBar('Mochila');
      b.style.setProperty('--v', mochila * 2);
      b.classList.toggle('is-low', mochila <= 4);
      // passou de 4 para 3: o sistema pede reposição sozinho (tudo dentro da linha do tempo da cena)
      if (mochila === 3) {
        const at = master.time();
        master.to(restock, { opacity: 1, duration: 0.4 }, at);
        master.call(() => {
          mochila = 40;
          stockNum('Mochila').textContent = mochila;
          b.style.setProperty('--v', 80);
          b.classList.remove('is-low');
        }, null, at + 5);
        master.to(restock, { opacity: 0, duration: 0.6 }, at + 5);
      }
    }
  }
  // um recebimento sobe do financeiro até o número de pagamentos
  function payment(tl, at) {
    const fin = box($('[data-fin]')), k2 = box(kpiCard('pagamentos'));
    const x0 = fin.x + fin.w * 0.82, y0 = fin.y + 6, x1 = k2.x + k2.w / 2, y1 = k2.y + k2.h - 4;
    tl.call(() => {
      const v = Math.min(100, parseFloat(todayBar.style.getPropertyValue('--v')) + 3);
      todayBar.style.setProperty('--v', v);
    }, null, at);
    tl.add(light.comet(lineTab(x0, y0, x1, y1), { dur: 0.42, tail: 110 }), at + 0.05);
    tl.call(() => {
      light.flash(x1, y1, { r: 70, alpha: 0.6 });
      kpi.pagamentos.set(kpi.pagamentos.value + 1);
      bump('pagamentos');
    }, null, at + 0.47);
  }
  function startCall(i, first) {
    const c = LIGACOES[i % LIGACOES.length];
    call.classList.remove('is-done');
    callAv.textContent = c.initial;
    callTitle.textContent = `Em ligação com ${c.name}`;
    callSub.textContent = 'Direto do navegador';
    call.classList.remove('is-ringing');
    seconds = first ? 134 : 0;
    timer.textContent = mmss(seconds);
    if (endBtn) endBtn.style.visibility = 'visible';
  }
  function endCall(tl, at) {
    tl.to(endBtn, { scale: 0.94, duration: 0.12, yoyo: true, repeat: 1 }, at);
    tl.call(() => {
      call.classList.add('is-done');
      callTitle.textContent = 'Ligação encerrada';
      callSub.innerHTML = 'Registrada no cliente';
      if (endBtn) endBtn.style.visibility = 'hidden';
      timer.textContent = '';
    }, null, at + 0.25);
    // o registro vai da ligação até "Ligações" no menu (16:10) ou até os módulos (4:5)
    const cb = box(call);
    if (!tall()) {
      tl.add(light.comet(lineTab(cb.x + 4, cb.y + cb.h / 2, 296, 104 + 28 + 64 * 4 + 8 * 4 + 32), { dur: 0.5, tail: 140, alpha: 0.85 }), at + 0.3);
    } else {
      tl.add(light.comet(lineTab(cb.x + cb.w / 2, cb.y, cb.x + cb.w / 2, 730), { dur: 0.3, tail: 90, alpha: 0.7 }), at + 0.3);
    }
    tl.call(() => {
      const c = LIGACOES[(callIdx + 1) % LIGACOES.length];
      call.classList.remove('is-done');
      call.classList.add('is-ringing');
      callAv.textContent = c.initial;
      callTitle.textContent = `Ligando para ${c.name}`;
      callSub.textContent = 'Direto do navegador';
    }, null, at + 2.4);
    tl.call(() => { callIdx++; startCall(callIdx, false); }, null, at + 3.6);
  }
  // módulo novo encaixa com luz na junta: o sistema cresce com a empresa
  function dock(tl, at) {
    const name = MODULOS[modIdx % MODULOS.length];
    const el = tall() ? newmodT : newmod;
    const joint = el.querySelector('.sw-joint');
    tl.to(el, { autoAlpha: 0, x: -20, duration: 0.3, ease: 'power2.in' }, at);
    tl.call(() => {
      (tall() ? newmodNameT : newmodName).textContent = name;
      modIdx++;
    }, null, at + 0.32);
    tl.fromTo(el, { autoAlpha: 0, x: 40 }, { autoAlpha: 1, x: 0, duration: 0.7, ease: 'expo.out', immediateRender: false }, at + 0.35);
    tl.fromTo(joint, { opacity: 0 }, { opacity: 1, duration: 0.15, immediateRender: false }, at + 0.85);
    tl.to(joint, { opacity: 0, duration: 1.4, ease: 'expo.out' }, at + 1.0);
    tl.call(() => {
      const r = box(tall() ? $('.sw-mods') : $('.sw-rail'));
      const x = tall() ? r.x + r.w - 90 : r.x + 26, y = tall() ? r.y + r.h / 2 : 104 + 28 + 72 * 5 + 18 + 42;
      light.flash(x, y, { r: 80, alpha: 0.7 });
      light.burst(x, y, 2, { dir: 0 });
    }, null, at + 0.85);
  }

  /* ---------- ciclo de 13 s, sempre vivo ---------- */
  function cycle(first) {
    const tl = gsap.timeline();
    const D = 13;
    for (let t = 1.2; t < D; t += 3.2 + (rnd() - 0.5) * 0.6) tl.call(order, null, t);
    payment(tl, 4.6);
    payment(tl, 10.4);
    dock(tl, first ? 1.2 : 6.2);
    endCall(tl, 8.0);
    // cronômetro: uma escrita por segundo
    for (let s = 1; s <= D; s++) tl.call(() => { if (!call.classList.contains('is-done') && !call.classList.contains('is-ringing')) { seconds++; timer.textContent = mmss(seconds); } }, null, s);
    tl.set({}, {}, D);
    return tl;
  }

  let master = null;
  function build() {
    master = gsap.timeline({ paused: true });
    master.add(assembly(), 0);
    master.add(cycle(true), master.duration() + 0.3);
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
    master.seek(3.4, false);
  }
  return {
    name: 'software',
    arm,
    start() { if (!master) build(); master.play(); },
    pause() { master?.pause(); },
    resume() { if (!master) build(); master.play(); },
    settle,
    // mudou o formato (16:10 ↔ 4:5): refaz com os trilhos do formato novo, no mesmo estado
    reformat(state) {
      if (master) { master.kill(); master = null; }
      light.clear();
      arm();
      if (state === 'running') { build(); master.play(); }
      else if (state === 'paused') settle();
    },
    get timeline() { return master; },
  };
}
