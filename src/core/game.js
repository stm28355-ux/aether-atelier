// ゲーム全体：開いた区画を全部同じ刻みで動かし、倉庫を通して物を渡す。画面なしで動く。
//
// 倉庫のルール（11/16 決定）
// - 区画の「納める口」に入った物は倉庫へ入る
// - 前の区画の物を出す口（imported）は、倉庫に入ってくる物を順番に等分して受け取る。
//   1つの口にためられるのは PORT_CAP 個まで（貯めて一気に出せない）
// - 受け取る口がない分は「余り」
//
// 瓦礫（11/21 決定）：あとの区画の依頼を達成すると、報酬で前の区画の瓦礫が片づく（依頼の clears）
import {
  createWorld, place, remove, step as stepWorld, rate, serialize, rebuild, clearTiles, TPS,
} from './sim.js';

export const PORT_CAP = 3;
const SAVE_VERSION = 1;

const emptyState = () => ({
  v: SAVE_VERSION,
  open: ['d0'],
  done: {},
  cleared: {}, // 区画 → 片づいた瓦礫の id
  layouts: {}, // 区画 → 置いた物（倉庫の口は含めない）
  made: {}, // 素材 → これまでに納めた合計（図鑑）
  seen: {}, // 素材 → ベルトの上で見たことがある（図鑑）
});

export function createGame(content, saved = null) {
  const state = { ...emptyState(), ...(saved && saved.v === SAVE_VERSION ? saved : {}) };
  const game = {
    content, state, tick: 0,
    worlds: {},
    hist: [], // 1秒ごとの倉庫の出入り { in:{}, out:{}, spare:{} }
    cur: null,
    rr: {}, // 素材ごとの、次に渡す口の順番
    events: [], // 画面に知らせること（依頼達成など）
  };
  game.cur = newBucket();
  // 区画や報酬が後から増えたとき：達成済みの依頼が開くはずの区画を開き、片づくはずの瓦礫を片づける（古いセーブのため）
  for (const d of content.districts) {
    d.requests.slice(0, state.done[d.id] || 0).forEach((r) => {
      if (r.opens && !state.open.includes(r.opens) && content.districts.some((x) => x.id === r.opens)) state.open.push(r.opens);
      for (const [dist, patch] of r.clears || []) markCleared(state, dist, patch);
    });
  }
  delete state.cleanup; // 余りで片づけていたころの記録
  state.open = state.open.filter((id) => content.districts.some((d) => d.id === id));
  for (const id of state.open) buildWorld(game, id);
  return game;
}

const newBucket = () => ({ in: {}, out: {}, spare: {} });
const add = (o, k, n = 1) => { o[k] = (o[k] || 0) + n; };

export const districtDef = (game, id) => game.content.districts.find((d) => d.id === id);

// 片づいた瓦礫を記録する。新しく片づいたら true
function markCleared(state, district, patch) {
  const list = (state.cleared[district] ||= []);
  if (list.includes(patch)) return false;
  list.push(patch);
  return true;
}

// この瓦礫を片づける依頼：{ district, index, request }
export function clearedBy(content, district, patch) {
  for (const d of content.districts) {
    const index = d.requests.findIndex((r) => (r.clears || []).some(([x, p]) => x === district && p === patch));
    if (index >= 0) return { district: d.id, index, request: d.requests[index] };
  }
  return null;
}

function rubbleLeft(game, def) {
  const cleared = game.state.cleared[def.id] || [];
  return def.rubble.filter((r) => !cleared.includes(r.id));
}

function buildWorld(game, id) {
  const def = districtDef(game, id);
  if (!def) return null;
  const world = createWorld({
    w: def.w, h: def.h, blocked: def.walls, leyline: def.leyline !== false,
    rubble: rubbleLeft(game, def).flatMap((r) => r.tiles),
  }, game.content);
  for (const f of def.fixed) place(world, f.id, f.x, f.y, f.dir, { ...f, fixed: true });
  for (const o of game.state.layouts[id] || []) place(world, o.id, o.x, o.y, o.dir, o);
  rebuild(world);
  game.worlds[id] = world;
  game.ports = null; // 受け取る口を数え直す
  return world;
}

// 区画の配置が変わったら呼ぶ（保存用に写す）
export function layoutChanged(game, id) {
  const w = game.worlds[id];
  game.state.layouts[id] = serialize(w).ents.filter((e) => !e.fixed);
}

export function resetDistrict(game, id) {
  delete game.state.layouts[id];
  buildWorld(game, id);
}

// 区画の配置をまとめて置き換える（お手本の配置・図面の共有用）。
// 同じ物が同じ場所にあれば残す（動いている素材や燃料はそのまま）。違う物だけ壊して置き直す
export function setLayout(game, id, layout) {
  const w = game.worlds[id];
  if (!w) { game.state.layouts[id] = layout.map((o) => ({ ...o })); buildWorld(game, id); return; }
  const B = game.content.buildings;
  const key = (o) => [o.id, o.x, o.y, o.dir & 3, o.recipe ?? B[o.id].recipes?.[0] ?? '', o.role ?? '', o.filter ?? ''].join(',');
  const want = new Map(layout.map((o) => [key(o), o]));
  for (const e of [...w.ents]) {
    if (e.fixed) continue;
    const k = key(e);
    if (want.has(k)) want.delete(k); else remove(w, e.x, e.y);
  }
  for (const o of want.values()) place(w, o.id, o.x, o.y, o.dir, o);
  layoutChanged(game, id);
  game.ports = null;
}

// 今使える建物：開いた区画の base と、達成した依頼の報酬
export function unlocked(game) {
  const list = [];
  for (const d of game.content.districts) {
    if (!game.state.open.includes(d.id)) continue;
    for (const b of d.base) if (!list.includes(b)) list.push(b);
    d.requests.slice(0, game.state.done[d.id] || 0).forEach((r) => r.unlock.forEach((b) => { if (!list.includes(b)) list.push(b); }));
  }
  return list;
}

// 機械で選べるレシピ：区画を開くと増えるレシピ（gatedRecipes）は、その区画が開いているときだけ
export function recipesFor(game, buildingId) {
  const { buildings, districts, gatedRecipes = [] } = game.content;
  const open = new Set(districts.filter((d) => game.state.open.includes(d.id)).flatMap((d) => d.recipes || []));
  return (buildings[buildingId].recipes || []).filter((r) => !gatedRecipes.includes(r) || open.has(r));
}

// 大目標：達成したか、今も流れているか
export function goals(game) {
  const list = [];
  for (const d of game.content.districts) {
    d.requests.forEach((r, i) => {
      if (!r.goal) return;
      const w = game.worlds[d.id];
      const reached = (game.state.done[d.id] || 0) > i;
      const flowing = !!w && Object.entries(r.targets).every(([t, n]) => rate(w, t) >= n);
      list.push({ ...r.goal, district: d.id, targets: r.targets, reached, flowing, open: game.state.open.includes(d.id) });
    });
  }
  return list;
}

function importPorts(game) {
  const ports = {};
  for (const id of game.state.open) {
    for (const e of game.worlds[id].ents) {
      if (e.kind === 'source' && e.imported) (ports[e.item] ||= []).push(e);
    }
  }
  return ports;
}

// 倉庫に入った物を、前の区画の物を出す口へ順番に配る
function distribute(game, item, n) {
  const ports = game.ports[item] || [];
  for (let k = 0; k < n; k++) {
    let given = false;
    for (let t = 0; t < ports.length; t++) {
      const i = ((game.rr[item] || 0) + t) % ports.length;
      if (ports[i].credit < PORT_CAP) {
        ports[i].credit++;
        game.rr[item] = (i + 1) % ports.length;
        add(game.cur.out, item);
        given = true;
        break;
      }
    }
    if (!given) add(game.cur.spare, item);
  }
}

// 直近60秒の合計（＝毎分の量）
export function perMin(game, kind, item) {
  let n = 0;
  for (const b of game.hist) n += b[kind][item] || 0;
  return n;
}

function checkRequests(game, id) {
  const def = districtDef(game, id);
  const world = game.worlds[id];
  const k = game.state.done[id] || 0;
  const r = def.requests[k];
  if (!r) return;
  for (const t in r.targets) if (rate(world, t) < r.targets[t]) return;
  game.state.done[id] = k + 1;
  if (r.opens && !game.state.open.includes(r.opens) && districtDef(game, r.opens)) {
    game.state.open.push(r.opens);
    buildWorld(game, r.opens);
  }
  game.events.push({ type: r.goal ? 'goal' : 'request', district: id, index: k, request: r });
  // 報酬で前の区画の瓦礫が片づく
  for (const [dist, patch] of r.clears || []) {
    if (!markCleared(game.state, dist, patch)) continue;
    const tiles = districtDef(game, dist)?.rubble.find((p) => p.id === patch)?.tiles || [];
    if (game.worlds[dist]) clearTiles(game.worlds[dist], tiles);
    game.events.push({ type: 'cleared', district: dist, patch, by: id });
  }
}

function markSeen(game) {
  const seen = (game.state.seen ||= {});
  for (const id of game.state.open) {
    for (const e of game.worlds[id].ents) {
      if (e.item && typeof e.item === 'object') seen[e.item.t] = true;
      else if (e.kind === 'source' && e.item) seen[e.item] = true;
    }
  }
}

export function step(game) {
  game.tick++;
  const dirty = game.state.open.some((id) => game.worlds[id].dirty);
  if (dirty || !game.ports) {
    for (const id of game.state.open) if (game.worlds[id].dirty) rebuild(game.worlds[id]);
    game.ports = importPorts(game);
  }
  for (const id of game.state.open) {
    const w = game.worlds[id];
    stepWorld(w);
    for (const t in w.tickOut) {
      const n = w.tickOut[t];
      add(game.cur.in, t, n);
      add(game.state.made, t, n);
      distribute(game, t, n);
    }
  }
  if (game.tick % TPS === 0) {
    game.hist.push(game.cur);
    if (game.hist.length > 60) game.hist.shift();
    game.cur = newBucket();
    for (const id of [...game.state.open]) checkRequests(game, id);
    markSeen(game);
  }
}

export function run(game, ticks) {
  for (let i = 0; i < ticks; i++) step(game);
}

export function save(game) {
  for (const id of game.state.open) if (game.worlds[id]) layoutChanged(game, id); // 魔力炉の燃料も写す
  return JSON.parse(JSON.stringify(game.state));
}
