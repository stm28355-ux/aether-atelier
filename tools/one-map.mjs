// フェーズ16の検証：素材の搬出を自由にした場合（倉庫の出す口を、どの原料でも・どこにでも・いくつでも置ける）、
// 1枚の盤面で飛空艇を毎分1つ作るのに要る機械を数える。
// node tools/one-map.mjs            … 本編と同じレシピ（はじめのレシピ）
// node tools/one-map.mjs alt        … 別レシピも使う（レンズは結晶から、帆布は澱で、枠はプレス機で鋼から）
import content from '../src/data/content.js';

const ALT = process.argv.includes('alt');
const RAW = new Set(['wood', 'ore', 'sand', 'aether', 'spore']);
// 素材ごとに使うレシピ（[機械, レシピ]）。範囲で変わる物は field
const MAKE = {
  plank: ['saw', 'plank'], dust: ['crusher', 'dust'], plate: ['caster', 'plate'],
  frame: ALT ? ['press', 'frameAlt'] : ['assembler', 'frame'],
  gear: ['press', 'gear'], screw: ['lathe', 'screw'], glassmix: ['mixer', 'glassmix'],
  lens: ALT ? ['polisher', 'lensAlt'] : ['polisher', 'lens'],
  fuel: ['still', 'fuel'], gearbox: ['workbench', 'gearbox'], spring: ['winder', 'spring'],
  clockwork: ['workbench', 'clockwork'], lantern: ['workbench', 'lantern'],
  refined: ['refiner', 'refine'], sludge: ['refiner', 'refine'], refuel: ['still', 'refuel'],
  floatmix: ['mixer', 'floatmix'], floatstone: ['steeper', 'steep'], floatplank: ['assembler', 'floatplank'],
  thread: ['spinner', 'spin'], canvas: ALT ? ['loom', 'canvasAlt'] : ['loom', 'weave'],
  balloon: ['loom', 'balloon'], compass: ['workbench', 'compass'], hull: ['workbench', 'hull'],
  airship: ['shipyard', 'airship'],
};
const FIELD = Object.fromEntries(content.fieldRules.map((f) => [f.to, f]));

const need = {}; // 素材 → 毎分
const runs = {}; // "機械/レシピ" → 毎分の回数
const fields = {}; // 範囲の変化 → 毎分
function want(t, n) {
  need[t] = (need[t] || 0) + n;
  if (RAW.has(t)) return;
  if (FIELD[t]) { const f = FIELD[t]; fields[`${f.field}：${f.from}→${t}`] = (fields[`${f.field}：${f.from}→${t}`] || 0) + n; want(f.from, n); return; }
  const [b, r] = MAKE[t];
  const rec = content.recipes[r];
  const k = n / rec.out[t];
  const key = `${b}/${r}`;
  runs[key] = (runs[key] || 0) + k;
  // 2つ出すレシピ（精製器）は、もう片方の分を差し引く
  for (const [o, m] of Object.entries(rec.out)) if (o !== t) need[o] = (need[o] || 0) - k * m;
  for (const [i, m] of Object.entries(rec.in)) want(i, k * m);
}
want('airship', 1);
// 精製器：精製エーテルと澱を同じ回数で出すので、多い方に合わせる（want で両方数えているので重なりを直す）
const B = content.buildings;
const machines = {};
for (const [key, k] of Object.entries(runs)) {
  const [b, r] = key.split('/');
  const per = 600 / content.recipes[r].ticks; // 1台が毎分回す回数
  machines[key] = Math.ceil(k / per - 1e-9);
}
// 精製器は refine を2回数えている（精製エーテルと澱）。回数の多い方だけ
const refKeys = Object.keys(runs).filter((k) => k === 'refiner/refine');
const show = (o) => Object.entries(o).map(([k, v]) => `${k} ${Math.round(v * 100) / 100}`).join('、');
console.log(ALT ? '■ 別レシピも使う' : '■ 本編のはじめのレシピ');
console.log('原料（毎分）：', show(Object.fromEntries(Object.entries(need).filter(([t]) => RAW.has(t)))));
console.log('範囲で変える（毎分）：', show(fields));
console.log('機械（台）：');
let tiles = 0, mana = 0, count = 0;
const perB = {};
for (const [key, n] of Object.entries(machines)) {
  const b = key.split('/')[0];
  perB[b] = (perB[b] || 0) + n;
  console.log(`  ${B[b].name}（${content.recipes[key.split('/')[1]] ? key.split('/')[1] : ''}）×${n}　毎分${Math.round(runs[key] * 100) / 100}回`);
}
for (const [b, n] of Object.entries(perB)) { tiles += B[b].w * B[b].h * n; count += n; if (B[b].mana) mana += n; }
const heat = Object.keys(fields).filter((k) => k.startsWith('heat')).length;
const cold = Object.keys(fields).filter((k) => k.startsWith('cold')).length;
console.log(`機械 ${count}台、${tiles}マス。魔力の要る機械 ${mana}台。熱で変える物 ${heat}種、冷気で変える物 ${cold}種、光 ${Object.keys(fields).filter((k) => k.startsWith('light')).length}種`);
