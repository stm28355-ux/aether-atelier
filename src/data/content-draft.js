// フェーズ2の下書き：機工と炉と霜の2系統、8区画。名前と数字は案（Docs「中身の表」で人が判定する）。
// 時間の単位は刻み（1秒＝10刻み）。機械1台の基本は20刻みで1回＝毎分30回。

export const items = {
  wood: { name: '木材', sys: '倉庫' },
  ore: { name: '鉱石', sys: '倉庫' },
  sand: { name: '砂', sys: '倉庫' },
  aether: { name: 'エーテル水', sys: '倉庫' },
  plank: { name: '板', sys: '機工' },
  molten: { name: '溶けた鉱石', sys: '炉と霜' },
  plate: { name: '金属板', sys: '炉と霜' },
  dust: { name: '鉱石粉', sys: '炉と霜' },
  frame: { name: '枠', sys: '機工' },
  gear: { name: '歯車', sys: '機工' },
  screw: { name: 'ねじ', sys: '機工' },
  glassmix: { name: 'ガラスの素', sys: '炉と霜' },
  glass: { name: 'ガラス', sys: '炉と霜' },
  lens: { name: 'レンズ', sys: '炉と霜' },
  fuel: { name: '燃料', sys: '炉と霜' },
  gearbox: { name: '歯車箱', sys: '機工' },
  redplate: { name: '赤熱した板', sys: '炉と霜' },
  steel: { name: '焼き入れ鋼', sys: '炉と霜' },
  crystal: { name: 'エーテル結晶', sys: '炉と霜' },
  spring: { name: 'ぜんまい', sys: '機工' },
  clockwork: { name: '時計の機構', sys: '機工' },
  lantern: { name: '魔導ランタン', sys: '炉と霜' },
};

// shake：揺れる（干渉の元）。fragile：揺れの近くでは止まる。mana：魔力が要る（地脈のない区画で）。
export const buildings = {
  saw: { name: '製材機', w: 2, h: 2, recipes: ['plank'] },
  crusher: { name: '粉砕機', w: 2, h: 2, recipes: ['dust'] },
  caster: { name: '鋳型台', w: 2, h: 2, recipes: ['plate'] },
  furnace: { name: '竜炉', w: 2, h: 2, field: 'heat', radius: 2, mana: true },
  assembler: { name: '組立台', w: 2, h: 2, recipes: ['frame'] },
  press: { name: 'プレス機', w: 2, h: 2, recipes: ['gear'], shake: true },
  lathe: { name: '旋盤', w: 1, h: 1, recipes: ['screw'], synergy: true },
  mixer: { name: '調合台', w: 2, h: 2, recipes: ['glassmix'] },
  polisher: { name: '研磨機', w: 2, h: 2, recipes: ['lens', 'lensAlt'], mana: true },
  still: { name: '蒸留器', w: 1, h: 1, recipes: ['fuel'] },
  manaFurnace: { name: '魔力炉', w: 2, h: 2, field: 'mana', radius: 2, powers: 4, fuelPerMin: 6 },
  frostPillar: { name: '霜の柱', w: 1, h: 1, field: 'cold', radius: 2, mana: true },
  winder: { name: '巻き機', w: 2, h: 2, recipes: ['spring'], shake: true },
  workbench: { name: 'からくり台', w: 3, h: 3, recipes: ['gearbox', 'clockwork', 'lantern'], fragile: true, mana: true },
};

export const recipes = {
  plank: { in: { wood: 1 }, out: { plank: 1 }, ticks: 20 },
  dust: { in: { ore: 1 }, out: { dust: 1 }, ticks: 20 },
  plate: { in: { molten: 1 }, out: { plate: 1 }, ticks: 20 },
  frame: { in: { plank: 3 }, out: { frame: 1 }, ticks: 30 },
  gear: { in: { plate: 1 }, out: { gear: 1 }, ticks: 20 },
  screw: { in: { plate: 1 }, out: { screw: 2 }, ticks: 40 },
  glassmix: { in: { sand: 2, dust: 1 }, out: { glassmix: 2 }, ticks: 20 },
  lens: { in: { glass: 2 }, out: { lens: 1 }, ticks: 40 },
  lensAlt: { in: { crystal: 1 }, out: { lens: 1 }, ticks: 20, alt: true },
  fuel: { in: { aether: 2 }, out: { fuel: 1 }, ticks: 40 },
  gearbox: { in: { frame: 1, gear: 2, screw: 2 }, out: { gearbox: 1 }, ticks: 40 },
  spring: { in: { steel: 1 }, out: { spring: 1 }, ticks: 40 },
  clockwork: { in: { gearbox: 1, spring: 2 }, out: { clockwork: 1 }, ticks: 60 },
  lantern: { in: { frame: 1, lens: 1, crystal: 2 }, out: { lantern: 1 }, ticks: 60 },
};

// 範囲がベルト上の素材に効く。ticks は範囲の中にいた刻みの合計（5刻み＝1マス）
export const fieldRules = [
  { field: 'heat', from: 'ore', to: 'molten', ticks: 15 },
  { field: 'heat', from: 'glassmix', to: 'glass', ticks: 25 },
  { field: 'heat', from: 'plate', to: 'redplate', ticks: 15 },
  { field: 'cold', from: 'redplate', to: 'steel', ticks: 10 },
  { field: 'cold', from: 'aether', to: 'crystal', ticks: 20 },
];

// imports：前の区画から倉庫を通して受け取る物。leyline：地脈があれば魔力なしで動く。
export const districts = [
  { id: 'd0', sys: '機工', w: 20, h: 14, leyline: true, raw: ['wood'], imports: [],
    requests: [{ plank: 30 }, { plank: 90 }] },
  { id: 'd1', sys: '炉と霜', w: 20, h: 14, leyline: true, raw: ['ore'], imports: [],
    requests: [{ dust: 30 }, { plate: 30 }, { plate: 60, dust: 30 }] },
  { id: 'd2', sys: '機工', w: 22, h: 14, leyline: true, raw: [], imports: ['plank', 'plate'],
    requests: [{ frame: 20 }, { gear: 30 }, { frame: 20, gear: 30 }] },
  { id: 'd3', sys: '炉と霜', w: 24, h: 16, leyline: false, raw: ['sand', 'aether'], imports: ['dust'],
    requests: [{ glass: 30 }, { lens: 15 }, { lens: 15, glass: 30 }] },
  { id: 'd4', sys: '機工', w: 24, h: 16, leyline: false, raw: ['aether'], imports: ['plate', 'frame', 'gear'],
    requests: [{ screw: 75 }, { gearbox: 15 }], limits: { lathe: 2 } },
  { id: 'd5', sys: '炉と霜', w: 24, h: 16, leyline: false, raw: ['aether'], imports: ['plate'], mixedPort: ['plate', 'aether'],
    requests: [{ crystal: 30 }, { steel: 30 }, { crystal: 30, steel: 30 }] },
  { id: 'd6', sys: '機工', w: 26, h: 16, leyline: false, raw: ['aether'], imports: ['gearbox', 'steel'],
    requests: [{ spring: 15 }, { clockwork: 10 }] },
  { id: 'd7', sys: '炉と霜', w: 26, h: 16, leyline: false, raw: ['aether'], imports: ['frame', 'glass'],
    requests: [{ lens: 30 }, { lantern: 10 }], choose: { lens: 'lensAlt' } },
];

export default { items, buildings, recipes, fieldRules, districts };
