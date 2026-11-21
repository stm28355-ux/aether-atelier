// フェーズ12：育てるの区画（区11〜13）と大目標「温室と市場」。人が送ってくれた図面も
import { test } from 'node:test';
import assert from 'node:assert/strict';
import content from '../src/data/content.js';
import { createGame, run, goals, replaceWithBlueprint } from '../src/core/game.js';
import { rate } from '../src/core/sim.js';
import { decode } from '../src/core/blueprint.js';
import { MODEL } from './models.js';
import { MECH } from './models2.js';
import { PLAYER } from './player-blueprints.js';

const ALL = content.districts.map((d) => d.id);
const allCleared = () => Object.fromEntries(content.districts.map((d) => [d.id, d.rubble.map((r) => r.id)]));
const fresh = (state) => createGame(content, { v: 1, done: {}, cleared: {}, made: {}, layouts: {}, ...state });
const allDone = () => Object.fromEntries(content.districts.filter((d) => !d.part).map((d) => [d.id, d.requests.length]));
const everything = (layouts = {}) => fresh({ open: ALL, done: allDone(), cleared: allCleared(), layouts: { ...MODEL, ...layouts } });

test('区11：胞子は毎分30だけ。光に通して全部光る苔にすると毎分30', () => {
  const g = fresh({ open: ['d8', 'd11'], layouts: { d8: MODEL.d8, d11: MODEL.d11 } });
  run(g, 3 * 60 * 10);
  assert.equal(rate(g.worlds.d11, 'moss'), 30);
  assert.equal(rate(g.worlds.d11, 'spore') || 0, 0);
});

test('区12の苔の口は、区11が納めた苔だけを受け取る（区12が納めた苔は倉庫を回って戻らない）', () => {
  const g = everything();
  run(g, 5 * 60 * 10);
  assert.equal(rate(g.worlds.d12, 'moss'), 150); // 人の図面（育て床8台）
  const port = g.worlds.d12.ents.find((e) => e.kind === 'source' && e.item === 'moss');
  assert.equal(port.from, 'd11');
  // 区11を止めると、区12には苔が届かない（区12の苔が戻ってこない）
  const s = everything({ d11: [] });
  run(s, 5 * 60 * 10);
  assert.equal(rate(s.worlds.d12, 'moss'), 0);
});

test('区12：育て床4台の形で、出た苔を戻すと毎分90、戻さないと届かない', () => {
  const loop = everything({ d12: MECH.d12 });
  run(loop, 5 * 60 * 10);
  assert.equal(rate(loop.worlds.d12, 'moss'), 90);
  const noLoop = MECH.d12.filter((o) => !(o.y === 0 || (o.x === 12 && o.y === 1)))
    .concat([{ id: 'belt', x: 12, y: 1, dir: 0 }]);
  const g = everything({ d12: noLoop });
  run(g, 5 * 60 * 10);
  assert.ok(rate(g.worlds.d12, 'moss') < 90, `戻さない ${rate(g.worlds.d12, 'moss')}`);
});

test('区13：帆布10と苔の鉢10で、大目標「温室と市場」', () => {
  const g = everything();
  g.state.done.d13 = 1;
  run(g, 5 * 60 * 10);
  assert.ok(rate(g.worlds.d13, 'canvas') >= 10);
  assert.ok(rate(g.worlds.d13, 'mosspot') >= 10);
  assert.equal(g.state.done.d13, 2);
  const gh = goals(g).find((x) => x.id === 'greenhouse');
  assert.ok(gh.reached && gh.flowing);
});

test('人が送ってくれた区8〜10の図面は、置き換えられて、依頼より多く作れる', () => {
  const g = everything();
  for (const [id, s] of Object.entries(PLAYER)) {
    const { bp, error } = decode(s, content);
    assert.ok(!error, error);
    assert.deepEqual(replaceWithBlueprint(g, id, bp), { ok: true }, id);
  }
  run(g, 10 * 60 * 10);
  assert.equal(rate(g.worlds.d8, 'refined'), 30);
  assert.equal(rate(g.worlds.d8, 'refuel'), 30);
  assert.ok(rate(g.worlds.d9, 'floatstone') >= 39);
  assert.equal(rate(g.worlds.d10, 'floatplank'), 30);
});
