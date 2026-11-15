// 試作（区0〜1）の中身。名前と数字は仮。
// 時間の単位は「刻み」（1秒＝10刻み）。ベルトは1マスを5刻みで進む（毎分120個まで）。

export const items = {
  wood: { name: '木材' },
  ore: { name: '鉱石' },
  plank: { name: '板' },
  molten: { name: '溶けた鉱石' },
  plate: { name: '金属板' },
  dust: { name: '鉱石粉' },
};

export const buildings = {
  belt: { name: 'ベルト', kind: 'belt', w: 1, h: 1 },
  splitter: { name: '分岐', kind: 'splitter', w: 1, h: 1 },
  source: { name: '倉庫の出す口', kind: 'source', w: 1, h: 1 },
  sink: { name: '倉庫の納める口', kind: 'sink', w: 1, h: 1 },
  saw: { name: '製材機', kind: 'machine', w: 2, h: 2, recipes: ['plank'] },
  crusher: { name: '粉砕機', kind: 'machine', w: 2, h: 2, recipes: ['dust'] },
  caster: { name: '鋳型台', kind: 'machine', w: 2, h: 2, recipes: ['plate'] },
  furnace: { name: '竜炉', kind: 'emitter', w: 2, h: 2, field: 'heat', radius: 2 },
};

export const recipes = {
  plank: { in: { wood: 1 }, out: { plank: 1 }, ticks: 20 },
  dust: { in: { ore: 1 }, out: { dust: 1 }, ticks: 20 },
  plate: { in: { molten: 1 }, out: { plate: 1 }, ticks: 20 },
};

// 範囲がベルト上の素材に効くルール。ticks は、範囲の中にいた刻みの合計（15刻み＝3マス分）。
export const fieldRules = [
  { field: 'heat', from: 'ore', to: 'molten', ticks: 15 },
];

export default { items, buildings, recipes, fieldRules };
