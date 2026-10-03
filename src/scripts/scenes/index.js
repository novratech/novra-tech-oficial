// Controle das cenas de Soluções.
// - Celular, tablet e sem JS: cada cena fica dentro do seu serviço (o HTML já é o quadro parado).
// - Desktop: as cenas vão para a tela presa ao lado e trocam com o serviço lido. O layout de
//   desktop só liga quando este script marca o tour (.is-staged): se algo falhar antes, fica o empilhado.
// - Só a cena visível toca; as outras ficam pausadas. Menos movimento: nada se mexe.
// Estados de cada cena: idle (HTML parado) → armed (planta fantasma, pronta para montar)
// → running ⇄ paused. Com a pausa do usuário ligada, nenhuma cena sai do quadro parado.
import gsap from 'gsap';
import { DrawSVGPlugin } from 'gsap/DrawSVGPlugin';
import { createLight } from './engine.js';
import { createIA } from './ia.js';
import { createSoftware } from './software.js';
import { createAutomacoes } from './automacoes.js';
import { createDados } from './dados.js';

gsap.registerPlugin(DrawSVGPlugin);

const FACTORIES = { ia: createIA, software: createSoftware, automacoes: createAutomacoes, dados: createDados };
const reduceMQ = window.matchMedia('(prefers-reduced-motion: reduce)');
const desktopMQ = window.matchMedia('(min-width: 1069px)');
const tallMQ = window.matchMedia('(max-width: 734.98px)');
const KEY = 'novra:cenas:pausa';

const tour = document.querySelector('[data-tour]');
const frame = tour?.querySelector('.tour__frame');
const roots = tour ? [...tour.querySelectorAll('[data-scene]')] : [];

if (tour && roots.length) init();

function init() {
  const env = { tall: () => tallMQ.matches };
  const items = [...tour.querySelectorAll('.tour__item')];
  const scenes = roots.map((root) => ({
    root,
    host: root.parentElement, // a tela dentro do serviço (lugar de origem)
    ui: root.querySelector('.sc__ui'),
    make: FACTORIES[root.dataset.scene],
    index: items.indexOf(root.closest('.tour__item')),
    inst: null, light: null, state: 'idle', visible: false, near: false, stopId: 0, hibernateId: 0,
  }));
  let userPaused = false;
  try { userPaused = sessionStorage.getItem(KEY) === '1'; } catch (e) {}
  let active = 0;
  let frameVisible = false, frameNear = false;
  let desktop = false;
  const canAnimate = () => !reduceMQ.matches && 'IntersectionObserver' in window;
  const halted = () => userPaused || !canAnimate();

  /* ---------- lugar das cenas: dentro do serviço ou na tela presa (primeiro de tudo) ---------- */
  function place() {
    desktop = desktopMQ.matches && !!frame;
    tour.classList.toggle('is-staged', desktop);
    scenes.forEach((s) => {
      if (desktop) {
        // mesma ordem dos serviços: a cena n é o n-ésimo filho da tela presa
        const ref = frame.querySelectorAll(':scope > .tour__shot')[s.index] || null;
        if (ref !== s.root) frame.insertBefore(s.root, ref);
        s.root.classList.add('tour__shot');
        s.root.classList.toggle('is-active', s.index === active);
        s.root.setAttribute('aria-hidden', 'true'); // no desktop, a descrição vai junto do texto de cada serviço
      } else {
        if (s.root.parentElement !== s.host) s.host.prepend(s.root);
        s.root.classList.remove('tour__shot', 'is-active');
        s.root.removeAttribute('aria-hidden');
      }
    });
    scenes.forEach((s) => { if (s.state === 'running') s.light.size(); });
    sync();
  }

  /* ---------- unidade u sem container query (navegadores antigos) ---------- */
  const cq = !!(window.CSS && CSS.supports && CSS.supports('width', '1cqw'));
  function unit(s) {
    if (cq || !s.ui) return;
    s.ui.style.setProperty('--u', `${s.root.offsetWidth / (env.tall() ? 800 : 1600)}px`);
  }

  /* ---------- ciclo de vida de cada cena ---------- */
  function ensure(s) {
    if (s.inst || !s.make) return s.inst;
    const canvas = s.root.querySelector('.sc__light');
    s.light = createLight(canvas, { vbw: () => (env.tall() ? 800 : 1600) });
    s.inst = s.make(s.root, s.light, env);
    return s.inst;
  }
  // perto de aparecer: já fica "desligada" (planta fantasma), para montar na frente da pessoa
  function arm(s) {
    if (s.state !== 'idle' || halted() || !ensure(s)) return;
    s.inst.arm();
    s.state = 'armed';
  }
  const showing = (s) => (desktop ? frameVisible && s.index === active : s.visible);
  function play(s) {
    clearTimeout(s.stopId);
    clearTimeout(s.hibernateId);
    if (s.state === 'running' || !ensure(s)) return;
    s.light.size();
    s.root.classList.remove('is-paused');
    if (s.state === 'idle') { s.inst.arm(); s.inst.start(); }
    else if (s.state === 'armed') s.inst.start();
    else s.inst.resume();
    s.state = 'running';
  }
  // a cena que sai continua até o fim do esmaecimento (0,6 s) e então pausa
  function stop(s, delay) {
    if (s.state !== 'running') return;
    clearTimeout(s.stopId);
    s.stopId = setTimeout(() => {
      s.inst.pause();
      s.light.sleep();
      s.root.classList.add('is-paused');
      s.state = 'paused';
      // muito tempo fora da tela: o canvas devolve a memória (a cena visível pausada guarda a luz congelada)
      clearTimeout(s.hibernateId);
      s.hibernateId = setTimeout(() => { if (!showing(s)) s.light.hibernate(); }, 10000);
    }, delay);
  }
  // pausa do usuário (ou menos movimento) com a cena ainda "desligada": vira o quadro completo, parado
  function freeze(s) {
    if (s.state !== 'armed') return;
    s.light.size();
    s.inst.settle();
    s.light.sleep();
    s.root.classList.add('is-paused');
    s.state = 'paused';
    // fora da vista não precisa guardar a luz congelada: devolve a memória já
    if (!showing(s)) s.light.hibernate();
  }
  function sync() {
    scenes.forEach((s) => {
      if (halted()) {
        if (s.state === 'running') stop(s, 0);
        else freeze(s);
        return;
      }
      if (s.near || (desktop && frameNear)) arm(s);
      if (showing(s)) play(s);
      else stop(s, desktop && s.index !== active ? 650 : 0);
    });
  }

  place();
  scenes.forEach(unit);

  /* ---------- visibilidade ---------- */
  if ('IntersectionObserver' in window) {
    const seen = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.target === frame) frameVisible = e.isIntersecting;
        else { const s = scenes.find((x) => x.host === e.target); if (s) s.visible = e.isIntersecting; }
      }
      sync();
    }, { threshold: 0.3 });
    const close = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.target === frame) frameNear = e.isIntersecting;
        else { const s = scenes.find((x) => x.host === e.target); if (s) s.near = e.isIntersecting; }
      }
      sync();
    }, { rootMargin: '60% 0px 60% 0px' });
    if (frame) { seen.observe(frame); close.observe(frame); }
    scenes.forEach((s) => { seen.observe(s.host); close.observe(s.host); });
  }

  tour.addEventListener('tour:change', (e) => {
    active = e.detail.index;
    if (desktop) scenes.forEach((s) => s.root.classList.toggle('is-active', s.index === active));
    sync();
  });

  /* ---------- pausa (WCAG 2.2.2): um estado só para as 4 cenas ---------- */
  // rótulo fixo; o estado vai no aria-pressed (o leitor de tela lê "Pausar as animações, pressionado")
  const buttons = [...tour.querySelectorAll('.sc-pause')];
  const paint = () => buttons.forEach((b) => b.setAttribute('aria-pressed', userPaused ? 'true' : 'false'));
  buttons.forEach((b) => b.addEventListener('click', () => {
    userPaused = !userPaused;
    try { sessionStorage.setItem(KEY, userPaused ? '1' : '0'); } catch (e) {}
    paint();
    sync();
  }));
  paint();

  /* ---------- tamanho e formato ---------- */
  if ('ResizeObserver' in window) {
    let rz = 0;
    const ro = new ResizeObserver(() => {
      cancelAnimationFrame(rz);
      rz = requestAnimationFrame(() => scenes.forEach((s) => {
        unit(s);
        // só a cena tocando refaz o canvas; as outras se ajustam quando voltarem a tocar
        if (s.state === 'running') { s.light.size(); s.light.redraw(); }
      }));
    });
    scenes.forEach((s) => ro.observe(s.root));
  }
  tallMQ.addEventListener('change', () => scenes.forEach((s) => {
    unit(s);
    if (!s.inst || s.state === 'idle') return;
    if (s.state === 'running') s.light.size();
    s.inst.reformat(s.state);
  }));
  desktopMQ.addEventListener('change', place);
  // ligou "reduzir movimento" com a página aberta: tudo para (e volta se desligar)
  reduceMQ.addEventListener('change', sync);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) sync(); });

  if (import.meta.env.DEV) {
    // gancho de teste: capturas sempre iguais (window.__cenas.seek('ia', 2.4))
    window.__cenas = {
      scenes,
      seek(name, t) {
        const s = scenes.find((x) => x.root.dataset.scene === name);
        if (!s) return;
        play(s);
        s.inst.pause();
        s.state = 'paused';
        s.inst.timeline.seek(t, false);
        s.light.redraw();
      },
      pauseAll() { userPaused = true; paint(); sync(); },
    };
  }
}
