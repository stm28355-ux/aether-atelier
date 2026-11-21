// 第2部の下書き（content-draft2.js）を、区画ごとに台数計算で確かめる。
// 使い方：node tools/check-part2.mjs
// 第1部の余りは、お手本の配置（test/models.js）でゲームを動かして測る。
// 副産物（2種類出るレシピ）と、増える素材（自分を材料にして増える）も数える。
import content from '../src/data/content.js';
import draft1 from '../src/data/content-draft.js';
import draft2 from '../src/data/content-draft2.js';
import { createGame, run, perMin } from '../src/core/game.js';
import { MODEL } from '../test/models.js';
import { TPS, BELT_TICKS } from '../src/core/sim.js';

const items = { ...draft1.items, ...draft2.items };
const buildings = { ...draft1.buildings, ...draft2.buildings };
const recipes = { ...draft1.recipes, ...draft2.recipes };
const fieldRules = [...draft1.fieldRules, ...draft2.fieldRules];
const name = (i) => items[i]?.name ?? i;
const f = (n) => (Number.isInteger(n) ? String(n) : n.toFixed(1));
const perCycle = (r) => (60 * TPS) / r.ticks; // 毎分の回数
const BELT = (60 * TPS) / BELT_TICKS;

// 第1部の余り（全部の区画を最後の段で動かしたときの、倉庫の「余り」）
const g = createGame(content, { v: 1, open: Object.keys(MODEL), done: Object.fromEntries(content.districts.map((d) => [d.id, d.requests.length])), cleared: {}, made: {}, layouts: { ...MODEL } });
run(g, 6 * 60 * TPS);
const supply = {};
for (const i of Object.keys(items)) { const s = perMin(g, 'spare', i); if (s) supply[i] = s; }
console.log('■ 第1部の余り（毎分）：' + Object.entries(supply).map(([i, n]) => `${name(i)}${n}`).join('、'));

// 区画ごとに使えるレシピ：第1部の別レシピでないもの＋開いた機械のレシピ＋開いた区画のレシピ
// 第1部のレシピは全部使える（第2部の区画は第1部のあとに開く）
const gated2 = new Set(draft2.districts.flatMap((d) => d.recipes));
function allowed(k) {
  const ds = draft2.districts.slice(0, k + 1);
  const open = new Set(ds.flatMap((d) => d.recipes));
  const have = new Set(ds.flatMap((d) => d.base));
  return Object.keys(recipes).filter((r) => {
    if (r in draft1.recipes) return true;
    if (draft2.altRecipes[r]) return open.has(r); // 第1部の機械に足すレシピ
    const b = Object.keys(draft2.buildings).find((x) => draft2.buildings[x].recipes?.includes(r));
    return have.has(b) && (!gated2.has(r) || open.has(r));
  });
}

function plan(d, k) {
  const ok = allowed(k);
  const machines = {}, raw = {}, fields = {}, side = {};
  const need = (item, n, depth = 0) => {
    if (depth > 40) throw new Error(`輪：${item}`);
    if (d.imports.includes(item) && !(d.seed && d.seed[item] != null)) { raw[item] = (raw[item] || 0) + n; return; }
    const rid = ok.find((r) => Object.keys(recipes[r].out)[0] === item);
    if (rid) {
      const r = recipes[rid];
      let count;
      if (r.in[item]) { // 増える：差し引きで増える分だけ数える。足りない分は種（前の区画から）
        const seed = d.seed?.[item] ?? 0;
        raw[item] = (raw[item] || 0) + seed;
        count = (n - seed) / ((r.out[item] - r.in[item]) * perCycle(r));
      } else count = n / (r.out[item] * perCycle(r));
      machines[rid] = (machines[rid] || 0) + count;
      for (const [o, m] of Object.entries(r.out)) if (o !== item) side[o] = (side[o] || 0) + m * count * perCycle(r);
      for (const [t, m] of Object.entries(r.in)) if (t !== item) need(t, m * count * perCycle(r), depth + 1);
      return;
    }
    const rule = fieldRules.find((x) => x.to === item);
    if (rule && !d.raw.includes(item)) { fields[`${rule.field}:${rule.from}`] = { ...rule, n: (fields[`${rule.field}:${rule.from}`]?.n || 0) + n }; need(rule.from, n, depth + 1); return; }
    raw[item] = (raw[item] || 0) + n;
  };
  return { need, machines, raw, fields, side };
}

const use = {}; // 倉庫から出る量
for (const [k, d] of draft2.districts.entries()) {
  console.log(`\n■ ${d.name}（${d.sys}、${d.w}×${d.h}）　${d.rule}`);
  let last;
  d.requests.forEach((req, j) => {
    const p = plan(d, k);
    for (const [i, n] of Object.entries(req)) p.need(i, n);
    // 副産物を同じ区画で使う分は、倉庫から出さずに済む（差し引く）
    for (const i of Object.keys(p.side)) {
      if (!p.raw[i]) continue;
      const n = Math.min(p.raw[i], p.side[i]);
      p.raw[i] -= n; p.side[i] -= n;
      if (p.raw[i] < 1e-9) delete p.raw[i];
      if (p.side[i] < 1e-9) delete p.side[i];
    }
    let manaUsers = 0;
    const ms = Object.entries(p.machines).map(([r, c]) => {
      const b = draft2.altRecipes[r] ?? Object.keys(buildings).find((x) => buildings[x].recipes?.includes(r));
      if (buildings[b].mana) manaUsers += Math.ceil(c - 1e-9);
      return `${buildings[b].name}${Math.ceil(c - 1e-9)}（${r}）`;
    });
    for (const x of Object.values(p.fields)) { ms.push(`${{ heat: '竜炉', cold: '霜の柱', light: '灯り台' }[x.field]}1以上（${name(x.from)}→${name(x.to)}）`); manaUsers += 1; }
    const furnaces = Math.ceil(manaUsers / 4);
    if (furnaces) {
      const useRefuel = d.imports.includes('refuel');
      const fuel = furnaces * (useRefuel ? 3 : 6);
      if (useRefuel) p.raw.refuel = (p.raw.refuel || 0) + fuel;
      else { p.raw.aether = (p.raw.aether || 0) + fuel * 2; ms.push(`蒸留器${Math.ceil(fuel / 15)}`); }
      ms.push(`魔力炉${furnaces}（${useRefuel ? `精製燃料 毎分${fuel}` : `燃料 毎分${fuel}`}）`);
    }
    const want = Object.entries(req).map(([i, n]) => `${name(i)}${n}`).join('＋');
    const rawS = Object.entries(p.raw).map(([i, n]) => `${name(i)}${f(n)}${d.imports.includes(i) ? '（前の区画）' : ''}`).join('、');
    const sideS = Object.entries(p.side).map(([i, n]) => `${name(i)}${f(n)}`).join('、');
    const over = Object.entries(p.raw).filter(([i, n]) => d.raw.includes(i) && n > (i === 'spore' ? 120 : BELT)).map(([i]) => name(i));
    console.log(`  依頼${j + 1} ${want}：${ms.join('・')}｜倉庫から ${rawS}${sideS ? `｜副産物 ${sideS}` : ''}${over.length ? `｜！口1つを超える：${over.join('、')}` : ''}`);
    for (const i of Object.keys(p.raw)) if (!d.raw.includes(i) && !d.imports.includes(i)) console.log(`    ！倉庫の口にない素材：${name(i)}`);
    last = { req, raw: p.raw, side: p.side };
  });
  for (const i in last.req) supply[i] = (supply[i] || 0) + last.req[i];
  for (const i of d.imports) if (last.raw[i]) use[i] = (use[i] || 0) + last.raw[i];
}

console.log('\n■ 倉庫の収支（第1部の余り＋第2部の区画が最後の依頼を流し続けたとき、毎分）');
for (const i of Object.keys(use)) {
  const s = supply[i] || 0, u = use[i];
  console.log(`  ${name(i)}：入る ${f(s)} ／ 出る ${f(u)}${u > s + 1e-9 ? `　← 足りない（${f(u - s)}）` : `　余り ${f(s - u)}`}`);
}
