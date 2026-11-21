// ゲームで使う中身。素材・機械・レシピは中身の表（content-draft.js、人が判定済み）から作る。
// 区画は区0〜7（機工と炉と霜の2系統）。区6と区7の最後の依頼が大目標。
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
  sorter: { name: '選り分け', kind: 'sorter', w: 1, h: 1 },
  overflow: { name: 'あふれ口', kind: 'overflow', w: 1, h: 1 },
};
for (const [id, b] of Object.entries(draft.buildings)) {
  buildings[id] = { ...b, kind: b.field ? 'emitter' : 'machine' };
}

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
// 瓦礫は、あとの区画の依頼の報酬で片づく（依頼の clears：[区画, 瓦礫の id]）。その区画の物を使う区画の依頼に結びつける
export const districts = [
  {
    id: 'd0', name: '区0 工房の入口', sys: '機工',
    intro: '倉庫から出てくる木材を、製材機で板にして納める。',
    w: 9, h: 9, walls: [],
    rubble: [
      { id: 'a', tiles: rect(0, 7, 5, 2) },
      { id: 'b', tiles: rect(5, 7, 4, 2) },
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
      { id: 'a', tiles: rect(0, 7, 6, 2) },
      { id: 'b', tiles: rect(6, 7, 6, 2) },
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
      { id: 'a', tiles: rect(0, 6, 5, 2) },
      { id: 'b', tiles: rect(5, 6, 4, 2) },
    ],
    fixed: [
      { id: 'source', x: 0, y: 1, dir: 0, item: 'plank', imported: true },
      { id: 'source', x: 0, y: 4, dir: 0, item: 'plate', imported: true },
      { id: 'sink', x: 8, y: 2, dir: 0 },
    ],
    base: ['assembler'], limits: {},
    requests: [
      { targets: { frame: 20 }, unlock: ['press'], reward: 'プレス機', clears: [['d0', 'a']] },
      { targets: { gear: 30 }, unlock: ['under'], reward: '下をくぐるベルト（4マスまで下を通す）' },
      { targets: { frame: 20, gear: 30 }, unlock: [], opens: 'd3', reward: '次の区画「灯りの工房」', clears: [['d0', 'b']] },
    ],
  },
  {
    id: 'd3', name: '区3 灯りの工房', sys: '炉と霜', leyline: false,
    intro: 'ここには地脈がない。竜炉と研磨機は、魔力炉の範囲に入れないと動かない。魔力炉は燃料を毎分6燃やし、範囲の機械4台まで動かす。ガラスの素は熱の中を5マス進むとガラスになる。',
    w: 12, h: 9, walls: [],
    rubble: [
      { id: 'a', tiles: rect(0, 7, 6, 2) },
      { id: 'b', tiles: rect(6, 7, 6, 2) },
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
      { targets: { lens: 15, glass: 30 }, unlock: [], opens: 'd4', reward: '次の区画「からくり工房」', clears: [['d1', 'a']] },
    ],
  },
  {
    id: 'd4', name: '区4 からくり工房', sys: '機工', leyline: false,
    intro: '旋盤は、辺で接する旋盤1台ごとに25%速くなる（ここでは2台まで）。区1の金属板と区2の枠・歯車が倉庫から届く。金属板が足りなければ、区1を改善して倉庫に入る量を増やす（区3の最後の依頼の報酬で、区1の瓦礫が片づいて広くなっている）。',
    w: 12, h: 10, walls: [],
    rubble: [
      { id: 'a', tiles: rect(0, 8, 6, 2) },
      { id: 'b', tiles: rect(6, 8, 6, 2) },
    ],
    fixed: [
      { id: 'source', x: 4, y: 0, dir: 1, item: 'plate', imported: true },
      { id: 'source', x: 6, y: 0, dir: 1, item: 'gear', imported: true },
      { id: 'source', x: 11, y: 5, dir: 2, item: 'frame', imported: true },
      { id: 'source', x: 0, y: 7, dir: 0, item: 'aether' },
      { id: 'sink', x: 11, y: 6, dir: 0 },
    ],
    base: ['lathe'], recipes: ['gearbox'], limits: { lathe: 2 },
    requests: [
      { targets: { screw: 75 }, unlock: ['workbench'], reward: 'からくり台（3×3。枠・歯車・ねじから歯車箱。魔力が要る）', clears: [['d2', 'a']] },
      { targets: { gearbox: 15 }, unlock: [], opens: 'd5', reward: '次の区画「霜の蔵」', clears: [['d1', 'b']] },
    ],
  },
  {
    id: 'd5', name: '区5 霜の蔵', sys: '炉と霜', leyline: false,
    intro: '霜の柱の冷気は、ベルトの上のエーテル水を4マスで結晶にし、赤熱した板を2マスで焼き入れ鋼にする。熱と冷気が重なったマスは打ち消し合う。倉庫の口からは金属板とエーテル水が混ざって出てくるので、選り分けで分ける。',
    w: 12, h: 9, walls: [],
    rubble: [
      { id: 'a', tiles: rect(0, 7, 6, 2) },
      { id: 'b', tiles: rect(6, 7, 6, 2) },
    ],
    fixed: [
      { id: 'source', x: 0, y: 3, dir: 0, item: 'plate', imported: true, extra: 'aether' },
      { id: 'sink', x: 11, y: 3, dir: 0 },
    ],
    base: ['frostPillar', 'sorter'], limits: {},
    requests: [
      { targets: { crystal: 30 }, unlock: [], reward: 'なし' },
      { targets: { steel: 30 }, unlock: [], reward: 'なし' },
      { targets: { crystal: 30, steel: 30 }, unlock: [], opens: 'd6', reward: '次の区画「時計塔の基部」', clears: [['d3', 'a'], ['d4', 'a']] },
    ],
  },
  {
    id: 'd6', name: '区6 時計塔の基部', sys: '機工', leyline: false,
    intro: '巻き機とプレス機は揺れる。揺れの範囲（周り2マス）に1マスでも入ったからくり台は止まる。あふれ口は、先が詰まった物を倉庫へ戻すので、混ぜたベルトが止まらない。',
    w: 13, h: 10, walls: [],
    rubble: [
      { id: 'a', tiles: rect(0, 8, 7, 2) },
      { id: 'b', tiles: rect(7, 8, 6, 2) },
    ],
    fixed: [
      { id: 'source', x: 0, y: 3, dir: 0, item: 'steel', imported: true },
      { id: 'source', x: 8, y: 0, dir: 1, item: 'gearbox', imported: true },
      { id: 'source', x: 0, y: 7, dir: 0, item: 'aether' },
      { id: 'sink', x: 12, y: 6, dir: 0 },
    ],
    base: ['winder', 'overflow'], recipes: ['clockwork'], limits: {},
    requests: [
      { targets: { spring: 15 }, unlock: [], reward: 'からくり台で時計の機構を作る', clears: [['d4', 'b'], ['d5', 'a']] },
      {
        targets: { clockwork: 10 }, unlock: [], opens: 'd7', reward: '大目標「時計塔が動く」、次の区画「灯台通り」', clears: [['d3', 'b'], ['d5', 'b']],
        goal: { id: 'clocktower', title: '時計塔が動く', story: '止まっていた時計塔の針が、ゆっくりと動き出した。霧の町に、時を告げる鐘がまた響く。' },
      },
    ],
  },
  {
    id: 'd7', name: '区7 灯台通り', sys: '炉と霜', leyline: false,
    intro: '研磨機に別のレシピが増えた：エーテル結晶1個からレンズ1個（ガラスからより2倍速い）。機械をクリックするとレシピを選べる。',
    w: 13, h: 8, walls: [],
    rubble: [], // あとの区画（第3部）を作るときに足す
    fixed: [
      { id: 'source', x: 12, y: 0, dir: 2, item: 'aether' },
      { id: 'source', x: 0, y: 1, dir: 0, item: 'glass', imported: true },
      { id: 'source', x: 0, y: 5, dir: 0, item: 'frame', imported: true },
      { id: 'source', x: 0, y: 7, dir: 0, item: 'aether' },
      { id: 'sink', x: 12, y: 4, dir: 0 },
    ],
    base: [], recipes: ['lensAlt', 'lantern'], limits: {},
    requests: [
      { targets: { lens: 30 }, unlock: [], reward: 'からくり台で魔導ランタンを作る', clears: [['d2', 'b'], ['d6', 'a']] },
      {
        targets: { lantern: 10 }, unlock: [], reward: '大目標「町に灯りがつく」', clears: [['d6', 'b']],
        goal: { id: 'lights', title: '町に灯りがつく', story: '霧の通りに、魔導ランタンがひとつ、またひとつと灯っていく。港の灯台にも光が戻った。' },
      },
    ],
  },
];

// 区画を開いたときに使えるようになるレシピ。ここに出てこないレシピは最初から使える
export const gatedRecipes = [...new Set(districts.flatMap((d) => d.recipes || []))];

// 地図に出す、まだ作っていない区画（第3部：エーテル・育てる・飛空艇）
export const upcoming = [];

export default { items, buildings, recipes, fieldRules, districts, upcoming, gatedRecipes };
