// 図面：区画の一部（または全部）の置き方を写して、回して、貼る。文字列にして人に渡せる。
// 図面 bp = { w, h, ents: [{ id, x, y, dir, recipe?, role?, filter? }], d?, x?, y?, full? }
//   ents の x, y は図面の左上からの位置。d, x, y は写した区画と、そこでの左上（回すと消える）。
//   full は区画をまるごと写した図面（同じ区画なら、そのまま置き換えられる）。
import { canPlace, entAt, place, setRecipe } from './sim.js';

const PREFIX = 'AA1.';

// 置いた物から、図面に残す中身だけを取り出す（燃料や運んでいる物は残さない）
function pick(e) {
  const o = { id: e.id, x: e.x, y: e.y, dir: e.dir & 3 };
  if (e.recipe) o.recipe = e.recipe;
  if (e.role) o.role = e.role;
  if (e.filter) o.filter = e.filter;
  return o;
}

// (x0,y0)〜(x1,y1) の四角に全部入っている物を写す（倉庫の口は写さない）。中身の外側の空きは詰める
export function copyArea(world, x0, y0, x1, y1, meta = {}) {
  const ax = Math.min(x0, x1), ay = Math.min(y0, y1), bx = Math.max(x0, x1), by = Math.max(y0, y1);
  const list = world.ents.filter((e) => !e.fixed && e.x >= ax && e.y >= ay && e.x + e.w - 1 <= bx && e.y + e.h - 1 <= by);
  if (!list.length) return null;
  const minX = Math.min(...list.map((e) => e.x)), minY = Math.min(...list.map((e) => e.y));
  const maxX = Math.max(...list.map((e) => e.x + e.w - 1)), maxY = Math.max(...list.map((e) => e.y + e.h - 1));
  return {
    ...meta, x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1,
    ents: list.map((e) => ({ ...pick(e), x: e.x - minX, y: e.y - minY })),
  };
}

// 右へ90度回す（steps 回）。回した図面は、写した区画の位置を持たない
export function rotate(bp, data, steps = 1) {
  let cur = bp;
  for (let s = 0; s < (((steps % 4) + 4) % 4); s++) {
    cur = {
      w: cur.h, h: cur.w,
      ents: cur.ents.map((e) => {
        const b = data.buildings[e.id];
        return { ...e, x: cur.h - (e.y + b.h), y: e.x, dir: (e.dir + 1) & 3 };
      }),
    };
  }
  return cur;
}

// 図面を (ox,oy) に貼れるか。同じ物が同じ場所・同じ大きさで置いてあれば重なってよい（向きやレシピは図面に合わせる）
// 戻り値：{ ok, bad: 重なる物の番号の Set, same: 置いてある同じ物の番号の Set }
export function checkPaste(world, bp, ox, oy) {
  const bad = new Set(), same = new Set();
  bp.ents.forEach((e, i) => {
    const x = ox + e.x, y = oy + e.y;
    const here = entAt(world, x, y);
    if (here && !here.fixed && here.id === e.id && here.x === x && here.y === y) { same.add(i); return; }
    if (!canPlace(world, e.id, x, y).ok) bad.add(i);
  });
  return { ok: bad.size === 0, bad, same };
}

// 図面を貼る（先に checkPaste で確かめておく）。置いた・合わせた物の数を返す
export function paste(world, bp, ox, oy) {
  const { ok, same } = checkPaste(world, bp, ox, oy);
  if (!ok) return 0;
  let n = 0;
  bp.ents.forEach((e, i) => {
    const x = ox + e.x, y = oy + e.y;
    if (same.has(i)) {
      const here = entAt(world, x, y);
      here.dir = e.dir & 3;
      if (e.recipe && here.recipe !== e.recipe) setRecipe(world, here, e.recipe);
      if (here.kind === 'sorter') here.filter = e.filter ?? null;
      if (here.kind === 'under' && e.role) here.role = e.role;
      world.dirty = true;
    } else place(world, e.id, x, y, e.dir, e);
    n++;
  });
  return n;
}

// ---- 文字列 ----
// AA1. ＋ JSON を base64（URL で使える字）にしたもの。物は [id, x, y, 向き, {r:レシピ, o:入口か出口か, f:選り分けの素材}]
const toB64 = (s) => btoa(String.fromCharCode(...new TextEncoder().encode(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const fromB64 = (s) => new TextDecoder().decode(Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0)));

export function encode(bp) {
  const o = { w: bp.w, h: bp.h, e: bp.ents.map((e) => {
    const p = {};
    if (e.recipe) p.r = e.recipe;
    if (e.role) p.o = e.role;
    if (e.filter) p.f = e.filter;
    return Object.keys(p).length ? [e.id, e.x, e.y, e.dir, p] : [e.id, e.x, e.y, e.dir];
  }) };
  if (bp.d) { o.d = bp.d; o.x = bp.x; o.y = bp.y; }
  if (bp.full) o.full = 1;
  return PREFIX + toB64(JSON.stringify(o));
}

// 文字列を図面に戻す。読めないとき・おかしな中身のときは { error }
export function decode(str, data) {
  const s = String(str || '').trim();
  if (!s.startsWith(PREFIX)) return { error: '図面の文字列ではない（AA1. で始まる文字列を貼る）' };
  let o;
  try { o = JSON.parse(fromB64(s.slice(PREFIX.length))); } catch { return { error: '図面の文字列が途中で切れているか、壊れている' }; }
  const int = (v) => Number.isInteger(v) && v >= 0 && v < 100;
  if (!o || !int(o.w) || !int(o.h) || !Array.isArray(o.e) || !o.e.length) return { error: '図面の中身が読めない' };
  const ents = [];
  const used = new Set();
  for (const a of o.e) {
    if (!Array.isArray(a)) return { error: '図面の中身が読めない' };
    const [id, x, y, dir, p = {}] = a;
    const b = data.buildings[id];
    if (!b || b.kind === 'source' || b.kind === 'sink') return { error: `知らない設備がある（${id}）` };
    if (!int(x) || !int(y) || ![0, 1, 2, 3].includes(dir) || x + b.w > o.w || y + b.h > o.h) return { error: '図面の中身が読めない' };
    for (let j = 0; j < b.h; j++) for (let i = 0; i < b.w; i++) {
      const k = (y + j) * o.w + x + i;
      if (used.has(k)) return { error: '図面の中で物が重なっている' };
      used.add(k);
    }
    const e = { id, x, y, dir };
    if (p.r) { if (!(b.recipes || []).includes(p.r)) return { error: `${b.name}のレシピが読めない` }; e.recipe = p.r; }
    if (p.o) { if (b.kind !== 'under' || !['in', 'out'].includes(p.o)) return { error: '図面の中身が読めない' }; e.role = p.o; }
    if (p.f) { if (b.kind !== 'sorter' || !data.items[p.f]) return { error: '選り分けの素材が読めない' }; e.filter = p.f; }
    ents.push(e);
  }
  const bp = { w: o.w, h: o.h, ents };
  if (typeof o.d === 'string' && int(o.x) && int(o.y)) { bp.d = o.d; bp.x = o.x; bp.y = o.y; }
  if (o.full && bp.d) bp.full = true;
  return { bp };
}
