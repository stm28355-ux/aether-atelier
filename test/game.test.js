import { test } from 'node:test';
import assert from 'node:assert/strict';
import content from '../src/data/content.js';
import {
  createGame, run, perMin, startCleanup, save, unlocked, PORT_CAP,
} from '../src/core/game.js';
import { rate, canPlace, snapshot } from '../src/core/sim.js';

const E = 0, S = 1, W = 2, N = 3;
const b = (x, y, dir) => ({ id: 'belt', x, y, dir });
const m = (id, x, y, dir = E) => ({ id, x, y, dir });

// お手本の配置（区画を小さくしても依頼が納まることを守る）
export const MODEL = {
  // 板を毎分90：製材機3台を分岐で並べる（9×7）
  d0: [
    b(1, 3, E), m('splitter', 2, 3), b(2, 2, N), b(2, 1, E), b(2, 4, S), b(2, 5, E),
    m('saw', 3, 0), m('saw', 3, 3), m('saw', 3, 5),
    b(5, 1, S), b(5, 2, S), b(5, 3, E), b(5, 5, N), b(5, 4, N), b(6, 3, E), b(7, 3, E),
  ],
  // 金属板を毎分60と鉱石粉を毎分30：鉱石を分けて、片方は熱を通す（12×7）
  d1: [
    b(1, 4, E), m('splitter', 2, 4), m('crusher', 3, 4),
    b(2, 3, N), b(2, 2, E), b(3, 2, E), b(4, 2, E), b(5, 2, E), m('splitter', 6, 2),
    m('furnace', 4, 0), m('caster', 7, 2), b(6, 1, N), b(6, 0, E), m('caster', 7, 0),
    b(9, 1, S), b(9, 2, S), b(9, 3, S), b(9, 4, E), b(10, 4, E),
    b(5, 4, E), b(6, 4, E), b(7, 4, E), b(8, 4, E),
  ],
  // 枠を毎分20と歯車を毎分30：前の区画から板と金属板を受け取る（9×6）
  d2: [
    b(1, 1, E), m('assembler', 2, 1), b(1, 4, E), m('press', 2, 4),
    b(4, 1, S), b(4, 2, E), b(4, 4, N), b(4, 3, N), b(5, 2, E), b(6, 2, E), b(7, 2, E),
  ],
  // ガラスを毎分30とレンズを毎分15：地脈がないので、竜炉と研磨機を魔力炉の範囲に入れる（12×7）
  d3: [
    m('mixer', 1, 1, N), b(1, 3, N), // 砂は口から直接、鉱石粉は下から
    b(2, 0, E), b(3, 0, E), b(4, 0, E), b(5, 0, E), b(6, 0, E), b(7, 0, E), b(8, 0, E), b(9, 0, E), // 熱の中を6マス
    m('furnace', 4, 1), m('manaFurnace', 6, 3),
    b(10, 0, S), b(10, 1, S), m('splitter', 10, 2, S), // 半分は納める口へ
    b(10, 3, S), b(10, 4, W), b(9, 4, S), m('polisher', 8, 5, E), b(10, 5, E), b(11, 5, N), b(11, 4, N), b(11, 3, N),
    m('still', 1, 6, E), b(2, 6, E), b(3, 6, E), b(4, 6, E), b(5, 6, N), b(5, 5, N), b(5, 4, E), // 燃料
  ],
};

const DISTRICTS = Object.keys(MODEL);
function allOpen(extra = {}) {
  return createGame(content, { v: 1, open: DISTRICTS, done: {}, cleared: {}, layouts: { ...MODEL }, made: {}, cleanup: null, ...extra });
}

test('お手本の配置はすべて置ける（区画が小さすぎない）', () => {
  const g = allOpen();
  for (const id of DISTRICTS) {
    assert.equal(g.worlds[id].ents.length, MODEL[id].length + content.districts.find((d) => d.id === id).fixed.length, id);
  }
});

test('お手本の配置で、すべての依頼が達成できる', () => {
  const g = allOpen();
  run(g, 10 * 60 * 10);
  assert.equal(rate(g.worlds.d0, 'plank'), 90);
  assert.equal(rate(g.worlds.d1, 'plate'), 60);
  assert.equal(rate(g.worlds.d1, 'dust'), 30);
  assert.equal(rate(g.worlds.d2, 'frame'), 20);
  assert.equal(rate(g.worlds.d2, 'gear'), 30);
  assert.equal(rate(g.worlds.d3, 'glass'), 30);
  assert.equal(rate(g.worlds.d3, 'lens'), 15);
  assert.deepEqual(g.state.done, { d0: 2, d1: 3, d2: 3, d3: 3 });
});

test('倉庫：前の区画の物は、入ってくる量までしか出せない。残りは余り', () => {
  const g = allOpen();
  run(g, 5 * 60 * 10);
  assert.equal(perMin(g, 'in', 'plank'), 90);
  assert.equal(perMin(g, 'out', 'plank'), 60); // 区2の組立台が使う分
  assert.equal(perMin(g, 'spare', 'plank'), 30);
  assert.equal(perMin(g, 'out', 'dust'), 30); // 鉱石粉は区3がすべて使う
  assert.equal(perMin(g, 'spare', 'dust'), 0);
  assert.equal(perMin(g, 'spare', 'lens'), 15); // レンズはまだ誰も使わない
  for (const p of g.ports.plank) assert.ok(p.credit <= PORT_CAP);
});

test('前の区画が何も作っていなければ、区2には何も届かない', () => {
  const g = createGame(content, { v: 1, open: ['d0', 'd1', 'd2'], layouts: { d2: MODEL.d2 } });
  run(g, 3 * 60 * 10);
  assert.equal(rate(g.worlds.d2, 'frame'), 0);
  assert.equal(rate(g.worlds.d2, 'gear'), 0);
});

test('瓦礫：余りの板を毎分30、1分流すと片づき、置けるようになる', () => {
  const g = allOpen();
  run(g, 2 * 60 * 10);
  assert.equal(canPlace(g.worlds.d0, 'belt', 0, 7).ok, false);
  startCleanup(g, 'd0', 'a');
  run(g, 90 * 10);
  assert.deepEqual(g.state.cleared.d0, ['a']);
  assert.equal(g.state.cleanup, null);
  assert.equal(canPlace(g.worlds.d0, 'belt', 0, 7).ok, true);
  assert.equal(canPlace(g.worlds.d0, 'belt', 6, 7).ok, false); // 隣の瓦礫は残る
});

test('余りが足りなければ瓦礫は片づかない', () => {
  const g = allOpen();
  run(g, 2 * 60 * 10);
  startCleanup(g, 'd0', 'b'); // 板を毎分60（余りは30しかない）
  run(g, 3 * 60 * 10);
  assert.equal(g.state.cleared.d0, undefined);
});

test('使える建物は、開いた区画と達成した依頼で増える', () => {
  const g = createGame(content);
  assert.deepEqual(unlocked(g), ['belt', 'saw']);
  const h = allOpen({ open: ['d0', 'd1', 'd2'], done: { d0: 2, d1: 1 } });
  assert.deepEqual(unlocked(h).sort(), ['assembler', 'belt', 'caster', 'crusher', 'furnace', 'saw', 'splitter'].sort());
});

test('保存して読み直すと、同じ配置から同じ結果になる', () => {
  const g = allOpen();
  run(g, 60 * 10);
  const s = JSON.parse(JSON.stringify(save(g)));
  const a = createGame(content, s), c = createGame(content, s);
  run(a, 777); run(c, 777);
  for (const id of DISTRICTS) assert.equal(snapshot(a.worlds[id]), snapshot(c.worlds[id]));
  assert.deepEqual(a.state.made, c.state.made);
});

test('図鑑：ベルトの上で見た物は、納めていなくても載る', () => {
  const g = allOpen();
  run(g, 60 * 10);
  assert.equal(g.state.seen.molten, true); // 溶けた鉱石は納めないが、ベルトの上を通る
  assert.equal(g.state.seen.ore, true);
  assert.equal(g.state.made.molten, undefined);
});
