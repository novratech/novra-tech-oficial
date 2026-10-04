// Comportamentos da home (marca nova). Rolagem nativa, sem cursor, sem ímã, sem brilho:
// o movimento existe para guiar a leitura, nunca para enfeitar.
import gsap from 'gsap';
import ScrollTrigger from 'gsap/ScrollTrigger';
gsap.registerPlugin(ScrollTrigger);
ScrollTrigger.config({ ignoreMobileResize: true });

const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const moreContrast = window.matchMedia('(prefers-contrast: more)').matches;
const html = document.documentElement;

/* ------------------------------------------------------------------ */
/* Vídeo do hero: a imagem parada aparece na hora; o vídeo só começa  */
/* a baixar depois que a página carregou, e nunca para quem prefere   */
/* menos movimento ou está economizando dados                         */
/* ------------------------------------------------------------------ */
(() => {
  const v = document.querySelector('.hero__video');
  if (!v) return;
  const saveData = navigator.connection && navigator.connection.saveData;
  if (reduce || saveData) return;
  let list = [];
  try { list = JSON.parse(v.dataset.sources || '[]'); } catch (e) {}
  let armed = false, visible = true;
  // baixou tudo? então pode ficar; senão, sair do hero cancela o download
  const full = () => v.buffered.length && v.duration && v.buffered.end(v.buffered.length - 1) >= v.duration - 0.5;
  const arm = () => {
    if (armed) return;
    armed = true;
    list.forEach((s) => {
      const el = document.createElement('source');
      el.src = s.src; el.type = s.type;
      if (s.media) el.media = s.media;
      v.appendChild(el);
    });
    v.preload = 'auto';
    v.load();
  };
  const disarm = () => {
    if (!armed || full()) return;
    armed = false;
    v.querySelectorAll('source').forEach((el) => el.remove());
    v.load(); // sem fontes, o navegador abandona a requisição
    v.classList.remove('is-ready');
  };
  const play = () => { v.play().catch(() => {}); }; // pouca energia bloqueia: fica o pôster
  v.addEventListener('playing', () => v.classList.add('is-ready'));
  const start = () => {
    if (!('IntersectionObserver' in window)) { arm(); play(); return; }
    new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      if (visible) { arm(); play(); }
      else { v.pause(); disarm(); }
    }).observe(v);
  };
  if (document.readyState === 'complete') setTimeout(start, 150);
  else window.addEventListener('load', () => setTimeout(start, 150), { once: true });
})();

/* ------------------------------------------------------------------ */
/* Cabeçalho: vidro ao rolar, mais fechado sobre as seções claras e,  */
/* no celular, a pílula "Fale conosco" quando o botão do hero sai     */
/* ------------------------------------------------------------------ */
const header = document.getElementById('site-header');
const lights = [...document.querySelectorAll('.theme-light')];
let ticking = false;
const onScroll = () => {
  if (ticking) return;
  ticking = true;
  requestAnimationFrame(() => {
    if (header) {
      header.dataset.state = window.scrollY > 8 ? 'scrolled' : 'top';
      const mid = header.offsetHeight / 2;
      header.classList.toggle('is-over-light', lights.some((s) => {
        const r = s.getBoundingClientRect();
        return r.top <= mid && r.bottom >= mid;
      }));
    }
    ticking = false;
  });
};
window.addEventListener('scroll', onScroll, { passive: true });
onScroll();

(() => {
  const cta = document.getElementById('hero-cta');
  if (!header || !cta || !('IntersectionObserver' in window)) { header?.classList.add('show-cta'); return; }
  new IntersectionObserver(([e]) => {
    // só mostra depois que o botão do hero passou para cima da tela
    header.classList.toggle('show-cta', !e.isIntersecting && e.boundingClientRect.top < 0);
  }).observe(cta);
})();

/* ------------------------------------------------------------------ */
/* Menu do celular (diálogo): prende o foco, Esc fecha, devolve o     */
/* foco ao botão e deixa o resto da página inerte                     */
/* ------------------------------------------------------------------ */
const toggle = document.getElementById('nav-toggle');
const menu = document.getElementById('mobile-menu');
// o botão de fechar mora no cabeçalho, fora do menu: por isso o menu não é aria-modal e o
// resto da página (inclusive o logo, a pílula e o link de pular) fica inerte
const inertables = [document.getElementById('main'), document.querySelector('.footer'),
  document.querySelector('.skip-link'), document.querySelector('.nav__brand'), document.querySelector('.nav__cta')].filter(Boolean);
let menuOpen = false;

function openMenu() {
  if (!menu) return;
  menu.hidden = false;
  requestAnimationFrame(() => menu.classList.add('is-open'));
  header?.classList.add('menu-open');
  toggle?.setAttribute('aria-expanded', 'true');
  toggle?.setAttribute('aria-label', 'Fechar menu');
  inertables.forEach((el) => el.setAttribute('inert', ''));
  document.body.style.overflow = 'hidden';
  menuOpen = true;
  setTimeout(() => menu.querySelector('a')?.focus(), 60);
}
function closeMenu(returnFocus = false) {
  if (!menu || !menuOpen) return;
  menu.classList.remove('is-open');
  header?.classList.remove('menu-open');
  toggle?.setAttribute('aria-expanded', 'false');
  toggle?.setAttribute('aria-label', 'Abrir menu');
  inertables.forEach((el) => el.removeAttribute('inert'));
  document.body.style.overflow = '';
  menuOpen = false;
  if (returnFocus) toggle?.focus();
  setTimeout(() => { if (!menuOpen && menu) menu.hidden = true; }, 340);
}
toggle?.addEventListener('click', () => (menuOpen ? closeMenu(true) : openMenu()));
document.addEventListener('keydown', (e) => {
  if (!menuOpen) return;
  if (e.key === 'Escape') { closeMenu(true); return; }
  if (e.key !== 'Tab') return;
  // o botão de fechar fica no cabeçalho: entra no ciclo de foco junto com o menu
  const items = [toggle, ...menu.querySelectorAll('a, button')].filter(Boolean);
  const first = items[0], last = items[items.length - 1];
  if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
});
window.matchMedia('(min-width: 834px)').addEventListener('change', (e) => { if (e.matches) closeMenu(); });

/* ------------------------------------------------------------------ */
/* Âncoras: a rolagem suave e o desconto do cabeçalho ficam no CSS;   */
/* aqui só fecha o menu e leva o foco junto                           */
/* ------------------------------------------------------------------ */
document.querySelectorAll('a[href^="#"]').forEach((a) => {
  a.addEventListener('click', () => {
    const id = a.getAttribute('href');
    if (!id || id === '#') return;
    const el = document.querySelector(id);
    if (!el) return;
    closeMenu();
    if (!el.matches('a, button, input, select, textarea, [tabindex]')) el.setAttribute('tabindex', '-1');
    setTimeout(() => el.focus({ preventScroll: true }), 0);
  });
});

/* ------------------------------------------------------------------ */
/* Entrada ao rolar: [data-reveal] sobe e aparece uma vez             */
/* ------------------------------------------------------------------ */
(() => {
  const els = document.querySelectorAll('[data-reveal]');
  if (!els.length) return;
  if (reduce || !('IntersectionObserver' in window)) {
    els.forEach((el) => el.classList.add('is-in'));
    return;
  }
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      e.target.classList.add('is-in');
      io.unobserve(e.target);
    });
  }, { rootMargin: '0px 0px -6% 0px', threshold: 0.08 });
  els.forEach((el) => io.observe(el));
  document.addEventListener('focusin', (e) => e.target.closest?.('[data-reveal]')?.classList.add('is-in'));
  // o script chegou depois do failsafe de 3,5 s: o que já apareceu não some de novo
  if (performance.now() > 3400) els.forEach((el) => el.classList.add('is-in'));
})();

/* ------------------------------------------------------------------ */
/* Manifesto: as dores acendem palavra por palavra; no fim recuam e a */
/* resposta fica sozinha em branco. Opacidade mínima 0,4 (3,4:1)      */
/* ------------------------------------------------------------------ */
(() => {
  const p = document.querySelector('[data-manifesto]');
  if (!p || reduce || moreContrast) return;
  const pains = p.querySelectorAll('.manifesto__pain .lw');
  const answer = p.querySelectorAll('.manifesto__answer .lw');
  p.classList.add('is-scrubbed');
  gsap.set([...pains, ...answer], { opacity: 0.4 });
  const mm = gsap.matchMedia();
  const build = (scrollTrigger) => gsap.timeline({ scrollTrigger })
    .to(pains, { opacity: 1, ease: 'none', stagger: 0.12, duration: 0.6 })
    .to(pains, { opacity: 0.55, ease: 'none', duration: 0.5 }, '+=0.15')
    .to(answer, { opacity: 1, ease: 'none', stagger: 0.12, duration: 0.6 }, '<');
  // desktop com o manifesto preso: termina antes de a folha clara cobrir o texto
  const ans = p.querySelector('.manifesto__answer');
  const sec = p.closest('.manifesto');
  mm.add('(min-width: 1069px) and (min-height: 640px)', () => build({
    trigger: p, start: 'top 68%', endTrigger: '#solucoes',
    // acaba quando a folha ainda está um terço da tela abaixo do fim da resposta presa
    end: () => `top ${Math.round(ans.getBoundingClientRect().bottom - sec.getBoundingClientRect().top + innerHeight * 0.34)}px`,
    scrub: 0.4, invalidateOnRefresh: true,
  }));
  mm.add('(max-width: 1068px), (max-height: 639px)', () => build({
    trigger: p, start: 'top 82%', end: 'bottom 45%', scrub: 0.4,
  }));
})();

/* ------------------------------------------------------------------ */
/* Tour de Soluções (desktop): o serviço que cruza o meio da tela vira */
/* o ativo e a tela presa à direita troca de produto                  */
/* ------------------------------------------------------------------ */
(() => {
  const tour = document.querySelector('[data-tour]');
  if (!tour || !('IntersectionObserver' in window)) return;
  const items = [...tour.querySelectorAll('.tour__item')];
  const cap = tour.querySelector('[data-tour-cap]');
  let active = 0;
  const setActive = (i) => {
    if (i === active) return;
    active = i;
    items.forEach((el, k) => el.classList.toggle('is-active', k === i));
    // as telas podem chegar depois (as cenas animadas entram na tela presa pelo próprio script)
    tour.querySelectorAll('.tour__frame .tour__shot').forEach((el, k) => el.classList.toggle('is-active', k === i));
    if (cap) cap.textContent = items[i].dataset.cap || '';
    tour.dispatchEvent(new CustomEvent('tour:change', { detail: { index: i } }));
  };
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => { if (e.isIntersecting) setActive(items.indexOf(e.target)); });
  }, { rootMargin: '-49% 0px -49% 0px', threshold: 0 });
  items.forEach((el) => io.observe(el));
})();

/* ------------------------------------------------------------------ */
/* Galeria de clientes: as setas andam um cartão e se apagam nas      */
/* pontas; o dedo e o trackpad rolam direto                           */
/* ------------------------------------------------------------------ */
document.querySelectorAll('[data-gallery]').forEach((g) => {
  const track = g.querySelector('.gallery__track');
  const prev = g.querySelector('[data-gallery-prev]');
  const next = g.querySelector('[data-gallery-next]');
  if (!track || !prev || !next) return;
  const step = () => {
    const item = track.querySelector('.gallery__item');
    return item ? item.getBoundingClientRect().width + parseFloat(getComputedStyle(track).columnGap || '20') : 320;
  };
  const sync = () => {
    const max = track.scrollWidth - track.clientWidth - 2;
    prev.disabled = track.scrollLeft <= 2;
    next.disabled = track.scrollLeft >= max;
  };
  prev.addEventListener('click', () => track.scrollBy({ left: -step(), behavior: reduce ? 'auto' : 'smooth' }));
  next.addEventListener('click', () => track.scrollBy({ left: step(), behavior: reduce ? 'auto' : 'smooth' }));
  track.addEventListener('scroll', () => requestAnimationFrame(sync), { passive: true });
  window.addEventListener('resize', sync);
  sync();
});

/* ------------------------------------------------------------------ */
/* Processo: a linha enche enquanto se lê e acende cada etapa         */
/* ------------------------------------------------------------------ */
(() => {
  const box = document.querySelector('[data-steps]');
  if (!box || reduce) return;
  const fill = box.querySelector('.steps__fill');
  const steps = [...box.querySelectorAll('.step')];
  box.classList.add('is-live');
  const horizontal = () => window.matchMedia('(min-width: 1100px)').matches;
  ScrollTrigger.create({
    trigger: box,
    start: 'top 75%',
    end: 'bottom 55%',
    scrub: 0.3,
    onUpdate: (self) => {
      const p = self.progress;
      fill.style.transform = horizontal() ? `scaleX(${p})` : `scaleY(${p})`;
      steps.forEach((s, i) => s.classList.toggle('is-lit', p >= (i + 0.35) / steps.length));
    },
    onRefresh: (self) => {
      fill.style.transform = horizontal() ? `scaleX(${self.progress})` : `scaleY(${self.progress})`;
    },
  });
})();

/* ------------------------------------------------------------------ */
/* Profundidade leve: [data-drift] chega alguns pixels depois do resto */
/* ------------------------------------------------------------------ */
(() => {
  if (reduce) return;
  document.querySelectorAll('[data-drift]').forEach((el) => {
    const d = parseFloat(el.dataset.drift || '40');
    gsap.fromTo(el, { y: d }, {
      y: 0, ease: 'none',
      scrollTrigger: { trigger: el.closest('section') || el, start: 'top bottom', end: 'center 55%', scrub: 0.5 },
    });
  });
})();

/* ------------------------------------------------------------------ */
/* Hero: ao sair, o texto sobe um pouco e esmaece; o vídeo recua      */
/* ------------------------------------------------------------------ */
(() => {
  if (reduce) return;
  const hero = document.getElementById('topo');
  if (!hero) return;
  gsap.timeline({ scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom top', scrub: 0.5 } })
    .to('.hero__face-layer', { yPercent: -6, scale: 1.04, opacity: 0.35, ease: 'none' }, 0)
    .to('.hero__content', { yPercent: -10, ease: 'none' }, 0);
})();

// fontes e imagens mudam a altura da página: recalcula os gatilhos
window.addEventListener('load', () => ScrollTrigger.refresh());
document.fonts?.ready.then(() => ScrollTrigger.refresh());
html.classList.add('is-ready');
