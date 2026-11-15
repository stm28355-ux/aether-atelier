// レシピ表と「毎分いくつ欲しいか」から、必要な機械の台数と原料の量を出す。
import { TPS, BELT_TICKS } from './sim.js';

export const BELT_PER_MIN = (60 * TPS) / BELT_TICKS;

// targets：{ 素材: 毎分の量 }　choose：{ 素材: 使うレシピ }（別レシピがあるとき）
export function plan(data, targets, choose = {}) {
  const machines = {}; // レシピ → { building, exact }
  const fields = {}; // 範囲のルール → { field, from, to, perMin, tiles }
  const raw = {}; // 倉庫から出す量
  const flows = {}; // 素材ごとの流れる量

  const buildingOf = (rid) => Object.keys(data.buildings).find((b) => data.buildings[b].recipes?.includes(rid));

  const need = (item, perMin, depth) => {
    if (depth > 50) throw new Error(`レシピが輪になっている：${item}`);
    flows[item] = (flows[item] || 0) + perMin;
    const rid = choose[item] ?? Object.keys(data.recipes).find((r) => data.recipes[r].out[item]);
    if (rid) {
      const r = data.recipes[rid];
      const perMachine = (r.out[item] * 60 * TPS) / r.ticks;
      const count = perMin / perMachine;
      machines[rid] ??= { building: buildingOf(rid), exact: 0 };
      machines[rid].exact += count;
      for (const t in r.in) need(t, (r.in[t] * count * 60 * TPS) / r.ticks, depth + 1);
      return;
    }
    const rule = data.fieldRules.find((f) => f.to === item);
    if (rule) {
      const key = `${rule.field}:${rule.from}`;
      fields[key] ??= { field: rule.field, from: rule.from, to: rule.to, perMin: 0, tiles: Math.ceil(rule.ticks / BELT_TICKS) };
      fields[key].perMin += perMin;
      need(rule.from, perMin, depth + 1);
      return;
    }
    raw[item] = (raw[item] || 0) + perMin;
  };

  for (const item in targets) need(item, targets[item], 0);
  for (const m of Object.values(machines)) m.count = Math.ceil(m.exact - 1e-9);
  const ports = {};
  for (const item in raw) ports[item] = Math.ceil(raw[item] / BELT_PER_MIN - 1e-9);
  return { machines, fields, raw, ports, flows };
}
