// フェーズ4：下をくぐるベルトと魔力
import { test } from 'node:test';
import assert from 'node:assert/strict';
import content from '../src/data/content.js';
import { createWorld, place, run, rate, entAt, rebuild } from '../src/core/sim.js';

const E = 0, S = 1, N = 3;
const world = (w, h, leyline = true) => createWorld({ w, h, leyline }, content);
const belts = (wd, xs, y, dir = E) => xs.forEach((x) => place(wd, 'belt', x, y, dir));

test('下をくぐる：入口から出口へ、間の物の下を通る', () => {
  const w = world(10, 3);
  place(w, 'source', 0, 1, E, { item: 'wood' });
  belts(w, [1], 1);
  place(w, 'under', 2, 1, E, { role: 'in' });
  for (let y = 0; y < 3; y++) place(w, 'belt', 4, y, S); // 横切るベルト（下を通るので邪魔にならない）
  place(w, 'under', 6, 1, E, { role: 'out' });
  belts(w, [7, 8], 1);
  place(w, 'sink', 9, 1);
  run(w, 70 * 10);
  assert.equal(entAt(w, 2, 1).partner, entAt(w, 6, 1));
  assert.equal(rate(w, 'wood'), 120); // ベルトと同じ速さ
});

test('下をくぐる：くぐれるのは間が4マスまで', () => {
  const w = world(10, 3);
  place(w, 'under', 1, 1, E, { role: 'in' });
  place(w, 'under', 7, 1, E, { role: 'out' }); // 間が5マス
  rebuild(w);
  assert.equal(entAt(w, 1, 1).partner, null);
  place(w, 'under', 6, 1, E, { role: 'out' }); // 間が4マス
  rebuild(w);
  assert.equal(entAt(w, 1, 1).partner, entAt(w, 6, 1));
});

test('下をくぐる：くぐっている間は熱が効かない（鉱石が溶けずに通る）', () => {
  const make = (under) => {
    const w = world(12, 5);
    place(w, 'source', 0, 2, E, { item: 'ore' });
    place(w, 'furnace', 4, 3, E); // 熱の範囲は x 2〜7、y 1〜4
    if (under) {
      belts(w, [1], 2);
      place(w, 'under', 2, 2, E, { role: 'in' }); // 入口と出口は熱の中だが、各1マスだけ
      place(w, 'under', 7, 2, E, { role: 'out' });
    } else belts(w, [1, 2, 3, 4, 5, 6, 7], 2);
    belts(w, [8, 9, 10], 2);
    place(w, 'sink', 11, 2);
    run(w, 70 * 10);
    return w;
  };
  const top = make(false), below = make(true);
  assert.equal(rate(top, 'ore'), 0);
  assert.ok(rate(top, 'molten') > 100);
  assert.equal(rate(below, 'molten'), 0);
  assert.ok(rate(below, 'ore') > 100);
});

test('下をくぐる：保存して読み直しても、組がつながる', () => {
  const w = world(8, 3);
  place(w, 'under', 1, 1, E, { role: 'in' });
  place(w, 'under', 4, 1, E, { role: 'out' });
  const o = w.ents.map((e) => ({ id: e.id, x: e.x, y: e.y, dir: e.dir, role: e.role }));
  const v = world(8, 3);
  for (const e of o) place(v, e.id, e.x, e.y, e.dir, e);
  rebuild(v);
  assert.equal(entAt(v, 1, 1).partner, entAt(v, 4, 1));
});

// 地脈のない区画で、研磨機（魔力が要る）を動かす。
// ガラスの口 → 研磨機（2,0）→ 納める口。魔力炉は (2,fy)、燃料の口は (0,3)
function polisherLine({ fy = 2, fuel = true } = {}) {
  const w = world(10, 8, false);
  place(w, 'source', 0, 1, E, { item: 'glass' });
  belts(w, [1], 1);
  place(w, 'polisher', 2, 0, E);
  place(w, 'sink', 4, 1);
  place(w, 'manaFurnace', 2, fy, E);
  if (fuel) {
    place(w, 'source', 0, 3, E, { item: 'fuel' });
    belts(w, [1], 3);
  }
  return w;
}

test('魔力：地脈のない区画では、魔力炉の範囲の外の研磨機は動かない', () => {
  const w = polisherLine({ fy: 3 }); // 範囲は y 1〜6。研磨機（y 0〜1）ははみ出す
  run(w, 70 * 10);
  assert.equal(rate(w, 'lens'), 0);
  assert.equal(entAt(w, 2, 0).status, 'no-mana');
});

test('魔力：燃料がないと動かない。燃料を入れると動く', () => {
  const dry = polisherLine({ fuel: false });
  run(dry, 70 * 10);
  assert.equal(rate(dry, 'lens'), 0);
  assert.equal(entAt(dry, 2, 0).status, 'no-fuel'); // 範囲の中だが、炉に燃料がない
  const wet = polisherLine();
  run(wet, 70 * 10);
  assert.equal(rate(wet, 'lens'), 15);
});

test('魔力：魔力炉は燃料1個を10秒（毎分6）で燃やす。範囲に機械がなければ燃やさない', () => {
  const w = world(10, 8, false);
  const f = place(w, 'manaFurnace', 2, 2, E);
  f.fuel = 3;
  run(w, 100);
  assert.equal(f.fuel, 3); // 魔力の要る機械がない
  place(w, 'polisher', 2, 0, E);
  let ticks = 0;
  while ((f.fuel > 0 || f.burn > 0) && ticks < 10000) { run(w, 1); ticks++; }
  assert.equal(ticks, 300);
});

test('魔力：範囲の機械が5台だと、全部が 4/5 の速さになる', () => {
  const w = world(16, 12, false);
  place(w, 'manaFurnace', 6, 6, E).fuel = 4; // 範囲 x 4〜9、y 4〜9
  const spots = [[4, 4], [8, 4], [4, 8], [8, 8], [4, 6]];
  for (const [x, y] of spots) place(w, 'polisher', x, y, N);
  run(w, 5);
  assert.equal(entAt(w, 6, 6).covers.length, 5);
  for (const [x, y] of spots) {
    const m = entAt(w, x, y);
    assert.deepEqual([m.pn, m.pd], [4, 5]);
  }
});

test('魔力：竜炉も魔力がないと熱を出さない（地脈のない区画）', () => {
  const w = world(12, 8, false);
  place(w, 'furnace', 4, 2, E);
  run(w, 5);
  assert.equal(w.fields.heat[2 * w.w + 4], 0);
  const f = place(w, 'manaFurnace', 4, 4, E); // 範囲 x 2〜7、y 2〜7 → 竜炉（4〜5, 2〜3）が入る
  f.fuel = 2;
  run(w, 5);
  assert.ok(w.fields.heat[2 * w.w + 4] > 0);
});
