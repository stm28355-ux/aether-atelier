// 使い方：npm run calc -- plate=30 dust=30
// 「金属板を毎分30個、鉱石粉を毎分30個」に必要な機械の台数と原料を出す。
import data from '../src/data/proto.js';
import { plan, BELT_PER_MIN } from '../src/core/calc.js';

const targets = {};
for (const a of process.argv.slice(2)) {
  const [item, n] = a.split('=');
  if (!data.items[item] || !(Number(n) > 0)) {
    console.error(`読めない指定：${a}\n素材：${Object.keys(data.items).join(', ')}`);
    process.exit(1);
  }
  targets[item] = Number(n);
}
if (!Object.keys(targets).length) {
  console.error('使い方：npm run calc -- 素材=毎分の量 …（例：plate=30 dust=30）');
  process.exit(1);
}

const name = (i) => data.items[i].name;
const p = plan(data, targets);
const f = (n) => (Number.isInteger(n) ? String(n) : n.toFixed(2));

console.log('■ 目標');
for (const i in targets) console.log(`  ${name(i)}：毎分${targets[i]}個`);
console.log('■ 機械');
for (const [rid, m] of Object.entries(p.machines)) {
  const b = data.buildings[m.building];
  console.log(`  ${b.name}（${b.w}×${b.h}）：${m.count}台（計算上 ${f(m.exact)}台）`);
}
console.log('■ 範囲を通す');
for (const r of Object.values(p.fields)) {
  console.log(`  ${name(r.from)} → ${name(r.to)}：${r.field} の範囲を${r.tiles}マス以上、毎分${f(r.perMin)}個`);
}
console.log('■ 倉庫から出す');
for (const i in p.raw) console.log(`  ${name(i)}：毎分${f(p.raw[i])}個（出す口 ${p.ports[i]}つ）`);
const over = Object.entries(p.flows).filter(([, n]) => n > BELT_PER_MIN);
if (over.length) {
  console.log(`■ 注意：ベルト1本（毎分${BELT_PER_MIN}個）を超える流れ`);
  for (const [i, n] of over) console.log(`  ${name(i)}：毎分${f(n)}個`);
}
