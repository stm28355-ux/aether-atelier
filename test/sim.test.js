import { test } from 'node:test';
import assert from 'node:assert/strict';
import data from '../src/data/proto.js';
import {
  createWorld, place, remove, canPlace, run, rate, serialize, load, snapshot, entAt, fieldActive,
} from '../src/core/sim.js';
import { plan } from '../src/core/calc.js';

const E = 0, S = 1, N = 3;
const belts = (w, list) => list.forEach(([x, y, d]) => assert.ok(place(w, 'belt', x, y, d), `belt ${x},${y}`));
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a}（狙い ${b}±${tol}）`);

test('ベルト1本は毎分120個を運ぶ', () => {
  const w = createWorld({ w: 10, h: 3 }, data);
  place(w, 'source', 0, 1, E, { item: 'wood' });
  belts(w, [1, 2, 3, 4, 5, 6].map((x) => [x, 1, E]));
  place(w, 'sink', 7, 1);
  run(w, 1000);
  near(rate(w, 'wood'), 120, 1, '毎分');
});

test('行き先がないと詰まって止まる（物は消えない）', () => {
  const w = createWorld({ w: 10, h: 3 }, data);
  place(w, 'source', 0, 1, E, { item: 'wood' });
  belts(w, [1, 2, 3, 4, 5].map((x) => [x, 1, E]));
  run(w, 300);
  const count = () => w.ents.filter((e) => e.kind === 'belt' && e.item).length;
  assert.equal(count(), 5);
  run(w, 100);
  assert.equal(count(), 5);
});

test('合流は交互に通す', () => {
  const w = createWorld({ w: 6, h: 3 }, data);
  place(w, 'source', 0, 0, E, { item: 'wood' });
  place(w, 'source', 0, 2, E, { item: 'ore' });
  belts(w, [[1, 0, E], [2, 0, S], [1, 2, E], [2, 2, N], [2, 1, E], [3, 1, E]]);
  place(w, 'sink', 4, 1);
  run(w, 1500);
  near(rate(w, 'wood'), 60, 1, '木材');
  near(rate(w, 'ore'), 60, 1, '鉱石');
});

test('分岐は左右に同じ数を分ける', () => {
  const w = createWorld({ w: 6, h: 5 }, data);
  place(w, 'source', 0, 2, E, { item: 'wood' });
  belts(w, [[1, 2, E], [2, 1, N], [2, 3, S]]);
  place(w, 'splitter', 2, 2, E);
  const a = place(w, 'sink', 2, 0);
  const b = place(w, 'sink', 2, 4);
  run(w, 1000);
  assert.ok(a.count.wood > 50);
  assert.ok(Math.abs(a.count.wood - b.count.wood) <= 1);
});

test('分岐は詰まった側を飛ばす', () => {
  const w = createWorld({ w: 6, h: 5 }, data);
  place(w, 'source', 0, 2, E, { item: 'wood' });
  belts(w, [[1, 2, E], [2, 1, N], [2, 3, S]]);
  place(w, 'splitter', 2, 2, E);
  place(w, 'sink', 2, 0);
  run(w, 1000);
  near(rate(w, 'wood'), 120, 1, '片側に全部');
});

test('機械はレシピの速さで作り、正面から出す', () => {
  const w = createWorld({ w: 8, h: 4 }, data);
  place(w, 'source', 0, 1, E, { item: 'wood' });
  belts(w, [[1, 1, E], [4, 1, E]]);
  const saw = place(w, 'saw', 2, 1, E);
  place(w, 'sink', 5, 1);
  run(w, 2000);
  assert.equal(rate(w, 'plank'), 30);
  assert.equal(rate(w, 'wood'), 0);
  assert.equal(saw.status, 'working');
});

test('機械は正面からは受け取らず、レシピにない素材も受け取らない', () => {
  const w = createWorld({ w: 8, h: 4 }, data);
  place(w, 'source', 5, 1, 2, { item: 'wood' }); // 正面（右）から入れようとする
  place(w, 'belt', 4, 1, 2);
  const saw = place(w, 'saw', 2, 1, E);
  place(w, 'source', 0, 2, E, { item: 'ore' }); // レシピにない素材
  place(w, 'belt', 1, 2, E);
  run(w, 200);
  assert.deepEqual(saw.inbuf, {});
  assert.equal(saw.status, 'waiting');
  assert.equal(entAt(w, 1, 2).item.t, 'ore');
});

test('熱の範囲を3マス通ると溶け、2マスなら溶けない', () => {
  const mk = () => {
    const w = createWorld({ w: 12, h: 10 }, data);
    place(w, 'furnace', 5, 5); // 範囲は x3〜8, y3〜8
    return w;
  };
  const a = mk();
  assert.ok(fieldActive(a, 'heat', 3, 3) || (run(a, 1), fieldActive(a, 'heat', 3, 3)));
  assert.ok(!fieldActive(a, 'heat', 2, 3));
  place(a, 'source', 0, 3, E, { item: 'ore' });
  belts(a, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((x) => [x, 3, E]));
  place(a, 'sink', 11, 3);
  run(a, 1000);
  near(rate(a, 'molten'), 120, 1, '溶けた鉱石');
  assert.equal(a.delivered.ore, undefined);

  const b = mk();
  place(b, 'source', 0, 3, E, { item: 'ore' });
  belts(b, [[1, 3, E], [2, 3, E], [3, 3, E], [4, 3, N], [4, 2, N], [4, 1, N]]);
  place(b, 'sink', 4, 0);
  run(b, 1000);
  near(rate(b, 'ore'), 120, 1, '鉱石のまま');
  assert.equal(b.delivered.molten, undefined);
});

// 区1のお手本：同じ鉱石から、熱を通して金属板、通さずに鉱石粉
function district1() {
  const w = createWorld({ w: 20, h: 14 }, data);
  place(w, 'source', 0, 6, E, { item: 'ore', fixed: true });
  place(w, 'belt', 1, 6, E);
  place(w, 'splitter', 2, 6, E);
  place(w, 'furnace', 5, 1); // 範囲は x3〜8, y0〜4
  belts(w, [[2, 5, N], [2, 4, E], ...[3, 4, 5, 6, 7, 8, 9].map((x) => [x, 4, E])]);
  place(w, 'caster', 10, 4, E);
  belts(w, [[12, 4, E], [13, 4, E]]);
  place(w, 'sink', 14, 4, E, { fixed: true });
  belts(w, [[2, 7, S], [2, 8, E], [3, 8, E]]);
  place(w, 'crusher', 4, 8, E);
  belts(w, [[6, 8, E], [7, 8, E]]);
  place(w, 'sink', 8, 8, E, { fixed: true });
  return w;
}

test('区1のお手本：金属板と鉱石粉を毎分30個ずつ', () => {
  const w = district1();
  run(w, 3000);
  assert.equal(rate(w, 'plate'), 30);
  assert.equal(rate(w, 'dust'), 30);
});

test('同じ配置なら同じ結果。保存して読み直しても同じ', () => {
  const a = district1();
  const b = district1();
  const c = load(JSON.parse(JSON.stringify(serialize(a))), data);
  run(a, 1234); run(b, 1234); run(c, 1234);
  assert.equal(snapshot(a), snapshot(b));
  assert.equal(snapshot(a), snapshot(c));
});

test('置けない場所と、壊せない物', () => {
  const w = createWorld({ w: 5, h: 5, blocked: [[4, 4]] }, data);
  assert.ok(place(w, 'saw', 1, 1));
  assert.equal(canPlace(w, 'belt', 2, 2).ok, false);
  assert.equal(canPlace(w, 'saw', 4, 0).ok, false);
  assert.equal(canPlace(w, 'belt', 4, 4).ok, false);
  place(w, 'source', 0, 0, E, { item: 'wood', fixed: true });
  assert.equal(remove(w, 0, 0), false);
  assert.equal(remove(w, 2, 2), true);
  assert.equal(canPlace(w, 'belt', 1, 1).ok, true);
});

test('台数計算：金属板と鉱石粉を毎分30個ずつ', () => {
  const p = plan(data, { plate: 30, dust: 30 });
  assert.equal(p.machines.plate.count, 1);
  assert.equal(p.machines.dust.count, 1);
  assert.equal(p.raw.ore, 60);
  assert.equal(p.ports.ore, 1);
  assert.equal(p.fields['heat:ore'].tiles, 3);
  const q = plan(data, { plate: 100 });
  assert.equal(q.machines.plate.count, 4);
});
