// 試作の画面：区画を開く、置く・壊す・回す、依頼と解放、保存。
import data from '../data/proto.js';
import districts from '../data/districts.js';
import {
  createWorld, place, remove, canPlace, entAt, rebuild, step, rate, serialize, load, TPS,
} from '../core/sim.js';
import { draw, CELL } from './draw.js';

const $ = (id) => document.getElementById(id);
const SAVE_KEY = 'aether-atelier-proto-v1';
const canvas = $('board');

let save = { done: {}, open: ['d0'], layouts: {}, cur: 'd0' };
try {
  const s = JSON.parse(localStorage.getItem(SAVE_KEY));
  if (s && s.open) save = s;
} catch { /* 保存が読めないときは最初から */ }
const persist = () => {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch { /* 保存できなくても遊べる */ }
};

const ui = { tool: null, dir: 0, hover: null, alpha: 0, paused: false, speed: 1 };
let def, world, drag = null;

function freshWorld(d) {
  const w = createWorld(d, data);
  for (const f of d.fixed) place(w, f.id, f.x, f.y, f.dir, { ...f, fixed: true });
  return w;
}

function openDistrict(id) {
  def = districts.find((d) => d.id === id);
  save.cur = id;
  let w = null;
  try { if (save.layouts[id]) w = load(save.layouts[id], data); } catch { w = null; }
  world = w || freshWorld(def);
  rebuild(world);
  ui.tool = null;
  const dpr = window.devicePixelRatio || 1;
  canvas.width = def.w * CELL * dpr;
  canvas.height = def.h * CELL * dpr;
  canvas.style.width = `${def.w * CELL}px`;
  canvas.style.height = `${def.h * CELL}px`;
  canvas.getContext('2d').setTransform(dpr, 0, 0, dpr, 0, 0);
  $('intro').textContent = def.intro;
  renderTabs(); renderPalette(); renderRequests(); renderLegend();
  persist();
}

const doneCount = () => save.done[def.id] || 0;
function available() {
  const list = [...def.base];
  def.requests.slice(0, doneCount()).forEach((r) => list.push(...r.unlock));
  return list;
}
const countOf = (id) => world.ents.filter((e) => e.id === id).length;
const overLimit = (id) => def.limits[id] != null && countOf(id) >= def.limits[id];

function changed() {
  rebuild(world);
  save.layouts[def.id] = serialize(world);
  persist();
  renderPalette();
}

// ---- 画面の部品 ----
function renderTabs() {
  $('tabs').replaceChildren(...districts.map((d) => {
    const b = document.createElement('button');
    b.textContent = d.name;
    b.disabled = !save.open.includes(d.id);
    b.className = d.id === def.id ? 'on' : '';
    b.onclick = () => openDistrict(d.id);
    return b;
  }));
}

function renderPalette() {
  $('palette').replaceChildren(...available().map((id, i) => {
    const b = data.buildings[id];
    const el = document.createElement('button');
    const lim = def.limits[id] != null ? `　${countOf(id)}/${def.limits[id]}` : '';
    el.innerHTML = `<span>${i + 1}. ${b.name}</span><small>${b.w}×${b.h}${lim}</small>`;
    el.className = ui.tool === id ? 'on' : '';
    el.disabled = overLimit(id);
    el.onclick = () => { ui.tool = ui.tool === id ? null : id; renderPalette(); };
    return el;
  }));
}

function renderRequests() {
  const n = doneCount();
  $('requests').replaceChildren(...def.requests.map((r, i) => {
    const el = document.createElement('div');
    el.className = `req ${i < n ? 'done' : i > n ? 'wait' : ''}`;
    let html = `<div class="t">${r.text}</div>`;
    if (i === n) {
      for (const t in r.targets) {
        html += `<div class="bar" data-item="${t}" data-n="${r.targets[t]}"><i></i></div><div class="row"><span>${data.items[t].name}</span><span data-rate="${t}"></span></div>`;
      }
    }
    html += `<div class="rw">報酬：${r.reward}</div>`;
    el.innerHTML = html;
    return el;
  }));
  updateRates();
}

function renderLegend() {
  $('legend').innerHTML = Object.values(data.items)
    .map((it) => `<div class="row"><span><i class="dot" style="background:${it.color}"></i>${it.name}</span></div>`).join('');
}

function updateRates() {
  for (const bar of document.querySelectorAll('#requests .bar')) {
    const t = bar.dataset.item, n = Number(bar.dataset.n), r = rate(world, t);
    bar.firstChild.style.width = `${Math.min(100, (r / n) * 100)}%`;
    bar.classList.toggle('full', r >= n);
    document.querySelector(`[data-rate="${t}"]`).textContent = `毎分 ${r} / ${n}`;
  }
  const rows = Object.keys(data.items).filter((t) => world.delivered[t])
    .map((t) => `<div class="row"><span><i class="dot" style="background:${data.items[t].color}"></i>${data.items[t].name}</span><span>${rate(world, t)}</span></div>`);
  $('rates').innerHTML = rows.join('') || '<div class="row"><span>まだ何も納めていない</span></div>';
}

let toastTimer;
function toast(msg) {
  $('toast').innerHTML = msg;
  $('toast').classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $('toast').classList.remove('show'), 4000);
}

function checkRequest() {
  const r = def.requests[doneCount()];
  if (!r) return;
  for (const t in r.targets) if (rate(world, t) < r.targets[t]) return;
  save.done[def.id] = doneCount() + 1;
  if (r.opens && !save.open.includes(r.opens)) save.open.push(r.opens);
  persist();
  toast(`依頼達成！<br>${r.reward}${r.unlock.length || r.opens ? ' が開いた' : ''}`);
  renderTabs(); renderPalette(); renderRequests();
}

// ---- 操作 ----
function tileAt(ev) {
  const r = canvas.getBoundingClientRect();
  return { x: Math.floor((ev.clientX - r.left) / CELL), y: Math.floor((ev.clientY - r.top) / CELL) };
}

function putBelt(x, y, d) {
  const e = entAt(world, x, y);
  if (e && e.kind === 'belt' && !e.fixed) { e.dir = d; world.dirty = true; return; }
  if (!e) place(world, 'belt', x, y, d);
}

function dragTo(t) {
  let guard = 100;
  while ((drag.x !== t.x || drag.y !== t.y) && guard--) {
    const dx = t.x - drag.x, dy = t.y - drag.y;
    const d = Math.abs(dx) >= Math.abs(dy) ? (dx > 0 ? 0 : 2) : (dy > 0 ? 1 : 3);
    putBelt(drag.x, drag.y, d);
    drag.x += [1, 0, -1, 0][d]; drag.y += [0, 1, 0, -1][d];
    putBelt(drag.x, drag.y, d);
    ui.dir = d;
  }
  changed();
}

function removeAt(t) {
  if (remove(world, t.x, t.y)) changed();
}

canvas.addEventListener('contextmenu', (ev) => ev.preventDefault());
canvas.addEventListener('mousedown', (ev) => {
  const t = tileAt(ev);
  if (ev.button === 2) {
    if (entAt(world, t.x, t.y) && !entAt(world, t.x, t.y).fixed) { removeAt(t); drag = { erase: true }; }
    else if (ui.tool) { ui.tool = null; renderPalette(); } else drag = { erase: true };
    return;
  }
  if (ev.button !== 0 || !ui.tool) return;
  if (ui.tool === 'belt') {
    drag = { x: t.x, y: t.y };
    putBelt(t.x, t.y, ui.dir);
    changed();
  } else if (!overLimit(ui.tool) && place(world, ui.tool, t.x, t.y, ui.dir)) {
    changed();
    if (overLimit(ui.tool)) { ui.tool = null; renderPalette(); }
  }
});
canvas.addEventListener('mousemove', (ev) => {
  const t = tileAt(ev);
  ui.hover = t;
  if (!drag) return;
  if (drag.erase) removeAt(t);
  else if (t.x >= 0 && t.y >= 0 && t.x < world.w && t.y < world.h) dragTo(t);
});
window.addEventListener('mouseup', () => { drag = null; });
canvas.addEventListener('mouseleave', () => { ui.hover = null; });

function rotate(step = 1) {
  const e = ui.hover && entAt(world, ui.hover.x, ui.hover.y);
  if (!ui.tool && e && !e.fixed) { e.dir = (e.dir + step) & 3; changed(); return; }
  ui.dir = (ui.dir + step) & 3;
}
canvas.addEventListener('wheel', (ev) => { ev.preventDefault(); rotate(ev.deltaY > 0 ? 1 : 3); }, { passive: false });

function setPaused(p) {
  ui.paused = p;
  $('pause').classList.toggle('on', p);
  $('pause').textContent = p ? '再開' : '一時停止';
}
window.addEventListener('keydown', (ev) => {
  if (ev.key === 'r' || ev.key === 'R') rotate();
  else if (ev.key === 'q' || ev.key === 'Q' || ev.key === 'Escape') { ui.tool = null; renderPalette(); }
  else if (ev.key === ' ') { ev.preventDefault(); setPaused(!ui.paused); }
  else if (ev.key === 'Delete' && ui.hover) removeAt(ui.hover);
  else if (/^[1-9]$/.test(ev.key)) {
    const id = available()[Number(ev.key) - 1];
    if (id && !overLimit(id)) { ui.tool = id; renderPalette(); }
  }
});
$('pause').onclick = () => setPaused(!ui.paused);
for (const b of document.querySelectorAll('[data-speed]')) {
  b.onclick = () => {
    ui.speed = Number(b.dataset.speed);
    document.querySelectorAll('[data-speed]').forEach((x) => x.classList.toggle('on', x === b));
  };
}
$('reset').onclick = () => {
  if (!confirm('この区画に置いた物を全部消します。よいですか？（依頼の達成は残ります）')) return;
  delete save.layouts[def.id];
  openDistrict(def.id);
};
$('openall').onclick = () => {
  for (const d of districts) { save.done[d.id] = d.requests.length; if (!save.open.includes(d.id)) save.open.push(d.id); }
  persist();
  renderTabs(); renderPalette(); renderRequests();
};

const STATUS = { working: '動いている', waiting: '材料待ち', blocked: '出口が詰まっている', 'no-field': '範囲の外', 'no-recipe': 'レシピなし' };
function updateInfo() {
  const e = ui.hover && entAt(world, ui.hover.x, ui.hover.y);
  let s = ' ';
  if (e) {
    s = data.buildings[e.id].name;
    if (e.kind === 'machine') {
      const r = data.recipes[e.recipe];
      const io = (o) => Object.keys(o).map((t) => data.items[t].name).join('＋');
      s += `：${io(r.in)} → ${io(r.out)}（毎分${(600 / r.ticks) * Object.values(r.out)[0]}個）｜${STATUS[e.status]}`;
    } else if (e.kind === 'source') s += `：${data.items[e.item].name}（毎分120個まで）`;
    else if (e.kind === 'emitter') s += '：周りに熱の範囲を作る。熱の中を3マス進んだ鉱石は溶ける';
    else if (e.item) s += `：${data.items[e.item.t].name}`;
  }
  $('info').textContent = s;
}

// ---- 進める ----
function tickOnce() {
  step(world);
  if (world.tick % TPS === 0) { updateRates(); checkRequest(); }
}
let last = performance.now(), acc = 0;
function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  if (!ui.paused) {
    acc += dt * TPS * ui.speed;
    while (acc >= 1) { tickOnce(); acc -= 1; }
  }
  ui.alpha = ui.paused ? 0 : acc;
  draw(canvas.getContext('2d'), world, ui, def, overLimit);
  updateInfo();
  requestAnimationFrame(frame);
}

openDistrict(save.open.includes(save.cur) ? save.cur : 'd0');
requestAnimationFrame(frame);

// 調べるとき用（コンソールから world を見る）
window.__aa = { get world() { return world; }, ui, advance(n) { for (let i = 0; i < n; i++) tickOnce(); } };
