// フェーズ16：検証「素材の搬出を自由にした場合、1枚の盤面で飛空艇まで作るのに要る広さ」と、おまけの区画「1枚の工房」
import { test } from 'node:test';
import assert from 'node:assert/strict';
import content from '../src/data/content.js';
import { createGame, run, placeableIn, replaceWithBlueprint, districtBlueprint, perMin } from '../src/core/game.js';
import { rate, entAt } from '../src/core/sim.js';
import { encode, decode } from '../src/core/blueprint.js';
import { MODEL } from './models.js';
import { layout as ONEMAP, SIZE } from './onemap.js';

const def = content.districts.find((d) => d.id === 'd16');
const allDone = (extra = {}) => ({ ...Object.fromEntries(content.districts.filter((d) => d.id !== 'd16').map((d) => [d.id, d.requests.length])), ...extra });
const game = (layouts = { ...MODEL }) => createGame(content, {
  v: 1, open: content.districts.map((d) => d.id), done: allDone(), made: {}, layouts,
  cleared: Object.fromEntries(content.districts.map((d) => [d.id, d.rubble.map((r) => r.id)])),
});

test('お手本（AI が組んだ形）は 26×27 に入り、原料の口と魔力炉だけで飛空艇を毎分1', () => {
  assert.equal(def.w, SIZE.w); assert.equal(def.h, SIZE.h);
  const g = game();
  assert.equal(g.worlds.d16.ents.length, ONEMAP.length + def.fixed.length); // 全部置ける
  run(g, 6 * 60 * 10);
  assert.equal(rate(g.worlds.d16, 'airship'), 1);
  assert.equal(g.state.done.d16, 1);
  // 原料の口は5種類だけ
  const items = new Set(ONEMAP.filter((o) => o.id === 'port').map((o) => o.item));
  assert.ok([...items].every((t) => content.RAW_ITEMS.includes(t)), [...items].join());
});

test('区16は大目標「飛空艇が飛ぶ」で開き、倉庫とはつながらない（作った物は倉庫に入らない）', () => {
  const g = createGame(content, { v: 1, open: ['d15'], done: { d15: 1 }, cleared: {}, made: {}, layouts: {} });
  assert.ok(g.state.open.includes('d16'));
  const h = game();
  run(h, 6 * 60 * 10);
  assert.equal(rate(h.worlds.d16, 'airship'), 1);
  assert.equal(perMin(h, 'in', 'airship'), rate(h.worlds.d15, 'airship')); // 倉庫に入る飛空艇は区15の分だけ
});

test('倉庫の出す口は、1枚の工房でだけ置ける', () => {
  const g = game();
  assert.ok(placeableIn(g, 'd16').includes('port'));
  assert.ok(!placeableIn(g, 'd14').includes('port'));
  assert.ok(placeableIn(g, 'd16').includes('shipyard'));
});

test('1枚の工房の図面は、倉庫の口の原料も写して戻せる。ほかの区画には貼れない', () => {
  const g = game();
  const s = encode(districtBlueprint(g, 'd16'));
  const { bp, error } = decode(s, content);
  assert.ok(!error, error);
  assert.ok(bp.ents.some((e) => e.id === 'port' && e.item === 'spore'));
  const h = game({ ...MODEL, d16: [] });
  assert.deepEqual(replaceWithBlueprint(h, 'd16', bp), { ok: true });
  run(h, 6 * 60 * 10);
  assert.equal(rate(h.worlds.d16, 'airship'), 1);
  assert.equal(entAt(h.worlds.d16, 16, 10).item, 'spore');
});
