// フェーズ13：総まとめの区画（区14・15）と大目標「飛空艇が飛ぶ」、町の地図の新しい通り
import { test } from 'node:test';
import assert from 'node:assert/strict';
import content from '../src/data/content.js';
import { createGame, run, goals, recipesFor } from '../src/core/game.js';
import { rate } from '../src/core/sim.js';
import { SPOTS, townHit } from '../src/ui/town.js';
import { MODEL } from './models.js';

const allCleared = () => Object.fromEntries(content.districts.map((d) => [d.id, d.rubble.map((r) => r.id)]));
const allDone = () => Object.fromEntries(content.districts.filter((d) => !d.part).map((d) => [d.id, d.requests.length]));
const everything = (layouts = {}) => createGame(content, {
  v: 1, open: content.districts.map((d) => d.id), done: allDone(), cleared: allCleared(), made: {}, layouts: { ...MODEL, ...layouts },
});

test('区14：地脈があり、たくさんの口から受け取って、浮き袋・航海計器・船体を毎分5以上', () => {
  const def = content.districts.find((d) => d.id === 'd14');
  assert.notEqual(def.leyline, false);
  assert.equal(def.fixed.filter((f) => f.imported).length, 8);
  const g = everything();
  run(g, 5 * 60 * 10);
  for (const t of ['balloon', 'compass', 'hull']) assert.ok(rate(g.worlds.d14, t) >= 5, `${t} ${rate(g.worlds.d14, t)}`);
  assert.equal(g.state.done.d14, 4);
});

test('区14が開くと、前の区画の機械に別のレシピ（織機の帆布・プレス機の枠）が増える', () => {
  const g = everything();
  assert.ok(recipesFor(g, 'loom').includes('canvasAlt'));
  assert.ok(recipesFor(g, 'press').includes('frameAlt'));
  const before = createGame(content, { v: 1, open: ['d13'], done: {}, cleared: {}, made: {}, layouts: {} });
  assert.ok(!recipesFor(before, 'loom').includes('canvasAlt'));
});

test('区15：造船台を2つの魔力炉で挟み、飛空艇を毎分1。大目標「飛空艇が飛ぶ」', () => {
  const g = everything();
  run(g, 6 * 60 * 10);
  assert.equal(rate(g.worlds.d15, 'airship'), 1);
  assert.equal(g.state.done.d15, 1);
  const a = goals(g).find((x) => x.id === 'airship');
  assert.ok(a.reached && a.flowing);
  // 魔力炉を1つにすると、造船台は範囲に入りきらず動かない
  const one = MODEL.d15.filter((o) => !(o.id === 'manaFurnace' && o.y === 7));
  const s = everything({ d15: one });
  run(s, 6 * 60 * 10);
  assert.equal(rate(s.worlds.d15, 'airship') || 0, 0);
});

test('町の地図：全部の区画に建物があり、重ならず、クリックで当たる', () => {
  for (const d of content.districts) if (!d.isolated) assert.ok(SPOTS[d.id], d.id); // おまけの1枚の工房は地図の一覧から入る
  const boxes = Object.entries(SPOTS).map(([id, [x, y]]) => ({ id, x, y }));
  for (const a of boxes) for (const b of boxes) {
    if (a.id < b.id) assert.ok(Math.abs(a.x - b.x) >= 32 || Math.abs(a.y - b.y) >= 30, `${a.id} と ${b.id}`);
  }
  for (const { id, x, y } of boxes) assert.equal(townHit((x + 15) * 4, (y + 12) * 4), id);
});
