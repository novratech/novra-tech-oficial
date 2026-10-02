import Lenis from 'lenis';
import gsap from 'gsap';
import ScrollTrigger from 'gsap/ScrollTrigger';
gsap.registerPlugin(ScrollTrigger);

const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const isFinePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

/* ------------------------------------------------------------------ */
/* Smooth scroll (Lenis) + GSAP ScrollTrigger sync                    */
/* ------------------------------------------------------------------ */
let lenis = null;
if (!prefersReduced) {
  lenis = new Lenis({
    duration: 1.1,
    easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    smoothWheel: true,
    touchMultiplier: 1.6,
  });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((time) => lenis.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);
  document.documentElement.classList.add('gsap');
}

/* Hero video — fade-in suave + pausa em prefers-reduced-motion */
(() => {
  const v = document.querySelector('.hero__video');
  if (!v) return;
  const show = () => v.classList.add('is-ready');
  if (v.readyState >= 2) show();
  else v.addEventListener('loadeddata', show, { once: true });
  if (prefersReduced) { v.removeAttribute('autoplay'); try { v.pause(); } catch (e) {} }
})();

const HEADER_OFFSET = 84; // clear the fixed header so section tops aren't hidden
const scrollTo = (target, offset = HEADER_OFFSET) => {
  const el = typeof target === 'string' ? document.querySelector(target) : target;
  if (!el) return;
  if (lenis) {
    lenis.scrollTo(el, { offset: -offset, duration: 1.3 });
  } else {
    const top = el.getBoundingClientRect().top + window.scrollY - offset;
    window.scrollTo({ top, behavior: prefersReduced ? 'auto' : 'smooth' });
  }
};

/* Anchor links → smooth scroll + close mobile menu */
document.querySelectorAll('a[href^="#"]').forEach((a) => {
  a.addEventListener('click', (e) => {
    const id = a.getAttribute('href');
    if (!id || id === '#') return;
    const el = document.querySelector(id);
    if (!el) return;
    e.preventDefault();
    closeMenu();
    // data-offset: páginas sem cabeçalho fixo pedem um deslocamento menor
    scrollTo(el, a.dataset.offset !== undefined ? Number(a.dataset.offset) : HEADER_OFFSET);
    // leva o foco junto, para teclado e leitor de tela continuarem dali
    if (!el.matches('a, button, input, select, textarea, [tabindex]')) el.setAttribute('tabindex', '-1');
    el.focus({ preventScroll: true });
    // data-no-hash: não suja o endereço que a pessoa pode copiar e mandar
    if (!('noHash' in a.dataset)) history.replaceState(null, '', id);
  });
});

/* ------------------------------------------------------------------ */
/* Header state + scroll progress                                     */
/* ------------------------------------------------------------------ */
const header = document.getElementById('site-header');
const scrollBar = document.getElementById('scroll-bar');

const onScroll = (y) => {
  const scrollY = y ?? window.scrollY;
  if (header) header.dataset.state = scrollY > 24 ? 'scrolled' : 'top';
  if (scrollBar) {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    const pct = max > 0 ? (scrollY / max) * 100 : 0;
    scrollBar.style.width = pct + '%';
  }
};
if (lenis) lenis.on('scroll', ({ scroll }) => onScroll(scroll));
else window.addEventListener('scroll', () => onScroll(), { passive: true });
onScroll(0);

/* ------------------------------------------------------------------ */
/* Mobile menu                                                        */
/* ------------------------------------------------------------------ */
const toggle = document.getElementById('nav-toggle');
const menu = document.getElementById('mobile-menu');
let menuOpen = false;

function openMenu() {
  if (!menu) return;
  menu.hidden = false;
  requestAnimationFrame(() => menu.classList.add('is-open'));
  header?.classList.add('menu-open');
  toggle?.setAttribute('aria-expanded', 'true');
  toggle?.setAttribute('aria-label', 'Fechar menu');
  lenis?.stop();
  document.body.style.overflow = 'hidden';
  menuOpen = true;
}
function closeMenu() {
  if (!menu || !menuOpen) return;
  menu.classList.remove('is-open');
  header?.classList.remove('menu-open');
  toggle?.setAttribute('aria-expanded', 'false');
  toggle?.setAttribute('aria-label', 'Abrir menu');
  lenis?.start();
  document.body.style.overflow = '';
  menuOpen = false;
  setTimeout(() => { if (!menuOpen && menu) menu.hidden = true; }, 420);
}
toggle?.addEventListener('click', () => (menuOpen ? closeMenu() : openMenu()));
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeMenu(); });

/* ------------------------------------------------------------------ */
/* Reveal on scroll — GSAP batch (suave, com profundidade)            */
/* ------------------------------------------------------------------ */
const revealEls = gsap.utils.toArray('[data-reveal]');
if (prefersReduced || !lenis) {
  revealEls.forEach((el) => el.classList.add('is-visible'));
} else {
  gsap.set(revealEls, { opacity: 0, y: 42, scale: 0.965, filter: 'blur(9px)' });
  ScrollTrigger.batch('[data-reveal]', {
    start: 'top 86%',
    onEnter: (els) =>
      gsap.to(els, {
        opacity: 1, y: 0, scale: 1, filter: 'blur(0px)',
        duration: 1.05, ease: 'power3.out', stagger: 0.1, overwrite: true,
        onComplete: () => els.forEach((el) => { el.classList.add('is-visible'); el.style.filter = ''; }),
      }),
  });
  // safety: never leave content hidden if something goes wrong
  window.addEventListener('load', () =>
    setTimeout(() => ScrollTrigger.refresh(), 200)
  );
  setTimeout(() => {
    revealEls.forEach((el) => {
      if (getComputedStyle(el).opacity === '0' && el.getBoundingClientRect().top < window.innerHeight) {
        gsap.to(el, { opacity: 1, y: 0, filter: 'blur(0px)', duration: 0.6 });
      }
    });
  }, 2500);
  // acordeão abriu ou fechou: a altura da página mudou, recalcula os gatilhos
  document.addEventListener('toggle', () => requestAnimationFrame(() => ScrollTrigger.refresh()), true);
}

/* ------------------------------------------------------------------ */
/* Animated counters                                                  */
/* ------------------------------------------------------------------ */
const counters = document.querySelectorAll('[data-count]');
const formatNum = (n, decimals) =>
  n.toLocaleString('pt-BR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });

function animateCount(el) {
  const target = parseFloat(el.dataset.count || '0');
  const decimals = parseInt(el.dataset.decimals || '0', 10);
  const suffix = el.dataset.suffix || '';
  if (prefersReduced) { el.textContent = formatNum(target, decimals) + suffix; return; }
  const duration = 1600;
  const start = performance.now();
  const tick = (now) => {
    const p = Math.min((now - start) / duration, 1);
    const eased = 1 - Math.pow(1 - p, 3);
    el.textContent = formatNum(target * eased, decimals) + suffix;
    if (p < 1) requestAnimationFrame(tick);
    else el.textContent = formatNum(target, decimals) + suffix;
  };
  requestAnimationFrame(tick);
}
if ('IntersectionObserver' in window) {
  const countIO = new IntersectionObserver(
    (entries) => entries.forEach((e) => {
      if (e.isIntersecting) { animateCount(e.target); countIO.unobserve(e.target); }
    }),
    { threshold: 0.6 }
  );
  counters.forEach((el) => countIO.observe(el));
} else {
  counters.forEach((el) => animateCount(el));
}

/* ------------------------------------------------------------------ */
/* Cards: tilt 3D + spotlight seguindo o cursor (premium/interativo)  */
/* ------------------------------------------------------------------ */
if (isFinePointer) {
  const cards = document.querySelectorAll('.card, .service, .case, .tech__card, .proof__card');
  cards.forEach((card) => {
    const tilt = !prefersReduced;
    card.addEventListener('pointermove', (e) => {
      const r = card.getBoundingClientRect();
      card.style.setProperty('--mx', `${e.clientX - r.left}px`);
      card.style.setProperty('--my', `${e.clientY - r.top}px`);
      if (tilt) {
        const px = (e.clientX - (r.left + r.width / 2)) / r.width;
        const py = (e.clientY - (r.top + r.height / 2)) / r.height;
        card.style.transform =
          `perspective(900px) rotateX(${(-py * 3).toFixed(2)}deg) rotateY(${(px * 3).toFixed(2)}deg) translateY(-5px)`;
      }
    });
    if (tilt) card.addEventListener('pointerleave', () => { card.style.transform = ''; });
  });
}

/* ------------------------------------------------------------------ */
/* Magnetic buttons                                                   */
/* ------------------------------------------------------------------ */
if (isFinePointer && !prefersReduced) {
  document.querySelectorAll('[data-magnetic]').forEach((el) => {
    const strength = 0.28;
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      const x = (e.clientX - (r.left + r.width / 2)) * strength;
      const y = (e.clientY - (r.top + r.height / 2)) * strength;
      el.style.transform = `translate(${x}px, ${y}px)`;
    });
    el.addEventListener('pointerleave', () => { el.style.transform = ''; });
  });
}

/* ------------------------------------------------------------------ */
/* Console 3D tilt                                                    */
/* ------------------------------------------------------------------ */
if (isFinePointer && !prefersReduced) {
  document.querySelectorAll('[data-tilt]').forEach((el) => {
    const parent = el.parentElement;
    parent?.addEventListener('pointermove', (e) => {
      const r = parent.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width - 0.5;
      const py = (e.clientY - r.top) / r.height - 0.5;
      el.style.transform = `perspective(1400px) rotateY(${-9 + px * 8}deg) rotateX(${4 - py * 8}deg)`;
    });
    parent?.addEventListener('pointerleave', () => {
      el.style.transform = '';
    });
  });
}

/* ------------------------------------------------------------------ */
/* Custom cursor                                                      */
/* ------------------------------------------------------------------ */
if (isFinePointer && !prefersReduced) {
  const cursor = document.getElementById('cursor');
  if (cursor) {
    document.body.classList.add('has-cursor');
    let cx = window.innerWidth / 2, cy = window.innerHeight / 2;
    let tx = cx, ty = cy;
    const dot = cursor.querySelector('.cursor__dot');
    window.addEventListener('pointermove', (e) => {
      tx = e.clientX; ty = e.clientY;
      cursor.style.opacity = '1';
      if (dot) dot.style.transform = `translate(${tx - cursor.offsetLeft}px, ${ty - cursor.offsetTop}px) translate(-50%, -50%)`;
    });
    const renderCursor = () => {
      cx += (tx - cx) * 0.18; cy += (ty - cy) * 0.18;
      cursor.style.left = cx + 'px';
      cursor.style.top = cy + 'px';
      if (dot) dot.style.transform = `translate(${tx - cx}px, ${ty - cy}px) translate(-50%, -50%)`;
      requestAnimationFrame(renderCursor);
    };
    requestAnimationFrame(renderCursor);
    document.querySelectorAll('a, button, [data-magnetic], input, textarea, select').forEach((el) => {
      el.addEventListener('pointerenter', () => cursor.classList.add('is-hover'));
      el.addEventListener('pointerleave', () => cursor.classList.remove('is-hover'));
    });
    window.addEventListener('pointerleave', () => (cursor.style.opacity = '0'));
  }
}

/* ------------------------------------------------------------------ */
/* Back to top                                                        */
/* ------------------------------------------------------------------ */
document.getElementById('back-to-top')?.addEventListener('click', () => scrollTo('#topo'));

/* ------------------------------------------------------------------ */
/* Contact form (Formspree-ready, progressive enhancement)            */
/* ------------------------------------------------------------------ */
const form = document.getElementById('contact-form');
const status = document.getElementById('form-status');
form?.addEventListener('submit', async (e) => {
  const action = form.getAttribute('action') || '';
  // If endpoint not configured, let the browser handle it / show guidance.
  if (action.includes('SEU_ID_AQUI')) {
    e.preventDefault();
    if (status) {
      status.textContent = 'Formulário em modo demonstração — configure o endpoint (Formspree) para receber mensagens.';
      status.className = 'cta__form-note is-error';
    }
    return;
  }
  e.preventDefault();
  const btn = form.querySelector('button[type="submit"]');
  const label = form.querySelector('.cta__btn-label');
  const prevLabel = label?.textContent;
  if (label) label.textContent = 'Enviando…';
  btn?.setAttribute('disabled', 'true');
  try {
    const res = await fetch(action, {
      method: 'POST',
      body: new FormData(form),
      headers: { Accept: 'application/json' },
    });
    if (res.ok) {
      form.reset();
      if (status) { status.textContent = 'Mensagem enviada! Em breve um especialista entrará em contato.'; status.className = 'cta__form-note is-success'; }
      if (label) label.textContent = 'Enviado ✓';
    } else {
      throw new Error('Falha no envio');
    }
  } catch (err) {
    if (status) { status.textContent = 'Não foi possível enviar agora. Tente novamente ou escreva para contato@novratech.com.br.'; status.className = 'cta__form-note is-error'; }
    if (label) label.textContent = prevLabel || 'Enviar mensagem';
  } finally {
    btn?.removeAttribute('disabled');
    setTimeout(() => { if (label && label.textContent === 'Enviado ✓') label.textContent = prevLabel || 'Enviar mensagem'; }, 4000);
  }
});

/* ------------------------------------------------------------------ */
/* Hero mouse parallax                                                */
/* ------------------------------------------------------------------ */
if (isFinePointer && !prefersReduced) {
  const hero = document.getElementById('topo');
  const items = hero ? [...hero.querySelectorAll('[data-parallax]')] : [];
  if (items.length) {
    let px = 0, py = 0, cx = 0, cy = 0;
    let active = false, rafId = null;
    hero.addEventListener('pointermove', (e) => {
      if (!active) return;
      const r = hero.getBoundingClientRect();
      px = (e.clientX - r.left) / r.width - 0.5;
      py = (e.clientY - r.top) / r.height - 0.5;
    });
    hero.addEventListener('pointerleave', () => { px = 0; py = 0; });
    const loop = () => {
      if (!active) return;
      cx += (px - cx) * 0.06; cy += (py - cy) * 0.06;
      items.forEach((el) => {
        const d = parseFloat(el.dataset.parallax || '0.05');
        el.style.translate = `${cx * d * 100}px ${cy * d * 100}px`;
      });
      rafId = requestAnimationFrame(loop);
    };
    const start = () => { if (!active) { active = true; rafId = requestAnimationFrame(loop); } };
    const stop = () => { active = false; if (rafId) cancelAnimationFrame(rafId); };
    // roda só com o hero na tela (mesmo contrato dos canvases)
    if ('IntersectionObserver' in window) {
      new IntersectionObserver((es) => es.forEach((e) => (e.isIntersecting ? start() : stop())),
        { threshold: 0 }).observe(hero);
    } else start();
  }
}

/* ------------------------------------------------------------------ */
/* GSAP ScrollTrigger — profundidade ao rolar (premium, futurista)    */
/* ------------------------------------------------------------------ */
if (lenis) {
  // Hero: profundidade cinematográfica ao sair — o rosto recua e desfoca,
  // as luzes ficam para trás e o texto sobe mais rápido (camadas).
  const hero = document.getElementById('topo');
  if (hero) {
    gsap.timeline({ scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom top', scrub: 0.6 } })
      .to('.hero__video', { yPercent: -8, scale: 1.08, filter: 'blur(4px)', ease: 'none' }, 0)
      .to('.hero__content', { yPercent: -14, opacity: 0.3, ease: 'none' }, 0)
      .to('.hero__scroll', { opacity: 0, ease: 'none' }, 0);
  }

  // Brilhos das seções em parallax (camadas em velocidades diferentes = ambiente vivo)
  gsap.utils.toArray('.glow-orb').forEach((orb, i) => {
    gsap.to(orb, {
      yPercent: i % 2 ? 24 : -24, ease: 'none',
      scrollTrigger: { trigger: orb.closest('section') || orb, start: 'top bottom', end: 'bottom top', scrub: true },
    });
  });

  // Imagens com parallax interno (profundidade dentro do quadro)
  gsap.utils.toArray('[data-parallax-img]').forEach((img) => {
    gsap.fromTo(img, { yPercent: -7 }, {
      yPercent: 7, ease: 'none',
      scrollTrigger: { trigger: img.closest('section') || img, start: 'top bottom', end: 'bottom top', scrub: true },
    });
  });

  // Linhas-assinatura "desenhando" ao entrar na tela
  gsap.utils.toArray('.signature-line').forEach((el) => {
    gsap.fromTo(el, { scaleX: 0, transformOrigin: 'left center' }, {
      scaleX: 1, duration: 1.1, ease: 'power3.out',
      scrollTrigger: { trigger: el, start: 'top 93%' },
    });
  });

  // Processo: a linha do pipeline "desenha" conforme você rola
  const pline = document.querySelector('.process__line');
  if (pline) {
    gsap.fromTo(pline, { scaleX: 0, transformOrigin: 'left center' }, {
      scaleX: 1, opacity: 0.9, ease: 'none',
      scrollTrigger: { trigger: '.process__grid', start: 'top 78%', end: 'bottom 72%', scrub: 0.5 },
    });
  }

  // Números grandes (stats / process) com leve respiro de profundidade
  gsap.utils.toArray('.stat__value, .process__num').forEach((el) => {
    gsap.fromTo(el, { y: 16 }, {
      y: -10, ease: 'none',
      scrollTrigger: { trigger: el.closest('section') || el, start: 'top bottom', end: 'bottom top', scrub: true },
    });
  });

}

/* ------------------------------------------------------------------ */
/* Hero background — WebGL liquid aurora (brand plasma)               */
/* ------------------------------------------------------------------ */
(() => {
  const canvas = document.getElementById('hero-canvas');
  if (!canvas) return;
  // phone: o canvas está display:none (CSS) — não gasta WebGL/shader à toa
  if (window.matchMedia('(max-width: 700px)').matches) return;
  const reveal = () => requestAnimationFrame(() => canvas.classList.add('is-ready'));

  const gl = canvas.getContext('webgl', { alpha: true, antialias: false, premultipliedAlpha: false })
    || canvas.getContext('experimental-webgl');
  if (!gl) { fallback2D(canvas); reveal(); return; }

  const VERT = `attribute vec2 p; void main(){ gl_Position = vec4(p,0.,1.); }`;
  const FRAG = `
  precision highp float;
  uniform vec2 u_res; uniform float u_time; uniform vec2 u_mouse;
  float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453123); }
  float noise(vec2 p){
    vec2 i=floor(p), f=fract(p); vec2 u=f*f*(3.0-2.0*f);
    return mix(mix(hash(i),hash(i+vec2(1,0)),u.x), mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),u.x), u.y);
  }
  float fbm(vec2 p){ float v=0.0,a=0.5; for(int i=0;i<6;i++){ v+=a*noise(p); p=p*2.0+vec2(3.1,1.7); a*=0.5; } return v; }
  void main(){
    vec2 uv = gl_FragCoord.xy / u_res.xy;
    float asp = u_res.x / u_res.y;
    vec2 p = vec2(uv.x*asp, uv.y);
    float t = u_time * 0.045;
    vec2 q = vec2(fbm(p*1.6 + vec2(0.0,t)), fbm(p*1.6 + vec2(5.2,-t)));
    vec2 r = vec2(fbm(p*1.8 + 2.0*q + vec2(1.7,9.2) + t*0.6),
                  fbm(p*1.8 + 2.0*q + vec2(8.3,2.8) - t*0.4));
    float n = fbm(p*2.2 + 2.4*r);
    vec2 m = vec2(u_mouse.x*asp, u_mouse.y);
    float md = distance(p, m);
    float mglow = smoothstep(0.55, 0.0, md) * 0.35;
    n += mglow;
    vec3 navy = vec3(0.012,0.020,0.047);
    vec3 blue = vec3(0.045,0.21,0.86);
    vec3 cyan = vec3(0.0,0.78,1.0);
    vec3 col = mix(navy, blue, smoothstep(0.28,0.62,n));
    col = mix(col, cyan, smoothstep(0.60,0.96,n));
    col += cyan * mglow * 0.5;
    float vig = smoothstep(1.25, 0.25, length(uv-0.5));
    col *= 0.55 + 0.45*vig;
    col *= 0.92 + 0.08*sin(u_time*0.5);
    gl_FragColor = vec4(col, 1.0);
  }`;

  function compile(type, src) {
    const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { return null; }
    return s;
  }
  const vs = compile(gl.VERTEX_SHADER, VERT), fs = compile(gl.FRAGMENT_SHADER, FRAG);
  if (!vs || !fs) { fallback2D(canvas); reveal(); return; }
  const prog = gl.createProgram();
  gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { fallback2D(canvas); reveal(); return; }
  gl.useProgram(prog);

  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 3,-1, -1,3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, 'p');
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

  const uRes = gl.getUniformLocation(prog, 'u_res');
  const uTime = gl.getUniformLocation(prog, 'u_time');
  const uMouse = gl.getUniformLocation(prog, 'u_mouse');

  const dpr = Math.min(window.devicePixelRatio || 1, 1.6);
  let mx = 0.5, my = 0.55, tmx = 0.5, tmy = 0.55;
  let cRect = null; // cacheado no resize — não mede layout a cada pointermove
  function resize() {
    cRect = canvas.getBoundingClientRect();
    canvas.width = Math.max(1, Math.floor(cRect.width * dpr));
    canvas.height = Math.max(1, Math.floor(cRect.height * dpr));
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.uniform2f(uRes, canvas.width, canvas.height);
  }
  window.addEventListener('pointermove', (e) => {
    if (!running || !cRect || !cRect.width) return;
    tmx = (e.clientX - cRect.left) / cRect.width;
    tmy = 1.0 - (e.clientY - cRect.top) / cRect.height;
  }, { passive: true });
  let resizeT;
  window.addEventListener('resize', () => { clearTimeout(resizeT); resizeT = setTimeout(resize, 150); });
  resize();

  const t0 = performance.now ? performance.now() : 0;
  let running = false, rafId = null;
  function render(now) {
    if (!running) return;
    mx += (tmx - mx) * 0.05; my += (tmy - my) * 0.05;
    gl.uniform1f(uTime, ((now || 0) - t0) / 1000);
    gl.uniform2f(uMouse, mx, my);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    rafId = requestAnimationFrame(render);
  }
  function start() { if (!running) { running = true; rafId = requestAnimationFrame(render); } }
  function stop() { running = false; if (rafId) cancelAnimationFrame(rafId); }

  reveal();
  if (prefersReduced) {
    gl.uniform1f(uTime, 12.0); gl.uniform2f(uMouse, 0.5, 0.55);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  } else if ('IntersectionObserver' in window) {
    new IntersectionObserver((entries) => entries.forEach((e) => (e.isIntersecting ? start() : stop())),
      { threshold: 0 }).observe(canvas);
  } else { start(); }

  function fallback2D(cv) {
    const ctx = cv.getContext('2d'); if (!ctx) return;
    const draw = () => {
      const rect = cv.getBoundingClientRect();
      cv.width = rect.width; cv.height = rect.height;
      const g = ctx.createRadialGradient(rect.width*0.5, rect.height*0.4, 0, rect.width*0.5, rect.height*0.4, rect.width*0.7);
      g.addColorStop(0, 'rgba(46, 107, 255,0.35)'); g.addColorStop(0.5, 'rgba(0,120,220,0.12)'); g.addColorStop(1, 'rgba(5,7,14,0)');
      ctx.fillStyle = g; ctx.fillRect(0,0,rect.width,rect.height);
    };
    draw(); window.addEventListener('resize', draw);
  }
})();

/* ------------------------------------------------------------------ */
/* Hero cinemagraph — rede de luz viva SOBRE a imagem estática        */
/* (a foto nunca muda; só as luzes se movem)                          */
/* ------------------------------------------------------------------ */
(() => {
  const canvas = document.getElementById('hero-fx');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  let w = 0, h = 0, parts = [];
  const GOLD = [248, 232, 175], GOLD2 = [201, 162, 75], BLUE = [120, 158, 255], BLUE2 = [0, 168, 255];
  const rand = (a, b) => a + Math.random() * (b - a);
  const alphaByX = (x) => { const t = x / w; return t < 0.38 ? 0 : (t > 0.64 ? 1 : (t - 0.38) / 0.26); };

  function make() {
    const n = Math.min(120, Math.max(34, Math.floor((w * h) / 12000)));
    parts = Array.from({ length: n }, () => {
      const x = w * 0.42 + Math.sqrt(Math.random()) * w * 0.62;
      const c = Math.random();
      const col = c < 0.52 ? GOLD : (c < 0.62 ? GOLD2 : (c < 0.86 ? BLUE2 : BLUE));
      const comet = Math.random() < 0.05;
      return {
        x, y: Math.random() * h,
        vx: comet ? rand(-0.5, -0.2) : rand(-0.05, 0.05),
        vy: comet ? rand(-0.7, -0.35) : rand(-0.16, -0.03),
        r: comet ? rand(1.1, 1.8) : rand(0.6, 2.1), col,
        ph: Math.random() * 6.283, sp: rand(0.006, 0.02),
        big: Math.random() < 0.14, comet,
      };
    });
  }
  function resize() {
    const r = canvas.getBoundingClientRect();
    w = r.width; h = r.height;
    canvas.width = Math.max(1, Math.floor(w * dpr));
    canvas.height = Math.max(1, Math.floor(h * dpr));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    make();
  }
  const LINK = 96;
  function frame() {
    ctx.clearRect(0, 0, w, h);
    // rede de linhas (constelação viva)
    ctx.lineWidth = 1;
    for (let i = 0; i < parts.length; i++) {
      const a = parts[i]; if (a.comet) continue;
      const ax = alphaByX(a.x); if (ax <= 0) continue;
      for (let j = i + 1; j < parts.length; j++) {
        const b = parts[j]; if (b.comet) continue;
        const dx = a.x - b.x, dy = a.y - b.y; const d = Math.hypot(dx, dy);
        if (d < LINK) {
          const al = (1 - d / LINK) * 0.10 * Math.min(ax, alphaByX(b.x));
          if (al <= 0.004) continue;
          ctx.strokeStyle = `rgba(201,170,110,${al})`;
          ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
        }
      }
    }
    // pontos + cometas
    for (const p of parts) {
      p.x += p.vx; p.y += p.vy; p.ph += p.sp;
      if (p.y < -16) { p.y = h + 16; p.x = w * 0.42 + Math.sqrt(Math.random()) * w * 0.62; }
      if (p.x < w * 0.28) p.x = w + 10; else if (p.x > w + 14) p.x = w * 0.34;
      const tw = 0.42 + 0.58 * Math.sin(p.ph);
      const a = alphaByX(p.x) * tw * (p.big ? 1.0 : 0.62);
      if (a <= 0.012) continue;
      const cc = `${p.col[0]},${p.col[1]},${p.col[2]}`;
      if (p.comet) {
        const tl = 26; const g = ctx.createLinearGradient(p.x, p.y, p.x - p.vx * tl, p.y - p.vy * tl);
        g.addColorStop(0, `rgba(${cc},${a})`); g.addColorStop(1, `rgba(${cc},0)`);
        ctx.strokeStyle = g; ctx.lineWidth = p.r; ctx.beginPath();
        ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx * tl, p.y - p.vy * tl); ctx.stroke();
      }
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r * (p.big ? 1.7 : 1), 0, 6.2832);
      ctx.fillStyle = `rgba(${cc},${a})`;
      ctx.shadowColor = `rgba(${cc},${a})`;
      ctx.shadowBlur = p.big ? 16 : 7;
      ctx.fill();
    }
    ctx.shadowBlur = 0;
  }
  let run = false, raf = null;
  const tick = () => { if (!run) return; frame(); raf = requestAnimationFrame(tick); };
  const start = () => { if (!run) { run = true; tick(); } };
  const stop = () => { run = false; if (raf) cancelAnimationFrame(raf); };

  resize();
  let rt; window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(resize, 200); });
  requestAnimationFrame(() => canvas.classList.add('is-ready'));

  if (prefersReduced) { frame(); }
  else if ('IntersectionObserver' in window) {
    new IntersectionObserver((es) => es.forEach((e) => (e.isIntersecting ? start() : stop())), { threshold: 0 }).observe(canvas);
  } else { start(); }
})();

/* ------------------------------------------------------------------ */
/* Intro de marca — marca a sessão e remove o nó após a animação      */
/* ------------------------------------------------------------------ */
(() => {
  const intro = document.getElementById('intro');
  if (!intro) return;
  try { sessionStorage.setItem('novra-seen', '1'); } catch (e) {}
  // a animação CSS termina em ~2.2s; remove o nó pra não pesar o DOM
  setTimeout(() => intro.remove(), 2600);
})();

/* ------------------------------------------------------------------ */
/* Decode — eyebrows "decodificam" ao entrar na tela (uma vez)        */
/* ------------------------------------------------------------------ */
(() => {
  if (prefersReduced) return;
  const els = document.querySelectorAll('.eyebrow');
  if (!els.length || !('IntersectionObserver' in window)) return;
  const CHARS = '01<>/\\|=+*#$&';
  const decode = (el) => {
    const final = el.textContent;
    const n = final.length;
    if (!n || n > 48) return;
    const t0 = performance.now();
    const DUR = 620;
    const step = (now) => {
      const k = Math.min(1, (now - t0) / DUR);
      const fixed = Math.floor(k * n);
      let out = final.slice(0, fixed);
      for (let i = fixed; i < n; i++) {
        const c = final[i];
        out += c === ' ' ? ' ' : CHARS[(Math.random() * CHARS.length) | 0];
      }
      el.textContent = out;
      if (k < 1) requestAnimationFrame(step);
      else el.textContent = final;
    };
    requestAnimationFrame(step);
  };
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (e.isIntersecting) { decode(e.target); io.unobserve(e.target); }
    });
  }, { threshold: 0.6 });
  els.forEach((el) => { if (!el.children.length) io.observe(el); });
})();

/* ------------------------------------------------------------------ */
/* Footer — watermark NOVRA sobe e acende conforme o rodapé entra     */
/* ------------------------------------------------------------------ */
if (lenis) {
  const wm = document.querySelector('.footer__watermark');
  if (wm) {
    gsap.fromTo(wm, { yPercent: 34, opacity: 0.25 }, {
      yPercent: 0, opacity: 1, ease: 'none',
      scrollTrigger: { trigger: wm, start: 'top bottom', end: 'bottom bottom', scrub: 0.4 },
    });
  }
}
