// ゲームで使う中身。素材・機械・レシピは中身の表（content-draft.js、人が判定済み）から作る。
// 区画はフェーズ4で区0〜3。区4〜7は地図に「準備中」で出す。
import draft from './content-draft.js';
import { ITEM_COLORS } from '../ui/sprites.js';

// 図鑑に出す役目（名前と役目を持たせる＝企画の「達成感」）
const ROLES = {
  wood: '町の外の森から届く。工房の仕事はここから始まる',
  ore: '谷の鉱山から届く、青みがかった石',
  sand: '港の浜の砂。熱を通すとガラスになる',
  aether: '霧の町の井戸にわく、ほのかに光る水',
  plank: '棚や枠の材料。工房でいちばんよく使う',
  molten: '竜炉の熱でとろけた鉱石。型に流して板にする',
  plate: '歯車やねじの元になる、薄くのばした金属',
  dust: '砕いた鉱石。ガラスに混ぜると濁りが取れる',
  frame: 'からくりやランタンの骨組み',
  gear: '止まった時計塔をもう一度回すための部品',
  screw: '部品どうしを留める小さな金具',
  glassmix: '砂と鉱石粉を混ぜた白い粉。熱で透き通る',
  glass: '窓や灯りに使う、透き通った板',
  lens: '光を集める。ランタンの心臓',
  fuel: 'エーテル水を煮詰めたもの。魔力炉を燃やす',
  gearbox: '歯車とねじを箱に組んだ、時計の中身',
  redplate: '熱を通って赤く光る金属板。冷やすと固くなる',
  steel: '熱して冷やした、しなやかで強い鋼',
  crystal: '冷やされて固まったエーテル。紫に光る',
  spring: '巻いておくと力をためる鋼の帯',
  clockwork: '時計塔を動かす心臓部',
  lantern: '霧の町を照らす灯り',
};

export const items = {};
for (const [id, it] of Object.entries(draft.items)) {
  items[id] = { ...it, color: ITEM_COLORS[id], role: ROLES[id] };
}

export const buildings = {
  belt: { name: 'ベルト', kind: 'belt', w: 1, h: 1 },
  splitter: { name: '分岐', kind: 'splitter', w: 1, h: 1 },
  source: { name: '倉庫の出す口', kind: 'source', w: 1, h: 1 },
  sink: { name: '倉庫の納める口', kind: 'sink', w: 1, h: 1 },
  under: { name: '下をくぐるベルト', kind: 'under', w: 1, h: 1 },
};
for (const [id, b] of Object.entries(draft.buildings)) {
  buildings[id] = { ...b, kind: b.field ? 'emitter' : 'machine' };
}
// 別レシピ（エーテル結晶からレンズ）は区7で開く。それまでは研磨機はガラスからだけ
buildings.polisher = { ...buildings.polisher, recipes: ['lens'] };

export const recipes = draft.recipes;
export const fieldRules = draft.fieldRules;

// 瓦礫の塊を四角で書く道具
const rect = (x, y, w, h) => {
  const t = [];
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) t.push([x + i, y + j]);
  return t;
};

// 区画。w×h は瓦礫を含めた広さ。fixed は倉庫の口（imported は前の区画の物を出す口）。
// base は区画を開いたときに使えるようになる物。依頼の unlock は報酬。
export const districts = [
  {
    id: 'd0', name: '区0 工房の入口', sys: '機工',
    intro: '倉庫から出てくる木材を、製材機で板にして納める。',
    w: 9, h: 9, walls: [],
    rubble: [
      { id: 'a', tiles: rect(0, 7, 5, 2), cost: { item: 'plank', perMin: 30 } },
      { id: 'b', tiles: rect(5, 7, 4, 2), cost: { item: 'plank', perMin: 60 } },
    ],
    fixed: [
      { id: 'source', x: 0, y: 3, dir: 0, item: 'wood' },
      { id: 'sink', x: 8, y: 3, dir: 0 },
    ],
    base: ['belt', 'saw'], limits: {},
    requests: [
      { targets: { plank: 30 }, unlock: ['splitter'], reward: '分岐（ベルトを分ける）' },
      { targets: { plank: 90 }, unlock: [], opens: 'd1', reward: '次の区画「炉の間」' },
    ],
  },
  {
    id: 'd1', name: '区1 炉の間', sys: '炉と霜',
    intro: '竜炉の熱は、ベルトを流れる鉱石にも効く。熱の中を3マス進んだ鉱石は溶ける。金属板が熱を通ると赤熱するので気をつける。',
    w: 12, h: 9, walls: [],
    rubble: [
      { id: 'a', tiles: rect(0, 7, 6, 2), cost: { item: 'plate', perMin: 15 } },
      { id: 'b', tiles: rect(6, 7, 6, 2), cost: { item: 'dust', perMin: 15 } },
    ],
    fixed: [
      { id: 'source', x: 0, y: 4, dir: 0, item: 'ore' },
      { id: 'sink', x: 11, y: 4, dir: 0 },
    ],
    base: ['crusher'], limits: { furnace: 1 },
    requests: [
      { targets: { dust: 30 }, unlock: ['furnace', 'caster'], reward: '竜炉（熱の範囲）と鋳型台' },
      { targets: { plate: 30 }, unlock: [], reward: 'なし' },
      { targets: { plate: 60, dust: 30 }, unlock: [], opens: 'd2', reward: '次の区画「歯車の作業場」' },
    ],
  },
  {
    id: 'd2', name: '区2 歯車の作業場', sys: '機工',
    intro: '区0の板と区1の金属板が、倉庫から届く。届く量は、前の区画が納めている量まで。組立台は板を毎分60使う。',
    w: 9, h: 8, walls: [],
    rubble: [
      { id: 'a', tiles: rect(0, 6, 5, 2), cost: { item: 'frame', perMin: 10 } },
      { id: 'b', tiles: rect(5, 6, 4, 2), cost: { item: 'gear', perMin: 10 } },
    ],
    fixed: [
      { id: 'source', x: 0, y: 1, dir: 0, item: 'plank', imported: true },
      { id: 'source', x: 0, y: 4, dir: 0, item: 'plate', imported: true },
      { id: 'sink', x: 8, y: 2, dir: 0 },
    ],
    base: ['assembler'], limits: {},
    requests: [
      { targets: { frame: 20 }, unlock: ['press'], reward: 'プレス機' },
      { targets: { gear: 30 }, unlock: ['under'], reward: '下をくぐるベルト（4マスまで下を通す）' },
      { targets: { frame: 20, gear: 30 }, unlock: [], opens: 'd3', reward: '次の区画「灯りの工房」' },
    ],
  },
  {
    id: 'd3', name: '区3 灯りの工房', sys: '炉と霜', leyline: false,
    intro: 'ここには地脈がない。竜炉と研磨機は、魔力炉の範囲に入れないと動かない。魔力炉は燃料を毎分6燃やし、範囲の機械4台まで動かす。ガラスの素は熱の中を5マス進むとガラスになる。',
    w: 12, h: 9, walls: [],
    rubble: [
      { id: 'a', tiles: rect(0, 7, 6, 2), cost: { item: 'glass', perMin: 15 } },
      { id: 'b', tiles: rect(6, 7, 6, 2), cost: { item: 'lens', perMin: 10 } },
    ],
    fixed: [
      { id: 'source', x: 0, y: 1, dir: 0, item: 'sand' },
      { id: 'source', x: 0, y: 3, dir: 0, item: 'dust', imported: true },
      { id: 'source', x: 0, y: 6, dir: 0, item: 'aether' },
      { id: 'sink', x: 11, y: 2, dir: 0 },
    ],
    base: ['mixer', 'manaFurnace', 'still'], limits: {},
    requests: [
      { targets: { glass: 30 }, unlock: ['polisher'], reward: '研磨機（ガラスからレンズ。魔力が要る）' },
      { targets: { lens: 15 }, unlock: [], reward: 'なし' },
      { targets: { lens: 15, glass: 30 }, unlock: [], reward: '第1部の続き（区4）はフェーズ5で開く' },
    ],
  },
];

// 地図に出す、まだ作っていない区画
export const upcoming = draft.districts.slice(4).map((d) => ({
  id: d.id,
  name: { d3: '区3 灯りの工房', d4: '区4 からくり工房', d5: '区5 霜の蔵', d6: '区6 時計塔の基部', d7: '区7 灯台通り' }[d.id],
  sys: d.sys,
}));

export default { items, buildings, recipes, fieldRules, districts, upcoming };
