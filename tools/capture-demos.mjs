// Fotografa as demos do /portfolio para a home (src/assets/home/).
// Uso, com o site rodando (dev ou preview):  node tools/capture-demos.mjs [http://localhost:4321]
//
// Por que existe: a home mostra as demos como produto, então a imagem precisa ser honesta
// e legível. O script esconde o que pode ser lido como resultado ou cliente real
// (78% / 24/7 / 4,8, "Top clientes", indicadores da logística, selo "breve"), troca nomes
// próprios por genéricos (o "Felipe" da demo é o nome do fundador), põe a tipografia no
// padrão da marca nova, troca o travessão por dois-pontos e falha se sobrar travessão ou
// meia-risca no texto visível. A demo do /portfolio não muda: tudo vale só para a foto.
import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const BASE = process.argv[2] || 'http://localhost:4321';
const OUT = new URL('../src/assets/home/', import.meta.url);
const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const HIDE = `
  .pf-tk__bar, .ag-stats, .ag-note, .ag-chat__tag, .ag-chips,
  .di-row--bottom .di-panel:not(.di-ask), .di-nav__item.is-soon,
  .pw-maphead__s, .pw-side, .pw-hint { display: none !important; }
  .di-kpi:nth-child(4) { display: none !important; }
  @media (min-width: 861px) { .di-kpis { grid-template-columns: repeat(3, 1fr) !important; } }
  @media (max-width: 860px) { .di-kpi:nth-child(3) { display: none !important; } }
  /* logística: o mapa e a lista de entregas que o sistema acompanha sozinho */
  .pw-grid { grid-template-columns: 1fr !important; }
  .pw-map { max-height: 46vh !important; }
  /* tipografia no padrão da marca nova (sem mono e sem caixa alta espaçada) */
  .pf-tk__stage *:not(svg *) {
    font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Inter Variable', sans-serif !important;
    text-transform: none !important; letter-spacing: 0 !important;
  }
  *, *::before, *::after { caret-color: transparent !important; }
`;

// "Atlas sugere" sem nome de cliente e sem jargão (lead time, ruptura)
const ATLAS_IA = 'Um cliente que costuma comprar a cada 21 dias fez o último pedido há 19 dias. Boa hora de o comercial ligar. E a <b>Válvula industrial 2"</b> está no mínimo e leva 12 dias para chegar: aprovar a reposição hoje evita faltar na semana que vem.';

// trocas de texto aplicadas no DOM antes de cada foto
const SWAPS = `
  (() => {
    const pairs = [
      [/\\s*\\u2014\\s*/g, ': '],
      [/\\s*\\u2013\\s*/g, ' a '],
      [/Clínica Vitale/g, 'clínica'],
      [/tirar dúvidas de preços e muito mais/g, 'tirar dúvidas e muito mais'],
      [/Tenho estes horários livres:/g, 'Tenho quinta às 10h, quinta às 16h30 ou sexta às 9h. Qual prefere?'],
      [/^CRM$/g, 'Histórico do cliente'],
      [/Timeline atualizada/g, 'Histórico atualizado'],
      [/Bom dia, Felipe/g, 'Bom dia, Ana'],
      [/Felipe O\\./g, 'Ana R.'],
      [/sexta-feira, 18 de julho · /g, ''],
      [/Malha em tempo real/gi, 'Entregas em tempo real'],
      [/CD Central · SP/g, 'São Paulo'],
    ];
    const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let n;
    while ((n = w.nextNode())) {
      let v = n.nodeValue;
      for (const [re, to] of pairs) v = v.replace(re, to);
      if (v !== n.nodeValue) n.nodeValue = v;
    }
    // "clínica" deixou de ser nome próprio: sai o negrito
    document.querySelectorAll('#demo-agente .ag-msgs b').forEach((b) => {
      if (b.textContent.trim() === 'clínica') b.replaceWith(document.createTextNode('clínica'));
    });
    const av = document.querySelector('#demo-atlas .ae-avatar');
    if (av) av.textContent = 'A';
  })()
`;

async function session({ width, height, dpr, mobile }) {
  const port = 9300 + Math.floor(Math.random() * 400);
  const dir = mkdtempSync(join(tmpdir(), 'novra-cap-'));
  const chrome = spawn(CHROME, ['--headless=new', '--hide-scrollbars', '--mute-audio', '--no-first-run',
    `--remote-debugging-port=${port}`, `--window-size=${width},${height}`, `--user-data-dir=${dir}`, 'about:blank'], { stdio: 'ignore' });
  const get = async (path) => {
    for (let i = 0; i < 80; i++) {
      try { const r = await fetch(`http://127.0.0.1:${port}${path}`, { method: path.startsWith('/json/new') ? 'PUT' : 'GET' }); if (r.ok) return r.json(); } catch {}
      await sleep(250);
    }
    throw new Error('Chrome não respondeu');
  };
  await get('/json/version');
  const target = await get('/json/new?about:blank');
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((ok, bad) => { ws.onopen = ok; ws.onerror = bad; });
  let id = 0; const pending = new Map(); const events = [];
  ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && pending.has(d.id)) { pending.get(d.id)(d); pending.delete(d.id); } else if (d.method) events.push(d.method); };
  const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
  const js = async (expression) => {
    const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (r.result?.exceptionDetails) throw new Error(r.result.exceptionDetails.exception?.description || 'erro no navegador');
    return r.result?.result?.value;
  };
  await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: dpr, mobile });
  if (mobile) await send('Emulation.setUserAgentOverride', { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1' });
  await send('Page.navigate', { url: `${BASE}/portfolio` });
  for (let i = 0; i < 80 && !events.includes('Page.loadEventFired'); i++) await sleep(250);
  await sleep(2500);
  await js(`(() => { const s = document.createElement('style'); s.textContent = ${JSON.stringify(HIDE)}; document.head.appendChild(s); })()`);
  const shot = async (file, clip) => {
    await js(SWAPS);
    await sleep(150);
    const bad = await js(`(() => { const t = document.querySelector('.pf-tk__stage').innerText; const m = t.match(/[\\u2013\\u2014]/); return m ? t.slice(Math.max(0, m.index - 40), m.index + 40) : ''; })()`);
    if (bad) throw new Error(`sobrou travessão em ${file}: "${bad}"`);
    const r = await send('Page.captureScreenshot', { format: 'png', ...(clip ? { clip: { ...clip, scale: 1 } } : {}) });
    writeFileSync(new URL(file, OUT), Buffer.from(r.result.data, 'base64'));
    console.log('ok', file);
  };
  const close = () => { ws.close(); chrome.kill('SIGKILL'); };
  return { js, shot, close };
}

// abre a demo e deixa no estado que vai para a foto
async function stage(s, slug) {
  await s.js(`document.querySelector('[data-open="${slug}"]').click()`);
  await sleep(2200);
  if (slug === 'atlas') {
    await s.js(`document.querySelector('#demo-atlas .ae-ia p').innerHTML = ${JSON.stringify(ATLAS_IA)}`);
  }
  if (slug === 'agente') {
    await s.js(`document.querySelector('#demo-agente [data-i="remarcar"]').click()`);
    for (let i = 0; i < 40; i++) { if (await s.js(`!!document.querySelector('#demo-agente .ag-opts button')`)) break; await sleep(200); }
    await sleep(400);
    await s.js(`[...document.querySelectorAll('#demo-agente .ag-opts button')].find((b) => b.textContent.trim() === 'Qui 10h').click()`);
    for (let i = 0; i < 60; i++) { if (await s.js(`/Remarcado/.test(document.querySelector('#demo-agente .ag-msgs').innerText)`)) break; await sleep(200); }
    await sleep(900);
  } else {
    await sleep(1800);
  }
  // congela animações (caminhões no mapa, digitação) para nenhum ponto cobrir um rótulo
  await s.js(`document.getAnimations().forEach((a) => a.pause()); document.querySelectorAll('svg').forEach((g) => g.pauseAnimations && g.pauseAnimations())`);
}
const closeDemo = async (s) => { await s.js(`document.querySelector('#pf-tk [data-action="close"]').click()`); await sleep(700); };
const rect = (s, sel) => s.js(`(() => { const r = document.querySelector(${JSON.stringify(sel)}).getBoundingClientRect(); return { x: r.left, y: r.top, width: r.width, height: r.height, bottom: r.bottom }; })()`);

// desktop: 1024x640 CSS com DPR 2,5 = 2560x1600. A interface fica grande e legível na moldura.
{
  const s = await session({ width: 1024, height: 640, dpr: 2.5, mobile: false });
  for (const slug of ['agente', 'atlas', 'insight', 'processflow']) {
    await stage(s, slug);
    await s.shot(`demo-${slug}.png`);
    await closeDemo(s);
  }
  s.close();
}

// celular: 390x844 CSS com DPR 3, recorte 4:5 (1170x1462). Cada recorte mostra
// exatamente o que a legenda da home descreve.
{
  const s = await session({ width: 390, height: 844, dpr: 3, mobile: true });
  const H = 487.5;
  // agente: do cabeçalho do chat até a confirmação (a saudação sai para caber a conversa)
  await stage(s, 'agente');
  await s.js(`(() => { const st = document.createElement('style'); st.textContent = '#demo-agente .ag-msgs > .ag-msg:first-child{display:none!important}'; document.head.appendChild(st); })()`);
  let r = await rect(s, '#demo-agente .ag-chat');
  await s.shot('demo-agente-m.png', { x: 0, y: Math.max(0, r.y), width: 390, height: H });
  await closeDemo(s);
  // atlas: o painel "Precisa de você agora", com as quatro pendências
  await stage(s, 'atlas');
  r = await rect(s, '#demo-atlas .ae-main .ae-panel');
  await s.shot('demo-atlas-m.png', { x: 0, y: Math.max(0, r.y - 16), width: 390, height: H });
  await closeDemo(s);
  // insight: cabeçalho, receita, pedidos e o gráfico do mês
  await stage(s, 'insight');
  r = await rect(s, '#demo-insight .di-main');
  await s.shot('demo-insight-m.png', { x: 0, y: Math.max(0, r.y), width: 390, height: H });
  await closeDemo(s);
  // logística: o mapa e o começo da lista de entregas
  await stage(s, 'processflow');
  r = await rect(s, '#demo-processflow .pw-mapcol');
  await s.shot('demo-processflow-m.png', { x: 0, y: Math.max(0, r.y), width: 390, height: H });
  await closeDemo(s);
  s.close();
}
