// フェーズ11：エーテルの区画（区8〜10）と大目標「浮き橋がかかる」
import { test } from 'node:test';
import assert from 'node:assert/strict';
import content from '../src/data/content.js';
import { createGame, run, goals, recipesFor, unlocked } from '../src/core/game.js';
import { rate, canPlace, serialize, load } from '../src/core/sim.js';
import { STAGES2 } from './models2.js';

const fresh = (state) => createGame(content, { v: 1, done: {}, cleared: {}, made: {}, layouts: {}, ...state });
const last = (id) => STAGES2[id][STAGES2[id].length - 1];
const P2 = ['d8', 'd9', 'd10'];
const part2 = (layouts = {}) => fresh({ open: P2, layouts: { d8: last('d8'), d9: last('d9'), d10: last('d10'), ...layouts } });

test('区7の魔導ランタンの依頼で区8が開く（区7を達成した古いセーブも）', () => {
  const g = fresh({ open: ['d0', 'd1', 'd2', 'd3', 'd4', 'd5', 'd6', 'd7'], done: { d7: 2 } });
  assert.ok(g.state.open.includes('d8'));
  assert.ok(unlocked(g).includes('refiner'));
  assert.deepEqual(recipesFor(g, 'still'), ['fuel', 'refuel']);
  assert.ok(!g.state.open.includes('d9'));
});

test('区7の瓦礫は区8と区9の依頼で片づく', () => {
  const g = fresh({ open: ['d7', 'd8', 'd9'], done: { d8: 2, d9: 2 } });
  assert.deepEqual(g.state.cleared.d7.sort(), ['a', 'b']);
});

test('区8：澱をよけないと精製燃料は作れない。選り分けでよけると毎分30', () => {
  const ok = part2();
  run(ok, 3 * 60 * 10);
  assert.equal(rate(ok.worlds.d8, 'refuel'), 30);
  // 選り分けをふつうのベルトにすると、澱が蒸留器の前で詰まる
  const jam = last('d8').map((o) => (o.id === 'sorter' ? { id: 'belt', x: o.x, y: o.y, dir: o.dir } : o));
  const g = part2({ d8: jam });
  run(g, 3 * 60 * 10);
  assert.equal(rate(g.worlds.d8, 'refuel'), 0);
});

test('区9：浮遊石を毎分30。右の浸し槽へ行く道を速いベルトからふつうのベルトにすると、浮遊石の素が石くずになって減る', () => {
  const g = part2();
  run(g, 5 * 60 * 10);
  assert.equal(rate(g.worlds.d9, 'floatstone'), 30);
  const slow = last('d9').map((o) => (o.id === 'fastBelt' ? { ...o, id: 'belt' } : o));
  const s = part2({ d9: slow });
  run(s, 5 * 60 * 10);
  assert.ok(rate(s.worlds.d9, 'floatstone') < 30, `ふつうのベルト ${rate(s.worlds.d9, 'floatstone')}`);
});

test('区9の魔力炉は、区8の精製燃料が倉庫から届かないと燃えない', () => {
  const g = fresh({ open: ['d9'], layouts: { d9: last('d9') } });
  run(g, 3 * 60 * 10);
  assert.equal(rate(g.worlds.d9, 'floatstone'), 0);
});

test('区10：水の上には置けない。下をくぐるベルトなら水の下を通せる', () => {
  const g = fresh({ open: ['d10'] });
  const w = g.worlds.d10;
  assert.equal(canPlace(w, 'belt', 5, 0).reason, '水の上には置けない');
  assert.equal(canPlace(w, 'belt', 5, 4).ok, true); // 桟橋
  assert.equal(canPlace(w, 'assembler', 11, 2).ok, false); // 島の端から水へはみ出す
  // 保存して読み直しても水のまま
  const w2 = load(serialize(w), content);
  assert.equal(canPlace(w2, 'belt', 13, 3).reason, '水の上には置けない');
});

test('区10：浮き板を毎分20で、大目標「浮き橋がかかる」', () => {
  const g = part2();
  run(g, 5 * 60 * 10);
  assert.equal(rate(g.worlds.d10, 'floatplank'), 20);
  assert.equal(g.state.done.d10, 2);
  const bridge = goals(g).find((x) => x.id === 'bridge');
  assert.ok(bridge.reached && bridge.flowing);
});

test('地図：まだ作っていない第2部の区画は「準備中」として並ぶ', () => {
  assert.deepEqual(content.upcoming.map((u) => u.id), ['d11', 'd12', 'd13', 'd14', 'd15']);
});
