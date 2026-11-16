// 中身の下書きを、区画ごとに台数計算で確かめる。
// 使い方：node tools/check-content.mjs
// 出すもの：依頼ごとの機械の台数、魔力炉と燃料、使う面積の目安、倉庫の収支（前の区画の物の出入り）
import draft from '../src/data/content-draft.js';
import { plan, BELT_PER_MIN } from '../src/core/calc.js';

const name = (i) => draft.items[i].name;
const f = (n) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

// 前の区画から受け取る物は、その区画では原料として扱う（レシピをたどらない）
function scoped(d) {
  const keep = (item) => !d.imports.includes(item);
  const recipes = {};
  for (const [id, r] of Object.entries(draft.recipes)) {
    const out = Object.keys(r.out)[0];
    if (keep(out) && (!r.alt || Object.values(d.choose || {}).includes(id))) recipes[id] = r;
  }
  return { ...draft, recipes, fieldRules: draft.fieldRules.filter((x) => keep(x.to)) };
}

function withMana(d, p) {
  if (d.leyline) return { furnaces: 0, fuel: 0 };
  let n = 0;
  for (const m of Object.values(p.machines)) if (draft.buildings[m.building].mana) n += m.count;
  for (const r of Object.values(p.fields)) if (r.field === 'heat' || r.field === 'cold') n += 1;
  const furnaces = Math.ceil(n / draft.buildings.manaFurnace.powers);
  return { users: n, furnaces, fuel: furnaces * draft.buildings.manaFurnace.fuelPerMin };
}

const supply = {}; // 倉庫に毎分入ってくる量（区画の最後の依頼を流し続けたとき）
const use = {}; // 倉庫から毎分出ていく量
for (const d of draft.districts) {
  const data = scoped(d);
  console.log(`\n■ ${d.id}（${d.sys}、${d.w}×${d.h}、地脈${d.leyline ? 'あり' : 'なし'}）`);
  let last;
  d.requests.forEach((req, k) => {
    const p = plan(data, req, d.choose);
    const mana = withMana(d, p);
    let fuelPlan = null;
    if (mana.fuel) fuelPlan = plan(data, { fuel: mana.fuel });
    const ms = Object.values(p.machines).map((m) => `${draft.buildings[m.building].name}${m.count}`);
    if (fuelPlan) ms.push(...Object.values(fuelPlan.machines).map((m) => `${draft.buildings[m.building].name}${m.count}`));
    for (const r of Object.values(p.fields)) ms.push(`${r.field === 'heat' ? '竜炉' : '霜の柱'}1以上`);
    if (mana.furnaces) ms.push(`魔力炉${mana.furnaces}（燃料 毎分${mana.fuel}）`);
    let area = 0;
    for (const m of Object.values(p.machines)) { const b = draft.buildings[m.building]; area += b.w * b.h * m.count; }
    if (fuelPlan) area += 1;
    area += mana.furnaces * 4 + Object.keys(p.fields).length * 4;
    const raw = { ...p.raw };
    if (fuelPlan) for (const i in fuelPlan.raw) raw[i] = (raw[i] || 0) + fuelPlan.raw[i];
    const want = Object.entries(req).map(([i, n]) => `${name(i)}${n}`).join('＋');
    const rawS = Object.entries(raw).map(([i, n]) => `${name(i)}${f(n)}${d.imports.includes(i) ? '（前の区画から）' : ''}`).join('、');
    const over = Object.entries(p.flows).filter(([, n]) => n > BELT_PER_MIN).map(([i]) => name(i));
    console.log(`  依頼${k + 1} ${want}：${ms.join('・')}｜倉庫から ${rawS}｜機械の面積 ${area}マス（区画の${Math.round((area / (d.w * d.h)) * 100)}%）${over.length ? `｜ベルト1本を超える：${over.join('、')}` : ''}`);
    for (const i in raw) if (!(i in draft.items) || !d.raw.includes(i) && !d.imports.includes(i)) console.log(`    ！倉庫の口にない素材：${name(i)}`);
    last = { req, raw };
  });
  for (const i in last.req) supply[i] = (supply[i] || 0) + last.req[i];
  for (const i of d.imports) if (last.raw[i]) use[i] = (use[i] || 0) + last.raw[i];
}

console.log('\n■ 倉庫の収支（全区画が最後の依頼を流し続けたとき、毎分）');
for (const i of new Set([...Object.keys(supply), ...Object.keys(use)])) {
  const s = supply[i] || 0, u = use[i] || 0;
  if (!u) continue;
  console.log(`  ${name(i)}：入る ${f(s)} ／ 出る ${f(u)}${u > s ? `　← 足りない（${f(u - s)}）` : ''}`);
}
