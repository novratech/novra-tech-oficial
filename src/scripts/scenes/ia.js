// Cena 1 · Inteligência artificial: conversas que chegam a qualquer hora.
// A IA pensa (borda viva), a luz vai buscar a resposta nos sistemas da empresa e volta,
// e a resposta nasce palavra por palavra. Três conversas se revezam (23:47, 10:24, 06:10).
import gsap from 'gsap';
import { samplePath, reverseTab, odometer, wordsHTML, revealWords, arriveAt, idle } from './engine.js';

const CONVERSAS = [
  {
    name: 'Carla', initial: 'C', channel: 'WhatsApp', time: '23:47',
    steps: [
      { in: 'Oi! Tem horário amanhã de manhã?' },
      { think: 'Olhando a agenda e o cadastro', ask: [['agenda', '9h e 10h30 livres'], ['clientes', 'Carla, cliente há 2 anos']] },
      { out: 'Oi, Carla! Amanhã tenho 9h ou 10h30. Quer que eu reserve às 9h?' },
      { in: 'Pode ser às 9h.', wait: 1.5 },
      { think: 'Reservando', ask: [['agenda', 'Reservado: amanhã, 9h']], done: true },
      { out: 'Pronto, reservado! Você recebe um lembrete 2 horas antes.', only: 'w' },
      { sys: 'Reservado: amanhã, 9h', check: true, only: 't' },
    ],
  },
  {
    name: 'Ricardo', initial: 'R', channel: 'Instagram', time: '10:24',
    steps: [
      { in: 'Quero um orçamento para 40 unidades.' },
      { think: 'Conferindo estoque e preços', ask: [['produtos', '52 em estoque'], ['clientes', 'Primeira compra']] },
      { out: 'Temos 52 em estoque. Para um pedido desse tamanho, chamei a Marina, do comercial.' },
      { think: null, ask: [['equipe', 'Marina foi avisada']], back: false, wait: 0.5 },
      { sys: 'Marina entrou na conversa' },
    ],
  },
  {
    name: 'Luana', initial: 'L', channel: 'Site', time: '06:10',
    steps: [
      { in: 'Vocês abrem no sábado?' },
      { think: 'Olhando a agenda', ask: [['agenda', 'Sábado, das 8h às 12h']] },
      { out: 'Abrimos sim, das 8h às 12h. Quer deixar um horário reservado?' },
      { in: 'Quero, às 9h.', wait: 1.5 },
      { think: 'Reservando', ask: [['agenda', 'Reservado: sábado, 9h']], done: true },
      { out: 'Feito! Reservei sábado às 9h para você.', only: 'w' },
      { sys: 'Reservado: sábado, 9h', check: true, only: 't' },
    ],
  },
];
const CK = '<svg class="ck" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.2 4.2L19 7"/></svg>';

export function createIA(root, light, env) {
  const $ = (s) => root.querySelector(s);
  const $$ = (s) => [...root.querySelectorAll(s)];
  const chat = $('[data-chat]');
  const log = $('[data-log]');
  const status = $('[data-status]');
  const core = $('[data-core]');
  const name = $('[data-name]');
  const avatar = $('[data-avatar]');
  const channel = $('[data-channel]');
  const time = odometer($('[data-time]'), '23:47');
  const countEl = $('[data-count]');
  const count = countEl ? odometer(countEl, 127) : null;
  const srcs = Object.fromEntries($$('[data-src]').map((el) => [el.dataset.src, el]));
  const nodes = Object.fromEntries($$('[data-node]').map((el) => [el.dataset.node, el]));
  const tall = () => env.tall();

  let tabs = null, fmt = null;
  function paths() {
    const f = tall() ? 't' : 'w';
    if (tabs && fmt === f) return tabs;
    fmt = f;
    tabs = {};
    for (const p of root.querySelectorAll(`.sc__svg--${f} [data-wire]`)) {
      const t = samplePath(p);
      tabs[p.dataset.wire] = t;
      tabs[p.dataset.wire + ':back'] = reverseTab(t);
    }
    return tabs;
  }
  const wireEl = (k) => root.querySelector(`.sc__svg--${tall() ? 't' : 'w'} [data-wire="${k}"]`);
  const end = (k) => { const t = paths()[k]; return [t.pts[(t.n - 1) * 2], t.pts[(t.n - 1) * 2 + 1]]; };

  /* ---------- peças de estado ---------- */
  function setSource(k, text, lit) {
    const el = srcs[k];
    if (el) {
      if (text) el.querySelector('.src__done').textContent = text;
      el.classList.toggle('is-lit', lit);
    }
    const n = nodes[k];
    if (n) n.classList.toggle('is-lit', lit);
  }
  function restAll() {
    for (const k of Object.keys(srcs)) setSource(k, null, false);
    for (const k of Object.keys(nodes)) nodes[k].classList.remove('is-lit');
    root.querySelectorAll('.wire.is-lit').forEach((w) => w.classList.remove('is-lit'));
  }
  function thinking(on, text) {
    chat.classList.toggle('is-thinking', on);
    chat.classList.toggle('is-resting', !on);
    core.classList.toggle('is-thinking', on);
    if (on && text) { status.textContent = text; status.className = 'chat__status tx-label shimmer'; }
    if (!on) { status.textContent = ''; status.className = 'chat__status tx-label'; }
  }
  function statusResult(text) {
    status.textContent = text;
    status.className = 'chat__status tx-label tx-hi';
  }

  /* ---------- balões (criados antes, invisíveis: nada pula quando aparecem) ---------- */
  function bubble(step) {
    const p = document.createElement('p');
    if (step.in) { p.className = 'msg msg--in tx-anchor'; p.textContent = step.in; }
    else if (step.out) { p.className = 'msg msg--out tx-body'; p.innerHTML = wordsHTML(step.out); }
    else if (step.sys) { p.className = 'msg msg--sys tx-label'; p.innerHTML = (step.check ? CK : '') + ' ' + step.sys; }
    gsap.set(p, { autoAlpha: 0, y: 14 });
    return p;
  }

  /* ---------- uma ida e volta da luz até os sistemas ---------- */
  function ask(tl, at, step) {
    const T = paths();
    let t = at;
    if (step.think !== null) tl.call(() => thinking(true, step.think), null, t);
    // pergunta vai do chat ao núcleo
    tl.call(() => wireEl('chat')?.classList.add('is-lit'), null, t);
    tl.add(light.comet(T.chat, { dur: 0.22, ease: 'power2.in', tail: 110 }), t);
    t += 0.24;
    // do núcleo a cada sistema
    step.ask.forEach(([k, text], i) => {
      const d = t + i * 0.08;
      tl.call(() => wireEl(k)?.classList.add('is-lit'), null, d + 0.08);
      tl.add(light.comet(T[k], {
        dur: 0.42, tail: 190,
        onArrive: () => {
          const [x, y] = end(k);
          light.flash(x, y, { r: tall() ? 80 : 110, alpha: 0.85 });
          if (i === 0) light.burst(x, y, step.done ? 3 : 2, { dir: tall() ? Math.PI / 2 : 0 });
        },
      }), d);
      // o sistema acende no instante em que a luz chega nele
      tl.call(() => {
        setSource(k, text, true);
        if (tall()) statusResult(`${k[0].toUpperCase() + k.slice(1)}: ${text}`);
      }, null, d + arriveAt(T[k], { dur: 0.42, tail: 190 }));
    });
    t += 0.42 + (step.ask.length - 1) * 0.08 + 0.08;
    if (step.back === false) return t;
    // volta: sistemas → núcleo → chat
    step.ask.forEach(([k], i) => tl.add(light.comet(T[k + ':back'], { dur: 0.3, alpha: 0.7, tail: 150 }), t + i * 0.05));
    t += 0.3 + 0.05 * (step.ask.length - 1);
    tl.add(light.comet(T['chat:back'], { dur: 0.2, alpha: 0.85, tail: 100, ease: 'power2.out' }), t);
    t += 0.2;
    return t;
  }

  /* ---------- uma conversa inteira ---------- */
  function conversa(c, first) {
    const tl = gsap.timeline();
    let t = 0;
    const steps = c.steps.filter((s) => !s.only || s.only === (tall() ? 't' : 'w'));
    // os balões nascem já no tamanho final, invisíveis
    const els = steps.map((s) => (s.in || s.out || s.sys ? bubble(s) : null));
    if (!first) {
      // a conversa anterior sobe e some; a nova pessoa entra no cabeçalho e a hora gira
      tl.to([...log.children], { autoAlpha: 0, y: -24, duration: 0.5, ease: 'power2.in', stagger: 0.03 }, 0);
      tl.to([name, avatar, channel], { autoAlpha: 0, duration: 0.25 }, 0.1);
      tl.call(restAll, null, 0.3);
      t = 0.55;
    }
    tl.call(() => {
      log.textContent = '';
      els.forEach((e) => e && log.appendChild(e));
      name.textContent = c.name;
      avatar.textContent = c.initial;
      channel.textContent = c.channel;
      time.set(c.time);
    }, null, t);
    if (!first) tl.to([name, avatar, channel], { autoAlpha: 1, duration: 0.35 }, t + 0.05);
    t += first ? 0.35 : 0.5;

    steps.forEach((s, i) => {
      if (s.wait) t += s.wait;
      if (s.in) {
        tl.to(els[i], { autoAlpha: 1, y: 0, duration: 0.45, ease: 'expo.out' }, t);
        t += 0.3;
      } else if (s.ask) {
        t = ask(tl, t, s);
        if (s.done) tl.call(() => thinking(false), null, t);
        t += 0.05;
      } else if (s.out) {
        tl.call(() => thinking(false), null, t);
        tl.to(els[i], { autoAlpha: 1, y: 0, duration: 0.3, ease: 'expo.out' }, t);
        tl.add(revealWords(els[i]), t + 0.08);
        // tempo de leitura proporcional ao tamanho da resposta
        t += 0.08 + s.out.split(' ').length * 0.055 + 0.9;
      } else if (s.sys) {
        tl.to(els[i], { autoAlpha: 1, y: 0, duration: 0.45, ease: 'expo.out' }, t);
        t += 0.8;
      }
    });
    tl.call(() => { thinking(false); if (count) count.set(count.value + 1); }, null, t);
    // respiro: os sistemas voltam devagar ao repouso
    tl.call(() => {
      for (const el of Object.values(srcs)) el.classList.remove('is-lit');
      for (const el of Object.values(nodes)) el.classList.remove('is-lit');
      root.querySelectorAll('.wire.is-lit').forEach((w) => w.classList.remove('is-lit'));
    }, null, t + 1.6);
    tl.set({}, {}, t + 2.6);
    return tl;
  }

  /* ---------- montagem: a tela liga ---------- */
  const panels = () => [chat, ...Object.values(srcs).filter((e) => e.offsetParent), ...Object.values(nodes).filter((e) => e.offsetParent)];
  function arm() {
    restAll();
    thinking(false);
    gsap.set(chat, { autoAlpha: 0.08, y: 12 });
    gsap.set([...Object.values(srcs), ...Object.values(nodes)], { autoAlpha: 0.08, x: 16 });
    gsap.set(core, { autoAlpha: 0, scale: 0.6 });
    gsap.set(log.children, { autoAlpha: 0 });
    root.querySelectorAll('.wire').forEach((w) => gsap.set(w, { drawSVG: '0%' }));
    // a linha do tempo nasce no ócio: quando a cena aparecer, só falta dar o play
    idle(() => { if (!master) build(); });
  }
  function assembly() {
    const tl = gsap.timeline();
    tl.to(chat, { autoAlpha: 1, y: 0, duration: 0.7, ease: 'expo.out' }, 0);
    tl.to(panels().slice(1), { autoAlpha: 1, x: 0, duration: 0.7, ease: 'expo.out', stagger: 0.07 }, 0.15);
    tl.to(core, { autoAlpha: 1, scale: 1, duration: 0.9, ease: 'expo.out' }, 0.2);
    const ws = [...root.querySelectorAll(`.sc__svg--${tall() ? 't' : 'w'} .wire`)];
    tl.to(ws, { drawSVG: '100%', duration: 0.6, ease: 'power2.out', stagger: 0.05 }, 0.3);
    tl.set(root.querySelectorAll(`.sc__svg--${tall() ? 'w' : 't'} .wire`), { drawSVG: '100%' }, 0.3);
    return tl;
  }

  /* ---------- relógio da cena ---------- */
  let master = null, idx = 0;
  function build() {
    master = gsap.timeline({ paused: true });
    master.add(assembly(), 0);
    master.add(conversa(CONVERSAS[0], true), 0);
    idx = 1;
    queue();
  }
  // emenda a próxima conversa quando a atual termina (a cena nunca para)
  function queue() {
    master.call(() => {
      // o que já passou há mais de 20 s sai da linha do tempo (memória estável numa visita longa)
      const now = master.time();
      master.getChildren(false, true, true).forEach((ch) => { if (ch.endTime() < now - 20) master.remove(ch); });
      master.add(conversa(CONVERSAS[idx % CONVERSAS.length], false), master.duration());
      idx++;
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
    name: 'ia',
    arm,
    start() { if (!master) build(); master.play(); },
    pause() { master?.pause(); },
    resume() { if (!master) build(); master.play(); },
    settle,
    // mudou o formato (16:10 ↔ 4:5): refaz com os trilhos do formato novo, no mesmo estado
    reformat(state) {
      tabs = null;
      if (master) { master.kill(); master = null; }
      light.clear();
      arm();
      if (state === 'running') { build(); master.play(); }
      else if (state === 'paused') settle();
    },
    get timeline() { return master; },
  };
}
