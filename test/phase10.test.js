// フェーズ10：第2部の新しい仕組み（副産物・時間で変わる・光の範囲・増える・速いベルト・優先分岐・精製燃料）
import { test } from 'node:test';
import assert from 'node:assert/strict';
import content, { trialDistricts } from '../src/data/content.js';
import { createWorld, place, run, rate, entAt } from '../src/core/sim.js';
import { createGame, recipesFor, unlocked } from '../src/core/game.js';

const E = 0, S = 1, W = 2, N = 3;
const world = (w, h, leyline = true) => createWorld({ w, h, leyline }, content);
const belts = (wd, xs, y, dir = E, id = 'belt') => xs.forEach((x) => place(wd, id, x, y, dir));

test('副産物：精製器は精製エーテルと澱を交互に出す', () => {
  const w = world(6, 2);
  place(w, 'source', 0, 0, E, { item: 'aether' });
  place(w, 'refiner', 1, 0, E);
  belts(w, [3, 4], 0); place(w, 'sink', 5, 0);
  run(w, 70 * 10);
  assert.equal(rate(w, 'refined'), 30);
  assert.equal(rate(w, 'sludge'), 30);
});

test('副産物：澱を受け取れない機械へ直につなぐと、澱がたまって精製器が止まる。選り分けで澱をよけると流れる', () => {
  const make = (sort) => {
    const w = world(9, 3);
    place(w, 'source', 0, 0, E, { item: 'aether' });
    place(w, 'refiner', 1, 0, E);
    if (sort) { place(w, 'sorter', 3, 0, E, { filter: 'sludge' }); place(w, 'belt', 3, 1, S); place(w, 'sink', 3, 2); }
    else place(w, 'belt', 3, 0, E);
    place(w, 'still', 4, 0, E, { recipe: 'refuel' });
    belts(w, [5, 6, 7], 0); place(w, 'sink', 8, 0);
    run(w, 70 * 10);
    return w;
  };
  const jam = make(false), ok = make(true);
  assert.equal(rate(jam, 'refuel'), 0);
  assert.equal(entAt(jam, 1, 0).status, 'blocked');
  assert.equal(rate(ok, 'refuel'), 30);
});

test('時間で変わる：浮遊石の素は6秒（60刻み）で石くず。冷気の中では止まる', () => {
  const make = (cold) => {
    const w = world(17, 5);
    place(w, 'source', 0, 2, E, { item: 'floatmix' });
    belts(w, Array.from({ length: 15 }, (_, i) => i + 1), 2);
    place(w, 'sink', 16, 2);
    if (cold) place(w, 'frostPillar', 8, 1, E); // 冷気は x 6〜10（5マス）
    run(w, 70 * 10);
    return w;
  };
  const warm = make(false), cool = make(true);
  // 15マス＝75刻みかかるので、冷気がないと途中で石くずになる
  assert.equal(rate(warm, 'floatmix'), 0);
  assert.ok(rate(warm, 'gravel') >= 110);
  // 冷気の5マス（25刻み）は時間が止まるので、ちょうど間に合う
  assert.ok(rate(cool, 'floatmix') >= 110, `冷気あり ${rate(cool, 'floatmix')}`);
});

test('速いベルト：1マスを2刻み（ふつうの2.5倍）。ふつうなら石くずになる距離でも間に合う', () => {
  const w = world(20, 1);
  place(w, 'source', 0, 0, E, { item: 'floatmix' });
  belts(w, Array.from({ length: 17 }, (_, i) => i + 1), 0, E, 'fastBelt');
  place(w, 'sink', 18, 0);
  run(w, 70 * 10);
  assert.ok(rate(w, 'floatmix') >= 110, `速いベルト ${rate(w, 'floatmix')}`);
  // 速いベルトは毎分240以上運べる（2つの口から合流させる）
  const v = world(8, 3);
  place(v, 'source', 0, 1, E, { item: 'aether' }); // 毎分120
  place(v, 'source', 2, 0, S, { item: 'aether' }); // 毎分120（横から合流）
  belts(v, [1, 2, 3, 4, 5, 6], 1, E, 'fastBelt'); place(v, 'sink', 7, 1);
  run(v, 70 * 10);
  assert.ok(rate(v, 'aether') >= 230, `毎分 ${rate(v, 'aether')}`);
});

test('光の範囲：灯り台の光の中を4マス進んだ胞子は光る苔になる', () => {
  const w = world(10, 3);
  place(w, 'source', 0, 1, E, { item: 'spore' });
  belts(w, [1, 2, 3, 4, 5, 6, 7, 8], 1);
  place(w, 'sink', 9, 1);
  place(w, 'lightPost', 4, 0, E); // 光は x 2〜6（5マス）
  run(w, 70 * 10);
  assert.equal(rate(w, 'moss'), 120);
  assert.equal(rate(w, 'spore'), 0);
});

test('増える：育て床は光る苔1とエーテル水1から光る苔2', () => {
  const w = world(6, 3);
  place(w, 'source', 0, 0, S, { item: 'moss' });
  place(w, 'source', 0, 2, N, { item: 'aether' });
  place(w, 'belt', 0, 1, E);
  place(w, 'planter', 1, 0, E);
  belts(w, [3, 4], 0); place(w, 'sink', 5, 0);
  run(w, 70 * 10);
  assert.equal(rate(w, 'moss'), 30); // 1台で毎分15回、2つずつ
});

test('優先分岐：正面に入れられるときは正面へ、詰まっているときだけ横へ', () => {
  const w = world(6, 3);
  place(w, 'source', 0, 1, E, { item: 'aether', interval: 10 }); // 毎分60
  place(w, 'prioritySplitter', 1, 1, E);
  belts(w, [2, 3], 1); place(w, 'sink', 4, 1);
  place(w, 'belt', 1, 0, N); place(w, 'sink', 1, 2); place(w, 'sink', 0, 0); // 横の行き先
  run(w, 70 * 10);
  assert.equal(rate(w, 'aether'), 60);
  assert.equal(entAt(w, 4, 1).count.aether > 0, true);
  assert.equal(entAt(w, 1, 2).count.aether ?? 0, 0); // 正面が空いているので横へは行かない
});

test('精製燃料：魔力炉で燃料2つ分', () => {
  const w = world(4, 3, false);
  place(w, 'source', 0, 0, E, { item: 'refuel', interval: 9999 });
  const mf = place(w, 'manaFurnace', 1, 0, E);
  place(w, 'furnace', 1, 2, E); // 魔力の要る機械（炉が燃えるように）
  run(w, 3);
  assert.equal(mf.fuel + (mf.burning ? 1 : 0), 2);
});

test('第2部のレシピ（第1部の機械に足す物）は、本編では区画が開くまで選べない。試作の区画では選べる', () => {
  const g = createGame(content, { v: 1, open: ['d0', 'd1', 'd2', 'd3', 'd4', 'd5', 'd6', 'd7'], done: {}, cleared: {}, made: {}, layouts: {} });
  assert.deepEqual(recipesFor(g, 'still'), ['fuel']);
  assert.deepEqual(recipesFor(g, 'press'), ['gear']);
  const trial = { ...content, districts: trialDistricts };
  const t = createGame(trial, { v: 1, open: trialDistricts.map((d) => d.id), done: {}, cleared: {}, made: {}, layouts: {} });
  assert.deepEqual(recipesFor(t, 'still'), ['fuel', 'refuel']);
  assert.ok(['refiner', 'steeper', 'lightPost', 'planter', 'fastBelt', 'prioritySplitter'].every((b) => unlocked(t).includes(b)));
});
