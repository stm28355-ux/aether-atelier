// フェーズ9の下書き：第2部（エーテル・育てる・総まとめ）。名前と数字は案（Docs「第2部の中身の表」で人が判定する）。
// 時間の単位は刻み（1秒＝10刻み）。機械1台の基本は20刻みで1回＝毎分30回。
// 第1部の物（content-draft.js）はそのまま使う。

// 新しい素材（17個。第1部の22個と合わせて39個）
export const items = {
  // エーテル
  refined: { name: '精製エーテル', sys: 'エーテル' },
  sludge: { name: '澱', sys: 'エーテル', note: '精製器の副産物' },
  refuel: { name: '精製燃料', sys: 'エーテル', note: '魔力炉で燃料の2倍長く燃える' },
  floatmix: { name: '浮遊石の素', sys: 'エーテル', note: '6秒で石くずになる（冷気の中では止まる）' },
  gravel: { name: '石くず', sys: 'エーテル', note: '浮遊石の素が固まったもの。使い道はない' },
  floatstone: { name: '浮遊石', sys: 'エーテル' },
  floatplank: { name: '浮き板', sys: 'エーテル', note: '大目標「浮き橋がかかる」' },
  // 育てる
  spore: { name: '胞子', sys: '倉庫' },
  moss: { name: '光る苔', sys: '育てる', note: '育て床で増える' },
  drymoss: { name: '乾き苔', sys: '育てる' },
  thread: { name: '魔法の糸', sys: '育てる' },
  canvas: { name: '帆布', sys: '育てる', note: '大目標「温室と市場」' },
  mosspot: { name: '苔の鉢', sys: '育てる', note: '大目標「温室と市場」' },
  // 総まとめ
  balloon: { name: '浮き袋', sys: '総まとめ' },
  compass: { name: '航海計器', sys: '総まとめ' },
  hull: { name: '船体', sys: '総まとめ' },
  airship: { name: '飛空艇', sys: '総まとめ', note: '大目標「飛空艇が飛ぶ」' },
};

// 新しい機械（7種。第1部の14種と合わせて21種）と道具（2つ）
export const buildings = {
  refiner: { name: '精製器', w: 2, h: 2, recipes: ['refine'] },
  steeper: { name: '浸し槽', w: 2, h: 2, recipes: ['steep'], mana: true },
  lightPost: { name: '灯り台', w: 1, h: 1, field: 'light', radius: 2, mana: true },
  planter: { name: '育て床', w: 2, h: 2, recipes: ['grow', 'mosspot'] },
  spinner: { name: '紡ぎ機', w: 2, h: 2, recipes: ['spin'] },
  loom: { name: '織機', w: 2, h: 2, recipes: ['weave', 'canvasAlt', 'balloon'] },
  shipyard: { name: '造船台', w: 4, h: 4, recipes: ['airship'], mana: true },
};
export const tools = {
  fastBelt: { name: '速いベルト', note: '1マスを0.25秒で進む（ふつうの2倍、毎分240個まで）' },
  prioritySplitter: { name: '優先分岐', note: '正面に入れられるときは正面へ、詰まっているときだけ左右へ' },
};

// 第1部の機械に足すレシピ（区画が開くと選べる）
export const altRecipes = {
  refuel: 'still', // 蒸留器：精製エーテル → 精製燃料
  floatmix: 'mixer', // 調合台：澱＋砂 → 浮遊石の素
  floatplank: 'assembler', // 組立台：板2＋浮遊石 → 浮き板
  compass: 'workbench', // からくり台：時計の機構＋レンズ＋光る苔 → 航海計器
  hull: 'workbench', // からくり台：浮き板2＋焼き入れ鋼＋枠 → 船体
  frameAlt: 'press', // プレス機（別レシピ）：焼き入れ鋼 → 枠2（板から作るより材料が少ない。プレス機は揺れる）
};

export const recipes = {
  refine: { in: { aether: 2 }, out: { refined: 1, sludge: 1 }, ticks: 20 }, // 正面から交互に出る
  refuel: { in: { refined: 1 }, out: { refuel: 1 }, ticks: 20 },
  floatmix: { in: { sludge: 1, sand: 1 }, out: { floatmix: 1 }, ticks: 20 },
  steep: { in: { floatmix: 1, refined: 1 }, out: { floatstone: 1 }, ticks: 30 },
  floatplank: { in: { plank: 2, floatstone: 1 }, out: { floatplank: 1 }, ticks: 30 },
  grow: { in: { moss: 1, aether: 1 }, out: { moss: 2 }, ticks: 40 }, // 増える：差し引き毎分15増える
  mosspot: { in: { glass: 1, moss: 2 }, out: { mosspot: 1 }, ticks: 30 },
  spin: { in: { drymoss: 2 }, out: { thread: 1 }, ticks: 20 },
  weave: { in: { thread: 3 }, out: { canvas: 1 }, ticks: 40 },
  canvasAlt: { in: { thread: 2, sludge: 1 }, out: { canvas: 1 }, ticks: 40, alt: true }, // 澱で糊づけした帆布（糸が少なく済む）
  frameAlt: { in: { steel: 1 }, out: { frame: 2 }, ticks: 40, alt: true },
  balloon: { in: { canvas: 2, floatstone: 1 }, out: { balloon: 1 }, ticks: 60 },
  compass: { in: { clockwork: 1, lens: 1, moss: 1 }, out: { compass: 1 }, ticks: 60 },
  hull: { in: { floatplank: 2, steel: 1, frame: 1 }, out: { hull: 1 }, ticks: 60 },
  airship: { in: { balloon: 1, compass: 1, hull: 1, lantern: 2 }, out: { airship: 1 }, ticks: 600 },
};

// 範囲がベルト上の素材に効く（ticks は範囲の中にいた刻みの合計。5刻み＝1マス）
export const fieldRules = [
  { field: 'light', from: 'spore', to: 'moss', ticks: 20 }, // 光の中を4マス
  { field: 'heat', from: 'moss', to: 'drymoss', ticks: 10 }, // 熱の中を2マス
];
// 時間で変わる（ベルトの上でも機械の前でも。冷気の中では時間が止まる）
export const decayRules = [
  { from: 'floatmix', to: 'gravel', ticks: 60, pausedBy: 'cold' }, // 6秒＝ふつうのベルト12マス分
];

// imports：前の区画から倉庫を通して受け取る物。raw：倉庫の原料。rawRate：原料の口が毎分出せる量（書いていなければ120）
export const districts = [
  { id: 'd8', name: '区8 霧の精製所', sys: 'エーテル', w: 12, h: 8, leyline: false,
    rule: '副産物（精製器は精製エーテルと澱を正面から交互に出す。澱を逃がさないと詰まる）', tool: '–',
    raw: ['aether'], imports: [], recipes: ['refuel'], base: ['refiner'],
    requests: [{ refined: 15 }, { refuel: 30 }], opens: '精製器、区9' },
  { id: 'd9', name: '区9 浮き石の工房', sys: 'エーテル', w: 13, h: 8, leyline: false,
    rule: '時間で変わる（浮遊石の素は6秒で石くずになる。冷気の中では止まる）', tool: '速いベルト',
    raw: ['aether', 'sand'], imports: [], recipes: ['floatmix'], base: ['steeper', 'fastBelt'],
    requests: [{ floatstone: 15 }, { floatstone: 30 }], opens: '浸し槽、速いベルト、区10' },
  { id: 'd10', name: '区10 浮き橋の桟橋', sys: 'エーテル（大目標）', w: 18, h: 6, leyline: false,
    rule: '地形（水の上には置けない。桟橋の足場だけ）', tool: '–',
    raw: ['wood'], imports: ['floatstone'], recipes: ['floatplank'], base: [],
    requests: [{ floatplank: 10 }, { floatplank: 20 }], goal: '浮き橋がかかる', opens: '浮き橋がかかる、区11' },
  { id: 'd11', name: '区11 光苔の庭', sys: '育てる', w: 12, h: 8, leyline: false,
    rule: '光の範囲（灯り台の光の中を4マス進んだ胞子は光る苔になる）', tool: '–',
    raw: ['spore', 'aether'], imports: ['refuel'], recipes: [], base: ['lightPost'],
    requests: [{ moss: 15 }, { moss: 30 }], opens: '灯り台、区12' },
  { id: 'd12', name: '区12 苗床の温室', sys: '育てる', w: 12, h: 8, leyline: false,
    rule: '増える（育て床は光る苔1とエーテル水から光る苔2。前の区画から届く苔は毎分30だけ）', tool: '優先分岐',
    raw: ['aether'], imports: ['moss', 'refuel'], seed: { moss: 30 }, recipes: [], base: ['planter', 'prioritySplitter'],
    requests: [{ moss: 60 }, { moss: 90 }], opens: '育て床、優先分岐、区13' },
  { id: 'd13', name: '区13 帆と糸の工房', sys: '育てる（大目標）', w: 13, h: 9, leyline: false,
    rule: '熱で乾かす（光る苔は熱の中を2マスで乾き苔）', tool: '–',
    raw: ['aether'], imports: ['moss', 'glass', 'refuel', 'sludge'], recipes: ['mosspot'], base: ['spinner', 'loom'],
    requests: [{ thread: 20 }, { canvas: 10, mosspot: 10 }], goal: '温室と市場', opens: '紡ぎ機・織機、温室と市場、区14' },
  { id: 'd14', name: '区14 飛空艇の部品工房', sys: '総まとめ', w: 16, h: 10, leyline: false,
    rule: '口が多い（前の大目標の物と第1部の余りを、たくさんの口から受け取る）', tool: '–',
    raw: ['aether'], imports: ['canvas', 'floatstone', 'clockwork', 'lens', 'moss', 'floatplank', 'steel', 'frame', 'refuel'],
    recipes: ['balloon', 'compass', 'hull', 'canvasAlt', 'frameAlt'], base: [],
    requests: [{ balloon: 5 }, { compass: 5 }, { hull: 5 }, { balloon: 5, compass: 5, hull: 5 }], opens: '区15' },
  { id: 'd15', name: '区15 天空の造船所', sys: '総まとめ（大目標）', w: 14, h: 10, leyline: false,
    rule: '大きな機械（4×4の造船台。4種類を4つの辺から受け取る）', tool: '–',
    raw: ['aether'], imports: ['balloon', 'compass', 'hull', 'lantern', 'refuel'], recipes: [], base: ['shipyard'],
    requests: [{ airship: 1 }], goal: '飛空艇が飛ぶ', opens: '飛空艇が飛ぶ' },
];

export default { items, buildings, tools, altRecipes, recipes, fieldRules, decayRules, districts };
