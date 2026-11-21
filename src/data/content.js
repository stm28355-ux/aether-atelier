// ゲームで使う中身。素材・機械・レシピは中身の表（content-draft.js、人が判定済み）から作る。
// 区画は区0〜7（機工と炉と霜の2系統）。区6と区7の最後の依頼が大目標。
import draft from './content-draft.js';
import draft2 from './content-draft2.js';
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

// 第2部の素材の役目
const ROLES2 = {
  refined: '霧のように軽い、澄んだエーテル',
  sludge: '精製器の底にたまる、ねばる澱。糊にもなる',
  refuel: '精製エーテルを煮詰めた燃料。魔力炉で2倍長く燃える',
  floatmix: '澱と砂を練ったもの。すぐ固まって石くずになる',
  gravel: '浮遊石になりそこねた石。使い道はない',
  floatstone: '精製エーテルを吸って、ふわりと浮く石',
  floatplank: '浮遊石を埋めた板。水の上に浮き橋をかける',
  spore: '霧の森で集めた、光る苔の胞子',
  moss: '灯りの下で育つ、青白く光る苔',
  drymoss: '熱で乾かした苔。ほぐすと糸になる',
  thread: '光る苔から紡いだ、ほのかに光る糸',
  canvas: '魔法の糸で織った、軽くて強い布',
  mosspot: 'ガラスの鉢に植えた光る苔。市場で人気',
  balloon: '帆布に浮遊石を縫い込んだ、飛空艇の浮き袋',
  compass: '時計の機構と光る苔の針で、霧の中でも迷わない',
  hull: '浮き板を鋼と枠で組んだ、飛空艇の船体',
  airship: '霧の町の空を渡る、工房の最後の大仕事',
};

export const items = {};
for (const [id, it] of Object.entries(draft.items)) {
  items[id] = { ...it, color: ITEM_COLORS[id], role: ROLES[id] };
}
for (const [id, it] of Object.entries(draft2.items)) {
  items[id] = { ...it, part: 2, color: ITEM_COLORS[id], role: ROLES2[id] };
}

export const buildings = {
  belt: { name: 'ベルト', kind: 'belt', w: 1, h: 1 },
  splitter: { name: '分岐', kind: 'splitter', w: 1, h: 1 },
  source: { name: '倉庫の出す口', kind: 'source', w: 1, h: 1 },
  sink: { name: '倉庫の納める口', kind: 'sink', w: 1, h: 1 },
  under: { name: '下をくぐるベルト', kind: 'under', w: 1, h: 1 },
  sorter: { name: '選り分け', kind: 'sorter', w: 1, h: 1 },
  overflow: { name: 'あふれ口', kind: 'overflow', w: 1, h: 1 },
  // 第2部の道具
  fastBelt: { name: '速いベルト', kind: 'belt', fast: true, w: 1, h: 1 },
  prioritySplitter: { name: '優先分岐', kind: 'splitter', priority: true, w: 1, h: 1 },
};
for (const [id, b] of Object.entries({ ...draft.buildings, ...draft2.buildings })) {
  buildings[id] = { ...b, kind: b.field ? 'emitter' : 'machine' };
}
// 第1部の機械に足すレシピ（区画が開くと選べる）
for (const [r, b] of Object.entries(draft2.altRecipes)) buildings[b] = { ...buildings[b], recipes: [...buildings[b].recipes, r] };

export const recipes = { ...draft.recipes, ...draft2.recipes };
export const fieldRules = [...draft.fieldRules, ...draft2.fieldRules];
// 時間で変わる素材（ベルトの上で ticks 刻みたつと to になる。pausedBy の範囲の中では時間が止まる）
export const decayRules = draft2.decayRules;

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
      { id: 'a', tiles: rect(0, 6, 12, 1), name: '上の1列' }, // 区1を改善する（鋳型台3台）ときに使う
      { id: 'b', tiles: rect(0, 7, 12, 2), name: '下の2列' },
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
    intro: '旋盤は、辺で接する旋盤1台ごとに25%速くなる（2台まで）。ここでは旋盤は3台まで。3台をつなげて並べると、真ん中は左右がふさがる。区1の金属板と区2の枠・歯車が倉庫から届く。金属板が足りなければ、区1を改善して倉庫に入る量を増やす（区3の最後の依頼の報酬で、区1の瓦礫が片づいて広くなっている）。',
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
    base: ['lathe'], recipes: ['gearbox'], limits: { lathe: 3 },
    requests: [
      { targets: { screw: 110 }, unlock: ['workbench'], reward: 'からくり台（3×3。枠・歯車・ねじから歯車箱。魔力が要る）', clears: [['d2', 'a']] },
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
    w: 13, h: 10, walls: [],
    rubble: [ // 第2部の区8・区9の依頼で片づく
      { id: 'a', tiles: rect(0, 8, 7, 2) },
      { id: 'b', tiles: rect(7, 8, 6, 2) },
    ],
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
        targets: { lantern: 10 }, unlock: [], opens: 'd8', reward: '大目標「町に灯りがつく」、第2部の区画「霧の精製所」', clears: [['d6', 'b']],
        goal: { id: 'lights', title: '町に灯りがつく', story: '霧の通りに、魔導ランタンがひとつ、またひとつと灯っていく。港の灯台にも光が戻った。' },
      },
    ],
  },
  // ---- 第2部：エーテル（区8〜10） ----
  {
    id: 'd8', name: '区8 霧の精製所', sys: 'エーテル', leyline: false, part: 2,
    intro: '精製器はエーテル水2から、精製エーテル1と澱1を正面から交互に出す（副産物）。蒸留器は精製エーテルから精製燃料を作るが、澱は受け取らない。澱を逃がさないと精製器が詰まって止まる。澱も納める口へ入れてよい。',
    w: 12, h: 8, walls: [],
    rubble: [
      { id: 'a', tiles: rect(0, 6, 6, 2) },
      { id: 'b', tiles: rect(6, 6, 6, 2) },
    ],
    fixed: [
      { id: 'source', x: 0, y: 2, dir: 0, item: 'aether' },
      { id: 'sink', x: 11, y: 2, dir: 0 },
    ],
    base: ['refiner'], recipes: ['refuel'], limits: {},
    requests: [
      { targets: { refined: 15 }, unlock: [], reward: 'なし' },
      { targets: { refuel: 30 }, unlock: [], opens: 'd9', reward: '次の区画「浮き石の工房」', clears: [['d7', 'a']] },
    ],
  },
  {
    id: 'd9', name: '区9 浮き石の工房', sys: 'エーテル', leyline: false, part: 2,
    intro: '調合台で澱と砂を練ると浮遊石の素。浮遊石の素は、できてから6秒（ふつうのベルトで12マス分）で石くずになる。ベルトの上で待っていても数える。冷気の中では時間が止まる。浸し槽（魔力が要る）は浮遊石の素と精製エーテルから浮遊石。速いベルトはふつうの2.5倍の速さ。魔力炉の燃料は、区8の精製燃料（燃料2つ分）が倉庫から届く。',
    w: 14, h: 11, walls: [],
    rubble: [
      { id: 'a', tiles: rect(0, 9, 7, 2) },
      { id: 'b', tiles: rect(7, 9, 7, 2) },
    ],
    fixed: [
      { id: 'source', x: 0, y: 1, dir: 0, item: 'aether' },
      { id: 'source', x: 0, y: 8, dir: 0, item: 'sand' },
      { id: 'source', x: 7, y: 0, dir: 1, item: 'refuel', imported: true },
      { id: 'sink', x: 13, y: 6, dir: 0 },
    ],
    base: ['steeper', 'fastBelt'], recipes: ['floatmix'], limits: {},
    requests: [
      { targets: { floatstone: 15 }, unlock: [], reward: 'なし', clears: [['d8', 'a']] },
      { targets: { floatstone: 30 }, unlock: [], opens: 'd10', reward: '次の区画「浮き橋の桟橋」', clears: [['d7', 'b']] },
    ],
  },
  {
    id: 'd10', name: '区10 浮き橋の桟橋', sys: 'エーテル', leyline: false, part: 2,
    intro: '港の桟橋。水の上には何も置けない。足場は岸と島と細い桟橋だけ。下をくぐるベルトなら、水の下を4マスまで通せる。組立台に板2と浮遊石1で浮き板（別のレシピ。機械をクリックして選ぶ）。浮遊石は区9から倉庫を通して届く。',
    w: 18, h: 8, walls: [],
    water: [...rect(4, 0, 3, 4), ...rect(4, 5, 3, 3), ...rect(12, 0, 4, 8)],
    rubble: [ // 水の上には瓦礫はない。岸と島の下の2列
      { id: 'a', tiles: rect(0, 6, 4, 2), name: '岸の下' },
      { id: 'b', tiles: [...rect(7, 6, 5, 2), ...rect(16, 6, 2, 2)], name: '島と右の岸の下' },
    ],
    fixed: [
      { id: 'source', x: 0, y: 2, dir: 0, item: 'wood' },
      { id: 'source', x: 9, y: 0, dir: 1, item: 'floatstone', imported: true },
      { id: 'sink', x: 17, y: 4, dir: 0 },
    ],
    base: [], recipes: ['floatplank'], limits: {},
    requests: [
      { targets: { floatplank: 10 }, unlock: [], reward: 'なし', clears: [['d8', 'b'], ['d9', 'a']] },
      {
        targets: { floatplank: 20 }, unlock: [], opens: 'd11', reward: '大目標「浮き橋がかかる」、次の区画「光苔の庭」', clears: [['d9', 'b']],
        goal: { id: 'bridge', title: '浮き橋がかかる', story: '港の水の上に、浮き板を並べた橋が静かに浮かんだ。霧の向こうの島へ、歩いて渡れるようになった。' },
      },
    ],
  },
  // ---- 第2部：育てる（区11〜13） ----
  {
    id: 'd11', name: '区11 光苔の庭', sys: '育てる', leyline: false, part: 2,
    intro: '灯り台は周り2マスに光の範囲を作る（魔力が要る）。光の中を4マス進んだ胞子は光る苔になる。光は熱や冷気と重なっても打ち消し合わない。胞子は霧の森から毎分30だけ届く。魔力炉の燃料は、区8の精製燃料が倉庫から届く。',
    w: 12, h: 8, walls: [],
    rubble: [
      { id: 'a', tiles: rect(0, 6, 6, 2) },
      { id: 'b', tiles: rect(6, 6, 6, 2) },
    ],
    fixed: [
      { id: 'source', x: 0, y: 2, dir: 0, item: 'spore', interval: 20 },
      { id: 'source', x: 0, y: 4, dir: 0, item: 'refuel', imported: true },
      { id: 'sink', x: 11, y: 2, dir: 0 },
    ],
    base: ['lightPost'], recipes: [], limits: {},
    requests: [
      { targets: { moss: 15 }, unlock: [], reward: 'なし' },
      { targets: { moss: 30 }, unlock: [], opens: 'd12', reward: '次の区画「苗床の温室」', clears: [['d10', 'a']] },
    ],
  },
  {
    id: 'd12', name: '区12 苗床の温室', sys: '育てる', leyline: false, part: 2,
    intro: '育て床は光る苔1とエーテル水1から光る苔2（1台で毎分15増える）。苔の口は区11が納めた苔だけを受け取る（毎分30。この区画が納めた苔は戻ってこない）。育て床から出た苔の一部を育て床へ戻して増やす。優先分岐は、正面に入れられるときは正面へ、詰まっているときだけ左右へ出す。',
    w: 14, h: 9, walls: [],
    rubble: [
      { id: 'a', tiles: rect(0, 7, 7, 2) },
      { id: 'b', tiles: rect(7, 7, 7, 2) },
    ],
    fixed: [
      { id: 'source', x: 0, y: 1, dir: 0, item: 'moss', imported: true, from: 'd11' },
      { id: 'source', x: 0, y: 6, dir: 0, item: 'aether' },
      { id: 'sink', x: 13, y: 1, dir: 0 },
    ],
    base: ['planter', 'prioritySplitter'], recipes: [], limits: {},
    requests: [
      { targets: { moss: 60 }, unlock: [], reward: 'なし', clears: [['d11', 'a']] },
      { targets: { moss: 90 }, unlock: [], opens: 'd13', reward: '次の区画「帆と糸の工房」', clears: [['d10', 'b']] },
    ],
  },
  {
    id: 'd13', name: '区13 帆と糸の工房', sys: '育てる', leyline: false, part: 2,
    intro: '光る苔は竜炉の熱の中を2マス進むと乾き苔になる。紡ぎ機は乾き苔2から魔法の糸、織機は糸3から帆布。育て床ではガラス1と光る苔2から苔の鉢（育て床をクリックしてレシピを選ぶ）。苔の鉢にする苔は熱に通さない。苔の口は区12が納めた苔だけを受け取る。澱の口は、区14が開くと使い道ができる。',
    w: 13, h: 11, walls: [],
    rubble: [
      { id: 'a', tiles: rect(0, 9, 6, 2) },
      { id: 'b', tiles: rect(6, 9, 7, 2) },
    ],
    fixed: [
      { id: 'source', x: 0, y: 1, dir: 0, item: 'moss', imported: true, from: 'd12' },
      { id: 'source', x: 0, y: 6, dir: 0, item: 'glass', imported: true },
      { id: 'source', x: 0, y: 8, dir: 0, item: 'refuel', imported: true },
      { id: 'source', x: 12, y: 8, dir: 2, item: 'sludge', imported: true },
      { id: 'sink', x: 12, y: 4, dir: 0 },
    ],
    base: ['spinner', 'loom'], recipes: ['mosspot'], limits: {},
    requests: [
      { targets: { thread: 20 }, unlock: [], reward: 'なし', clears: [['d11', 'b'], ['d12', 'a']] },
      {
        targets: { canvas: 10, mosspot: 10 }, unlock: [], opens: 'd14', reward: '大目標「温室と市場」、次の区画「飛空艇の部品工房」', clears: [['d12', 'b']],
        goal: { id: 'greenhouse', title: '温室と市場', story: 'ガラスの温室に光る苔の鉢が並び、市場には帆布の天幕が張られた。霧の町に、青白い灯りの市が立つ。' },
      },
    ],
  },
  // ---- 第2部：総まとめ（区14・15） ----
  {
    id: 'd14', name: '区14 飛空艇の部品工房', sys: '総まとめ', part: 2,
    intro: 'これまでの区画の物が、たくさんの口から届く。織機で浮き袋（帆布2＋浮遊石）、からくり台で航海計器（時計の機構＋レンズ＋光る苔）と船体（浮き板2＋焼き入れ鋼＋枠）。機械をクリックしてレシピを選ぶ。ここには地脈があるので魔力は要らない。この区画が開くと、前の区画で使える別のレシピが2つ増える：織機の帆布（糸2＋澱）、プレス機の枠（焼き入れ鋼1から枠2）。',
    w: 16, h: 11, walls: [],
    rubble: [
      { id: 'a', tiles: rect(0, 9, 8, 2) },
      { id: 'b', tiles: rect(8, 9, 8, 2) },
    ],
    fixed: [
      { id: 'source', x: 0, y: 0, dir: 0, item: 'lens', imported: true },
      { id: 'source', x: 0, y: 1, dir: 0, item: 'clockwork', imported: true },
      { id: 'source', x: 0, y: 2, dir: 0, item: 'moss', imported: true, from: 'd12' },
      { id: 'source', x: 0, y: 5, dir: 0, item: 'steel', imported: true },
      { id: 'source', x: 0, y: 6, dir: 0, item: 'frame', imported: true },
      { id: 'source', x: 0, y: 8, dir: 0, item: 'floatplank', imported: true },
      { id: 'source', x: 12, y: 0, dir: 1, item: 'canvas', imported: true },
      { id: 'source', x: 13, y: 0, dir: 1, item: 'floatstone', imported: true },
      { id: 'sink', x: 15, y: 7, dir: 0 },
    ],
    base: [], recipes: ['balloon', 'compass', 'hull', 'canvasAlt', 'frameAlt'], limits: {},
    requests: [
      { targets: { balloon: 5 }, unlock: [], reward: 'なし' },
      { targets: { compass: 5 }, unlock: [], reward: 'なし', clears: [['d13', 'a']] },
      { targets: { hull: 5 }, unlock: [], reward: 'なし' },
      { targets: { balloon: 5, compass: 5, hull: 5 }, unlock: [], opens: 'd15', reward: '次の区画「天空の造船所」', clears: [['d13', 'b']] },
    ],
  },
  {
    id: 'd15', name: '区15 天空の造船所', sys: '総まとめ', leyline: false, part: 2,
    intro: '造船台は4×4の大きな機械（魔力が要る）。浮き袋・航海計器・船体を1つずつと魔導ランタン2つから、60秒かけて飛空艇を1隻組む。魔力炉1つの範囲には入りきらない。区14の部品と区7のランタン、区8の精製燃料が倉庫から届く。',
    w: 14, h: 10, walls: [],
    rubble: [],
    fixed: [
      { id: 'source', x: 0, y: 3, dir: 0, item: 'compass', imported: true },
      { id: 'source', x: 0, y: 5, dir: 0, item: 'refuel', imported: true },
      { id: 'source', x: 0, y: 7, dir: 0, item: 'lantern', imported: true },
      { id: 'source', x: 10, y: 0, dir: 1, item: 'balloon', imported: true },
      { id: 'source', x: 10, y: 9, dir: 3, item: 'hull', imported: true },
      { id: 'sink', x: 13, y: 4, dir: 0 },
    ],
    base: ['shipyard'], recipes: [], limits: {},
    requests: [
      {
        targets: { airship: 1 }, unlock: [], reward: '大目標「飛空艇が飛ぶ」', clears: [['d14', 'a'], ['d14', 'b']],
        goal: { id: 'airship', title: '飛空艇が飛ぶ', story: '浮き袋がふくらみ、船体がゆっくりと造船所を離れた。霧の町の空を、工房の飛空艇が渡っていく。' },
      },
    ],
  },
];

// フェーズ10の試作の区画（URL に ?trial を付けたときだけ開く。本編のセーブとは別）
// 新しい仕組みを1つずつ試す。地脈はあり（魔力のことは考えなくてよい）
export const trialDistricts = [
  {
    id: 't8', name: '試8 副産物', sys: 'エーテル', leyline: true,
    intro: '精製器はエーテル水2から、精製エーテル1と澱1を正面から交互に出す。蒸留器は精製エーテルしか受け取らないので、澱をよけないと精製器が詰まって止まる。',
    w: 10, h: 7, walls: [], rubble: [],
    fixed: [
      { id: 'source', x: 0, y: 3, dir: 0, item: 'aether' },
      { id: 'sink', x: 9, y: 3, dir: 0 },
    ],
    base: ['belt', 'splitter', 'sorter', 'overflow', 'refiner', 'still'], recipes: ['refuel'], limits: {},
    requests: [
      { targets: { refined: 15 }, unlock: [], reward: 'なし' },
      { targets: { refuel: 30 }, unlock: [], reward: 'なし' },
    ],
  },
  {
    id: 't9', name: '試9 時間で変わる', sys: 'エーテル', leyline: true,
    intro: '浮遊石の素は、できてから6秒（ふつうのベルトで12マス分）で石くずになる。ベルトの上で待っていても数える。冷気の中では時間が止まる。速いベルトは2.5倍の速さ。浸し槽は浮遊石の素と精製エーテルから浮遊石。',
    w: 14, h: 9, walls: [], rubble: [],
    fixed: [
      { id: 'source', x: 0, y: 1, dir: 0, item: 'aether' },
      { id: 'source', x: 0, y: 5, dir: 0, item: 'sand' },
      { id: 'sink', x: 13, y: 3, dir: 0 },
    ],
    base: ['belt', 'fastBelt', 'splitter', 'sorter', 'overflow', 'under', 'refiner', 'mixer', 'steeper', 'frostPillar'], recipes: ['floatmix'], limits: {},
    requests: [
      { targets: { floatstone: 15 }, unlock: [], reward: 'なし' },
      { targets: { floatstone: 30 }, unlock: [], reward: 'なし' },
    ],
  },
  {
    id: 't11', name: '試11 光の範囲', sys: '育てる', leyline: true,
    intro: '灯り台は周り2マスに光の範囲を作る。光の中を4マス進んだ胞子は光る苔になる。光は熱や冷気と重なっても打ち消し合わない。',
    w: 10, h: 7, walls: [], rubble: [],
    fixed: [
      { id: 'source', x: 0, y: 3, dir: 0, item: 'spore' },
      { id: 'sink', x: 9, y: 3, dir: 0 },
    ],
    base: ['belt', 'splitter', 'lightPost'], limits: {},
    requests: [
      { targets: { moss: 30 }, unlock: [], reward: 'なし' },
      { targets: { moss: 60 }, unlock: [], reward: 'なし' },
    ],
  },
  {
    id: 't12', name: '試12 増える', sys: '育てる', leyline: true,
    intro: '光る苔の口は毎分30しか出さない。育て床は光る苔1とエーテル水1から光る苔2（差し引き1台で毎分15増える）。増えた苔の一部を育て床に戻す。優先分岐は、正面に入れられるときは正面へ、詰まっているときだけ左右へ出す。',
    w: 14, h: 10, walls: [], rubble: [],
    fixed: [
      { id: 'source', x: 0, y: 2, dir: 0, item: 'moss', interval: 20 },
      { id: 'source', x: 0, y: 7, dir: 0, item: 'aether' },
      { id: 'sink', x: 13, y: 4, dir: 0 },
    ],
    base: ['belt', 'splitter', 'prioritySplitter', 'under', 'planter'], limits: {},
    requests: [
      { targets: { moss: 60 }, unlock: [], reward: 'なし' },
      { targets: { moss: 90 }, unlock: [], reward: 'なし' },
    ],
  },
];

// 区画を開いたときに使えるようになるレシピ。ここに出てこないレシピは最初から使える。
// 第2部で第1部の機械に足すレシピと、第2部の機械の2つ目のレシピも、区画が開くまで選べない
export const gatedRecipes = [...new Set([
  ...districts.flatMap((d) => d.recipes || []),
  ...Object.keys(draft2.altRecipes), 'canvasAlt', 'mosspot', 'balloon',
])];

// 地図に出す、まだ作っていない区画（今はない）
export const upcoming = draft2.districts
  .filter((d) => !districts.some((x) => x.id === d.id))
  .map((d) => ({ id: d.id, name: d.name, sys: d.sys.replace(/（.*）/, '') }));

export default { items, buildings, recipes, fieldRules, decayRules, districts, upcoming, gatedRecipes };
