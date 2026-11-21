// フェーズ5：相乗・揺れ・冷気と打ち消し・選り分け・あふれ口・混ざって出る口・大きな機械の魔力
import { test } from 'node:test';
import assert from 'node:assert/strict';
import content from '../src/data/content.js';
import { createWorld, place, run, rate, entAt, rebuild, backRate } from '../src/core/sim.js';

const E = 0, S = 1, W = 2, N = 3;
const world = (w, h, leyline = true) => createWorld({ w, h, leyline }, content);
const belts = (wd, xs, y, dir = E) => xs.forEach((x) => place(wd, 'belt', x, y, dir));
const credit = (s) => { s.credit = 3; };

// 金属板の口 → 旋盤 n 台（縦に並べる）→ 納める口
function lathes(n, gap = false) {
  const w = world(6, 8);
  const out = [];
  for (let k = 0; k < n; k++) {
    const y = k * (gap ? 2 : 1);
    place(w, 'source', 0, y, E, { item: 'plate' });
    place(w, 'lathe', 1, y, E);
    belts(w, [2], y);
    out.push(y);
  }
  for (const y of out) place(w, 'sink', 3, y);
  return w;
}

test('相乗：旋盤は1台でねじ毎分30。辺で接すると1台ごとに+25%、2台まで', () => {
  const one = lathes(1); run(one, 70 * 10);
  assert.equal(rate(one, 'screw'), 30);
  const apart = lathes(2, true); run(apart, 70 * 10);
  assert.equal(rate(apart, 'screw'), 60);
  const pair = lathes(2); run(pair, 70 * 10);
  assert.ok(rate(pair, 'screw') >= 74 && rate(pair, 'screw') <= 76, `2台 ${rate(pair, 'screw')}`);
  const three = lathes(3); run(three, 70 * 10);
  assert.deepEqual([0, 1, 2].map((y) => entAt(three, 1, y).syn), [1, 2, 1]); // 真ん中は+50%
});

test('揺れ：プレス機の周り2マスに1マスでも入ったからくり台は止まる。離すと動く', () => {
  const make = (px) => {
    const w = world(14, 5);
    const wb = place(w, 'workbench', 0, 1, E);
    for (const [t, y] of [['frame', 0], ['gear', 4]]) { place(w, 'source', 1, y, S, { item: t }); }
    place(w, 'source', 3, 0, S, { item: 'screw' }); // 上の辺の右端から入れる
    place(w, 'belt', 3, 1, W);
    place(w, 'sink', 3, 2);
    wb.dir = E;
    place(w, 'press', px, 1, E);
    rebuild(w);
    return w;
  };
  const near = make(4), far = make(5); // からくり台の右端は x=2。プレス機の揺れは周り2マス（x=4 なら x=2 まで届く）
  assert.equal(entAt(near, 0, 1).shaken, true);
  assert.equal(entAt(far, 0, 1).shaken, false);
  run(near, 50);
  assert.equal(entAt(near, 0, 1).status, 'shaken');
});

test('選り分け：選んだ素材だけ左右へ、残りは正面へ。選んでいなければ全部正面へ', () => {
  const make = (filter) => {
    const w = world(8, 5);
    const src = place(w, 'source', 0, 2, E, { item: 'plate', imported: true, extra: 'aether' });
    belts(w, [1], 2);
    place(w, 'sorter', 2, 2, E, { filter });
    belts(w, [3, 4], 2); place(w, 'sink', 5, 2); // 正面
    place(w, 'belt', 2, 1, N); place(w, 'sink', 2, 0); // 左
    place(w, 'belt', 2, 3, S); place(w, 'sink', 2, 4); // 右
    for (let i = 0; i < 70 * 10; i++) { credit(src); run(w, 1); }
    return w;
  };
  const w = make('aether');
  assert.equal(entAt(w, 5, 2).count.aether, undefined);
  assert.ok(entAt(w, 5, 2).count.plate > 50);
  assert.ok(entAt(w, 2, 0).count.aether > 20 && entAt(w, 2, 4).count.aether > 20); // 左右へ順に
  assert.equal(entAt(w, 2, 0).count.plate, undefined);
  const none = make(null);
  assert.ok(entAt(none, 5, 2).count.aether > 50 && entAt(none, 5, 2).count.plate > 50);
});

test('混ざって出る口：前の区画の物が届いていれば交互に、届いていなければ倉庫の原料だけ出る', () => {
  const w = world(4, 1);
  place(w, 'source', 0, 0, E, { item: 'plate', imported: true, extra: 'aether' });
  belts(w, [1, 2], 0); place(w, 'sink', 3, 0);
  run(w, 70 * 10);
  assert.equal(rate(w, 'plate'), 0);
  assert.equal(rate(w, 'aether'), 120);
  const v = world(4, 1);
  const s = place(v, 'source', 0, 0, E, { item: 'plate', imported: true, extra: 'aether' });
  belts(v, [1, 2], 0); place(v, 'sink', 3, 0);
  for (let i = 0; i < 70 * 10; i++) { credit(s); run(v, 1); }
  assert.equal(rate(v, 'plate'), 60);
  assert.equal(rate(v, 'aether'), 60);
});

test('あふれ口：先が詰まった物は倉庫へ戻し、後ろのベルトは止まらない', () => {
  // 鉱石と木材を混ぜて製材機へ。製材機は鉱石を受け取れないので、あふれ口がないと詰まる
  const make = (overflow) => {
    const w = world(8, 3);
    place(w, 'source', 0, 1, E, { item: 'wood', interval: 10 });
    place(w, 'source', 2, 0, S, { item: 'ore', interval: 20 });
    belts(w, [1, 2, 3], 1);
    if (overflow) place(w, 'overflow', 4, 1, E); else belts(w, [4], 1);
    place(w, 'saw', 5, 1, E);
    place(w, 'sink', 7, 1);
    run(w, 70 * 10);
    return w;
  };
  const jam = make(false), flow = make(true);
  assert.equal(rate(jam, 'plank'), 0);
  assert.equal(rate(flow, 'plank'), 30);
  assert.ok(backRate(flow) >= 25); // 鉱石（毎分30）と、製材機が受け取りきれない木材の一部
});

test('冷気：エーテル水は4マスで結晶。熱と重なったマスでは打ち消されて変わらない', () => {
  const make = (withHeat) => {
    const w = world(10, 5);
    place(w, 'source', 0, 2, E, { item: 'aether' });
    belts(w, [1, 2, 3, 4, 5, 6, 7, 8], 2);
    place(w, 'sink', 9, 2);
    place(w, 'frostPillar', 4, 1, E); // 冷気は x 2〜6、y 0〜3（ベルトの上は5マス）
    if (withHeat) place(w, 'furnace', 4, 3, E); // 熱は x 2〜7、y 1〜6。冷気と全部重なる
    run(w, 70 * 10);
    return w;
  };
  const cold = make(false), both = make(true);
  assert.equal(rate(cold, 'crystal'), 120);
  assert.equal(rate(both, 'crystal'), 0);
  assert.equal(rate(both, 'aether'), 120);
});

test('焼き入れ：金属板は熱で赤熱し、そのあと冷気2マスで焼き入れ鋼になる', () => {
  const w = world(16, 5);
  place(w, 'source', 0, 2, E, { item: 'plate' });
  belts(w, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14], 2);
  place(w, 'sink', 15, 2);
  place(w, 'furnace', 2, 3, E); // 熱は x 0〜5
  place(w, 'frostPillar', 10, 1, E); // 冷気は x 8〜12（熱と重ならない）
  run(w, 70 * 10);
  assert.equal(rate(w, 'steel'), 120);
});

test('魔力：3×3のからくり台は魔力炉1つの範囲に入りきらない。2つで挟むと、合わせた範囲で動く', () => {
  const make = (two) => {
    const w = world(14, 7, false);
    const wb = place(w, 'workbench', 5, 2, S);
    place(w, 'manaFurnace', 3, 2, E).fuel = 4;
    if (two) place(w, 'manaFurnace', 8, 2, E).fuel = 4;
    run(w, 2); // 炉が燃え始める
    return wb;
  };
  const one = make(false), both = make(true);
  assert.equal(one.covered, false);
  assert.equal(both.covered, true);
  assert.deepEqual([both.suppliers.length, both.pn, both.pd], [2, 1, 1]);
});
