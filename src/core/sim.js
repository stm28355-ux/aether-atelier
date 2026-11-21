// 工場のシミュレーション。画面なしで動く。同じ配置なら必ず同じ結果になる（乱数は使わない）。
//
// 向き：0=右(東) 1=下(南) 2=左(西) 3=上(北)
// ベルトと分岐は、1マスに素材を1個だけ持つ。素材は BELT_TICKS 刻みで次のマスへ進む。
// 下をくぐるベルト（under）：入口と出口の間の UNDER_GAP マスまでを下でつなぐ。くぐっている間は範囲が効かない。
// 魔力：地脈のない区画（leyline: false）では、mana の付いた機械は、全部のマスが燃えている魔力炉の範囲
//       （いくつかの炉の範囲を合わせてよい）に入っていないと動かない。
//       魔力炉は燃料を毎分 fuelPerMin 燃やし、範囲にかかる機械 powers 台まで動かす。多いと全部が遅くなる。
// 相乗（synergy）：同じ機械と辺で接すると、1台ごとに +25%（最大 +50%）速い。
// 揺れ（shake）：揺れる機械の周り2マスは揺れの範囲。そこに1マスでも入った fragile の機械は止まる。
// 選り分け（sorter）：後ろから受け、選んだ素材だけ左右へ、残りは正面へ出す。
// あふれ口（overflow）：ベルトと同じだが、先が詰まった物は倉庫へ戻す（余った物で止まらない）。

export const TPS = 10; // 1秒の刻み数
export const BELT_TICKS = 5; // 1マス進むのにかかる刻み
export const DX = [1, 0, -1, 0];
export const DY = [0, 1, 0, -1];
export const UNDER_GAP = 4; // 下をくぐれるマス数
export const FUEL_CAP = 4; // 魔力炉にためられる燃料
const FIELDS = ['heat', 'cold', 'mana', 'shake'];
export const SHAKE_RADIUS = 2;
export const SYN_STEP = 1, SYN_MAX = 2, SYN_DEN = 4; // 相乗：1台ごとに 1/4（+25%）、2台まで

// blocked：置けないマス（柱など）。rubble：瓦礫のマス（片づけると置ける）
export const WALL = 1, RUBBLE = 2;
export function createWorld({ w, h, blocked = [], rubble = [], leyline = true }, data) {
  const world = {
    w, h, data, leyline,
    manaFurnaces: [], consumers: [],
    blocked: new Uint8Array(w * h),
    grid: new Array(w * h).fill(null),
    ents: [],
    fields: {},
    tick: 0,
    dirty: true,
    delivered: {}, // 納めた合計
    hist: [], // 1秒ごとの納めた数（直近60秒）
    cur: {},
    tickOut: {}, // この刻みで納めた数（倉庫へ送る）
    back: {}, // あふれ口から倉庫へ戻した数（1秒ごと）
    backHist: [],
  };
  for (const f of FIELDS) world.fields[f] = new Uint8Array(w * h);
  for (const [x, y] of blocked) world.blocked[y * w + x] = WALL;
  for (const [x, y] of rubble) world.blocked[y * w + x] = RUBBLE;
  return world;
}

export function entAt(world, x, y) {
  if (x < 0 || y < 0 || x >= world.w || y >= world.h) return null;
  return world.grid[y * world.w + x];
}

export function canPlace(world, id, x, y) {
  const def = world.data.buildings[id];
  if (!def) return { ok: false, reason: '知らない建物' };
  for (let j = 0; j < def.h; j++) {
    for (let i = 0; i < def.w; i++) {
      const cx = x + i, cy = y + j;
      if (cx < 0 || cy < 0 || cx >= world.w || cy >= world.h) return { ok: false, reason: '区画の外' };
      const b = world.blocked[cy * world.w + cx];
      if (b) return { ok: false, reason: b === RUBBLE ? '瓦礫がある' : '置けないマス' };
      if (world.grid[cy * world.w + cx]) return { ok: false, reason: 'ほかの物がある' };
    }
  }
  return { ok: true };
}

// 瓦礫のマスを空ける
export function clearTiles(world, tiles) {
  for (const [x, y] of tiles) if (world.blocked[y * world.w + x] === RUBBLE) world.blocked[y * world.w + x] = 0;
  world.dirty = true;
}

// props：recipe（機械）、item（出す口が出す素材）、fixed（壊せない）、interval（出す口の間隔）
//        imported（前の区画の物を出す口。credit の数だけ出せる）、extra（同じ口から交互に出す倉庫の原料）
//        filter（選り分けが横へ出す素材）、role（下をくぐるベルトの入口か出口か）
export function place(world, id, x, y, dir = 0, props = {}) {
  if (!canPlace(world, id, x, y).ok) return null;
  const def = world.data.buildings[id];
  const e = {
    id, kind: def.kind, x, y, w: def.w, h: def.h, dir: dir & 3, fixed: !!props.fixed,
    outs: [], feeders: [], rr: 0, lastFrom: null,
  };
  if (e.kind === 'belt' || e.kind === 'splitter') e.item = null;
  if (e.kind === 'sorter') { e.item = null; e.filter = props.filter ?? null; e.front = []; e.sides = []; }
  if (e.kind === 'overflow') { e.item = null; e.wait = 0; }
  if (e.kind === 'under') { e.item = null; e.role = props.role === 'out' ? 'out' : 'in'; e.partner = null; e.tube = []; }
  if (e.kind === 'emitter') { e.on = true; if (def.fuelPerMin) { e.fuel = Math.min(FUEL_CAP, props.fuel || 0); e.burn = 0; e.burning = false; } }
  if (e.kind === 'source') {
    e.item = props.item ?? null; e.interval = props.interval ?? BELT_TICKS; e.cool = 0;
    if (props.imported) { e.imported = true; e.credit = 0; }
    if (props.extra) { e.extra = props.extra; e.turn = 0; }
  }
  if (e.kind === 'sink') e.count = {};
  if (e.kind === 'machine') {
    e.recipe = props.recipe ?? def.recipes[0] ?? null;
    e.inbuf = {}; e.outbuf = {}; e.left = 0; e.status = 'waiting'; e.acc = 0; e.syn = 0; e.shaken = false;
  }
  world.ents.push(e);
  for (let j = 0; j < e.h; j++) for (let i = 0; i < e.w; i++) world.grid[(y + j) * world.w + x + i] = e;
  world.dirty = true;
  return e;
}

export function remove(world, x, y) {
  const e = entAt(world, x, y);
  if (!e || e.fixed) return false;
  world.ents.splice(world.ents.indexOf(e), 1);
  for (let j = 0; j < e.h; j++) for (let i = 0; i < e.w; i++) world.grid[(e.y + j) * world.w + e.x + i] = null;
  world.dirty = true;
  return true;
}

export function setRecipe(world, e, recipe) {
  e.recipe = recipe; e.inbuf = {}; e.outbuf = {}; e.left = 0;
}

// 範囲が効いているか。熱と冷気が重なったマスは打ち消し合う。
export function fieldActive(world, field, x, y) {
  const i = y * world.w + x;
  if (!world.fields[field][i]) return false;
  if (field === 'heat') return !world.fields.cold[i];
  if (field === 'cold') return !world.fields.heat[i];
  return true;
}

function machineInField(world, e, field) {
  for (let j = 0; j < e.h; j++) for (let i = 0; i < e.w; i++) {
    if (!fieldActive(world, field, e.x + i, e.y + j)) return false;
  }
  return true;
}

// (fx,fy) のマスから target へ素材を渡せるつながりか
function canConnect(target, fx, fy) {
  switch (target.kind) {
    case 'belt': // 向かい合わせは不可
    case 'overflow':
      return !(target.x + DX[target.dir] === fx && target.y + DY[target.dir] === fy);
    case 'under': // 入口はベルトと同じ。出口は下からだけ
      return target.role === 'in' && !(target.x + DX[target.dir] === fx && target.y + DY[target.dir] === fy);
    case 'emitter': // 魔力炉は燃料をどの辺からでも受け取る
      return !!target.fuelIn;
    case 'splitter': // 後ろからだけ
    case 'sorter':
      return target.x - DX[target.dir] === fx && target.y - DY[target.dir] === fy;
    case 'machine': // 正面の辺は出口なので入れない
      if (target.dir === 0) return fx !== target.x + target.w;
      if (target.dir === 1) return fy !== target.y + target.h;
      if (target.dir === 2) return fx !== target.x - 1;
      return fy !== target.y - 1;
    case 'sink':
      return true;
    default:
      return false;
  }
}

function addOut(world, e, fx, fy, d) {
  const t = entAt(world, fx + DX[d], fy + DY[d]);
  if (!t || t === e || !canConnect(t, fx, fy)) return;
  if (e.outs.includes(t)) return;
  e.outs.push(t);
  if (!t.feeders.includes(e)) t.feeders.push(e);
}

// 範囲の四角（区画の外も含む）
export function reach(world, e, radius) {
  const r = radius ?? world.data.buildings[e.id].radius;
  return { x0: e.x - r, y0: e.y - r, x1: e.x + e.w + r - 1, y1: e.y + e.h + r - 1 };
}

// 範囲を塗り直す。熱と冷気は、動いている（魔力が届いている）源だけ。魔力の範囲は炉を置いただけで見せる
function computeFields(world) {
  for (const f of FIELDS) world.fields[f].fill(0);
  for (const e of world.ents) {
    const def = world.data.buildings[e.id];
    let field = null, b = null;
    if (e.kind === 'emitter') {
      if (def.field !== 'mana' && !e.on) continue;
      field = def.field; b = reach(world, e);
    } else if (def.shake) {
      field = 'shake'; b = reach(world, e, SHAKE_RADIUS);
    } else continue;
    for (let y = Math.max(0, b.y0); y <= Math.min(world.h - 1, b.y1); y++) {
      for (let x = Math.max(0, b.x0); x <= Math.min(world.w - 1, b.x1); x++) world.fields[field][y * world.w + x]++;
    }
  }
}

// 相乗と揺れ：配置で決まるので、置き直したときだけ数える
function linkNeighbors(world) {
  const B = world.data.buildings;
  for (const m of world.ents) {
    if (m.kind !== 'machine') continue;
    m.syn = 0; m.shaken = false;
    if (B[m.id].synergy) {
      const near = new Set();
      for (let j = 0; j < m.h; j++) for (let i = 0; i < m.w; i++) {
        for (let d = 0; d < 4; d++) {
          const t = entAt(world, m.x + i + DX[d], m.y + j + DY[d]);
          if (t && t !== m && t.id === m.id) near.add(t);
        }
      }
      m.syn = Math.min(SYN_MAX, near.size * SYN_STEP);
    }
    if (B[m.id].fragile) {
      for (let j = 0; j < m.h && !m.shaken; j++) for (let i = 0; i < m.w; i++) {
        if (world.fields.shake[(m.y + j) * world.w + m.x + i]) { m.shaken = true; break; }
      }
    }
  }
}

// 下をくぐる：入口から前へ UNDER_GAP+1 マスまでに、同じ向きの出口があればつなぐ
// （同じ向きの入口が先にあれば、そこで終わり）。間のマスは見えないベルトで、素材は持ち越す
function linkTunnels(world) {
  const tubes = [];
  for (const e of world.ents) if (e.kind === 'under') e.partner = null;
  for (const e of world.ents) {
    if (e.kind !== 'under' || e.role !== 'in') continue;
    let out = null, k = 1;
    for (; k <= UNDER_GAP + 1; k++) {
      const t = entAt(world, e.x + DX[e.dir] * k, e.y + DY[e.dir] * k);
      if (t && t.kind === 'under' && t.dir === e.dir) { if (t.role === 'out' && !t.partner) out = t; break; }
    }
    if (!out) { e.tube = []; continue; }
    e.partner = out; out.partner = e;
    const n = k - 1;
    const old = e.tube.length === n ? e.tube : [];
    e.tube = [];
    for (let i = 0; i < n; i++) {
      e.tube.push({
        id: 'tube', kind: 'belt', virtual: true, x: e.x + DX[e.dir] * (i + 1), y: e.y + DY[e.dir] * (i + 1), w: 1, h: 1,
        dir: e.dir, item: old[i] ? old[i].item : null, outs: [], feeders: [], rr: 0, lastFrom: null,
      });
    }
    const chain = [e, ...e.tube, out];
    for (let i = 0; i < chain.length - 1; i++) { chain[i].outs.push(chain[i + 1]); chain[i + 1].feeders.push(chain[i]); }
    tubes.push(...e.tube);
  }
  return tubes;
}

// 魔力：どの魔力炉がどの機械にかかるか。機械のマスごとに、どの炉の範囲に入っているかを覚える
function linkMana(world) {
  const B = world.data.buildings;
  world.manaFurnaces = world.ents.filter((e) => e.kind === 'emitter' && B[e.id].fuelPerMin);
  world.consumers = world.leyline ? [] : world.ents.filter((e) => B[e.id].mana && (e.kind === 'machine' || e.kind === 'emitter'));
  for (const f of world.manaFurnaces) f.covers = [];
  for (const e of world.ents) {
    e.needsMana = !world.leyline && !!B[e.id].mana;
    e.suppliers = []; e.masks = []; e.covered = false;
    e.pn = 1; e.pd = 1;
    if (e.kind === 'emitter' && !e.needsMana) e.on = true;
  }
  for (const c of world.consumers) {
    const full = (1 << (c.w * c.h)) - 1;
    let all = 0;
    for (const f of world.manaFurnaces) {
      const b = reach(world, f);
      let mask = 0;
      for (let j = 0; j < c.h; j++) for (let i = 0; i < c.w; i++) {
        const x = c.x + i, y = c.y + j;
        if (x >= b.x0 && x <= b.x1 && y >= b.y0 && y <= b.y1) mask |= 1 << (j * c.w + i);
      }
      if (!mask) continue;
      c.suppliers.push(f); c.masks.push(mask); f.covers.push(c);
      all |= mask;
    }
    c.full = full;
    c.covered = all === full; // 炉が燃えれば動く（燃料がないだけ）
  }
  assignPower(world);
}

// 機械ごとの速さ（pn/pd）。全部のマスが燃えている炉の範囲に入っていれば動き、
// かかっている燃えている炉のうち、いちばん混んでいる炉の速さになる
function assignPower(world) {
  let changed = false;
  for (const c of world.consumers) {
    let mask = 0, n = 1, d = 1;
    c.suppliers.forEach((f, k) => {
      if (!f.burning) return;
      mask |= c.masks[k];
      const load = f.covers.length, nn = Math.min(world.data.buildings[f.id].powers, load);
      if (nn * d < n * load) { n = nn; d = load; }
    });
    if (mask !== c.full) { n = 0; d = 1; }
    c.pn = n; c.pd = d;
    if (c.kind === 'emitter') {
      const on = n > 0;
      if (on !== c.on) { c.on = on; changed = true; }
    }
  }
  return changed;
}

// 魔力炉が燃料を燃やす（範囲に魔力の要る機械があるときだけ）
function powerTick(world) {
  if (world.leyline || !world.manaFurnaces.length) return;
  for (const f of world.manaFurnaces) {
    if (f.burn === 0 && f.fuel > 0 && f.covers.length) { f.fuel--; f.burn = Math.round((60 * TPS) / world.data.buildings[f.id].fuelPerMin); }
    f.burning = f.burn > 0;
    if (f.burn > 0) f.burn--;
  }
  if (assignPower(world)) computeFields(world);
}

export const isHolder = (e) => e.kind === 'belt' || e.kind === 'splitter' || e.kind === 'under' || e.kind === 'sorter' || e.kind === 'overflow';

export function rebuild(world) {
  const { ents } = world;
  for (const e of ents) {
    e.outs = []; e.feeders = [];
    if (e.kind === 'emitter') e.fuelIn = !!world.data.buildings[e.id].fuelPerMin;
  }
  linkMana(world);
  computeFields(world);
  linkNeighbors(world);
  const tubes = linkTunnels(world);
  for (const e of ents) {
    if (e.kind === 'belt' || e.kind === 'source' || e.kind === 'overflow' || (e.kind === 'under' && e.role === 'out')) addOut(world, e, e.x, e.y, e.dir);
    else if (e.kind === 'sorter') {
      addOut(world, e, e.x, e.y, e.dir);
      e.front = e.outs.slice();
      for (const d of [(e.dir + 3) & 3, (e.dir + 1) & 3]) addOut(world, e, e.x, e.y, d);
      e.sides = e.outs.filter((t) => !e.front.includes(t));
    } else if (e.kind === 'splitter') {
      for (const d of [e.dir, (e.dir + 3) & 3, (e.dir + 1) & 3]) addOut(world, e, e.x, e.y, d);
    } else if (e.kind === 'machine') {
      const horizontal = e.dir === 0 || e.dir === 2;
      const n = horizontal ? e.h : e.w;
      for (let k = 0; k < n; k++) {
        const fx = horizontal ? (e.dir === 0 ? e.x + e.w - 1 : e.x) : e.x + k;
        const fy = horizontal ? e.y + k : (e.dir === 1 ? e.y + e.h - 1 : e.y);
        addOut(world, e, fx, fy, e.dir);
      }
    }
    if (e.rr >= e.outs.length) e.rr = 0;
    if (e.kind === 'sorter' && e.rr >= e.sides.length) e.rr = 0;
    if (e.lastFrom && !ents.includes(e.lastFrom)) e.lastFrom = null;
  }
  // 下流から先に動かす順番（詰まっていない列がまとめて進むように）
  const holders = [...ents.filter(isHolder), ...tubes];
  const seen = new Set();
  const order = [];
  const visit = (e) => {
    if (seen.has(e)) return;
    seen.add(e);
    for (const t of e.outs) if (isHolder(t)) visit(t);
    order.push(e);
  };
  holders.forEach(visit);
  world.holders = holders;
  world.order = order;
  world.machines = ents.filter((e) => e.kind === 'machine');
  world.sources = ents.filter((e) => e.kind === 'source');
  world.dirty = false;
}

// 出す口が次に出す素材。前の区画の物は credit があるときだけ。extra のある口は交互に出す
function nextItem(s) {
  if (!s.item) return null;
  const main = !s.imported || s.credit >= 1 ? s.item : null;
  if (!s.extra) return main;
  return s.turn === 1 ? s.extra : main ?? s.extra;
}

function ready(f) {
  if (isHolder(f)) return !!f.item && f.item.p >= BELT_TICKS;
  if (f.kind === 'source') return f.cool <= 0 && nextItem(f) !== null;
  if (f.kind === 'machine') return Object.values(f.outbuf).some((n) => n > 0);
  return false;
}

// 合流は、渡したい相手が複数いたら順番に通す
function myTurn(target, from) {
  const fs = target.feeders;
  const start = fs.indexOf(target.lastFrom) + 1;
  for (let k = 0; k < fs.length; k++) {
    const f = fs[(start + k) % fs.length];
    if (f === from || ready(f)) return f === from;
  }
  return true;
}

function push(world, from, target, item) {
  switch (target.kind) {
    case 'belt':
    case 'splitter':
    case 'under':
    case 'sorter':
    case 'overflow':
      if (target.item) return false;
      if (target.feeders.length > 1 && !myTurn(target, from)) return false;
      item.p = 0;
      target.item = item;
      target.lastFrom = from;
      return true;
    case 'machine': {
      const r = world.data.recipes[target.recipe];
      const need = r && r.in[item.t];
      if (!need) return false;
      const have = target.inbuf[item.t] || 0;
      if (have >= need * 2) return false;
      target.inbuf[item.t] = have + 1;
      return true;
    }
    case 'emitter':
      if (!target.fuelIn || item.t !== 'fuel' || target.fuel >= FUEL_CAP) return false;
      target.fuel++;
      return true;
    case 'sink':
      target.count[item.t] = (target.count[item.t] || 0) + 1;
      world.delivered[item.t] = (world.delivered[item.t] || 0) + 1;
      world.cur[item.t] = (world.cur[item.t] || 0) + 1;
      world.tickOut[item.t] = (world.tickOut[item.t] || 0) + 1;
      return true;
    default:
      return false;
  }
}

function tryOut(world, e, item) {
  if (e.kind === 'sorter') {
    if (item.t !== e.filter) return e.front.length > 0 && push(world, e, e.front[0], item);
    const n = e.sides.length;
    for (let k = 0; k < n; k++) {
      const i = (e.rr + k) % n;
      if (push(world, e, e.sides[i], item)) { e.rr = (i + 1) % n; return true; }
    }
    return false;
  }
  const n = e.outs.length;
  for (let k = 0; k < n; k++) {
    const i = (e.rr + k) % n;
    if (push(world, e, e.outs[i], item)) { e.rr = (i + 1) % n; return true; }
  }
  return false;
}

function applyFields(world, h) {
  if (h.virtual) return; // 下をくぐっている間は範囲が効かない
  const it = h.item;
  for (const rule of world.data.fieldRules) {
    if (rule.from !== it.t || !fieldActive(world, rule.field, h.x, h.y)) continue;
    it.ex = (it.ex || 0) + 1;
    if (it.ex >= rule.ticks) { it.t = rule.to; it.ex = 0; }
    return;
  }
}

// 魔力が届かない理由：範囲の外（no-mana）か、届く魔力炉はあるが燃えていない（no-fuel）か
const noPower = (m) => (m.covered ? 'no-fuel' : 'no-mana');

function stepMachine(world, m) {
  const r = world.data.recipes[m.recipe];
  if (!r) { m.status = 'no-recipe'; return; }
  for (const t in m.outbuf) {
    if (m.outbuf[t] > 0 && tryOut(world, m, { t, p: 0, ex: 0 })) { m.outbuf[t]--; break; }
  }
  const powered = !m.needsMana || m.pn > 0;
  m.slow = m.needsMana && powered && m.pn < m.pd;
  if (m.left > 0) {
    if (m.shaken) { m.status = 'shaken'; return; }
    if (!powered) { m.status = noPower(m); return; }
    // 速さ＝相乗 (SYN_DEN+syn)/SYN_DEN × 魔力 pn/pd。端数は acc にためる
    const pn = m.needsMana ? m.pn : 1, pd = m.needsMana ? m.pd : 1;
    m.acc += (SYN_DEN + m.syn) * pn;
    const den = SYN_DEN * pd;
    while (m.acc >= den && m.left > 0) { m.acc -= den; m.left--; }
    if (m.left === 0) for (const t in r.out) m.outbuf[t] = (m.outbuf[t] || 0) + r.out[t];
  }
  if (m.left > 0) { m.status = 'working'; return; }
  if (r.field && !machineInField(world, m, r.field)) { m.status = 'no-field'; return; }
  if (m.shaken) { m.status = 'shaken'; return; }
  if (!powered) { m.status = noPower(m); return; }
  for (const t in r.out) if ((m.outbuf[t] || 0) >= r.out[t] * 2) { m.status = 'blocked'; return; }
  for (const t in r.in) if ((m.inbuf[t] || 0) < r.in[t]) { m.status = 'waiting'; return; }
  for (const t in r.in) m.inbuf[t] -= r.in[t];
  m.left = r.ticks;
  m.status = 'working';
}

export function step(world) {
  if (world.dirty) rebuild(world);
  world.tick++;
  world.tickOut = {};
  powerTick(world);
  for (const h of world.holders) {
    if (!h.item) continue;
    if (h.item.p < BELT_TICKS) h.item.p++;
    applyFields(world, h);
  }
  for (const s of world.sources) if (s.cool > 0) s.cool--;
  for (const h of world.order) {
    if (!h.item || h.item.p < BELT_TICKS) continue;
    if (tryOut(world, h, h.item)) { h.item = null; if (h.kind === 'overflow') h.wait = 0; continue; }
    // あふれ口：1マス進む間（BELT_TICKS 刻み）待っても先が空かなければ、倉庫へ戻す
    if (h.kind === 'overflow' && ++h.wait >= BELT_TICKS) {
      world.back[h.item.t] = (world.back[h.item.t] || 0) + 1;
      h.item = null; h.wait = 0;
    }
  }
  for (const m of world.machines) stepMachine(world, m);
  for (const s of world.sources) {
    if (s.cool > 0) continue;
    const t = nextItem(s);
    if (!t || !tryOut(world, s, { t, p: 0, ex: 0 })) continue;
    s.cool = s.interval;
    if (s.imported && t === s.item) s.credit--;
    if (s.extra) s.turn ^= 1;
  }
  if (world.tick % TPS === 0) {
    world.hist.push(world.cur);
    if (world.hist.length > 60) world.hist.shift();
    world.cur = {};
    world.backHist.push(world.back);
    if (world.backHist.length > 60) world.backHist.shift();
    world.back = {};
  }
}

export function run(world, ticks) {
  for (let i = 0; i < ticks; i++) step(world);
}

// 直近60秒で納めた数（＝毎分の量）
export function rate(world, item) {
  let n = 0;
  for (const b of world.hist) n += b[item] || 0;
  return n;
}

// あふれ口から倉庫へ戻した数（直近60秒、全部の素材）
export function backRate(world) {
  let n = 0;
  for (const b of world.backHist) for (const t in b) n += b[t];
  return n;
}

// 配置だけを取り出す（保存・共有用）。流れている素材は含めない（魔力炉の燃料だけは残す）。
export function serialize(world) {
  const blocked = [];
  world.blocked.forEach((v, i) => { if (v) blocked.push([i % world.w, Math.floor(i / world.w)]); });
  return {
    v: 1, w: world.w, h: world.h, blocked,
    ents: world.ents.map((e) => {
      const o = { id: e.id, x: e.x, y: e.y, dir: e.dir };
      if (e.fixed) o.fixed = true;
      if (e.kind === 'machine') o.recipe = e.recipe;
      if (e.kind === 'under') o.role = e.role;
      if (e.kind === 'sorter' && e.filter) o.filter = e.filter;
      if (e.kind === 'emitter' && e.fuel) o.fuel = e.fuel; // 読み直したとき、炉が冷えて詰まらないように
      if (e.kind === 'source') {
        o.item = e.item; if (e.interval !== BELT_TICKS) o.interval = e.interval; if (e.imported) o.imported = true;
        if (e.extra) o.extra = e.extra;
      }
      return o;
    }),
  };
}

export function load(json, data) {
  const world = createWorld(json, data);
  for (const o of json.ents) place(world, o.id, o.x, o.y, o.dir, o);
  return world;
}

// 動いている途中の様子（テストで「同じ結果」を比べるため）
export function snapshot(world) {
  return JSON.stringify({
    tick: world.tick,
    delivered: world.delivered,
    ents: world.ents.map((e) => [e.id, e.x, e.y, e.item ?? null, e.inbuf ?? null, e.outbuf ?? null, e.left ?? null, e.fuel ?? null,
      (e.tube || []).map((c) => c.item)]),
  });
}
