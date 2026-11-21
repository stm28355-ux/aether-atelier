// 画面：町の地図・区画・図鑑。ゲームの中身は core/game.js。
import content from '../data/content.js';
import {
  createGame, step as stepGame, layoutChanged, resetDistrict, unlocked, perMin, startCleanup,
  districtDef, save, recipesFor, goals,
} from '../core/game.js';
import {
  place, remove, entAt, rate, rebuild, setRecipe, backRate, TPS, DX, DY, UNDER_GAP, FUEL_CAP, SHAKE_RADIUS, BELT_TICKS,
} from '../core/sim.js';
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

const ui = { screen: 'map', district: null, tool: null, tab: 'move', dir: 0, hover: null, alpha: 0, paused: false, speed: 1, recipe: {}, filter: null, book: 'items' };
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
      if (st === 'soon') body = '<p class="sub">準備中</p>';
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
  const later = document.createElement('p');
  later.className = 'hint later';
  later.textContent = 'この先（第3部）：エーテル・育てる・飛空艇の系統は、2系統を遊んだあとで作る。';
  grid.append(later);
  updateMap();
}
function renderGoals() {
  $('goals').innerHTML = goals(game).map((g) => {
    const want = Object.entries(g.targets).map(([t, n]) => `${dot(t)}${itemName(t)} 毎分${n}`).join('、');
    const st = !g.open ? '<span class="sub">まだ区画が開いていない</span>'
      : !g.reached ? `<span class="sub">${districtDef(game, g.district).name}で、${want}を納める</span>`
        : g.flowing ? `<span class="ok">◎ 流れ続けている</span>（${want}）`
          : `<span class="warn">止まっている</span>（${want}が足りない）`;
    return `<div class="goal ${g.reached ? 'reached' : ''}"><b>${g.title}</b><div>${st}</div></div>`;
  }).join('');
}
function updateMap() {
  renderGoals();
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
// 図鑑のタブ：素材・範囲のきまり・設備
const known = (t) => !!(game.state.made[t] || game.state.seen?.[t]);
const knownName = (t) => (known(t) ? itemName(t) : '？？？');
const tiles = (f) => f.ticks / BELT_TICKS; // 範囲の中で何マス分
const ioIcons = (o) => Object.entries(o).map(([k, n]) => `${dot(k)}${itemName(k)}${n > 1 ? `×${n}` : ''}`).join('＋');
// 今選べるレシピ（[設備, レシピ]）
const allRecipes = () => Object.keys(buildings).flatMap((bid) => (buildings[bid].recipes ? recipesFor(game, bid).map((r) => [bid, r]) : []));

function howMade(t) {
  if (items[t].sys === '倉庫') return ['倉庫から出てくる'];
  const list = allRecipes().filter(([, r]) => content.recipes[r].out[t]).map(([bid, r]) => `${buildings[bid].name}で ${ioIcons(content.recipes[r].in)} から`);
  for (const f of content.fieldRules) if (f.to === t) list.push(`${dot(f.from)}${knownName(f.from)}が<b>${FIELD_NAME[f.field]}の中を${tiles(f)}マス</b>進む`);
  return list;
}
function usesOf(t) {
  const list = allRecipes().filter(([, r]) => content.recipes[r].in[t])
    .map(([bid, r]) => `${buildings[bid].name}で ${Object.keys(content.recipes[r].out).map((o) => `${dot(o)}${knownName(o)}`).join('')} に`);
  for (const f of content.fieldRules) if (f.from === t) list.push(`<b>${FIELD_NAME[f.field]}の中を${tiles(f)}マス</b>進むと ${dot(f.to)}${knownName(f.to)} になる`);
  return list;
}
function bookItems() {
  return Object.entries(items).map(([t, it]) => {
    const n = game.state.made[t] || 0;
    if (!known(t)) return `<div class="entry unknown"><canvas class="ico" data-item="${t}" data-dark="1" width="24" height="24"></canvas><div><b>？？？</b><p>まだ作っていない</p></div></div>`;
    const count = it.sys === '倉庫' ? '倉庫から' : n ? `これまで ${n}個納めた` : '工場の中で作っている';
    const uses = usesOf(t);
    return `<div class="entry">${dot(t)}<div><b>${it.name}</b><span class="sub">　${it.sys}・${count}</span><p>${it.role}</p>`
      + `<p class="how"><span class="k">作り方</span>${howMade(t).join('<br>')}</p>`
      + (uses.length ? `<p class="how"><span class="k">使い道</span>${uses.join('<br>')}</p>` : '')
      + '</div></div>';
  }).join('');
}
function bookRules() {
  const has = new Set(unlocked(game));
  const row = (f) => `<tr><td>${FIELD_NAME[f.field]}</td><td>${tiles(f)}マス</td><td>${dot(f.from)}${knownName(f.from)}</td><td>→</td><td>${known(f.to) ? dot(f.to) : ''}${knownName(f.to)}</td></tr>`;
  let html = `<section class="rule"><h3>熱と冷気で変わる物</h3>
    <p>熱と冷気は、ベルトの上を流れる物に効く。範囲の中にいた長さの合計で変わる（1マス進む長さ＝0.5秒を、1マスと数える）。</p>
    <ul><li>ベルトの上で止まっていても、範囲の中にいる間は数える（詰まると、思っていない物に変わることがある）</li>
    <li>範囲を出ても、それまでに数えた分は残る</li>
    <li>熱と冷気が重なったマスは打ち消し合い、どちらも効かない（灰色のマス）</li>
    <li>下をくぐるベルトの中では効かない</li></ul>
    <table class="rules"><tr><th>範囲</th><th>長さ</th><th>前</th><th></th><th>あと</th></tr>${content.fieldRules.map(row).join('')}</table>
    <p class="sub">熱は竜炉、冷気は霜の柱が出す。どちらも周り2マス。</p></section>`;
  if (has.has('manaFurnace')) {
    html += `<section class="rule"><h3>魔力</h3><ul>
      <li>地脈のない区画（区3から）では、竜炉・研磨機・霜の柱・からくり台は魔力が要る</li>
      <li>魔力炉は燃料を毎分${buildings.manaFurnace.fuelPerMin}燃やし、周り${buildings.manaFurnace.radius}マス（紫の点）に魔力を出す。範囲の機械${buildings.manaFurnace.powers}台まで、ふつうの速さで動かす（多いと全部が遅くなる）</li>
      <li>機械の全部のマスが紫の点の中にあれば動く。いくつかの魔力炉の範囲を合わせてよい（からくり台は魔力炉2つで挟む）</li></ul></section>`;
  }
  if (has.has('lathe')) html += '<section class="rule"><h3>相乗</h3><ul><li>旋盤は、辺で接する旋盤1台ごとに25%速い（2台まで、最大50%）</li></ul></section>';
  if (has.has('workbench')) html += `<section class="rule"><h3>揺れ</h3><ul><li>プレス機と巻き機は、置いているだけで周り${SHAKE_RADIUS}マスを揺らす（斜めの線）</li><li>からくり台は、1マスでも揺れの範囲に入ると止まる</li></ul></section>`;
  return html;
}
function bookBuildings() {
  return TABS.map((g) => {
    const ids = inTab(g.id);
    if (!ids.length) return '';
    return `<h3 class="bk-h">${g.name}</h3><div class="book-grid">${ids.map((id) => {
      const b = buildings[id];
      const rs = b.recipes ? recipesFor(game, id).map((r) => {
        const rr = content.recipes[r];
        return `${ioIcons(rr.in)} → ${ioIcons(rr.out)}<span class="sub">　毎分${(600 / rr.ticks) * Object.values(rr.out)[0]}</span>`;
      }) : [];
      const size = b.kind === 'under' ? '入口と出口' : `${b.w}×${b.h}`;
      return `<div class="entry bld"><div><b>${b.name}</b><span class="sub">　${size}</span>${rs.length ? `<p class="how">${rs.join('<br>')}</p>` : ''}<p>${buildingNote(id, false)}</p></div></div>`;
    }).join('')}</div>`;
  }).join('');
}
function renderBook() {
  document.querySelectorAll('[data-book]').forEach((b) => b.classList.toggle('on', b.dataset.book === ui.book));
  const box = $('book');
  box.className = ui.book === 'items' ? 'book-grid' : '';
  box.innerHTML = ui.book === 'items' ? bookItems() : ui.book === 'rules' ? bookRules() : bookBuildings();
  paintIcons();
}
document.querySelectorAll('[data-book]').forEach((b) => { b.onclick = () => { ui.book = b.dataset.book; renderBook(); }; });

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
  closePicker();
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
  // 真ん中の列は盤面の幅に固定する（説明文の長さで列の幅が変わると、盤面がずれてカーソルの下のマスが変わる）
  $('center').style.width = `${def.w * CELL + 2}px`;
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

const TOOL_NOTE = {
  belt: '物を運ぶ。ドラッグで引く。置いたベルトの上に引き直すと向きが変わる',
  splitter: '後ろから受けて、正面・左・右に順に出す',
  under: '入口を置き、同じ向きで前に出口を置く（間は4マスまで）。くぐっている間は範囲が効かない',
  sorter: '後ろから受けて、選んだ素材だけ左右へ、残りは正面へ。置いてからクリックで素材を選ぶ',
  overflow: '先が詰まった物を倉庫へ戻す。混ぜたベルトが、余った物で止まらない',
};
// 範囲を出す物の説明。熱と冷気は、何マスで何が変わるかを中身（fieldRules）から書く
function fieldText(field) {
  if (field === 'mana') return '燃料を燃やして魔力の範囲を作る';
  const by = {};
  for (const f of content.fieldRules) if (f.field === field && known(f.from)) (by[tiles(f)] ||= []).push(`${itemName(f.from)}→${itemName(f.to)}`);
  const rules = Object.entries(by).map(([n, l]) => `${n}マスで ${l.join('、')}`).join('。');
  return `周りに${FIELD_NAME[field]}の範囲を作る${rules ? `。${rules}` : ''}${field === 'cold' ? '。熱と重なったマスは打ち消し合う' : ''}`;
}
// inDistrict：区画の中で見る説明か（レシピと、その区画で魔力が要るかを入れる）。図鑑では false
function buildingNote(id, inDistrict = true) {
  const b = buildings[id];
  const notes = [TOOL_NOTE[id]];
  if (b.recipes && inDistrict) notes.push(recipesFor(game, id).map((r) => recipeText(r)).join(' ／ '));
  if (b.field) notes.push(fieldText(b.field));
  if (b.field === 'mana') notes.push(`燃料を毎分${b.fuelPerMin}燃やし、範囲の魔力が要る機械${b.powers}台まで動かす`);
  if (b.synergy) notes.push('辺で接する同じ機械1台ごとに25%速い（2台まで）');
  if (b.shake) notes.push(`揺れる（周り${SHAKE_RADIUS}マスのからくり台は止まる）`);
  if (b.fragile) notes.push(`揺れる機械から${SHAKE_RADIUS}マス以内だと止まる`);
  if (b.mana && (inDistrict ? def.leyline === false : true)) notes.push(inDistrict ? '魔力が要る' : '地脈のない区画では魔力が要る');
  if (buildings[id].recipes && recipesFor(game, id).length > 1) notes.push('置いたあとクリックでレシピを選ぶ');
  return notes.filter(Boolean).join('。');
}
// 置く物の種類（タブ）。1〜9 は今のタブの中で選ぶ、Tab で切り替える
// 作る機械は、はじめのレシピでできる物の系統（機工／炉と霜）で分ける
const machineSys = (b) => items[Object.keys(content.recipes[b.recipes[0]].out)[0]].sys;
const TABS = [
  { id: 'move', name: '運ぶ', note: 'ベルト・分岐など、物を運ぶ道具', has: (b) => b.kind !== 'machine' && b.kind !== 'emitter' },
  { id: 'kiko', name: '機工', note: '木と金属を組む機械（製材機・組立台・プレス機・旋盤など）', has: (b) => b.kind === 'machine' && machineSys(b) === '機工' },
  { id: 'ro', name: '炉と霜', note: '砕く・型に流す・混ぜる・磨く機械（粉砕機・鋳型台・調合台・研磨機など）', has: (b) => b.kind === 'machine' && machineSys(b) !== '機工' },
  { id: 'field', name: '範囲', note: '熱・冷気・魔力の範囲を出す物（竜炉・霜の柱・魔力炉）', has: (b) => b.kind === 'emitter' },
];
const inTab = (tab) => placeable().filter((id) => TABS.find((g) => g.id === tab).has(buildings[id]));
const tabsShown = () => TABS.filter((g) => inTab(g.id).length);
function switchTab(stepN) {
  const s = tabsShown();
  const k = s.findIndex((g) => g.id === ui.tab);
  ui.tab = s[(k + stepN + s.length) % s.length].id;
  renderPalette();
}

// 置く物の2行目：何を作るか（材料 → できる物の絵）
const TOOL_SHORT = { belt: 'ドラッグで引く', splitter: '正面・左・右へ順に出す', under: '4マスまで下を通す', sorter: '選んだ素材を左右へ', overflow: '詰まった物を倉庫へ戻す' };
const FIELD_NAME = { heat: '熱', cold: '冷気', mana: '魔力' };
function makesHtml(id) {
  const b = buildings[id];
  const icons = (o) => Object.entries(o).map(([k, n]) => `${dot(k)}${n > 1 ? `<sub>${n}</sub>` : ''}`).join('');
  if (b.kind === 'machine') {
    const rs = recipesFor(game, id).map((r) => content.recipes[r]);
    if (rs.length === 1) return `${icons(rs[0].in)}→${icons(rs[0].out)}${Object.keys(rs[0].out).map(itemName).join('')}`;
    const n = rs.reduce((s, r) => s + Object.keys(r.in).length + Object.keys(r.out).length, 0);
    if (n <= 5) return rs.map((r) => `${icons(r.in)}→${icons(r.out)}`).join('<i>／</i>');
    return `→${[...new Set(rs.flatMap((r) => Object.keys(r.out)))].map(dot).join('')}<i>から選ぶ</i>`;
  }
  if (b.kind === 'emitter') return b.fuelPerMin ? `${FIELD_NAME[b.field]}の範囲・${dot('fuel')}燃料を燃やす` : `${FIELD_NAME[b.field]}の範囲（周り${b.radius}マス）`;
  return TOOL_SHORT[id] || '';
}

function renderPalette() {
  const shown = tabsShown();
  if (!shown.some((g) => g.id === ui.tab)) ui.tab = shown[0]?.id ?? 'move';
  $('palette-tabs').replaceChildren(...shown.map((g) => {
    const el = document.createElement('button');
    el.textContent = g.name;
    el.title = `${g.note}（Tab で切り替え）`;
    el.className = g.id === ui.tab ? 'on' : '';
    if (ui.tool && g.id !== ui.tab && g.has(buildings[ui.tool])) el.classList.add('holding'); // 持っている物は別のタブ
    el.onclick = () => { ui.tab = g.id; renderPalette(); };
    return el;
  }));
  $('palette').replaceChildren(...inTab(ui.tab).map((id, i) => {
    const b = buildings[id];
    const el = document.createElement('button');
    el.title = buildingNote(id);
    const tags = [b.kind === 'under' ? '入口と出口' : `${b.w}×${b.h}`];
    if (b.mana && def.leyline === false) tags.push('魔力');
    if (b.shake) tags.push('揺れる');
    if (b.synergy) tags.push('相乗');
    if (def.limits[id] != null) tags.push(`${countOf(id)}/${def.limits[id]}台`);
    el.innerHTML = `<span class="pk">${i + 1}</span><span class="pn">${b.name}</span><small>${tags.join('・')}</small><span class="mk">${makesHtml(id)}</span>`;
    el.className = ui.tool === id ? 'on' : '';
    el.disabled = overLimit(id);
    el.onclick = () => { ui.tool = ui.tool === id ? null : id; renderPalette(); };
    return el;
  }));
  paintIcons();
}

function recipeText(id) {
  const r = content.recipes[id];
  const io = (o) => Object.entries(o).map(([k, n]) => `${itemName(k)}${n > 1 ? n : ''}`).join('＋');
  return `${io(r.in)} → ${io(r.out)}`;
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
  const back = backRate(world);
  if (back) rows.push(`<div class="row sub"><span>あふれ口から倉庫へ戻した</span><span>${back}</span></div>`);
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
    if (ev.type === 'goal') showGoal(ev.request.goal, ev.request.reward);
    if (ev.type === 'cleared') toast(`${d.name}：瓦礫を片づけた。置ける場所が広がった`);
    persist();
    if (ui.screen === 'district') { renderPalette(); renderRequests(); renderRubble(); }
    if (ui.screen === 'map') renderMap();
  }
}

function showGoal(goal, reward) {
  $('goal-title').textContent = `大目標「${goal.title}」`;
  $('goal-story').textContent = goal.story;
  $('goal-reward').textContent = reward.includes('次の区画') ? reward.replace(/^.*?、/, '') : '';
  $('goal').classList.add('show');
}
$('goal-close').onclick = () => $('goal').classList.remove('show');

// ---- レシピ・選り分けの素材を選ぶ小さな窓 ----
let picking = null;
function closePicker() { picking = null; $('picker').classList.remove('show'); }
function openPicker(e, ev) {
  const box = $('picker');
  let html = '';
  if (e.kind === 'sorter') {
    const known = Object.keys(items).filter((t) => game.state.seen?.[t] || game.state.made?.[t]);
    html = '<div class="pk-t">左右へ出す素材を選ぶ</div><div class="pk-items">'
      + known.map((t) => `<button data-filter="${t}" class="${e.filter === t ? 'on' : ''}" title="${itemName(t)}">${dot(t)}${itemName(t)}</button>`).join('')
      + `</div><button data-filter="" class="${e.filter ? '' : 'on'}">選ばない（全部正面へ）</button>`;
  } else {
    html = `<div class="pk-t">${buildings[e.id].name}のレシピ</div>`
      + recipesFor(game, e.id).map((r) => {
        const rr = content.recipes[r];
        return `<button data-recipe="${r}" class="${e.recipe === r ? 'on' : ''}">${recipeText(r)}<small>　毎分${(600 / rr.ticks) * Object.values(rr.out)[0]}${rr.alt ? '・別レシピ' : ''}</small></button>`;
      }).join('');
  }
  box.innerHTML = html;
  box.style.left = `${Math.min(ev.clientX + 8, window.innerWidth - 280)}px`;
  box.style.top = `${Math.min(ev.clientY + 8, window.innerHeight - 260)}px`;
  box.classList.add('show');
  picking = e;
  paintIcons();
  for (const b of box.querySelectorAll('[data-filter]')) {
    b.onclick = () => { if (picking) { picking.filter = b.dataset.filter || null; ui.filter = picking.filter; changed(); } closePicker(); };
  }
  for (const b of box.querySelectorAll('[data-recipe]')) {
    b.onclick = () => {
      if (picking && picking.recipe !== b.dataset.recipe) { setRecipe(world, picking, b.dataset.recipe); ui.recipe[picking.id] = b.dataset.recipe; changed(); }
      closePicker();
    };
  }
}
const choosable = (e) => e && !e.fixed && (e.kind === 'sorter' || (e.kind === 'machine' && recipesFor(game, e.id).length > 1));
window.addEventListener('mousedown', (ev) => { if (picking && !$('picker').contains(ev.target)) closePicker(); }, true);

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

// 下をくぐるベルトを置くと、入口か出口か：後ろ（UNDER_GAP+1 マス以内）に出口のない同じ向きの入口があれば出口
function underRole(x, y, dir) {
  if (world.dirty) rebuild(world);
  for (let k = 1; k <= UNDER_GAP + 1; k++) {
    const t = entAt(world, x - DX[dir] * k, y - DY[dir] * k);
    if (t && t.kind === 'under' && t.dir === dir) return t.role === 'in' && !t.partner ? 'out' : 'in';
  }
  return 'in';
}

canvas.addEventListener('contextmenu', (ev) => ev.preventDefault());
canvas.addEventListener('mousedown', (ev) => {
  const t = tileAt(ev);
  if (ev.button === 2) {
    const e = entAt(world, t.x, t.y);
    if (e && !e.fixed) { removeAt(t); drag = { erase: true }; }
    else if (ui.tool) { ui.tool = null; renderPalette(); } else drag = { erase: true };
    return;
  }
  if (ev.button !== 0) return;
  // 何も持っていないか、持っている物と同じ設備をクリックしたら、レシピ（選り分けは素材）を選ぶ
  const here = entAt(world, t.x, t.y);
  if (!ui.tool || (here && here.id === ui.tool && ui.tool !== 'belt')) {
    if (choosable(here)) openPicker(here, ev);
    return;
  }
  if (ui.tool === 'belt') {
    drag = { x: t.x, y: t.y };
    putBelt(t.x, t.y, ui.dir);
    changed();
  } else if (!overLimit(ui.tool)) {
    const props = {};
    if (ui.tool === 'under') props.role = underRole(t.x, t.y, ui.dir);
    if (ui.tool === 'sorter') props.filter = ui.filter;
    if (ui.recipe[ui.tool] && recipesFor(game, ui.tool).includes(ui.recipe[ui.tool])) props.recipe = ui.recipe[ui.tool];
    const e = place(world, ui.tool, t.x, t.y, ui.dir, props);
    if (!e) return;
    changed();
    if (e.kind === 'sorter' && !e.filter) openPicker(e, ev); // 置いたらすぐ素材を選ぶ
    else if (choosable(e) && !ui.recipe[e.id]) { ui.recipe[e.id] = e.recipe; openPicker(e, ev); } // レシピが選べる機械は、はじめて置いたときに窓を出す
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
  else if (ev.key === 'q' || ev.key === 'Q' || ev.key === 'Escape') { closePicker(); ui.tool = null; renderPalette(); }
  else if (ev.key === 'Delete' && ui.hover) removeAt(ui.hover);
  else if (ev.key === 'Tab') { ev.preventDefault(); switchTab(ev.shiftKey ? -1 : 1); }
  else if (/^[1-9]$/.test(ev.key)) {
    const id = inTab(ui.tab)[Number(ev.key) - 1];
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

const STATUS = {
  working: '動いている', waiting: '材料待ち', blocked: '出口が詰まっている', 'no-field': '範囲の外', 'no-recipe': 'レシピなし',
  'no-mana': '魔力炉の範囲の外なので止まっている（機械の全部のマスを紫の点の中に入れる）',
  'no-fuel': '魔力炉に燃料がないので止まっている（燃料をベルトで魔力炉へ運ぶ）',
  shaken: `揺れの範囲に入っているので止まっている（揺れる機械から${SHAKE_RADIUS}マスより離す）`,
};
function emitterInfo(e) {
  const b = buildings[e.id];
  if (b.field !== 'mana') {
    let s = `：${fieldText(b.field)}`;
    if (e.needsMana) s += e.on ? '｜魔力が届いている' : `｜${STATUS[e.covered ? 'no-fuel' : 'no-mana']}`;
    return s;
  }
  if (world.leyline) return '：この区画は地脈があるので、魔力は要らない';
  const n = e.covers?.length ?? 0;
  return `：燃料を毎分${b.fuelPerMin}燃やし、範囲の魔力が要る機械${b.powers}台まで動かす｜燃料 ${e.fuel}/${FUEL_CAP}・${e.burning ? '燃えている' : e.fuel > 0 ? '待っている（範囲に魔力の要る機械がない）' : '燃料がない'}｜範囲の機械 ${n}台${n > b.powers ? `（多いので全部 ${b.powers}/${n} の速さ）` : ''}`;
}
function underInfo(e) {
  const side = e.role === 'in' ? '（入口）' : '（出口）';
  if (e.partner) return `${side}：間の${Math.abs(e.partner.x - e.x) + Math.abs(e.partner.y - e.y) - 1}マスを下でつなぐ。くぐっている間は範囲が効かない`;
  return e.role === 'in' ? `${side}：出口がない。前へ${UNDER_GAP + 1}マス以内に、同じ向きで出口を置く` : `${side}：入口がない`;
}
function updateInfo() {
  const t = ui.hover;
  const e = t && entAt(world, t.x, t.y);
  let s = '', name = '';
  if (e) {
    name = buildings[e.id].name;
    if (e.kind === 'machine') {
      const r = content.recipes[e.recipe];
      const io = (o) => Object.entries(o).map(([k, n]) => `${itemName(k)}${n > 1 ? n : ''}`).join('＋');
      s += `：${io(r.in)} → ${io(r.out)}（毎分${(600 / r.ticks) * Object.values(r.out)[0]}個）｜${STATUS[e.status]}`;
      if (e.slow && e.status === 'working') s += `（魔力不足で ${e.pn}/${e.pd} の速さ）`;
      if (e.syn) s += `｜相乗 +${e.syn * 25}%（隣の${buildings[e.id].name}）`;
      else if (buildings[e.id].synergy) s += `｜同じ${buildings[e.id].name}と辺で接すると速くなる`;
      if (buildings[e.id].shake) s += '｜揺れる';
      if (choosable(e)) s += '｜クリックでレシピを選ぶ';
    } else if (e.kind === 'source' && e.extra) s += `：${itemName(e.item)}（前の区画から）と${itemName(e.extra)}が交互に出る`;
    else if (e.kind === 'source') s += e.imported ? `：${itemName(e.item)}（前の区画から。倉庫に入る量まで）` : `：${itemName(e.item)}（毎分120個まで）`;
    else if (e.kind === 'sorter') s += `：${e.filter ? `${itemName(e.filter)}だけ左右へ、残りは正面へ` : 'まだ素材を選んでいない（全部正面へ）'}｜クリックで素材を選ぶ`;
    else if (e.kind === 'overflow') s += '：先が詰まった物を倉庫へ戻す（余った物で止まらない）';
    else if (e.kind === 'emitter') s += emitterInfo(e);
    else if (e.kind === 'under') s += underInfo(e);
    else if (e.item) s += `：${itemName(e.item.t)}`;
  } else if (t && world.blocked[t.y * world.w + t.x] === 2) { name = '瓦礫'; s = '：右の「瓦礫」から片づけると置けるようになる'; }
  const html = name ? `<b>${name}</b>${s}` : '';
  if (html !== lastInfo) { $('info').innerHTML = html; lastInfo = html; }
}
let lastInfo = null;

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
      showShake: world.ents.some((e) => buildings[e.id].fragile) || !!(ui.tool && (buildings[ui.tool].fragile || buildings[ui.tool].shake)),
      underRole: ui.tool === 'under' && ui.hover ? underRole(ui.hover.x, ui.hover.y, ui.dir) : null,
      portLabel: () => '受取',
    });
    updateInfo();
  }
  requestAnimationFrame(frame);
}

route();
requestAnimationFrame(frame);

// 調べるとき用（コンソールから見る。プレビューが隠れて止まるときは advance で進める）
window.__aa = { get game() { return game; }, ui, updateInfo, advance(n) { for (let i = 0; i < n; i++) tickOnce(); } };
