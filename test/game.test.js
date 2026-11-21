import { test } from 'node:test';
import assert from 'node:assert/strict';
import content from '../src/data/content.js';
import {
  createGame, run, perMin, save, unlocked, setLayout, goals, recipesFor, clearedBy, PORT_CAP,
} from '../src/core/game.js';
import { rate, canPlace, snapshot } from '../src/core/sim.js';
import { MODEL, STAGES, FIRST } from './models.js';

const DISTRICTS = Object.keys(MODEL);
const PART1 = ['d0', 'd1', 'd2', 'd3'];
const FIRST_LAYOUTS = { d0: MODEL.d0, d1: FIRST.d1, d2: FIRST.d2, d3: MODEL.d3 };
const fresh = (state) => createGame(content, { v: 1, done: {}, cleared: {}, made: {}, ...state });
// 第1部（区0〜3）を、最初に来たときの形で開く
const part1 = () => fresh({ open: PART1, layouts: { ...FIRST_LAYOUTS } });
// 全部の区画を、最後の段の形で開く
const allOpen = () => fresh({ open: DISTRICTS, layouts: { ...MODEL } });

// はじめから遊ぶ：開いた区画に段ごとのお手本を置き、全部の依頼を達成するまで進める
// 区1は最初の形で始め、区4が開いて上の1列の瓦礫が片づいたら改善する（鋳型台3台。その1列を使う）
function playThrough(maxMinutes = 60) {
  const g = createGame(content);
  const applied = {};
  for (let s = 0; s < maxMinutes * 60; s++) {
    for (const id of g.state.open) {
      const st = STAGES[id];
      let k = Math.min(g.state.done[id] || 0, st.length - 1);
      let layout = st[k];
      if (id === 'd1' && !(g.state.cleared.d1 || []).includes('a')) { k = 'first'; layout = FIRST.d1; }
      if (applied[id] !== k) { setLayout(g, id, layout); applied[id] = k; }
    }
    if (DISTRICTS.every((id) => (g.state.done[id] || 0) >= content.districts.find((d) => d.id === id).requests.length)) break;
    run(g, 10);
  }
  return g;
}

test('お手本の配置はすべて置ける（区画が小さすぎない）', () => {
  // 区1の改善した形だけは、区4が開いて片づく上の1列を使う
  const cleared = (id, layout) => (id === 'd1' && layout !== FIRST.d1 ? { d1: ['a'] } : {});
  for (const [id, stages] of Object.entries({ ...STAGES, d1: [...STAGES.d1, FIRST.d1], d2: [...STAGES.d2, FIRST.d2] })) {
    const def = content.districts.find((d) => d.id === id);
    stages.forEach((layout, k) => {
      const g = fresh({ open: [id], layouts: { [id]: layout }, cleared: cleared(id, layout) });
      assert.equal(g.worlds[id].ents.length, layout.length + def.fixed.length, `${id} 段${k + 1}`);
    });
  }
});

test('区1の改善した形（鋳型台3台）は、上の1列の瓦礫が片づくまで置ききれない', () => {
  const g = fresh({ open: ['d1'], layouts: { d1: MODEL.d1 } });
  assert.ok(g.worlds.d1.ents.length < MODEL.d1.length + 2);
});

test('はじめから順に：お手本の配置で全部の依頼が達成でき、5つの大目標が流れ続ける', () => {
  const g = playThrough();
  const want = Object.fromEntries(content.districts.map((d) => [d.id, d.requests.length]));
  assert.deepEqual(g.state.done, want);
  run(g, 3 * 60 * 10); // 達成したあとも流し続ける
  const gl = goals(g);
  assert.deepEqual(gl.map((x) => [x.id, x.reached, x.flowing]), [['clocktower', true, true], ['lights', true, true], ['bridge', true, true], ['greenhouse', true, true], ['airship', true, true]]);
  for (const d of content.districts) assert.equal((g.state.cleared[d.id] || []).length, d.rubble.length, `${d.id} の瓦礫`);
});

test('第1部は、最初に来たときの形（区1は金属板60、区2は枠20）で依頼が達成できる', () => {
  const g = part1();
  run(g, 10 * 60 * 10);
  assert.equal(rate(g.worlds.d0, 'plank'), 90);
  assert.equal(rate(g.worlds.d1, 'plate'), 60);
  assert.equal(rate(g.worlds.d1, 'dust'), 30);
  assert.equal(rate(g.worlds.d2, 'frame'), 20);
  assert.equal(rate(g.worlds.d2, 'gear'), 30);
  assert.equal(rate(g.worlds.d3, 'glass'), 30);
  assert.equal(rate(g.worlds.d3, 'lens'), 15);
  assert.deepEqual(g.state.done, { d0: 2, d1: 3, d2: 3, d3: 3 });
  assert.ok(g.state.open.includes('d4')); // 区3の最後の依頼で区4が開く
});

test('区4のねじ110は、区1が金属板60のままだと届かない（区2のプレス機と分け合う）。区1を改善すると届く', () => {
  const make = (d1) => {
    const g = fresh({ open: [...PART1, 'd4'], layouts: { ...FIRST_LAYOUTS, d1, d4: STAGES.d4[0] } });
    run(g, 5 * 60 * 10);
    return g;
  };
  const before = make(FIRST.d1), after = make(MODEL.d1);
  assert.ok(rate(before.worlds.d4, 'screw') < 110, `改善前 ${rate(before.worlds.d4, 'screw')}`);
  assert.ok(rate(after.worlds.d4, 'screw') >= 110, `改善後 ${rate(after.worlds.d4, 'screw')}`);
});

test('倉庫：前の区画の物は、入ってくる量までしか出せない。残りは余り', () => {
  const g = part1();
  run(g, 5 * 60 * 10);
  assert.equal(perMin(g, 'in', 'plank'), 90);
  assert.equal(perMin(g, 'out', 'plank'), 60); // 区2の組立台が使う分
  assert.equal(perMin(g, 'spare', 'plank'), 30);
  assert.equal(perMin(g, 'out', 'dust'), 30); // 鉱石粉は区3がすべて使う
  assert.equal(perMin(g, 'spare', 'dust'), 0);
  assert.equal(perMin(g, 'spare', 'lens'), 15); // レンズはまだ誰も使わない
  for (const p of g.ports.plank) assert.ok(p.credit <= PORT_CAP);
});

test('倉庫：全部の区画が動くと、金属板は区2・区4・区5で分け合い、足りない区画はない', () => {
  const g = allOpen();
  run(g, 6 * 60 * 10);
  assert.equal(perMin(g, 'in', 'plate'), 90);
  assert.equal(perMin(g, 'spare', 'plate'), 0);
  assert.ok(rate(g.worlds.d2, 'gear') >= 30);
  assert.ok(rate(g.worlds.d5, 'steel') >= 30);
  assert.ok(rate(g.worlds.d4, 'gearbox') >= 10); // 区6が使う分
  assert.ok(rate(g.worlds.d6, 'clockwork') >= 10);
  assert.ok(rate(g.worlds.d7, 'lantern') >= 10);
});

test('前の区画が何も作っていなければ、区2には何も届かない', () => {
  const g = fresh({ open: ['d0', 'd1', 'd2'], layouts: { d2: FIRST.d2 } });
  run(g, 3 * 60 * 10);
  assert.equal(rate(g.worlds.d2, 'frame'), 0);
  assert.equal(rate(g.worlds.d2, 'gear'), 0);
});

test('瓦礫：あとの区画の依頼を達成すると、前の区画の瓦礫が片づく', () => {
  const g = part1();
  assert.equal(canPlace(g.worlds.d0, 'belt', 0, 7).ok, false);
  run(g, 10 * 60 * 10); // 区0〜3の依頼を全部達成する
  assert.deepEqual(g.state.cleared.d0, ['a', 'b']); // 区2の1つ目と3つ目の依頼
  assert.deepEqual(g.state.cleared.d1, ['a']); // 区3の最後の依頼（区4が開く）
  assert.equal(canPlace(g.worlds.d0, 'belt', 0, 7).ok, true);
  assert.equal(canPlace(g.worlds.d1, 'belt', 0, 6).ok, true); // 区1の上の1列
  assert.equal(canPlace(g.worlds.d1, 'belt', 0, 7).ok, false); // 区1の下の2列は区4の依頼で片づく
});

test('瓦礫：どの瓦礫も、その区画よりあとの区画の依頼1つで片づく', () => {
  const ids = content.districts.map((d) => d.id);
  const count = {};
  for (const d of content.districts) for (const r of d.requests) for (const [dist, patch] of r.clears || []) {
    const def = content.districts.find((x) => x.id === dist);
    assert.ok(def?.rubble.some((p) => p.id === patch), `${d.id} が片づける ${dist}${patch} がない`);
    assert.ok(ids.indexOf(d.id) > ids.indexOf(dist), `${dist}${patch} を片づける ${d.id} が、あとの区画でない`);
    count[dist + patch] = (count[dist + patch] || 0) + 1;
  }
  for (const d of content.districts) for (const p of d.rubble) {
    assert.equal(count[d.id + p.id], 1, `${d.id}${p.id} を片づける依頼の数`);
    assert.ok(clearedBy(content, d.id, p.id));
  }
});

test('古いセーブ：達成済みの依頼の瓦礫は片づき、余りで片づけていた記録は消える', () => {
  const g = fresh({ open: PART1, done: { d0: 2, d1: 3, d2: 3, d3: 3 }, cleanup: { district: 'd0', patch: 'b' } });
  assert.deepEqual(g.state.cleared.d0, ['a', 'b']);
  assert.deepEqual(g.state.cleared.d1, ['a']);
  assert.equal(g.state.cleanup, undefined);
  assert.equal(canPlace(g.worlds.d0, 'belt', 5, 7).ok, true);
});

test('使える建物は、開いた区画と達成した依頼で増える', () => {
  const g = createGame(content);
  assert.deepEqual(unlocked(g), ['belt', 'saw']);
  const h = fresh({ open: ['d0', 'd1', 'd2'], done: { d0: 2, d1: 1 } });
  assert.deepEqual(unlocked(h).sort(), ['assembler', 'belt', 'caster', 'crusher', 'furnace', 'saw', 'splitter'].sort());
});

test('レシピ：区画を開くと増えるレシピは、その区画が開くまで選べない', () => {
  const g = fresh({ open: ['d0', 'd1', 'd2', 'd3', 'd4'] });
  assert.deepEqual(recipesFor(g, 'polisher'), ['lens']);
  assert.deepEqual(recipesFor(g, 'workbench'), ['gearbox']);
  const h = allOpen();
  assert.deepEqual(recipesFor(h, 'polisher'), ['lens', 'lensAlt']);
  assert.deepEqual(recipesFor(h, 'workbench'), ['gearbox', 'clockwork', 'lantern', 'compass', 'hull']);
});

test('区3を達成した古いセーブを読むと、区4が開く', () => {
  const g = fresh({ open: PART1, done: { d0: 2, d1: 3, d2: 3, d3: 3 } });
  assert.ok(g.state.open.includes('d4'));
  assert.ok(g.worlds.d4);
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

test('読み直しても魔力炉の燃料は残る（炉が冷えて、熱の前の物が流れて詰まらないように）', () => {
  const g = allOpen();
  run(g, 2 * 60 * 10);
  const before = g.worlds.d3.ents.find((e) => e.id === 'manaFurnace').fuel;
  assert.ok(before > 0);
  const h = createGame(content, save(g));
  assert.equal(h.worlds.d3.ents.find((e) => e.id === 'manaFurnace').fuel, before);
});

test('図鑑：ベルトの上で見た物は、納めていなくても載る', () => {
  const g = part1();
  run(g, 60 * 10);
  assert.equal(g.state.seen.molten, true); // 溶けた鉱石は納めないが、ベルトの上を通る
  assert.equal(g.state.seen.ore, true);
  assert.equal(g.state.made.molten, undefined);
});
