// 画面：町の地図・区画・図鑑。ゲームの中身は core/game.js。
import mainContent, { trialDistricts } from '../data/content.js';
import {
  createGame, step as stepGame, layoutChanged, resetDistrict, unlocked, perMin,
  districtDef, save, recipesFor, goals, clearedBy, placeableIn,
  setLayout, pasteCheck, pasteInto, districtBlueprint, replaceWithBlueprint,
} from '../core/game.js';
import { copyArea, rotate as rotateBp, encode, decode } from '../core/blueprint.js';
import {
  place, remove, entAt, rate, rebuild, setRecipe, backRate, TPS, DX, DY, UNDER_GAP, FUEL_CAP, SHAKE_RADIUS, BELT_TICKS,
} from '../core/sim.js';
import { draw, CELL } from './draw.js';
import { drawItem } from './sprites.js';
import { drawTown, townHit, TOWN_W, TOWN_H } from './town.js';

const $ = (id) => document.getElementById(id);
// 試作モード（URL に ?trial）：第2部の新しい仕組みを試す区画だけを、本編とは別のセーブで遊ぶ
const TRIAL = new URLSearchParams(location.search).has('trial');
const content = TRIAL ? { ...mainContent, districts: trialDistricts, upcoming: [] } : mainContent;
const SAVE_KEY = TRIAL ? 'aether-atelier-trial' : 'aether-atelier-v1';
const { items, buildings } = content;
const itemName = (t) => items[t]?.name ?? t;
const dot = (t) => `<canvas class="ico" data-item="${t}" width="24" height="24"></canvas>`;

let saved = null;
try { saved = JSON.parse(localStorage.getItem(SAVE_KEY)); } catch { saved = null; }
if (TRIAL && !saved) saved = { v: 1, open: trialDistricts.map((d) => d.id), done: {}, cleared: {}, made: {}, layouts: {} };
let game = createGame(content, saved);
const persist = () => {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(save(game))); } catch { /* 保存できなくても遊べる */ }
};

const ui = { screen: 'map', district: null, tool: null, tab: 'move', dir: 0, hover: null, alpha: 0, paused: false, speed: 1, recipe: {}, filter: null, book: 'items',
  sel: null, selecting: false, clip: null, pasting: false, pasteState: null };
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
// 区画は開く順に並べる（地図の絵も、カードも）
const ORDER = [...content.districts, ...content.upcoming].map((d) => d.id);
let townHover = null;
function districtState(id) {
  const def = districtDef(game, id);
  if (!def) return 'soon';
  if (!game.state.open.includes(id)) return 'locked';
  return (game.state.done[id] || 0) >= def.requests.length ? 'done' : 'open';
}
function renderMap() {
  const grid = $('map-grid');
  grid.replaceChildren();
  for (const id of ORDER) {
    const def = districtDef(game, id) || content.upcoming.find((u) => u.id === id);
    if (!def) continue;
    const st = districtState(id);
    if (!TRIAL && id === 'd0') { // 第1部の始まり
      const head = document.createElement('p');
      head.className = 'hint later part';
      head.textContent = '第1部：機工と炉と霜（大目標「時計塔が動く」「町に灯りがつく」）';
      grid.append(head);
    }
    if (!TRIAL && id === 'd16') { // おまけ
      const head = document.createElement('p');
      head.className = 'hint later part';
      head.textContent = 'おまけ：1枚の工房（大目標「飛空艇が飛ぶ」で開く。原料の口を自由に置いて、1枚の盤面で飛空艇まで）';
      grid.append(head);
    }
    if (!TRIAL && id === 'd8') { // 第2部の始まり
      const head = document.createElement('p');
      head.className = 'hint later part';
      head.textContent = '第2部：エーテル・育てる・飛空艇（区7の大目標「町に灯りがつく」で開く。大目標「浮き橋がかかる」「温室と市場」「飛空艇が飛ぶ」）';
      grid.append(head);
    }
    const card = document.createElement('div');
    card.className = `card ${st}`;
    let body = '';
    if (st === 'soon') body = '<p class="sub">準備中</p>';
    else if (st === 'locked') body = '<p class="sub">まだ開いていない</p>';
    else {
      const n = game.state.done[id] || 0;
      body = `<p class="sub">${def.sys}・${st === 'done' ? '依頼をすべて達成' : `依頼 ${n}/${def.requests.length}`}</p><canvas class="mini" data-mini="${id}"></canvas><div class="exports" data-exports="${id}"></div>`;
    }
    card.innerHTML = `<b>${def.name}</b>${body}`;
    if (st === 'open' || st === 'done') { card.onclick = () => { location.hash = `#/d/${id}`; }; card.classList.add('click'); }
    grid.append(card);
  }
  if (TRIAL) { // 試作モードの中だけ、本編へ戻る道を出す（本編の地図には試作モードへの道を出さない。URL に ?trial で開ける）
    const later = document.createElement('p');
    later.className = 'hint later';
    later.innerHTML = '試作モード：第2部の新しい仕組み（副産物・時間で変わる・光の範囲・増える）を1つずつ試す区画です。本編のセーブとは別です。<a href="./">本編へ戻る</a>';
    grid.append(later);
  }
  updateMap();
}

// 町の絵：開いた区画・達成した区画・大目標（時計塔の針、街灯と灯台）
function paintTown() {
  const c = $('town');
  if (TRIAL) { c.style.display = 'none'; return; }
  const dpr = window.devicePixelRatio || 1;
  if (c.width !== TOWN_W * dpr) { c.width = TOWN_W * dpr; c.height = TOWN_H * dpr; }
  const ctx = c.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const gl = Object.fromEntries(goals(game).map((g) => [g.id, g]));
  drawTown(ctx, {
    districts: content.districts,
    open: game.state.open,
    done: ORDER.filter((id) => districtState(id) === 'done'),
    clock: !!(gl.clocktower?.reached && gl.clocktower.flowing),
    clockStopped: !!(gl.clocktower?.reached && !gl.clocktower.flowing),
    lights: !!(gl.lights?.reached && gl.lights.flowing),
    bridge: !!(gl.bridge?.reached && gl.bridge.flowing),
    greenhouse: !!(gl.greenhouse?.reached && gl.greenhouse.flowing),
    airship: !!(gl.airship?.reached && gl.airship.flowing),
    hover: townHover,
    t: game.tick,
  });
}
const townPos = (ev) => { const r = $('town').getBoundingClientRect(); return [(ev.clientX - r.left) * (TOWN_W / r.width), (ev.clientY - r.top) * (TOWN_H / r.height)]; };
$('town').addEventListener('mousemove', (ev) => {
  const id = townHit(...townPos(ev));
  const h = id && game.state.open.includes(id) ? id : null;
  $('town').style.cursor = h ? 'pointer' : 'default';
  $('town').title = h ? `${districtDef(game, h).name}へ入る` : '';
  if (h !== townHover) { townHover = h; paintTown(); }
});
$('town').addEventListener('mouseleave', () => { townHover = null; paintTown(); });
$('town').addEventListener('click', (ev) => {
  const id = townHit(...townPos(ev));
  if (id && game.state.open.includes(id)) location.hash = `#/d/${id}`;
});
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
  paintTown();
  for (const c of document.querySelectorAll('[data-mini]')) {
    const w = game.worlds[c.dataset.mini];
    const k = 0.2, dpr = window.devicePixelRatio || 1;
    if (c.width !== w.w * CELL * k * dpr) {
      c.width = w.w * CELL * k * dpr; c.height = w.h * CELL * k * dpr;
      c.style.width = `${w.w * CELL * k}px`; c.style.height = `${w.h * CELL * k}px`;
    }
    const ctx = c.getContext('2d');
    ctx.setTransform(k * dpr, 0, 0, k * dpr, 0, 0);
    draw(ctx, w, { alpha: 0, art: 'plain' });
  }
  for (const el of document.querySelectorAll('[data-exports]')) {
    const w = game.worlds[el.dataset.exports];
    const list = Object.keys(items).filter((t) => rate(w, t) > 0);
    el.innerHTML = list.length ? `出している：${list.map((t) => `${dot(t)}${itemName(t)} ${rate(w, t)}`).join('　')}` : '<span class="sub">まだ何も出していない</span>';
  }
  const rows = Object.keys(items).filter((t) => perMin(game, 'in', t) || perMin(game, 'out', t));
  $('warehouse').innerHTML = rows.length
    ? `<tr><th>素材</th><th>入る</th><th>使われる</th><th>余り</th></tr>${rows.map((t) => `<tr><td>${dot(t)}${itemName(t)}</td><td>${perMin(game, 'in', t)}</td><td>${perMin(game, 'out', t)}</td><td>${perMin(game, 'spare', t)}</td></tr>`).join('')}`
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

const FUEL_USE = { fuel: '魔力炉の燃料（1つで10秒燃える）', refuel: '魔力炉の燃料（燃料2つ分、20秒燃える）' };
function howMade(t) {
  if (items[t].sys === '倉庫') return ['倉庫から出てくる'];
  const list = allRecipes().filter(([, r]) => content.recipes[r].out[t]).map(([bid, r]) => {
    const others = Object.keys(content.recipes[r].out).filter((o) => o !== t);
    return `${buildings[bid].name}で ${ioIcons(content.recipes[r].in)} から${others.length ? `（${others.map((o) => `${dot(o)}${knownName(o)}`).join('・')}も一緒に出る）` : ''}`;
  });
  for (const f of content.fieldRules) if (f.to === t) list.push(`${dot(f.from)}${knownName(f.from)}が<b>${FIELD_NAME[f.field]}の中を${tiles(f)}マス</b>進む`);
  for (const d of content.decayRules || []) if (d.to === t) list.push(`${dot(d.from)}${knownName(d.from)}が<b>${d.ticks / TPS}秒</b>たつ（時間で変わる）`);
  return list;
}
function usesOf(t) {
  const list = [...new Set(allRecipes().filter(([, r]) => content.recipes[r].in[t])
    .map(([bid, r]) => `${buildings[bid].name}で ${Object.keys(content.recipes[r].out).map((o) => `${dot(o)}${knownName(o)}`).join('・')} に`))];
  if (FUEL_USE[t]) list.push(FUEL_USE[t]);
  for (const f of content.fieldRules) if (f.from === t) list.push(`<b>${FIELD_NAME[f.field]}の中を${tiles(f)}マス</b>進むと ${dot(f.to)}${knownName(f.to)} になる`);
  for (const d of content.decayRules || []) if (d.from === t) list.push(`<b>${d.ticks / TPS}秒</b>たつと ${dot(d.to)}${knownName(d.to)} になる（冷気の中では止まる）`);
  for (const d of content.districts) for (const r of d.requests) if (r.goal && r.targets[t]) list.push(`大目標「${r.goal.title}」（${d.name}）`);
  return list;
}
function bookItems() {
  // 本編では、まだ出会っていない第2部の素材は載せない
  return Object.entries(items).filter(([t, it]) => !it.part || TRIAL || known(t)).map(([t, it]) => {
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
  let html = `<section class="rule"><h3>熱・冷気・光で変わる物</h3>
    <p>熱・冷気・光は、ベルトの上を流れる物に効く。範囲の中にいた長さの合計で変わる（1マス進む長さ＝0.5秒を、1マスと数える）。</p>
    <ul><li>ベルトの上で止まっていても、範囲の中にいる間は数える（詰まると、思っていない物に変わることがある）</li>
    <li>範囲を出ても、それまでに数えた分は残る</li>
    <li>熱と冷気が重なったマスは打ち消し合い、どちらも効かない（灰色のマス）</li>
    <li>下をくぐるベルトの中では効かない</li></ul>
    <table class="rules"><tr><th>範囲</th><th>長さ</th><th>前</th><th></th><th>あと</th></tr>${content.fieldRules.filter((f) => !items[f.from].part || TRIAL || known(f.from)).map(row).join('')}</table>
    <p class="sub">熱は竜炉、冷気は霜の柱、光は灯り台が出す。どれも周り2マス。光は熱や冷気と重なっても打ち消し合わない。</p></section>`;
  const decays = (content.decayRules || []).filter((r) => TRIAL || known(r.from));
  if (decays.length) { // 時間で変わる物
    html += `<section class="rule"><h3>時間で変わる物</h3><p>ベルトの上で時間がたつと変わる。ベルトの上で待っていても数える。冷気の中では時間が止まる。素材の右上の輪が、残りの時間。</p><ul>${decays.map((r) => `<li>${dot(r.from)}${itemName(r.from)}は${r.ticks / TPS}秒で${dot(r.to)}${knownName(r.to)}になる</li>`).join('')}</ul></section>`;
  }
  if (has.has('manaFurnace')) {
    const needs = [...has].filter((id) => buildings[id].mana).map((id) => buildings[id].name).join('・');
    html += `<section class="rule"><h3>魔力</h3><ul>
      <li>地脈のない区画（区3から）では、${needs}は魔力が要る</li>
      ${has.has('refiner') || TRIAL ? '<li>精製燃料は、魔力炉で燃料2つ分燃える</li>' : ''}
      <li>魔力炉は燃料を毎分${buildings.manaFurnace.fuelPerMin}燃やし、周り${buildings.manaFurnace.radius}マス（紫の点）に魔力を出す。範囲の機械${buildings.manaFurnace.powers}台まで、ふつうの速さで動かす（多いと全部が遅くなる）</li>
      <li>機械の全部のマスが紫の点の中にあれば動く。いくつかの魔力炉の範囲を合わせてよい（からくり台は魔力炉2つで挟む）</li></ul></section>`;
  }
  if (has.has('lathe')) html += '<section class="rule"><h3>相乗</h3><ul><li>旋盤は、辺で接する旋盤1台ごとに25%速い（2台まで、最大50%）</li></ul></section>';
  const part2 = [];
  if (has.has('fastBelt')) part2.push('<li><b>速いベルト</b>：ふつうの2.5倍の速さ（1マス0.2秒）。時間で変わる素材を遠くへ運ぶときや、たくさん運ぶとき（毎分300個まで）に</li>');
  if (has.has('prioritySplitter')) part2.push('<li><b>優先分岐</b>：正面に入れられるときは必ず正面へ。正面が詰まっているときだけ左右へ。増やした苔を「育て床に戻すのが先、余りを納める」のように使う</li>');
  if (has.has('refiner')) part2.push('<li><b>副産物</b>：出す物が2つある機械は、正面から交互に出す。どちらかが先で詰まると、機械が止まる。選り分けやあふれ口でよける</li>');
  if (has.has('planter')) part2.push('<li><b>増える</b>：育て床は光る苔1を2にする。増えた苔の一部を育て床に戻すと、届く苔より多く納められる</li>');
  if (game.state.open.includes('d10') || TRIAL) part2.push('<li><b>水</b>：水のマスには何も置けない。下をくぐるベルトなら、水の下を4マスまで通せる</li>');
  if (game.state.open.includes('d12')) part2.push('<li><b>どの区画から受け取るか</b>：「区11から」のように書いた口は、その区画が納めた物だけを受け取る（自分の区画が納めた物が、倉庫を回って戻ってこない）</li>');
  if (has.has('shipyard')) part2.push('<li><b>大きな機械</b>：造船台は4×4。魔力炉1つの範囲には入りきらないので、2つの範囲を合わせる</li>');
  if (part2.length) html += `<section class="rule"><h3>第2部の仕組み</h3><ul>${part2.join('')}</ul></section>`;
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
  const k = def.scale || 1; // 大きい区画は縮めて見せる（1枚の工房）
  canvas.width = def.w * CELL * k * dpr;
  canvas.height = def.h * CELL * k * dpr;
  canvas.style.width = `${def.w * CELL * k}px`;
  canvas.style.height = `${def.h * CELL * k}px`;
  canvas.getContext('2d').setTransform(dpr * k, 0, 0, dpr * k, 0, 0);
  // 真ん中の列は盤面の幅に固定する（説明文の長さで列の幅が変わると、盤面がずれてカーソルの下のマスが変わる）
  $('center').style.width = `${def.w * CELL * k + 2}px`;
  $('intro').textContent = def.intro;
  ui.pasting = false; ui.selecting = false; clearSel(); holding = false;
  lastSnap = snap();
  renderPalette(); renderRequests(); renderRubble(); renderEditBar();
}

const countOf = (id) => world.ents.filter((e) => e.id === id).length;
const overLimit = (id) => def.limits[id] != null && countOf(id) >= def.limits[id];
const placeable = () => (def ? placeableIn(game, ui.district) : unlocked(game).filter((id) => buildings[id].kind !== 'source' && buildings[id].kind !== 'sink'));

function changed() {
  layoutChanged(game, ui.district);
  persist();
  renderPalette();
  if (!holding) commit(); // ドラッグ中は、マウスを離したときにまとめて1回分として覚える
}

// ---- 元に戻す・やり直す ----
// 置き方が変わるたびに、前の置き方（燃料や運んでいる物は含めない）を区画ごとに覚える
const UNDO_MAX = 80;
const undoStacks = {};
const stacks = () => (undoStacks[ui.district] ||= { undo: [], redo: [] });
let lastSnap = null; // 最後に覚えた置き方
let holding = false; // マウスを押している間
function snap() {
  return JSON.stringify(world.ents.filter((e) => !e.fixed).map((e) => {
    const o = { id: e.id, x: e.x, y: e.y, dir: e.dir };
    if (e.recipe) o.recipe = e.recipe;
    if (e.role) o.role = e.role;
    if (e.filter) o.filter = e.filter;
    return o;
  }).sort((a, b) => a.y - b.y || a.x - b.x));
}
function pushUndo(s) {
  const st = stacks();
  st.undo.push(s);
  if (st.undo.length > UNDO_MAX) st.undo.shift();
  st.redo.length = 0;
}
function commit() {
  const now = snap();
  if (lastSnap !== null && now !== lastSnap) pushUndo(lastSnap);
  lastSnap = now;
  renderEditBar();
}
function restore(s) {
  setLayout(game, ui.district, JSON.parse(s)); // 同じ物は置き直さない（燃料や運んでいる物はそのまま）
  lastSnap = snap();
  persist(); renderPalette(); renderEditBar();
}
function undo() {
  const st = stacks();
  if (!st.undo.length) return;
  st.redo.push(snap());
  restore(st.undo.pop());
}
function redo() {
  const st = stacks();
  if (!st.redo.length) return;
  st.undo.push(snap());
  restore(st.redo.pop());
}

const TOOL_NOTE = {
  belt: '物を運ぶ。ドラッグで引く。置いたベルトの上に引き直すと向きが変わる',
  splitter: '後ろから受けて、正面・左・右に順に出す',
  under: '入口を置き、同じ向きで前に出口を置く（間は4マスまで）。くぐっている間は範囲が効かない',
  sorter: '後ろから受けて、選んだ素材だけ左右へ、残りは正面へ。置いてからクリックで素材を選ぶ',
  overflow: '先が詰まった物を倉庫へ戻す。混ぜたベルトが、余った物で止まらない',
  port: '原料（木材・鉱石・砂・エーテル水・胞子）を毎分120個まで出す。置いてからクリックで原料を選ぶ。1枚の工房だけで置ける',
  fastBelt: '物を運ぶ。ふつうのベルトの2.5倍の速さ（1マス0.2秒、毎分300個まで）。ドラッグで引く。ふつうのベルトの上に引くと置き換わる',
  prioritySplitter: '後ろから受けて、正面に入れられるときは正面へ。正面が詰まっているときだけ左右へ順に出す',
};
// 機械の説明に足すこと（第2部の仕組み）
const MACHINE_NOTE = {
  refiner: '出す物が2つ（精製エーテルと澱）。正面から交互に出し、片方が詰まると止まる',
  planter: '光る苔1から2に増える（差し引き1台で毎分15）。増えた苔の一部を戻して使う',
  shipyard: '4×4の大きな機械。魔力炉1つの範囲には入りきらない（2つで挟む）',
};
// 範囲を出す物の説明。熱と冷気は、何マスで何が変わるかを中身（fieldRules）から書く
function fieldText(field) {
  if (field === 'mana') return '燃料を燃やして魔力の範囲を作る';
  const by = {};
  for (const f of content.fieldRules) if (f.field === field && known(f.from)) (by[tiles(f)] ||= []).push(`${itemName(f.from)}→${itemName(f.to)}`);
  const rules = Object.entries(by).map(([n, l]) => `${n}マスで ${l.join('、')}`).join('。');
  return `周りに${FIELD_NAME[field]}の範囲を作る${rules ? `。${rules}` : ''}${field === 'cold' ? '。熱と重なったマスは打ち消し合う。時間で変わる素材は、冷気の中では時間が止まる' : ''}${field === 'light' ? '。熱や冷気と重なっても打ち消し合わない' : ''}`;
}
// inDistrict：区画の中で見る説明か（レシピと、その区画で魔力が要るかを入れる）。図鑑では false
function buildingNote(id, inDistrict = true) {
  const b = buildings[id];
  const notes = [TOOL_NOTE[id], MACHINE_NOTE[id]];
  if (b.recipes && inDistrict) notes.push(recipesFor(game, id).map((r) => recipeText(r)).join(' ／ '));
  if (b.field) notes.push(fieldText(b.field));
  if (b.field === 'mana') notes.push(`燃料を毎分${b.fuelPerMin}燃やし、範囲の魔力が要る機械${b.powers}台まで動かす${items.refuel && (TRIAL || known('refuel')) ? '。精製燃料は燃料2つ分' : ''}`);
  if (b.synergy) notes.push('辺で接する同じ機械1台ごとに25%速い（2台まで）');
  if (b.shake) notes.push(`揺れる（周り${SHAKE_RADIUS}マスのからくり台は止まる）`);
  if (b.fragile) notes.push(`揺れる機械から${SHAKE_RADIUS}マス以内だと止まる`);
  if (b.mana && (inDistrict ? def.leyline === false : true)) notes.push(inDistrict ? '魔力が要る' : '地脈のない区画では魔力が要る');
  if (buildings[id].recipes && recipesFor(game, id).length > 1) notes.push('置いたあとクリックでレシピを選ぶ');
  return notes.filter(Boolean).join('。');
}
// 置く物の種類（タブ）。1〜9 は今のタブの中で選ぶ、Tab で切り替える
// 何をする物かで4つに分ける（どのタブも9個まで＝1〜9で選べる）
const MAKE_TAB = { // 作る機械のうち「組立」に入る物。ほかの機械は「加工」
  assembler: 1, press: 1, lathe: 1, winder: 1, workbench: 1, spinner: 1, loom: 1, shipyard: 1,
};
const TABS = [
  { id: 'move', name: '運ぶ', note: 'ベルト・分岐・下をくぐるベルトなど、物を運ぶ道具', has: (b) => b.kind !== 'machine' && b.kind !== 'emitter' },
  { id: 'proc', name: '加工', note: '原料を加工する機械（製材機・粉砕機・鋳型台・調合台・蒸留器・研磨機・精製器・浸し槽・育て床）', has: (b) => b.kind === 'machine' && !MAKE_TAB[b.id] },
  { id: 'make', name: '組立', note: '部品を組み立てる・紡ぐ・織る機械（組立台・プレス機・旋盤・巻き機・からくり台・紡ぎ機・織機・造船台）', has: (b) => b.kind === 'machine' && !!MAKE_TAB[b.id] },
  { id: 'field', name: '範囲', note: '熱・冷気・魔力・光の範囲を出す物（竜炉・霜の柱・魔力炉・灯り台）', has: (b) => b.kind === 'emitter' },
];
const inTab = (tab) => placeable().filter((id) => TABS.find((g) => g.id === tab).has({ ...buildings[id], id }));
const tabsShown = () => TABS.filter((g) => inTab(g.id).length);
function switchTab(stepN) {
  const s = tabsShown();
  const k = s.findIndex((g) => g.id === ui.tab);
  ui.tab = s[(k + stepN + s.length) % s.length].id;
  renderPalette();
}

// 置く物の2行目：何を作るか（材料 → できる物の絵）
const TOOL_SHORT = { port: '原料を出す（クリックで選ぶ）', belt: 'ドラッグで引く', splitter: '正面・左・右へ順に出す', under: '4マスまで下を通す', sorter: '選んだ素材を左右へ', overflow: '詰まった物を倉庫へ戻す', fastBelt: '2.5倍の速さ。ドラッグで引く', prioritySplitter: '正面が先、詰まったら左右へ' };
const FIELD_NAME = { heat: '熱', cold: '冷気', mana: '魔力', light: '光' };
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

// 操作の説明：開け閉めを覚える
try { if (localStorage.getItem('aether-atelier-help') === 'closed') $('help').open = false; } catch {}
$('help').addEventListener('toggle', () => { try { localStorage.setItem('aether-atelier-help', $('help').open ? 'open' : 'closed'); } catch {} });

function renderPalette() {
  const shown = tabsShown();
  if (!shown.some((g) => g.id === ui.tab)) ui.tab = shown[0]?.id ?? 'move';
  $('palette-tabs').replaceChildren(...shown.map((g) => {
    const el = document.createElement('button');
    el.textContent = g.name;
    el.title = `${g.note}（Tab で切り替え）`;
    el.className = g.id === ui.tab ? 'on' : '';
    if (ui.tool && g.id !== ui.tab && g.has({ ...buildings[ui.tool], id: ui.tool })) el.classList.add('holding'); // 持っている物は別のタブ
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
    el.onclick = () => { ui.tool = ui.tool === id ? null : id; dropEdit(); renderPalette(); };
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
    html += `<div class="rw">報酬：${rewardText(r)}</div>`;
    el.innerHTML = html;
    return el;
  }));
  updateDistrictPanels();
}

// 瓦礫の呼び方：「区1の瓦礫（左）」
const shortName = (id) => districtDef(game, id).name.split(' ')[0];
const patchSide = (patch) => patch.name ?? (Math.min(...patch.tiles.map(([x]) => x)) === 0 ? '左' : '右');
function rubbleName(district, patchId) {
  const patch = districtDef(game, district).rubble.find((p) => p.id === patchId);
  return `${shortName(district)}の瓦礫（${patchSide(patch)}）`;
}
// 報酬の文：書いてある報酬と、片づく瓦礫。skipGoal は大目標の窓用（大目標の名前を除く）
function rewardText(r, skipGoal = false) {
  const parts = [];
  if (r.reward && r.reward !== 'なし') parts.push(...r.reward.split('、').filter((p) => !(skipGoal && p.startsWith('大目標'))));
  for (const [d, p] of r.clears || []) parts.push(`${rubbleName(d, p)}が片づく`);
  return parts.join('、') || (skipGoal ? '' : 'なし');
}

function renderRubble() {
  const left = def.rubble.filter((r) => !(game.state.cleared[ui.district] || []).includes(r.id));
  if (!def.rubble.length) { $('rubble').innerHTML = '<p class="sub">この区画には瓦礫がない</p>'; return; }
  if (!left.length) { $('rubble').innerHTML = '<p class="sub">この区画の瓦礫はすべて片づいた</p>'; return; }
  $('rubble').innerHTML = left.map((r) => {
    const by = clearedBy(content, ui.district, r.id);
    const where = by ? `${districtDef(game, by.district).name}の依頼「${reqText(by.request)}」を達成すると片づく` : 'あとの区画で片づく';
    const notYet = by && !game.state.open.includes(by.district) ? '<span class="sub">（まだ開いていない区画）</span>' : '';
    return `<div class="req wait-no"><div class="t">${patchSide(r)}の${r.tiles.length}マス</div><div class="rw">${where}${notYet}</div></div>`;
  }).join('') + '<p class="hint">瓦礫は、この区画の物を使うあとの区画で依頼を達成すると、報酬で片づいて置ける場所になる。</p>';
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
  $('imports').innerHTML = ports.map((p) => (p.from
    ? `<div class="row"><span>${dot(p.item)}${itemName(p.item)}<small class="sub">　${districtDef(game, p.from).name.split(' ')[0]}から</small></span><span>${districtDef(game, p.from).name.split(' ')[0]}が納める ${game.worlds[p.from] ? rate(game.worlds[p.from], p.item) : 0}</span></div>`
    : `<div class="row"><span>${dot(p.item)}${itemName(p.item)}</span><span>倉庫に入る ${perMin(game, 'in', p.item)}</span></div>`)).join('')
    + (ports.length ? '<p class="hint">倉庫に入る量を、受け取る口で等分する。足りなければ前の区画を改善する。</p>' : '');
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
    // 片づいた瓦礫は、依頼達成の知らせの報酬に入っている（cleared は画面を描き直すだけ）
    if (ev.type === 'request') toast(`${d.name}：依頼達成！<br>報酬：${rewardText(ev.request)}${ev.request.clears?.length ? '<br>前の区画が広くなった' : ''}`);
    if (ev.type === 'goal') showGoal(ev.request);
    persist();
    if (ui.screen === 'district') { renderPalette(); renderRequests(); renderRubble(); }
    if (ui.screen === 'map') renderMap();
  }
}

function showGoal(r) {
  $('goal-title').textContent = `大目標「${r.goal.title}」`;
  $('goal-story').textContent = r.goal.story;
  $('goal-reward').textContent = rewardText(r, true);
  $('goal').classList.add('show');
}
$('goal-close').onclick = () => $('goal').classList.remove('show');

// ---- レシピ・選り分けの素材を選ぶ小さな窓 ----
let picking = null;
function closePicker() { picking = null; $('picker').classList.remove('show'); }
function openPicker(e, ev) {
  const box = $('picker');
  let html = '';
  if (e.kind === 'source') {
    html = '<div class="pk-t">倉庫から出す原料を選ぶ</div><div class="pk-items">'
      + content.RAW_ITEMS.map((t) => `<button data-item="${t}" class="${e.item === t ? 'on' : ''}" title="${itemName(t)}">${dot(t)}${itemName(t)}</button>`).join('')
      + '</div>';
  } else if (e.kind === 'sorter') {
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
  for (const b of box.querySelectorAll('[data-item]')) {
    b.onclick = () => { if (picking) { picking.item = b.dataset.item; ui.portItem = picking.item; world.dirty = true; changed(); } closePicker(); };
  }
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
const choosable = (e) => e && !e.fixed && (e.kind === 'sorter' || (e.kind === 'source' && buildings[e.id].free) || (e.kind === 'machine' && recipesFor(game, e.id).length > 1));
window.addEventListener('mousedown', (ev) => { if (picking && !$('picker').contains(ev.target)) closePicker(); }, true);

// ---- 操作 ----
function tileAt(ev) {
  const r = canvas.getBoundingClientRect();
  const k = def.scale || 1;
  return { x: Math.floor((ev.clientX - r.left) / (CELL * k)), y: Math.floor((ev.clientY - r.top) / (CELL * k)) };
}
function putBelt(x, y, d) {
  const id = buildings[ui.tool]?.kind === 'belt' ? ui.tool : 'belt';
  const e = entAt(world, x, y);
  if (e && e.kind === 'belt' && !e.fixed && e.id !== id) { remove(world, x, y); place(world, id, x, y, d); return; }
  if (e && e.kind === 'belt' && !e.fixed) { e.dir = d; world.dirty = true; return; }
  if (!e) place(world, id, x, y, d);
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

// ---- 範囲を選ぶ・図面を貼る・スポイト ----
// 範囲は Shift＋ドラッグか「範囲を選ぶ」で選ぶ。コピー・切り取りした図面は持ったまま何度でも貼れる（R で回す）
const selRect = (s) => ({ ax: Math.min(s.x0, s.x1), ay: Math.min(s.y0, s.y1), bx: Math.max(s.x0, s.x1), by: Math.max(s.y0, s.y1) });
const clampT = (t) => ({ x: Math.max(0, Math.min(world.w - 1, t.x)), y: Math.max(0, Math.min(world.h - 1, t.y)) });
// 範囲に少しでもかかっている物（消すとき）
function entsTouching(s) {
  const r = selRect(s);
  return world.ents.filter((e) => !e.fixed && e.x <= r.bx && e.x + e.w - 1 >= r.ax && e.y <= r.by && e.y + e.h - 1 >= r.ay);
}
function clearSel() { ui.sel = null; $('selmenu').classList.remove('show'); }
// 持っている物・図面・範囲選びをやめる
function dropEdit() { ui.pasting = false; ui.selecting = false; clearSel(); renderEditBar(); }

function copySel() {
  const r = selRect(ui.sel);
  const bp = copyArea(world, r.ax, r.ay, r.bx, r.by, { d: ui.district });
  clearSel();
  if (!bp) { toast('範囲の中に、まるごと入っている物がない'); renderEditBar(); return null; }
  ui.clip = bp;
  startPaste();
  return bp;
}
function cutSel() {
  const bp = copySel();
  if (!bp) return;
  for (const e of bp.ents) remove(world, bp.x + e.x, bp.y + e.y);
  changed();
}
function deleteSel() {
  const list = entsTouching(ui.sel);
  clearSel();
  for (const e of list) remove(world, e.x, e.y);
  if (list.length) changed();
  renderEditBar();
}
function openSelMenu(ev) {
  const r = selRect(ui.sel);
  const n = entsTouching(ui.sel).length;
  const box = $('selmenu');
  box.innerHTML = `<div class="pk-t">選んだ範囲（${r.bx - r.ax + 1}×${r.by - r.ay + 1}マス、${n}個）</div>
    <button data-sel="copy">コピー<small>C</small></button>
    <button data-sel="cut">切り取り<small>X</small></button>
    <button data-sel="del">消す<small>Delete</small></button>
    <button data-sel="text">図面の文字列にする</button>
    <button data-sel="cancel">やめる<small>Esc</small></button>`;
  box.style.left = `${Math.min(ev.clientX + 10, window.innerWidth - 200)}px`;
  box.style.top = `${Math.min(ev.clientY + 10, window.innerHeight - 230)}px`;
  box.classList.add('show');
  for (const b of box.querySelectorAll('[data-sel]')) {
    b.onclick = () => {
      const a = b.dataset.sel;
      if (a === 'copy') copySel();
      else if (a === 'cut') cutSel();
      else if (a === 'del') deleteSel();
      else if (a === 'text') { const bp = copySel(); if (bp) openBp(encode(bp), `選んだ範囲の図面（${bp.ents.length}個）。今は持っているので、クリックで貼れる`); }
      else { clearSel(); renderEditBar(); }
    };
  }
}

function startPaste() {
  if (!ui.clip) return;
  ui.pasting = true; ui.tool = null; ui.selecting = false;
  clearSel(); renderPalette(); renderEditBar();
}
// 図面はカーソルのマスを真ん中にして貼る
const pasteOrigin = () => (ui.hover && ui.clip
  ? { ox: ui.hover.x - Math.floor((ui.clip.w - 1) / 2), oy: ui.hover.y - Math.floor((ui.clip.h - 1) / 2) } : null);
function pasteHere() {
  const o = pasteOrigin();
  if (!o) return;
  const r = pasteCheck(game, ui.district, ui.clip, o.ox, o.oy);
  if (!r.ok) { toast(`貼れない：${r.reason}`); return; }
  pasteInto(game, ui.district, ui.clip, o.ox, o.oy);
  changed();
}

// スポイト：カーソルの下の物を、同じ向き・同じレシピで持つ
function pipette() {
  const e = ui.hover && entAt(world, ui.hover.x, ui.hover.y);
  if (!e || e.fixed || !placeable().includes(e.id)) return;
  ui.pasting = false; ui.selecting = false; clearSel();
  if (overLimit(e.id)) { toast(`${buildings[e.id].name}はこの区画に${def.limits[e.id]}台まで`); ui.tool = null; }
  else ui.tool = e.id;
  ui.dir = e.dir;
  if (e.recipe) ui.recipe[e.id] = e.recipe;
  if (e.kind === 'sorter') ui.filter = e.filter;
  if (e.kind === 'source') ui.portItem = e.item;
  const tab = TABS.find((g) => g.has(buildings[e.id]));
  if (tab) ui.tab = tab.id;
  renderPalette(); renderEditBar();
}

function renderEditBar() {
  if (!ui.district) return;
  const st = stacks();
  $('btn-select').classList.toggle('on', ui.selecting);
  $('btn-paste').classList.toggle('on', ui.pasting);
  $('btn-paste').disabled = !ui.clip;
  $('btn-undo').disabled = !st.undo.length;
  $('btn-redo').disabled = !st.redo.length;
  $('holding').textContent = ui.pasting ? '図面を持っている：クリックで貼る・R で回す・右クリックで手放す'
    : ui.selecting ? 'ドラッグで範囲を選ぶ（右クリックか Esc でやめる）' : '';
}
$('btn-select').onclick = () => {
  const on = !ui.selecting;
  dropEdit();
  ui.selecting = on;
  if (on) { ui.tool = null; renderPalette(); }
  renderEditBar();
};
$('btn-paste').onclick = () => { if (ui.pasting) dropEdit(); else startPaste(); };
$('btn-undo').onclick = undo;
$('btn-redo').onclick = redo;
$('btn-bp').onclick = () => openBp();

// ---- 図面の文字列 ----
const bpMsg = (s) => { $('bp-msg').textContent = s; };
function openBp(text = '', msg = '') {
  $('bp-text').value = text;
  bpMsg(msg);
  $('bp-clip').disabled = !ui.clip;
  $('bpbox').classList.add('show');
  if (text) $('bp-text').select();
}
function closeBp() { $('bpbox').classList.remove('show'); }
$('bp-district').onclick = () => {
  const bp = districtBlueprint(game, ui.district);
  if (!bp) { bpMsg('この区画には、まだ何も置いていない'); return; }
  $('bp-text').value = encode(bp);
  $('bp-text').select();
  bpMsg(`${def.name}の図面（${bp.ents.length}個）。この区画で読み込むと、配置をまるごと置き換えられる`);
};
$('bp-clip').onclick = () => {
  if (!ui.clip) return;
  $('bp-text').value = encode(ui.clip);
  $('bp-text').select();
  bpMsg(`持っている図面（${ui.clip.ents.length}個）`);
};
$('bp-copy').onclick = async () => {
  const t = $('bp-text').value.trim();
  if (!t) return;
  try { await navigator.clipboard.writeText(t); bpMsg('文字列をコピーした'); } catch { $('bp-text').select(); bpMsg('コピーできなかった。選んである文字列を Ctrl+C でコピーする'); }
};
$('bp-load').onclick = () => {
  const r = decode($('bp-text').value, content);
  if (r.error) { bpMsg(r.error); return; }
  const bp = r.bp;
  if (bp.full && bp.d === ui.district) {
    if (!confirm('この区画の配置を、図面でまるごと置き換えます。よいですか？（「元に戻す」で戻せる）')) return;
    const res = replaceWithBlueprint(game, ui.district, bp);
    if (!res.ok) { bpMsg(`置き換えられない：${res.reason}`); return; }
    changed(); closeBp(); toast('図面で区画を置き換えた');
    return;
  }
  ui.clip = bp; startPaste(); closeBp();
  toast(bp.full ? `${districtDef(game, bp.d)?.name ?? 'ほかの区画'}の図面を持った。クリックで貼る（R で回す）` : '図面を持った。クリックで貼る（R で回す）');
};
$('bp-close').onclick = closeBp;

// ---- マウス ----
canvas.addEventListener('contextmenu', (ev) => ev.preventDefault());
canvas.addEventListener('mousedown', (ev) => {
  const t = tileAt(ev);
  if (ev.button === 1) { ev.preventDefault(); pipette(); return; }
  if (ev.button === 2) {
    if (ui.pasting || ui.sel || ui.selecting) { dropEdit(); return; }
    holding = true;
    const e = entAt(world, t.x, t.y);
    if (e && !e.fixed) { removeAt(t); drag = { erase: true }; }
    else if (ui.tool) { ui.tool = null; renderPalette(); } else drag = { erase: true };
    return;
  }
  if (ev.button !== 0) return;
  if (ev.shiftKey || ui.selecting) { // 範囲を選び始める
    const c = clampT(t);
    ui.sel = { x0: c.x, y0: c.y, x1: c.x, y1: c.y, drag: true };
    $('selmenu').classList.remove('show');
    return;
  }
  if (ui.sel) { clearSel(); renderEditBar(); }
  if (ui.pasting) { pasteHere(); return; }
  holding = true;
  // 何も持っていないか、持っている物と同じ設備をクリックしたら、レシピ（選り分けは素材）を選ぶ
  const here = entAt(world, t.x, t.y);
  if (!ui.tool || (here && here.id === ui.tool && buildings[ui.tool].kind !== 'belt')) {
    if (choosable(here)) openPicker(here, ev);
    return;
  }
  if (buildings[ui.tool].kind === 'belt') {
    drag = { x: t.x, y: t.y };
    putBelt(t.x, t.y, ui.dir);
    changed();
  } else if (!overLimit(ui.tool)) {
    const props = {};
    if (ui.tool === 'under') props.role = underRole(t.x, t.y, ui.dir);
    if (ui.tool === 'sorter') props.filter = ui.filter;
    if (buildings[ui.tool].free) props.item = ui.portItem || 'wood';
    if (ui.recipe[ui.tool] && recipesFor(game, ui.tool).includes(ui.recipe[ui.tool])) props.recipe = ui.recipe[ui.tool];
    const e = place(world, ui.tool, t.x, t.y, ui.dir, props);
    if (!e) return;
    changed();
    if (e.kind === 'sorter' && !e.filter) openPicker(e, ev); // 置いたらすぐ素材を選ぶ
    else if (e.kind === 'source' && !ui.portItem) { ui.portItem = e.item; openPicker(e, ev); } // はじめての倉庫の口は、原料を選ぶ窓
    else if (choosable(e) && !ui.recipe[e.id]) { ui.recipe[e.id] = e.recipe; openPicker(e, ev); } // レシピが選べる機械は、はじめて置いたときに窓を出す
    if (overLimit(ui.tool)) { ui.tool = null; renderPalette(); }
  }
});
canvas.addEventListener('mousemove', (ev) => {
  const t = tileAt(ev);
  ui.hover = t;
  if (ui.sel?.drag) { const c = clampT(t); ui.sel.x1 = c.x; ui.sel.y1 = c.y; return; }
  if (!drag) return;
  if (drag.erase) removeAt(t);
  else if (t.x >= 0 && t.y >= 0 && t.x < world.w && t.y < world.h) dragTo(t);
});
window.addEventListener('mouseup', (ev) => {
  drag = null;
  if (ui.sel?.drag) { ui.sel.drag = false; ui.selecting = false; openSelMenu(ev); renderEditBar(); }
  if (holding) { holding = false; commit(); }
});
// 範囲の小さな窓の外をクリックしたら、範囲をやめる
window.addEventListener('mousedown', (ev) => {
  if (ui.sel && !ui.sel.drag && !$('selmenu').contains(ev.target) && ev.target !== canvas) { clearSel(); renderEditBar(); }
}, true);
canvas.addEventListener('mouseleave', () => { ui.hover = null; });

function rotate(stepN = 1) {
  if (ui.pasting && ui.clip) { ui.clip = rotateBp(ui.clip, content, stepN); return; }
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
  if (ev.target.closest?.('textarea, input')) return; // 図面の文字列を書いているとき
  if ($('bpbox').classList.contains('show')) { if (ev.key === 'Escape') closeBp(); return; }
  if (ev.key === ' ') { ev.preventDefault(); setPaused(!ui.paused); return; }
  if (ui.screen !== 'district') return;
  const k = ev.key.length === 1 ? ev.key.toLowerCase() : ev.key;
  const ctrl = ev.ctrlKey || ev.metaKey;
  if (ctrl && k === 'z') { ev.preventDefault(); if (ev.shiftKey) redo(); else undo(); return; }
  if (ctrl && k === 'y') { ev.preventDefault(); redo(); return; }
  if (ctrl && k === 'v') { ev.preventDefault(); startPaste(); return; }
  if (ui.sel && !ui.sel.drag) {
    if (k === 'c') { ev.preventDefault(); copySel(); return; }
    if (k === 'x') { ev.preventDefault(); cutSel(); return; }
    if (k === 'Delete' || k === 'Backspace') { ev.preventDefault(); deleteSel(); return; }
  }
  if (ctrl) return; // ほかの Ctrl の組み合わせはブラウザに任せる
  if (k === 'r') rotate();
  else if (k === 'e') pipette();
  else if (k === 'q' || k === 'Escape') { closePicker(); dropEdit(); ui.tool = null; renderPalette(); }
  else if (k === 'Delete' && ui.hover) removeAt(ui.hover);
  else if (k === 'Tab') { ev.preventDefault(); switchTab(ev.shiftKey ? -1 : 1); }
  else if (/^[1-9]$/.test(k)) {
    const id = inTab(ui.tab)[Number(k) - 1];
    if (id && !overLimit(id)) { ui.tool = id; dropEdit(); renderPalette(); }
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
  if (!confirm('この区画に置いた物を全部消します。よいですか？（依頼の達成と片づいた瓦礫は残ります。「元に戻す」で戻せる）')) return;
  const before = lastSnap;
  resetDistrict(game, ui.district);
  persist();
  openDistrict(ui.district);
  if (before && before !== lastSnap) { pushUndo(before); renderEditBar(); }
};
// 試作用の「全部開く」は、URL に ?dev を付けたときだけ出す
if (!new URLSearchParams(location.search).has('dev')) $('openall').style.display = 'none';
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
  if (ui.pasting && ui.pasteState && t) { // 図面を持っているときは、貼れるかを出す
    name = '図面';
    s = ui.pasteState.ok ? `：${ui.clip.ents.length}個。クリックで貼る・R で回す・右クリックで手放す` : `：ここには貼れない（${ui.pasteState.reason}）`;
  } else if (e) {
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
    else if (e.kind === 'source') s += e.from ? `：${itemName(e.item)}（${districtDef(game, e.from).name}が納めた分だけ）` : e.imported ? `：${itemName(e.item)}（前の区画から。倉庫に入る量まで）` : `：${itemName(e.item)}（毎分${Math.round(600 / e.interval)}個まで）`;
    else if (e.kind === 'sorter') s += `：${e.filter ? `${itemName(e.filter)}だけ左右へ、残りは正面へ` : 'まだ素材を選んでいない（全部正面へ）'}｜クリックで素材を選ぶ`;
    else if (e.kind === 'overflow') s += '：先が詰まった物を倉庫へ戻す（余った物で止まらない）';
    else if (e.kind === 'emitter') s += emitterInfo(e);
    else if (e.kind === 'under') s += underInfo(e);
    else if (e.item) {
      s += `：${itemName(e.item.t)}`;
      const rule = content.decayRules?.find((r) => r.from === e.item.t);
      if (rule) s += `（あと${((rule.ticks - (e.item.age || 0)) / TPS).toFixed(1)}秒で${itemName(rule.to)}。冷気の中では止まる）`;
    }
    if (e.fast) s += '｜2.5倍の速さ';
    if (e.priority) s += '：正面に入れられるときは正面へ、詰まっているときだけ左右へ';
  } else if (t && world.blocked[t.y * world.w + t.x] === 2) { name = '瓦礫'; s = '：あとの区画の依頼を達成すると片づく（どの依頼かは右の「瓦礫」）'; }
  else if (t && world.blocked[t.y * world.w + t.x] === 3) { name = '水'; s = '：何も置けない。下をくぐるベルトなら、水の下を4マスまで通せる'; }
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
    const po = ui.pasting ? pasteOrigin() : null;
    ui.pasteState = po ? pasteCheck(game, ui.district, ui.clip, po.ox, po.oy) : null;
    draw(canvas.getContext('2d'), world, {
      sel: ui.sel ? selRect(ui.sel) : null,
      paste: po ? { bp: ui.clip, ox: po.ox, oy: po.oy, bad: ui.pasteState.bad, ok: ui.pasteState.ok } : null,
      art: 'name', tool: ui.tool, dir: ui.dir, hover: ui.hover, alpha: ui.alpha, overLimit,
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
