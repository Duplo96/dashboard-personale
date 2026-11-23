let D = { bills: [], vehicles: [], contracts: [] };
let view = ['home', 'bills', 'cars', 'contracts', 'deadlines'].includes(location.hash.slice(1)) ? location.hash.slice(1) : 'home';
let photo = null;
let photoCredit = null;
const $ = (s) => document.querySelector(s);
const eur = (n) => Number(n || 0).toLocaleString('it-IT', { style: 'currency', currency: 'EUR', useGrouping: 'always' });
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const iso = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const today = () => iso(new Date());
const days = (s) => Math.round((new Date(s + 'T00:00:00') - new Date(new Date().toDateString())) / 864e5);
const fmt = (s) => s ? new Date(s + 'T00:00:00').toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
const uid = () => Math.random().toString(36).slice(2, 9);
const save = () => window.api.save(D);
const COLORS = ['#4f8cff', '#5fd6a0', '#f2c46d', '#b9a2ff', '#ff8fa3', '#8fa3b8', '#5fd0d6'];
if (!window.api) { // versione iPhone: sola lettura dallo snapshot
  document.documentElement.classList.add('ro'); document.body.classList.add('ro');
  let snapP = null;
  const getSnap = () => snapP || (snapP = (async () => {
    if (window.SNAPSHOT) return window.SNAPSHOT;
    const e = window.SNAPSHOT_ENC;
    const b = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
    const open = async (pass) => {
      const km = await crypto.subtle.importKey('raw', new TextEncoder().encode(pass), 'PBKDF2', false, ['deriveKey']);
      const key = await crypto.subtle.deriveKey({ name: 'PBKDF2', salt: b(e.s), iterations: e.i, hash: 'SHA-256' }, km, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
      return JSON.parse(new TextDecoder().decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b(e.n) }, key, b(e.c))));
    };
    let saved = null; try { saved = localStorage.getItem('sbp'); } catch (_) {}
    if (saved) { try { return await open(saved); } catch (_) { try { localStorage.removeItem('sbp'); } catch (_) {} } }
    for (;;) {
      const pass = await askPass('Dashboard protetta', 'Inserisci la password', true);
      try { const s = await open(pass.value); if (pass.remember) { try { localStorage.setItem('sbp', pass.value); } catch (_) {} } return s; }
      catch (_) { document.querySelector('.ovl small').textContent = 'Password errata, riprova.'; }
    }
  })());
  window.api = { load: async () => JSON.parse(JSON.stringify((await getSnap()).data)), save: async () => true, openVault: async () => {}, photo: async () => (await getSnap()).photo || null, credit: async () => (await getSnap()).credit || null, exportMobile: async () => null, openRaw: async () => {}, version: async () => { const s = await getSnap(); return { version: s.version, released: s.released, exported: s.exported }; } };
}
function askPass(title, label, remember) {
  return new Promise((res) => {
    const o = document.createElement('div'); o.className = 'ovl';
    o.innerHTML = `<form class="glass"><h3>${title}</h3><small>${label}</small><input type="password" autocomplete="current-password" placeholder="Password" required>${remember ? '<label><input type="checkbox" checked> Ricordami su questo dispositivo</label>' : ''}<div class="act"><button type="button" class="cancel">Annulla</button><button class="btn">OK</button></div></form>`;
    document.body.appendChild(o);
    const f = o.querySelector('form'), i = o.querySelector('input'); i.focus();
    f.onsubmit = (ev) => { ev.preventDefault(); const v = i.value, r = remember ? o.querySelector('input[type=checkbox]').checked : false; o.remove(); res({ value: v, remember: r }); };
    o.querySelector('.cancel').onclick = () => { o.remove(); res({ value: '', remember: false, cancelled: true }); };
    if (remember) o.querySelector('.cancel').style.display = 'none';
  });
}

function migrate() {
  D.bills = D.bills || []; D.vehicles = D.vehicles || []; D.contracts = D.contracts || [];
  D.bills.forEach((b) => { if (b.paid && !b.paidDate) b.paidDate = b.due; delete b.paid; if (!('paidDate' in b)) b.paidDate = null; });
  D.vehicles.forEach((v) => { v.paid = v.paid || {}; });
}

const TYPES = ['Abbonamento', 'Luce', 'Gas', 'Acqua', 'Internet', 'Telefono', 'Rifiuti', 'Altro'];
function addPeriod(s, repeat) {
  const [y, m, d] = s.split('-').map(Number);
  const t = repeat === 'annuale' ? new Date(y + 1, m - 1, 1) : new Date(y, m, 1);
  const last = new Date(t.getFullYear(), t.getMonth() + 1, 0).getDate();
  t.setDate(Math.min(d, last)); return iso(t);
}
function openAdd(startTab) {
  if (document.querySelector('.ovl')) return;
  const o = document.createElement('div'); o.className = 'ovl';
  o.innerHTML = `<form class="glass addbox"><h3>Aggiungi</h3>
    <div class="tabs"><button type="button" data-t="q" class="on">Spesa rapida</button><button type="button" data-t="f">Bolletta completa</button></div>
    <div data-p="q" class="pane">
      <small>Per abbonamenti e spese semplici: fai da solo in pochi secondi.</small>
      <input name="supplier" placeholder="Nome (es. Netflix, Palestra)" required>
      <div class="two"><select name="type">${TYPES.map((t) => `<option>${t}</option>`).join('')}</select><input name="amount" type="number" step="0.01" min="0" placeholder="Importo €" required></div>
      <div class="two"><input name="due" type="date" required value="${today()}" title="Prossima scadenza"><select name="repeat"><option value="">Una tantum</option><option value="mensile" selected>Ogni mese</option><option value="annuale">Ogni anno</option></select></div>
      <label><input type="checkbox" name="paid"> Già pagata</label>
      <div class="act"><button type="button" class="cancel">Annulla</button><button class="btn">Aggiungi</button></div>
    </div>
    <div data-p="f" class="pane" hidden>
      <small>Per bollette con intestatario, POD/PDR, periodo e dettagli: lascia fare a me.</small>
      <ol class="steps"><li>Metti il PDF o la foto nella cartella <b>raw</b>.</li><li>Scrivimi in chat «ho aggiunto una bolletta».</li><li>La leggo, la registro qui e nella wiki, poi la vedi comparire.</li></ol>
      <div class="act"><button type="button" class="cancel">Chiudi</button><button type="button" class="btn" id="goRaw">Apri cartella raw</button></div>
    </div></form>`;
  document.body.appendChild(o);
  const f = o.querySelector('form'), close = () => o.remove();
  const tab = (t) => { f.querySelectorAll('[data-t]').forEach((b) => b.classList.toggle('on', b.dataset.t === t)); f.querySelectorAll('[data-p]').forEach((p) => p.hidden = p.dataset.p !== t); };
  f.querySelectorAll('[data-t]').forEach((b) => b.onclick = () => tab(b.dataset.t));
  f.querySelectorAll('.cancel').forEach((b) => b.onclick = close);
  o.onmousedown = (e) => { if (e.target === o) close(); };
  f.elements.type.onchange = () => { f.elements.repeat.value = f.elements.type.value === 'Abbonamento' ? 'mensile' : ''; };
  o.querySelector('#goRaw').onclick = () => window.api.openRaw();
  f.onsubmit = (e) => {
    e.preventDefault();
    const v = Object.fromEntries(new FormData(f));
    const mk = (due, paidDate) => ({ id: uid(), supplier: v.supplier.trim(), type: v.type, amount: Number(v.amount), due, paidDate, repeat: v.repeat || null, source: 'manuale' });
    D.bills.push(mk(v.due, v.paid ? v.due : null));
    if (v.paid && v.repeat) D.bills.push(mk(addPeriod(v.due, v.repeat), null));
    close(); save(); view = 'bills'; render();
  };
  tab(startTab || 'q'); f.querySelector('input[name=supplier]').focus();
}
function billMeta(b) {
  const bits = [b.type, 'scade ' + fmt(b.due)];
  if (b.repeat) bits.push('ogni ' + (b.repeat === 'annuale' ? 'anno' : 'mese'));
  const det = [b.holder && 'Intestatario: ' + b.holder, b.pod && 'POD/PDR ' + b.pod, b.period && 'Periodo ' + b.period, b.invoice && 'Fatt. ' + b.invoice].filter(Boolean);
  return esc(bits.join(' · ')) + (det.length ? '<br>' + esc(det.join(' · ')) : '') + (b.source === 'claude' ? ' <span class="tag">da Claude</span>' : '');
}

/* ---------- pills ---------- */
const billPill = (b) => {
  if (b.paidDate) return `<span class="pill ok">Pagata il ${fmt(b.paidDate)}</span>`;
  const d = days(b.due);
  if (d < 0) return `<span class="pill bad">Scaduta da ${-d} g</span>`;
  if (d <= 14) return `<span class="pill warn">Scade tra ${d} g</span>`;
  return `<span class="pill neu">Scade tra ${d} g</span>`;
};
const dlPill = (s, label = 'Tra') => {
  const d = days(s);
  if (d < 0) return `<span class="pill bad">Scaduta da ${-d} g</span>`;
  if (d <= 30) return `<span class="pill warn">${label} ${d} g</span>`;
  return `<span class="pill neu">${label} ${d} g</span>`;
};

const VEH = [['insurance', 'insuranceDue', 'Assicurazione'], ['tax', 'taxDue', 'Bollo'], ['inspection', 'inspectionDue', 'Revisione'], ['service', 'serviceDue', 'Tagliando']];

function allDeadlines() {
  const out = [];
  D.bills.filter((b) => !b.paidDate).forEach((b) => out.push({ what: `Bolletta ${b.type}`, who: b.supplier, date: b.due, extra: eur(b.amount) }));
  D.vehicles.forEach((v) => VEH.forEach(([k, f, l]) => v[f] && !v.paid[k] && out.push({ what: l, who: v.name, date: v[f] })));
  D.contracts.forEach((c) => c.end && out.push({ what: 'Fine contratto', who: c.name, date: c.end, contract: true }));
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

/* ---------- charts ---------- */
let chartYear = null;
function areaChart() {
  const dt = (b) => b.paidDate || b.due || '';
  const years = [...new Set(D.bills.map((b) => dt(b).slice(0, 4)).filter(Boolean))].sort();
  const cy = String(new Date().getFullYear());
  if (!years.includes(chartYear)) chartYear = years.includes(cy) ? cy : (years[years.length - 1] || cy);
  const cats = {};
  D.bills.forEach((b) => { cats[b.type] = (cats[b.type] || 0) + Number(b.amount || 0); });
  const names = Object.keys(cats).sort((a, b) => cats[b] - cats[a]);
  const months = Array.from({ length: 12 }, (_, i) => ({ l: new Date(2000, i, 1).toLocaleDateString('it-IT', { month: 'short' }), by: {}, t: 0 }));
  D.bills.forEach((b) => { const d = dt(b); if (d.slice(0, 4) === chartYear) { const m = months[+d.slice(5, 7) - 1]; m.by[b.type] = (m.by[b.type] || 0) + Number(b.amount || 0); m.t += Number(b.amount || 0); } });
  const rawMax = Math.max(...months.map((m) => m.t), 1);
  const step = rawMax <= 100 ? 25 : rawMax <= 250 ? 50 : rawMax <= 500 ? 100 : 250;
  const top = Math.ceil(rawMax / step) * step;
  const W = 560, H = 250, x0 = 58, x1 = 548, y0 = 24, y1 = 206, slot = (x1 - x0) / 12, bw = Math.min(28, slot - 10);
  const yy = (v) => y1 - (v / top) * (y1 - y0);
  let grid = '';
  for (let v = 0; v <= top; v += step) grid += `<line x1="${x0}" x2="${x1}" y1="${yy(v)}" y2="${yy(v)}" stroke="rgba(255,255,255,.08)"/><text x="${x0 - 8}" y="${yy(v) + 4}" text-anchor="end">${eur(v).replace(',00', '')}</text>`;
  const bars = months.map((m, i) => {
    const x = x0 + i * slot + (slot - bw) / 2; let acc = 0;
    const segs = names.map((n) => { const v = m.by[n] || 0; if (!v) return ''; const h = (v / top) * (y1 - y0); const y = yy(acc + v); acc += v; return `<rect x="${x}" y="${y}" width="${bw}" height="${h}" fill="${COLORS[names.indexOf(n) % 7]}" rx="3"/>`; }).join('');
    const val = m.t ? `<text x="${x + bw / 2}" y="${yy(m.t) - 6}" text-anchor="middle" style="fill:#eef1f6;font-size:10px">${eur(m.t).replace(',00', '')}</text>` : '';
    return `${segs}${val}<text x="${x + bw / 2}" y="${H - 14}" text-anchor="middle">${esc(m.l)}</text>`;
  }).join('');
  const tot = months.reduce((s, m) => s + m.t, 0);
  const legend = names.map((n, i) => `<span><i style="background:${COLORS[i % 7]}"></i>${esc(n)}</span>`).join('');
  const yb = years.map((y) => `<button class="ybtn ${y === chartYear ? 'on' : ''}" data-cy="${y}">${y}</button>`).join('');
  return `<div class="chead"><h2>Spesa bollette ${chartYear} · totale ${eur(tot)}</h2><div class="ybs">${yb}</div></div>
  <svg viewBox="0 0 ${W} ${H}" width="100%">${grid}${bars}</svg><div class="clegend">${legend}</div>`;
}
function areaChartOld() {
  const months = [], now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({ k: d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'), l: d.toLocaleDateString('it-IT', { month: 'short' }), v: 0 });
  }
  D.bills.forEach((b) => { const m = months.find((x) => x.k === (b.due || '').slice(0, 7)); if (m) m.v += Number(b.amount) || 0; });
  const max = Math.max(...months.map((m) => m.v), 1);
  const W = 520, H = 200, px = 30, py = 24;
  const pts = months.map((m, i) => [px + i * ((W - 2 * px) / 5), H - py - (m.v / max) * (H - 2 * py - 14)]);
  let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 1; i < pts.length; i++) { const cx = (pts[i - 1][0] + pts[i][0]) / 2; d += ` C${cx},${pts[i - 1][1]} ${cx},${pts[i][1]} ${pts[i][0]},${pts[i][1]}`; }
  const area = `${d} L${pts[5][0]},${H - py} L${pts[0][0]},${H - py} Z`;
  const bars = Array.from({ length: 70 }, (_, i) => `<line x1="${px + i * ((W - 2 * px) / 69)}" x2="${px + i * ((W - 2 * px) / 69)}" y1="${H - py}" y2="${H - py - 8 - ((i * 37) % 22)}" stroke="rgba(255,255,255,.12)"/>`).join('');
  const labels = months.map((m, i) => `<text x="${pts[i][0]}" y="${H - 6}" text-anchor="middle">${esc(m.l)}</text>${m.v ? `<circle cx="${pts[i][0]}" cy="${pts[i][1]}" r="4" fill="#4f8cff"/><text x="${pts[i][0]}" y="${pts[i][1] - 10}" text-anchor="middle" style="fill:#f3eeea">${Math.round(m.v)}</text>` : ''}`).join('');
  return `<svg viewBox="0 0 ${W} ${H}" width="100%"><defs><linearGradient id="ag" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4f8cff" stop-opacity=".4"/><stop offset="1" stop-color="#4f8cff" stop-opacity="0"/></linearGradient></defs>${bars}<path d="${area}" fill="url(#ag)"/><path d="${d}" fill="none" stroke="#f3eeea" stroke-width="2"/>${labels}</svg>`;
}

function donut() {
  const by = {};
  D.bills.forEach((b) => { by[b.type] = (by[b.type] || 0) + Number(b.amount || 0); });
  const ent = Object.entries(by).sort((a, b) => b[1] - a[1]);
  const tot = ent.reduce((s, e) => s + e[1], 0);
  if (!tot) return '<div class="empty">Nessuna spesa registrata.</div>';
  const R = 52, C = 2 * Math.PI * R; let off = 0;
  const arcs = ent.map(([k, v], i) => { const len = (v / tot) * C; const el = `<circle r="${R}" cx="70" cy="70" fill="none" stroke="${COLORS[i % 7]}" stroke-width="22" stroke-dasharray="${len - 2} ${C - len + 2}" stroke-dashoffset="${-off}" transform="rotate(-90 70 70)"/>`; off += len; return el; }).join('');
  const leg = ent.map(([k, v], i) => `<div><i style="background:${COLORS[i % 7]}"></i>${esc(k)} · ${eur(v)}</div>`).join('');
  return `<div class="donut"><svg viewBox="0 0 140 140" width="170">${arcs}<text x="70" y="68" text-anchor="middle" style="fill:#f3eeea;font-size:15px;font-weight:700">${eur(tot)}</text><text x="70" y="84" text-anchor="middle">totale</text></svg><div class="leg">${leg}</div></div>`;
}

function wheel(cx) {
  const sp = [0, 72, 144, 216, 288].map((a) => `<line x1="${cx}" y1="190" x2="${cx + 22 * Math.sin(a * Math.PI / 180)}" y2="${190 - 22 * Math.cos(a * Math.PI / 180)}" stroke="#3a3f47" stroke-width="7" stroke-linecap="round"/>`).join('');
  return `<circle cx="${cx}" cy="190" r="45" fill="#050608"/><circle cx="${cx}" cy="190" r="38" fill="#0b0c0f"/><circle cx="${cx}" cy="190" r="27" fill="url(#rim)"/>${sp}<circle cx="${cx}" cy="190" r="7" fill="#20242a"/><path d="M${cx + 14} 168 A26 26 0 0 1 ${cx + 26} 186" stroke="#c0392b" stroke-width="5" fill="none" stroke-linecap="round"/>`;
}
function carSvg() {
  if (photo) return `<img src="${photo}" alt="auto">`;
  return `<svg viewBox="0 0 560 250" xmlns="http://www.w3.org/2000/svg">
  <defs>
   <linearGradient id="b1" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#555c68"/><stop offset=".28" stop-color="#23272e"/><stop offset=".7" stop-color="#0d0f13"/><stop offset="1" stop-color="#050608"/></linearGradient>
   <linearGradient id="g1" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#9fb2c9"/><stop offset=".5" stop-color="#3b4a5f"/><stop offset="1" stop-color="#141a24"/></linearGradient>
   <linearGradient id="rim" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#e6eaf0"/><stop offset="1" stop-color="#7d8794"/></linearGradient>
  </defs>
  <ellipse cx="280" cy="226" rx="258" ry="20" fill="none" stroke="rgba(255,255,255,.2)"/><circle cx="280" cy="247" r="4" fill="rgba(255,255,255,.45)"/>
  <ellipse cx="280" cy="222" rx="236" ry="11" fill="rgba(0,0,0,.5)"/>
  <path d="M34 182 L36 134 Q40 114 68 110 L114 104 Q138 46 194 38 L362 38 Q412 40 434 84 L470 100 Q518 106 528 138 L534 180 Q536 192 522 192 L40 192 Q30 190 34 182Z" fill="url(#b1)"/>
  <path d="M36 168 L532 168 L534 180 Q536 192 522 192 L40 192 Q30 190 34 182Z" fill="#0a0b0e"/>
  <path d="M128 102 Q146 54 196 46 L262 46 L262 102Z M276 46 L354 46 Q392 48 412 80 L418 102 L276 102Z" fill="url(#g1)"/>
  <path d="M150 34 L362 34" stroke="#b4bcc8" stroke-width="3.5" stroke-linecap="round"/>
  <path d="M262 102 L268 166 M152 104 L146 166 M392 104 L398 166" stroke="rgba(255,255,255,.13)" fill="none"/>
  <rect x="232" y="116" width="24" height="4" rx="2" fill="#6b7480"/><rect x="304" y="116" width="24" height="4" rx="2" fill="#6b7480"/>
  <path d="M408 98 l24 -2 l3 11 l-24 3z" fill="#0b0c10"/>
  <path d="M40 126 Q280 108 524 132" stroke="rgba(255,255,255,.3)" stroke-width="1.5" fill="none"/>
  <path d="M498 118 L528 130 L524 140 L494 132Z" fill="#e8eef7"/><path d="M500 136 L526 144" stroke="#9fb4d0" stroke-width="2"/>
  <rect x="34" y="120" width="11" height="24" rx="3" fill="#b3342b"/>
  <path d="M470 160 L530 160" stroke="#050608" stroke-width="6"/>
  <circle cx="126" cy="190" r="49" fill="#040507"/><circle cx="438" cy="190" r="49" fill="#040507"/>
  ${wheel(126)}${wheel(438)}</svg>`;
}
function carSvgOld() {
  return `<svg viewBox="0 0 540 210" xmlns="http://www.w3.org/2000/svg">
  <defs><linearGradient id="bd" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3a3f47"/><stop offset=".35" stop-color="#1b1e23"/><stop offset="1" stop-color="#0c0d10"/></linearGradient>
  <linearGradient id="gl" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#6d7885"/><stop offset="1" stop-color="#262b32"/></linearGradient></defs>
  <ellipse cx="270" cy="188" rx="235" ry="12" fill="rgba(0,0,0,.35)"/>
  <path d="M30 152 L32 112 Q38 98 66 94 L126 88 Q146 38 198 32 L352 32 Q398 34 420 72 L454 88 Q496 94 505 120 L511 152 Q513 162 502 162 L28 162 Q22 160 30 152Z" fill="url(#bd)"/>
  <path d="M140 86 Q158 46 202 40 L250 40 L250 86Z M262 40 L346 40 Q380 42 398 68 L404 86 L262 86Z" fill="url(#gl)"/>
  <path d="M150 30 L350 30" stroke="#9aa3ad" stroke-width="3" stroke-linecap="round"/>
  <path d="M34 118 Q260 106 506 124" stroke="rgba(255,255,255,.2)" fill="none"/>
  <rect x="490" y="112" width="18" height="8" rx="3" fill="#e8ecf2" opacity=".9"/><rect x="26" y="112" width="12" height="12" rx="3" fill="#c9332b"/>
  <rect x="86" y="140" width="70" height="2" fill="#0a0b0d"/>
  <g><circle cx="120" cy="156" r="33" fill="#0a0b0d"/><circle cx="120" cy="156" r="21" fill="#c9ced6"/><circle cx="120" cy="156" r="9" fill="#2b2f35"/>
  <circle cx="414" cy="156" r="33" fill="#0a0b0d"/><circle cx="414" cy="156" r="21" fill="#c9ced6"/><circle cx="414" cy="156" r="9" fill="#2b2f35"/></g>
  <path d="M150 60 L338 60" stroke="rgba(255,255,255,.25)" stroke-width="2" fill="none"/></svg>`;
}

/* ---------- views ---------- */
const kpi = (title, n, a, b, go) => `<div class="glass kpi"><button class="go" data-go="${go}">&#8599;</button><h3>${title}</h3><div class="n">${n}</div><div class="subs"><span>${a[0]}<b>${a[1]}</b></span><span>${b[0]}<b>${b[1]}</b></span></div></div>`;

function carCard(v) {
  const specs = `<div class="spec"><small>Allestimento</small><b>${esc(v.trim)}</b></div><div class="spec"><small>Colore</small><b>${esc(v.color)}</b></div><div class="spec"><small>Anno</small><b>${esc(v.year)}</b></div><div class="spec"><small>Targa</small><input data-vf="${v.id}:plate" value="${esc(v.plate)}" placeholder="Inserisci targa"></div>`;
  const dls = VEH.map(([k, f, l]) => {
    const paid = v.paid[k];
    const right = !v[f] ? '' : paid ? `<span class="pill">Pagata il ${fmt(paid)}</span><button class="mini" data-vunpay="${v.id}:${k}">Annulla</button>` : `${dlPill(v[f], 'Tra')}<button class="mini" data-vpay="${v.id}:${k}">Pagato</button>`;
    return `<div class="dl"><div class="t">${l}<small>${v[f] ? 'scade ' + fmt(v[f]) : 'data da inserire'}</small></div><input type="date" data-vf="${v.id}:${f}" value="${esc(v[f])}">${right}</div>`;
  }).join('');
  return `<div class="carwrap">
  <div class="phone glass"><div class="hi">La tua auto</div><h3>${esc(v.name)}<br>${esc(v.trim)}</h3>
    <div class="chips"><b>Panoramica</b><span>Scadenze</span><span>Documenti</span></div>
    <div class="hero"><div class="wm">T-CROSS</div><div class="nm">${esc(v.name.replace('Volkswagen ', ''))}<br>${esc(v.trim.replace('1.0 TSI ', ''))}</div><div class="pr">${esc(v.year)}</div>
      <div class="carimg${photo ? ' ph' : ''}">${carSvg()}</div>
      ${photo && photoCredit ? `<div class="credit">${esc(photoCredit)}</div>` : ''}
      <div class="sagebtns"><button class="sbtn" data-go="deadlines">Scadenze</button><button class="sbtn sm" data-del="vehicles:${v.id}" title="Elimina">&#10005;</button></div></div></div>
  <div class="glasspanel glass"><div class="lb">Dati veicolo</div><div class="specs">${specs}</div><div class="lb">Scadenze e pagamenti</div>${dls}</div></div>`;
}

const views = {
  home() {
    const open = D.bills.filter((b) => !b.paidDate);
    const tot = open.reduce((s, b) => s + Number(b.amount || 0), 0);
    const late = open.filter((b) => days(b.due) < 0).length;
    const ym = today().slice(0, 7);
    const paidM = D.bills.filter((b) => b.paidDate && b.paidDate.slice(0, 7) === ym).length;
    const dl = allDeadlines();
    const urgent = dl.filter((x) => days(x.date) <= 30).length;
    const soon90 = D.contracts.filter((c) => c.end && days(c.end) <= 90).length;
    const v = D.vehicles[0];
    const nextCar = v ? VEH.map(([k, f]) => (v[f] && !v.paid[k]) ? days(v[f]) : null).filter((x) => x !== null).sort((a, b) => a - b)[0] ?? null : null;
    const recent = [...D.bills].sort((a, b) => b.due.localeCompare(a.due)).slice(0, 4);
    return `<div class="grid g4">
      ${kpi('Bollette', D.bills.length, ['Aperte', open.length], ['Pagate nel mese', paidM], 'bills')}
      ${kpi('Da pagare', eur(tot), ['Scadute', late], ['In arrivo', open.length - late], 'bills')}
      ${kpi('Auto', D.vehicles.length, ['Prossima scadenza', nextCar === null ? '—' : nextCar + ' g'], ['Veicolo', v ? esc(v.name.replace('Volkswagen ', '')) : '—'], 'cars')}
      ${kpi('Contratti', D.contracts.length, ['Attivi', D.contracts.length], ['In scadenza 90 g', soon90], 'contracts')}
    </div>
    <div class="grid g2" style="margin-top:14px">
      <div class="glass card">${areaChart()}</div>
      <div class="glass card"><h2>Prossime scadenze · ${urgent} entro 30 giorni</h2>${dl.slice(0, 4).map((x) => `<div class="row"><div class="t">${esc(x.what)}<small>${esc(x.who)} · ${fmt(x.date)}</small></div><div class="amt">${esc(x.extra || '')}</div>${x.contract ? dlPill(x.date, 'Scade tra') : dlPill(x.date)}</div>`).join('') || '<div class="empty">Nessuna scadenza.</div>'}</div>
    </div>
    <div class="grid g2b" style="margin-top:14px">
      <div class="glass card"><h2>Bollette recenti</h2>${recent.map((b) => `<div class="row"><div class="t">${esc(b.supplier)}<small>${esc(b.type)} · ${fmt(b.due)}</small></div><div class="amt">${eur(b.amount)}</div>${billPill(b)}</div>`).join('') || '<div class="empty">Nessuna bolletta.</div>'}</div>
      <div class="glass card"><h2>Spesa per categoria</h2>${donut()}</div>
    </div>`;
  },
  bills() {
    const rows = [...D.bills].sort((a, b) => b.due.localeCompare(a.due));
    return `<div class="vh"><h1>Bollette</h1><button class="btn" data-add="q">+ Aggiungi</button></div>
    <div class="glass card">${rows.map((b) => `<div class="row">
      <div class="t">${esc(b.supplier)}<small>${billMeta(b)}</small></div>
      <div class="amt">${eur(b.amount)}</div>${billPill(b)}
      ${b.paidDate ? `<button class="mini" data-unpay="${b.id}">Annulla</button>` : `<input type="date" id="pd-${b.id}" value="${today()}" title="Data pagamento"><button class="mini" data-pay="${b.id}">Segna pagata</button>`}
      <button class="x" data-del="bills:${b.id}">&#10005;</button></div>`).join('') || '<div class="empty">Nessuna bolletta.</div>'}</div>`;
  },
  cars() {
    return `<h1>Auto</h1>${D.vehicles.map(carCard).join('') || '<div class="glass card empty">Nessun veicolo.</div>'}`;
  },
  contracts() {
    return `<h1>Contratti</h1>
    <div class="glass card" style="margin-bottom:14px"><form id="fc">
      <input name="name" placeholder="Contratto" required><input name="provider" placeholder="Fornitore">
      <input name="cost" type="number" step="0.01" placeholder="Costo €"><input name="end" type="date" title="Scadenza"><button class="btn">Aggiungi</button></form></div>
    <div class="glass card">${D.contracts.map((c) => `<div class="row"><div class="t">${esc(c.name)}<small>${esc(c.provider)} · scade il ${fmt(c.end)}</small></div>
      <div class="amt">${c.cost ? eur(c.cost) : ''}</div>${c.end ? dlPill(c.end, 'Scade tra') : ''}<button class="x" data-del="contracts:${c.id}">&#10005;</button></div>`).join('') || '<div class="empty">Nessun contratto.</div>'}</div>`;
  },
  deadlines() {
    return `<h1>Scadenze</h1><div class="glass card">${allDeadlines().map((x) => `<div class="row"><div class="t">${esc(x.what)}<small>${esc(x.who)} · ${fmt(x.date)}</small></div><div class="amt">${esc(x.extra || '')}</div>${x.contract ? dlPill(x.date, 'Scade tra') : dlPill(x.date)}</div>`).join('') || '<div class="empty">Nessuna scadenza.</div>'}</div>`;
  }
};

/* ---------- render & events ---------- */
function render() {
  const sc = $('#view').scrollTop;
  $('#view').innerHTML = views[view]();
  $('#view').scrollTop = sc;
  $('#banner').hidden = !D.demo;
  document.querySelectorAll('#nav button').forEach((b) => b.classList.toggle('on', b.dataset.v === view));
  const f = (id, fn) => { const el = $(id); if (el) el.onsubmit = (e) => { e.preventDefault(); fn(Object.fromEntries(new FormData(el))); save(); render(); }; };
  document.querySelectorAll('[data-add]').forEach((x) => x.onclick = () => openAdd(x.dataset.add));
  f('#fc', (o) => D.contracts.push({ id: uid(), ...o, cost: Number(o.cost) || 0 }));
  const vget = (s) => { const [id, k] = s.split(':'); return [D.vehicles.find((v) => v.id === id), k]; };
  document.querySelectorAll('[data-pay]').forEach((x) => x.onclick = () => { const b = D.bills.find((i) => i.id === x.dataset.pay); b.paidDate = $('#pd-' + b.id).value || today(); if (b.repeat) { const nd = addPeriod(b.due, b.repeat); if (!D.bills.some((i) => i.supplier === b.supplier && i.due === nd)) D.bills.push({ id: uid(), supplier: b.supplier, type: b.type, amount: b.amount, due: nd, paidDate: null, repeat: b.repeat, source: b.source || 'manuale' }); } save(); render(); });
  document.querySelectorAll('[data-unpay]').forEach((x) => x.onclick = () => { D.bills.find((i) => i.id === x.dataset.unpay).paidDate = null; save(); render(); });
  document.querySelectorAll('[data-vpay]').forEach((x) => x.onclick = () => { const [v, k] = vget(x.dataset.vpay); v.paid[k] = today(); save(); render(); });
  document.querySelectorAll('[data-vunpay]').forEach((x) => x.onclick = () => { const [v, k] = vget(x.dataset.vunpay); delete v.paid[k]; save(); render(); });
  document.querySelectorAll('[data-vf]').forEach((x) => x.onchange = () => {
    const [v, k] = vget(x.dataset.vf); v[k] = x.value;
    const m = VEH.find((e) => e[1] === k); if (m) delete v.paid[m[0]];
    save(); render();
  });
  document.querySelectorAll('[data-del]').forEach((x) => x.onclick = () => { const [k, id] = x.dataset.del.split(':'); D[k] = D[k].filter((i) => i.id !== id); save(); render(); });
  document.querySelectorAll('[data-cy]').forEach((x) => x.onclick = () => { chartYear = x.dataset.cy; render(); });
  document.querySelectorAll('[data-go]').forEach((x) => x.onclick = () => { view = x.dataset.go; render(); });
}

$('#nav').onclick = (e) => { if (e.target.dataset.v) { view = e.target.dataset.v; render(); } };
$('#addBtn').onclick = () => openAdd('q');
$('#openVault').onclick = () => window.api.openVault();
window.addEventListener('focus', async () => { // ricarica se i dati sono cambiati su disco (es. bolletta registrata da Claude)
  if (document.querySelector('.ovl') || document.querySelector('input:focus')) return;
  try { const d = await window.api.load(); if (JSON.stringify(d) !== JSON.stringify(D)) { D = d; migrate(); render(); } } catch (_) {}
});
$('#exportMobile').onclick = async () => {
  const a = await askPass('Esporta per iPhone', 'Scegli una password: i dati verranno cifrati con questa e la chiederà l\'iPhone', false);
  if (a.cancelled) return;
  const p = await window.api.exportMobile(a.value);
  alert(p ? 'Versione iPhone esportata in:\n' + p + (a.value ? '\n(dati cifrati)' : '\n(ATTENZIONE: dati NON cifrati)') : 'Esportazione non riuscita');
};
$('#clearDemo').onclick = () => {
  D.bills = D.bills.filter((b) => !/esempio/i.test(b.supplier));
  D.contracts = D.contracts.filter((c) => !/esempio/i.test(c.name));
  D.demo = false; save(); render();
};
const fdt = (s) => new Date(s).toLocaleString('it-IT', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
window.api.version().then((v) => {
  $('#ver').textContent = 'v' + (v.version || '?') + (v.released ? ' · aggiornata il ' + fdt(v.released) : '') + (v.exported ? ' · dati del ' + fdt(v.exported) : '');
}).catch(() => {});
Promise.all([window.api.load(), window.api.photo(), window.api.credit()]).then(([d, p, c]) => { D = d; photo = p; photoCredit = c; migrate(); render(); });
