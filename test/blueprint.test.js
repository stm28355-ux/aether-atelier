// フェーズ6：図面（範囲のコピペ・回す・文字列で渡す）
import { test } from 'node:test';
import assert from 'node:assert/strict';
import content from '../src/data/content.js';
import { createGame, run, setLayout, districtBlueprint, pasteCheck, pasteInto, replaceWithBlueprint } from '../src/core/game.js';
import { rate, entAt } from '../src/core/sim.js';
import { copyArea, rotate, encode, decode } from '../src/core/blueprint.js';
import { MODEL } from './models.js';

const DISTRICTS = Object.keys(MODEL);
const allOpen = (layouts = MODEL) => createGame(content, {
  v: 1, open: DISTRICTS, done: Object.fromEntries(content.districts.map((d) => [d.id, d.requests.length])),
  cleared: {}, made: {}, layouts: { ...layouts },
});
// 置いた物の並び（比べる用）
const shape = (w) => w.ents.filter((e) => !e.fixed).map((e) => [e.id, e.x, e.y, e.dir, e.recipe ?? '', e.role ?? '', e.filter ?? ''].join()).sort();

test('区画をまるごと写して文字列にし、何も置いていない区画に戻すと、同じ配置で同じ量を作る', () => {
  const g = allOpen();
  for (const id of ['d1', 'd3', 'd5', 'd7']) {
    const bp = decode(encode(districtBlueprint(g, id)), content).bp;
    assert.equal(bp.full, true);
    const h = allOpen({ ...MODEL, [id]: [] });
    const r = replaceWithBlueprint(h, id, bp);
    assert.ok(r.ok, `${id} ${r.reason}`);
    assert.deepEqual(shape(h.worlds[id]), shape(g.worlds[id]), id);
  }
  const h = allOpen({ ...MODEL, d3: [] });
  replaceWithBlueprint(h, 'd3', districtBlueprint(g, 'd3'));
  run(h, 4 * 60 * 10);
  assert.equal(rate(h.worlds.d3, 'glass'), 30);
  assert.equal(rate(h.worlds.d3, 'lens'), 15);
});

test('ほかの区画の図面では、区画を置き換えない', () => {
  const g = allOpen();
  assert.equal(replaceWithBlueprint(g, 'd2', districtBlueprint(g, 'd1')).ok, false);
});

test('範囲を写すと、外側の空きを詰める。倉庫の口は写さない', () => {
  const g = allOpen();
  const bp = copyArea(g.worlds.d0, 0, 0, 8, 6);
  assert.equal(bp.x, 1); // 区0の口（x=0）は写さず、x=1 のベルトから
  assert.ok(bp.ents.every((e) => e.id !== 'source' && e.id !== 'sink'));
  assert.equal(copyArea(g.worlds.d0, 0, 7, 8, 8), null); // 何もない範囲
});

test('右へ4回回すと元に戻る。2×2の機械は向きと位置が回る', () => {
  const g = allOpen();
  const bp = copyArea(g.worlds.d1, 0, 0, 11, 6);
  const norm = (b) => b.ents.map((e) => [e.id, e.x, e.y, e.dir].join()).sort();
  assert.deepEqual(norm(rotate(bp, content, 4)), norm(bp));
  const one = rotate({ w: 3, h: 2, ents: [{ id: 'caster', x: 0, y: 0, dir: 0 }, { id: 'belt', x: 2, y: 0, dir: 0 }] }, content);
  assert.deepEqual([one.w, one.h], [2, 3]);
  assert.deepEqual(one.ents, [{ id: 'caster', x: 0, y: 0, dir: 1 }, { id: 'belt', x: 1, y: 2, dir: 1 }]);
});

test('回して貼れる：区0の製材機の列を半回転して、何も置いていない区0に貼る', () => {
  const g = allOpen();
  const bp = rotate(rotate(copyArea(g.worlds.d0, 1, 0, 7, 6), content), content); // 半回転（2×2 の製材機が全部入る範囲）
  const h = allOpen({ ...MODEL, d0: [] });
  const ox = 1, oy = 0;
  const c = pasteCheck(h, 'd0', bp, ox, oy);
  assert.ok(c.ok, c.reason);
  assert.ok(pasteInto(h, 'd0', bp, ox, oy));
  assert.equal(h.worlds.d0.ents.filter((e) => e.id === 'saw').length, 3);
});

test('貼れないとき：ほかの物と重なる、まだ使えない設備、台数の上限', () => {
  const g = allOpen();
  const bp = copyArea(g.worlds.d1, 0, 0, 11, 6);
  // 同じ場所に同じ物があるのは重なってよい（何も増えない）
  assert.ok(pasteCheck(g, 'd1', bp, bp.x, bp.y).ok);
  const before = g.worlds.d1.ents.length;
  assert.ok(pasteInto(g, 'd1', bp, bp.x, bp.y));
  assert.equal(g.worlds.d1.ents.length, before);
  // 1マスずらすと重なる
  const off = pasteCheck(g, 'd1', bp, bp.x + 1, bp.y);
  assert.equal(off.ok, false);
  assert.ok(off.bad.size > 0);
  // まだ使えない設備（区0だけ開いた状態で、竜炉の入った図面）
  const early = createGame(content);
  const r = pasteCheck(early, 'd0', { w: 2, h: 2, ents: [{ id: 'furnace', x: 0, y: 0, dir: 0 }] }, 3, 0);
  assert.equal(r.ok, false);
  assert.match(r.reason, /まだ使えない設備/);
  // 台数の上限（区4の旋盤は2台まで。もう2台ある）
  const lathe = pasteCheck(g, 'd4', { w: 1, h: 1, ents: [{ id: 'lathe', x: 0, y: 0, dir: 0 }] }, 9, 3);
  assert.equal(lathe.ok, false);
  assert.match(lathe.reason, /2台まで/);
});

test('貼ると、図面のレシピ・選り分けの素材・下をくぐるベルトの入口と出口も写る', () => {
  const g = allOpen();
  const src = g.worlds.d7.ents.find((e) => e.id === 'polisher');
  assert.equal(src.recipe, 'lensAlt');
  const bp = decode(encode(copyArea(g.worlds.d7, src.x, src.y, src.x + 1, src.y + 1)), content).bp;
  assert.equal(bp.ents[0].recipe, 'lensAlt');
  const sorterBp = decode(encode(copyArea(g.worlds.d5, 2, 3, 2, 3)), content).bp;
  assert.equal(sorterBp.ents[0].filter, 'aether');
  const under = g.worlds.d4.ents.filter((e) => e.id === 'under');
  const ubp = decode(encode(copyArea(g.worlds.d4, 0, 0, 11, 1)), content).bp;
  assert.deepEqual(ubp.ents.filter((e) => e.id === 'under').map((e) => e.role).sort(), under.map((e) => e.role).sort());
});

test('読めない文字列は図面にしない', () => {
  assert.ok(decode('', content).error);
  assert.ok(decode('hello', content).error);
  assert.ok(decode('AA1.@@@', content).error);
  const bad = (o) => decode(`AA1.${Buffer.from(JSON.stringify(o)).toString('base64url')}`, content).error;
  assert.ok(bad({ w: 2, h: 1, e: [['dragon', 0, 0, 0]] }), '知らない設備');
  assert.ok(bad({ w: 2, h: 1, e: [['source', 0, 0, 0]] }), '倉庫の口');
  assert.ok(bad({ w: 1, h: 1, e: [['belt', 0, 0, 0], ['belt', 0, 0, 1]] }), '重なり');
  assert.ok(bad({ w: 2, h: 2, e: [['caster', 0, 0, 0, { r: 'gear' }]] }), 'ないレシピ');
  assert.ok(bad({ w: 1, h: 1, e: [['belt', 0, 0, 7]] }), '向き');
  assert.equal(bad({ w: 2, h: 2, e: [['caster', 0, 0, 0, { r: 'plate' }]] }), undefined);
});

test('貼ったあとも同じ配置：区画をまるごと置き換えても、残っている物（燃料）はそのまま', () => {
  const g = allOpen();
  run(g, 60 * 10);
  const mf = g.worlds.d3.ents.find((e) => e.id === 'manaFurnace');
  const fuel = mf.fuel;
  assert.ok(replaceWithBlueprint(g, 'd3', districtBlueprint(g, 'd3')).ok);
  assert.equal(entAt(g.worlds.d3, mf.x, mf.y), mf); // 置き直していない
  assert.equal(mf.fuel, fuel);
  setLayout(g, 'd3', MODEL.d3);
});
