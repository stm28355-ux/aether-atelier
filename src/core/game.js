// ゲーム全体：開いた区画を全部同じ刻みで動かし、倉庫を通して物を渡す。画面なしで動く。
//
// 倉庫のルール（11/16 決定）
// - 区画の「納める口」に入った物は倉庫へ入る
// - 前の区画の物を出す口（imported）は、倉庫に入ってくる物を順番に等分して受け取る。
//   1つの口にためられるのは PORT_CAP 個まで（貯めて一気に出せない）
// - 受け取る口がない分は「余り」。瓦礫を片づけている間は、その素材の余りが片づけに回る
import {
  createWorld, place, step as stepWorld, rate, serialize, rebuild, clearTiles, TPS,
} from './sim.js';

export const PORT_CAP = 3;
const SAVE_VERSION = 1;

const emptyState = () => ({
  v: SAVE_VERSION,
  open: ['d0'],
  done: {},
  cleared: {}, // 区画 → 片づけた瓦礫の id
  layouts: {}, // 区画 → 置いた物（倉庫の口は含めない）
  made: {}, // 素材 → これまでに納めた合計（図鑑）
  seen: {}, // 素材 → ベルトの上で見たことがある（図鑑）
  cleanup: null, // { district, patch }
});

export function createGame(content, saved = null) {
  const state = { ...emptyState(), ...(saved && saved.v === SAVE_VERSION ? saved : {}) };
  const game = {
    content, state, tick: 0,
    worlds: {},
    hist: [], // 1秒ごとの倉庫の出入り { in:{}, out:{}, spare:{}, clean:{} }
    cur: null,
    rr: {}, // 素材ごとの、次に渡す口の順番
    events: [], // 画面に知らせること（依頼達成など）
  };
  game.cur = newBucket();
  for (const id of state.open) buildWorld(game, id);
  return game;
}

const newBucket = () => ({ in: {}, out: {}, spare: {}, clean: {} });
const add = (o, k, n = 1) => { o[k] = (o[k] || 0) + n; };

export const districtDef = (game, id) => game.content.districts.find((d) => d.id === id);

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
  const c = game.state.cleanup;
  const cleanItem = c && rubbleCost(game, c.district, c.patch)?.item;
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
    if (given) continue;
    if (cleanItem === item) add(game.cur.clean, item);
    else add(game.cur.spare, item);
  }
}

export function rubbleCost(game, district, patch) {
  return districtDef(game, district)?.rubble.find((r) => r.id === patch)?.cost;
}

export function startCleanup(game, district, patch) {
  game.state.cleanup = { district, patch };
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
  game.events.push({ type: 'request', district: id, index: k, request: r });
}

function checkCleanup(game) {
  const c = game.state.cleanup;
  if (!c) return;
  const cost = rubbleCost(game, c.district, c.patch);
  if (!cost) { game.state.cleanup = null; return; }
  if (perMin(game, 'clean', cost.item) < cost.perMin) return;
  (game.state.cleared[c.district] ||= []).push(c.patch);
  const patch = districtDef(game, c.district).rubble.find((r) => r.id === c.patch);
  clearTiles(game.worlds[c.district], patch.tiles);
  game.state.cleanup = null;
  // 片づけの記録は使い切る（次の片づけに持ち越さない）
  for (const b of game.hist) b.clean = {};
  game.events.push({ type: 'cleared', district: c.district, patch: c.patch });
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
    checkCleanup(game);
  }
}

export function run(game, ticks) {
  for (let i = 0; i < ticks; i++) step(game);
}

export function save(game) {
  return JSON.parse(JSON.stringify(game.state));
}
