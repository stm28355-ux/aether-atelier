// 画面：町の地図・区画・図鑑。ゲームの中身は core/game.js。
import content from '../data/content.js';
import {
  createGame, step as stepGame, layoutChanged, resetDistrict, unlocked, perMin, startCleanup,
  districtDef, save,
} from '../core/game.js';
import { place, remove, entAt, rate, TPS } from '../core/sim.js';
import { draw, CELL } from './draw.js';
import { drawItem } from './sprites.js';

const $ = (id) => document.getElementById(id);
const SAVE_KEY = 'aether-atelier-v1';
const { items, buildings } = content;
const itemName = (t) => items[t]?.name ?? t;
const dot = (t) => `<canvas class="ico" data-item="${t}" width="24" height="24"></canvas>`;

let saved = null;
try { saved = JSON.parse(localStorage.getItem(SAVE_KEY)); } catch { saved = null; }
let game = createGame(content, saved);
const persist = () => {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(save(game))); } catch { /* 保存できなくても遊べる */ }
};

const ui = { screen: 'map', district: null, tool: null, dir: 0, hover: null, alpha: 0, paused: false, speed: 1 };
const canvas = $('board');

// ---- 画面の切り替え（#/map, #/book, #/d/区画） ----
function route() {
  const h = location.hash || '#/map';
  const m = h.match(/^#\/d\/(\w+)$/);
  if (m && game.state.open.includes(m[1])) { ui.screen = 'district'; openDistrict(m[1]); }
  else if (h === '#/book') ui.screen = 'book';
  else ui.screen = 'map';
  for (const s of ['map', 'book', 'district']) $(`screen-${s}`).style.display = ui.screen === s ? '' : 'none';
  document.querySelectorAll('[data-go]').forEach((b) => b.classList.toggle('on', b.dataset.go === `#/${ui.screen}`));
  $('where').textContent = ui.screen === 'district' ? `› ${districtDef(game, ui.district).name}` : '';
  if (ui.screen === 'map') renderMap();
  if (ui.screen === 'book') renderBook();
}
window.addEventListener('hashchange', route);
document.querySelectorAll('[data-go]').forEach((b) => { b.onclick = () => { location.hash = b.dataset.go; }; });

// ---- 町の地図 ----
const COLS = { '機工': ['d0', 'd2', 'd4', 'd6'], '炉と霜': ['d1', 'd3', 'd5', 'd7'] };
function districtState(id) {
  const def = districtDef(game, id);
  if (!def) return 'soon';
  if (!game.state.open.includes(id)) return 'locked';
  return (game.state.done[id] || 0) >= def.requests.length ? 'done' : 'open';
}
function renderMap() {
  const grid = $('map-grid');
  grid.replaceChildren();
  for (const [sys, ids] of Object.entries(COLS)) {
    const col = document.createElement('div');
    col.className = 'map-col';
    col.innerHTML = `<h3>${sys}</h3>`;
    for (const id of ids) {
      const def = districtDef(game, id) || content.upcoming.find((u) => u.id === id);
      const st = districtState(id);
      const card = document.createElement('div');
      card.className = `card ${st}`;
      let body = '';
      if (st === 'soon') body = '<p class="sub">準備中（フェーズ4以降）</p>';
      else if (st === 'locked') body = '<p class="sub">まだ開いていない</p>';
      else {
        const n = game.state.done[id] || 0;
        body = `<p class="sub">${st === 'done' ? '依頼をすべて達成' : `依頼 ${n}/${def.requests.length}`}</p><canvas class="mini" data-mini="${id}"></canvas><div class="exports" data-exports="${id}"></div>`;
      }
      card.innerHTML = `<b>${def.name}</b>${body}`;
      if (st === 'open' || st === 'done') { card.onclick = () => { location.hash = `#/d/${id}`; }; card.classList.add('click'); }
      col.append(card);
    }
    grid.append(col);
  }
  updateMap();
}
function updateMap() {
  for (const c of document.querySelectorAll('[data-mini]')) {
    const w = game.worlds[c.dataset.mini];
    const k = 0.25, dpr = window.devicePixelRatio || 1;
    if (c.width !== w.w * CELL * k * dpr) {
      c.width = w.w * CELL * k * dpr; c.height = w.h * CELL * k * dpr;
      c.style.width = `${w.w * CELL * k}px`; c.style.height = `${w.h * CELL * k}px`;
    }
    const ctx = c.getContext('2d');
    ctx.setTransform(k * dpr, 0, 0, k * dpr, 0, 0);
    draw(ctx, w, { alpha: 0 });
  }
  for (const el of document.querySelectorAll('[data-exports]')) {
    const w = game.worlds[el.dataset.exports];
    const list = Object.keys(items).filter((t) => rate(w, t) > 0);
    el.innerHTML = list.length ? `出している：${list.map((t) => `${dot(t)}${itemName(t)} ${rate(w, t)}`).join('　')}` : '<span class="sub">まだ何も出していない</span>';
  }
  const rows = Object.keys(items).filter((t) => perMin(game, 'in', t) || perMin(game, 'out', t));
  $('warehouse').innerHTML = rows.length
    ? `<tr><th>素材</th><th>入る</th><th>使われる</th><th>余り</th></tr>${rows.map((t) => `<tr><td>${dot(t)}${itemName(t)}</td><td>${perMin(game, 'in', t)}</td><td>${perMin(game, 'out', t)}</td><td>${perMin(game, 'spare', t) + perMin(game, 'clean', t)}</td></tr>`).join('')}`
    : '<tr><td>まだ何も入っていない</td></tr>';
  paintIcons();
}

// ---- 図鑑 ----
function renderBook() {
  $('book').innerHTML = Object.entries(items).map(([t, it]) => {
    const n = game.state.made[t] || 0;
    const known = n || game.state.seen?.[t];
    const count = it.sys === '倉庫' ? '倉庫から' : n ? `これまで ${n}個納めた` : '工場の中で作っている';
    return known
      ? `<div class="entry">${dot(t)}<div><b>${it.name}</b><span class="sub">　${it.sys}・${count}</span><p>${it.role}</p></div></div>`
      : `<div class="entry unknown"><canvas class="ico" data-item="${t}" data-dark="1" width="24" height="24"></canvas><div><b>？？？</b><p>まだ作っていない</p></div></div>`;
  }).join('');
  paintIcons();
}

function paintIcons() {
  for (const c of document.querySelectorAll('canvas.ico:not([data-done])')) {
    const ctx = c.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    drawItem(ctx, c.dataset.item, 12, 12, 16);
    if (c.dataset.dark) { ctx.globalCompositeOperation = 'source-atop'; ctx.fillStyle = '#7a6d5e'; ctx.fillRect(0, 0, 24, 24); }
    c.dataset.done = '1';
  }
}

// ---- 区画 ----
let def, world;
function openDistrict(id) {
  ui.district = id;
  def = districtDef(game, id);
  world = game.worlds[id];
  ui.tool = null;
  const dpr = window.devicePixelRatio || 1;
  canvas.width = def.w * CELL * dpr;
  canvas.height = def.h * CELL * dpr;
  canvas.style.width = `${def.w * CELL}px`;
  canvas.style.height = `${def.h * CELL}px`;
  canvas.getContext('2d').setTransform(dpr, 0, 0, dpr, 0, 0);
  $('intro').textContent = def.intro;
  renderPalette(); renderRequests(); renderRubble();
}

const countOf = (id) => world.ents.filter((e) => e.id === id).length;
const overLimit = (id) => def.limits[id] != null && countOf(id) >= def.limits[id];
const placeable = () => unlocked(game).filter((id) => buildings[id].kind !== 'source' && buildings[id].kind !== 'sink');

function changed() {
  layoutChanged(game, ui.district);
  persist();
  renderPalette();
}

function renderPalette() {
  $('palette').replaceChildren(...placeable().map((id, i) => {
    const b = buildings[id];
    const el = document.createElement('button');
    const lim = def.limits[id] != null ? `　${countOf(id)}/${def.limits[id]}` : '';
    el.innerHTML = `<span>${i + 1}. ${b.name}</span><small>${b.w}×${b.h}${lim}</small>`;
    el.className = ui.tool === id ? 'on' : '';
    el.disabled = overLimit(id);
    el.onclick = () => { ui.tool = ui.tool === id ? null : id; renderPalette(); };
    return el;
  }));
}

function reqText(r) {
  return Object.entries(r.targets).map(([t, n]) => `${itemName(t)}を毎分${n}`).join('と') + '、納める';
}
function renderRequests() {
  const n = game.state.done[ui.district] || 0;
  $('requests').replaceChildren(...def.requests.map((r, i) => {
    const el = document.createElement('div');
    el.className = `req ${i < n ? 'done' : i > n ? 'wait' : ''}`;
    let html = `<div class="t">${reqText(r)}</div>`;
    if (i === n) {
      for (const t in r.targets) {
        html += `<div class="bar" data-item="${t}" data-n="${r.targets[t]}"><i></i></div><div class="row"><span>${dot(t)}${itemName(t)}</span><span data-rate="${t}"></span></div>`;
      }
    }
    html += `<div class="rw">報酬：${r.reward}</div>`;
    el.innerHTML = html;
    return el;
  }));
  updateDistrictPanels();
}

function renderRubble() {
  const left = def.rubble.filter((r) => !(game.state.cleared[ui.district] || []).includes(r.id));
  const c = game.state.cleanup;
  if (!left.length) { $('rubble').innerHTML = '<p class="sub">この区画の瓦礫はすべて片づけた</p>'; return; }
  $('rubble').innerHTML = left.map((r) => {
    const active = c && c.district === ui.district && c.patch === r.id;
    return `<div class="req ${active ? '' : 'wait-no'}"><div class="t">${r.tiles.length}マス：${itemName(r.cost.item)}を毎分${r.cost.perMin}、1分</div>
      ${active ? `<div class="bar" data-clean="${r.cost.item}" data-n="${r.cost.perMin}"><i></i></div><div class="row"><span>余りから</span><span data-cleanrate></span></div>` : `<button data-clean-start="${r.id}">片づける</button>`}</div>`;
  }).join('') + '<p class="hint">片づけは、倉庫の「余り」（あとの区画が受け取らなかった分）で行う。同時に片づけられるのは1か所。</p>';
  for (const b of document.querySelectorAll('[data-clean-start]')) {
    b.onclick = () => { startCleanup(game, ui.district, b.dataset.cleanStart); persist(); renderRubble(); };
  }
}

function updateDistrictPanels() {
  for (const bar of document.querySelectorAll('#requests .bar')) {
    const t = bar.dataset.item, n = Number(bar.dataset.n), r = rate(world, t);
    bar.firstChild.style.width = `${Math.min(100, (r / n) * 100)}%`;
    bar.classList.toggle('full', r >= n);
    document.querySelector(`[data-rate="${t}"]`).textContent = `毎分 ${r} / ${n}`;
  }
  const rows = Object.keys(items).filter((t) => world.delivered[t])
    .map((t) => `<div class="row"><span>${dot(t)}${itemName(t)}</span><span>${rate(world, t)}</span></div>`);
  $('rates').innerHTML = rows.join('') || '<div class="row"><span class="sub">まだ何も納めていない</span></div>';
  const ports = world.ents.filter((e) => e.kind === 'source' && e.imported);
  $('imports-box').style.display = ports.length ? '' : 'none';
  $('imports').innerHTML = ports.map((p) => `<div class="row"><span>${dot(p.item)}${itemName(p.item)}</span><span>倉庫に入る ${perMin(game, 'in', p.item)}</span></div>`).join('')
    + (ports.length ? '<p class="hint">倉庫に入る量を、受け取る口で等分する。足りなければ前の区画を改善する。</p>' : '');
  const cb = document.querySelector('[data-clean]');
  if (cb) {
    const t = cb.dataset.clean, n = Number(cb.dataset.n), r = perMin(game, 'clean', t);
    cb.firstChild.style.width = `${Math.min(100, (r / n) * 100)}%`;
    document.querySelector('[data-cleanrate]').textContent = `毎分 ${r} / ${n}`;
  }
  paintIcons();
}

// ---- 知らせ ----
let toastTimer;
function toast(msg) {
  $('toast').innerHTML = msg;
  $('toast').classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $('toast').classList.remove('show'), 4000);
}
function handleEvents() {
  while (game.events.length) {
    const ev = game.events.shift();
    const d = districtDef(game, ev.district);
    if (ev.type === 'request') toast(`${d.name}：依頼達成！<br>報酬：${ev.request.reward}`);
    if (ev.type === 'cleared') toast(`${d.name}：瓦礫を片づけた。置ける場所が広がった`);
    persist();
    if (ui.screen === 'district') { renderPalette(); renderRequests(); renderRubble(); }
    if (ui.screen === 'map') renderMap();
  }
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
let drag = null;
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
function removeAt(t) { if (remove(world, t.x, t.y)) changed(); }

canvas.addEventListener('contextmenu', (ev) => ev.preventDefault());
canvas.addEventListener('mousedown', (ev) => {
  const t = tileAt(ev);
  if (ev.button === 2) {
    const e = entAt(world, t.x, t.y);
    if (e && !e.fixed) { removeAt(t); drag = { erase: true }; }
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

function rotate(stepN = 1) {
  const e = ui.hover && entAt(world, ui.hover.x, ui.hover.y);
  if (!ui.tool && e && !e.fixed) { e.dir = (e.dir + stepN) & 3; world.dirty = true; changed(); return; }
  ui.dir = (ui.dir + stepN) & 3;
}
canvas.addEventListener('wheel', (ev) => { ev.preventDefault(); rotate(ev.deltaY > 0 ? 1 : 3); }, { passive: false });

function setPaused(p) {
  ui.paused = p;
  $('pause').classList.toggle('on', p);
  $('pause').textContent = p ? '再開' : '一時停止';
}
window.addEventListener('keydown', (ev) => {
  if (ev.key === ' ') { ev.preventDefault(); setPaused(!ui.paused); return; }
  if (ui.screen !== 'district') return;
  if (ev.key === 'r' || ev.key === 'R') rotate();
  else if (ev.key === 'q' || ev.key === 'Q' || ev.key === 'Escape') { ui.tool = null; renderPalette(); }
  else if (ev.key === 'Delete' && ui.hover) removeAt(ui.hover);
  else if (/^[1-9]$/.test(ev.key)) {
    const id = placeable()[Number(ev.key) - 1];
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
  if (!confirm('この区画に置いた物を全部消します。よいですか？（依頼の達成と片づけた瓦礫は残ります）')) return;
  resetDistrict(game, ui.district);
  persist();
  openDistrict(ui.district);
};
$('openall').onclick = () => {
  for (const d of content.districts) {
    game.state.done[d.id] = d.requests.length;
    if (!game.state.open.includes(d.id)) game.state.open.push(d.id);
  }
  persist();
  game = createGame(content, save(game));
  route();
};

const STATUS = { working: '動いている', waiting: '材料待ち', blocked: '出口が詰まっている', 'no-field': '範囲の外', 'no-recipe': 'レシピなし' };
function updateInfo() {
  const t = ui.hover;
  const e = t && entAt(world, t.x, t.y);
  let s = ' ';
  if (e) {
    s = buildings[e.id].name;
    if (e.kind === 'machine') {
      const r = content.recipes[e.recipe];
      const io = (o) => Object.entries(o).map(([k, n]) => `${itemName(k)}${n > 1 ? n : ''}`).join('＋');
      s += `：${io(r.in)} → ${io(r.out)}（毎分${(600 / r.ticks) * Object.values(r.out)[0]}個）｜${STATUS[e.status]}`;
    } else if (e.kind === 'source') s += e.imported ? `：${itemName(e.item)}（前の区画から。倉庫に入る量まで）` : `：${itemName(e.item)}（毎分120個まで）`;
    else if (e.kind === 'emitter') s += '：周りに熱の範囲を作る。熱の中を3マス進んだ鉱石は溶け、金属板は赤熱する';
    else if (e.item) s += `：${itemName(e.item.t)}`;
  } else if (t && world.blocked[t.y * world.w + t.x] === 2) s = '瓦礫：右の「瓦礫」から片づけると置けるようになる';
  $('info').textContent = s;
}

// ---- 進める ----
function tickOnce() {
  stepGame(game);
  if (game.tick % TPS === 0) {
    handleEvents();
    if (ui.screen === 'district') updateDistrictPanels();
    if (ui.screen === 'map') updateMap();
  }
}
let last = performance.now(), acc = 0, saveAcc = 0;
function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  if (!ui.paused) {
    acc += dt * TPS * ui.speed;
    while (acc >= 1) { tickOnce(); acc -= 1; }
    saveAcc += dt;
    if (saveAcc > 5) { saveAcc = 0; persist(); }
  }
  ui.alpha = ui.paused ? 0 : acc;
  if (ui.screen === 'district') {
    const c = game.state.cleanup;
    const cleanupTiles = c && c.district === ui.district ? def.rubble.find((r) => r.id === c.patch)?.tiles : null;
    draw(canvas.getContext('2d'), world, {
      tool: ui.tool, dir: ui.dir, hover: ui.hover, alpha: ui.alpha, overLimit, cleanupTiles,
      portLabel: () => '受取',
    });
    updateInfo();
  }
  requestAnimationFrame(frame);
}

route();
requestAnimationFrame(frame);

// 調べるとき用（コンソールから見る。プレビューが隠れて止まるときは advance で進める）
window.__aa = { get game() { return game; }, ui, advance(n) { for (let i = 0; i < n; i++) tickOnce(); } };
