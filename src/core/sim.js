// 工場のシミュレーション。画面なしで動く。同じ配置なら必ず同じ結果になる（乱数は使わない）。
//
// 向き：0=右(東) 1=下(南) 2=左(西) 3=上(北)
// ベルトと分岐は、1マスに素材を1個だけ持つ。素材は BELT_TICKS 刻みで次のマスへ進む。
// 下をくぐるベルト（under）：入口と出口の間の UNDER_GAP マスまでを下でつなぐ。くぐっている間は範囲が効かない。
// 魔力：地脈のない区画（leyline: false）では、mana の付いた機械は魔力炉の範囲に入っていないと動かない。
//       魔力炉は燃料を毎分 fuelPerMin 燃やし、範囲の機械 powers 台まで動かす。多いと全部が遅くなる。

export const TPS = 10; // 1秒の刻み数
export const BELT_TICKS = 5; // 1マス進むのにかかる刻み
export const DX = [1, 0, -1, 0];
export const DY = [0, 1, 0, -1];
export const UNDER_GAP = 4; // 下をくぐれるマス数
export const FUEL_CAP = 4; // 魔力炉にためられる燃料
const FIELDS = ['heat', 'cold', 'mana'];

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
//        imported（前の区画の物を出す口。credit の数だけ出せる）
export function place(world, id, x, y, dir = 0, props = {}) {
  if (!canPlace(world, id, x, y).ok) return null;
  const def = world.data.buildings[id];
  const e = {
    id, kind: def.kind, x, y, w: def.w, h: def.h, dir: dir & 3, fixed: !!props.fixed,
    outs: [], feeders: [], rr: 0, lastFrom: null,
  };
  if (e.kind === 'belt' || e.kind === 'splitter') e.item = null;
  if (e.kind === 'under') { e.item = null; e.role = props.role === 'out' ? 'out' : 'in'; e.partner = null; e.tube = []; }
  if (e.kind === 'emitter') { e.on = true; if (def.fuelPerMin) { e.fuel = 0; e.burn = 0; e.burning = false; } }
  if (e.kind === 'source') {
    e.item = props.item ?? null; e.interval = props.interval ?? BELT_TICKS; e.cool = 0;
    if (props.imported) { e.imported = true; e.credit = 0; }
  }
  if (e.kind === 'sink') e.count = {};
  if (e.kind === 'machine') {
    e.recipe = props.recipe ?? def.recipes[0] ?? null;
    e.inbuf = {}; e.outbuf = {}; e.left = 0; e.status = 'waiting'; e.acc = 0;
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
      return !(target.x + DX[target.dir] === fx && target.y + DY[target.dir] === fy);
    case 'under': // 入口はベルトと同じ。出口は下からだけ
      return target.role === 'in' && !(target.x + DX[target.dir] === fx && target.y + DY[target.dir] === fy);
    case 'emitter': // 魔力炉は燃料をどの辺からでも受け取る
      return !!target.fuelIn;
    case 'splitter': // 後ろからだけ
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
export function reach(world, e) {
  const r = world.data.buildings[e.id].radius;
  return { x0: e.x - r, y0: e.y - r, x1: e.x + e.w + r - 1, y1: e.y + e.h + r - 1 };
}
const inside = (b, e) => e.x >= b.x0 && e.y >= b.y0 && e.x + e.w - 1 <= b.x1 && e.y + e.h - 1 <= b.y1;

// 範囲を塗り直す。熱と冷気は、動いている（魔力が届いている）源だけ。魔力の範囲は炉を置いただけで見せる
function computeFields(world) {
  for (const f of FIELDS) world.fields[f].fill(0);
  for (const e of world.ents) {
    if (e.kind !== 'emitter') continue;
    const def = world.data.buildings[e.id];
    if (def.field !== 'mana' && !e.on) continue;
    const b = reach(world, e);
    for (let y = Math.max(0, b.y0); y <= Math.min(world.h - 1, b.y1); y++) {
      for (let x = Math.max(0, b.x0); x <= Math.min(world.w - 1, b.x1); x++) world.fields[def.field][y * world.w + x]++;
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

// 魔力：どの魔力炉がどの機械に届くか（機械の全部のマスが範囲に入っていること）
function linkMana(world) {
  const B = world.data.buildings;
  world.manaFurnaces = world.ents.filter((e) => e.kind === 'emitter' && B[e.id].fuelPerMin);
  world.consumers = world.leyline ? [] : world.ents.filter((e) => B[e.id].mana && (e.kind === 'machine' || e.kind === 'emitter'));
  for (const f of world.manaFurnaces) f.covers = [];
  for (const e of world.ents) {
    e.needsMana = !world.leyline && !!B[e.id].mana;
    e.suppliers = [];
    e.pn = 1; e.pd = 1;
    if (e.kind === 'emitter' && !e.needsMana) e.on = true;
  }
  for (const c of world.consumers) {
    for (const f of world.manaFurnaces) {
      if (inside(reach(world, f), c)) { c.suppliers.push(f); f.covers.push(c); }
    }
  }
  assignPower(world);
}

// 機械ごとの速さ（pn/pd）。届いている魔力炉のうち、いちばん余裕のある炉で決める
function assignPower(world) {
  let changed = false;
  for (const c of world.consumers) {
    let n = 0, d = 1;
    for (const f of c.suppliers) {
      if (!f.burning) continue;
      const load = f.covers.length, nn = Math.min(world.data.buildings[f.id].powers, load);
      if (nn * d > n * load) { n = nn; d = load; }
    }
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

const isHolder = (e) => e.kind === 'belt' || e.kind === 'splitter' || e.kind === 'under';

export function rebuild(world) {
  const { ents } = world;
  for (const e of ents) {
    e.outs = []; e.feeders = [];
    if (e.kind === 'emitter') e.fuelIn = !!world.data.buildings[e.id].fuelPerMin;
  }
  linkMana(world);
  computeFields(world);
  const tubes = linkTunnels(world);
  for (const e of ents) {
    if (e.kind === 'belt' || e.kind === 'source' || (e.kind === 'under' && e.role === 'out')) addOut(world, e, e.x, e.y, e.dir);
    else if (e.kind === 'splitter') {
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

function ready(f) {
  if (isHolder(f)) return !!f.item && f.item.p >= BELT_TICKS;
  if (f.kind === 'source') return !!f.item && f.cool <= 0 && (!f.imported || f.credit >= 1);
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

function stepMachine(world, m) {
  const r = world.data.recipes[m.recipe];
  if (!r) { m.status = 'no-recipe'; return; }
  for (const t in m.outbuf) {
    if (m.outbuf[t] > 0 && tryOut(world, m, { t, p: 0, ex: 0 })) { m.outbuf[t]--; break; }
  }
  const powered = !m.needsMana || m.pn > 0;
  m.slow = m.needsMana && powered && m.pn < m.pd;
  if (m.left > 0) {
    if (!powered) { m.status = 'no-mana'; return; }
    let go = true;
    if (m.slow) { m.acc += m.pn; if (m.acc >= m.pd) m.acc -= m.pd; else go = false; }
    if (go) {
      m.left--;
      if (m.left === 0) for (const t in r.out) m.outbuf[t] = (m.outbuf[t] || 0) + r.out[t];
    }
  }
  if (m.left > 0) { m.status = 'working'; return; }
  if (r.field && !machineInField(world, m, r.field)) { m.status = 'no-field'; return; }
  if (!powered) { m.status = 'no-mana'; return; }
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
    if (h.item && h.item.p >= BELT_TICKS && tryOut(world, h, h.item)) h.item = null;
  }
  for (const m of world.machines) stepMachine(world, m);
  for (const s of world.sources) {
    if (!s.item || s.cool > 0 || (s.imported && s.credit < 1)) continue;
    if (tryOut(world, s, { t: s.item, p: 0, ex: 0 })) { s.cool = s.interval; if (s.imported) s.credit--; }
  }
  if (world.tick % TPS === 0) {
    world.hist.push(world.cur);
    if (world.hist.length > 60) world.hist.shift();
    world.cur = {};
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

// 配置だけを取り出す（保存・共有用）。流れている素材は含めない。
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
      if (e.kind === 'source') { o.item = e.item; if (e.interval !== BELT_TICKS) o.interval = e.interval; if (e.imported) o.imported = true; }
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
