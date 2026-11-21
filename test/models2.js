// 第2部のお手本の配置（区8〜）。models.js と同じ形
const E = 0, S = 1, W = 2, N = 3;
const b = (x, y, dir) => ({ id: 'belt', x, y, dir });
const fb = (x, y, dir) => ({ id: 'fastBelt', x, y, dir });
const m = (id, x, y, dir = E, p = {}) => ({ id, x, y, dir, ...p });
const u = (x, y, dir, role) => ({ id: 'under', x, y, dir, role });
const of = (x, y, dir) => ({ id: 'overflow', x, y, dir });
const row = (xs, y, dir, f = b) => xs.map((x) => f(x, y, dir));
const col = (x, ys, dir, f = b) => ys.map((y) => f(x, y, dir));
const range = (a, z) => Array.from({ length: z - a + 1 }, (_, i) => a + i);

// 区8（12×6）。段1：精製エーテルを毎分15（精製器の出す物を、澱ごと納める）
const d8a = [m('refiner', 1, 1), ...row(range(3, 10), 2, E)];
// 段2：精製燃料を毎分30。選り分けで澱を下へよけ、蒸留器のあとで合流させる
const d8b = [
  m('refiner', 1, 1), b(3, 2, E), m('sorter', 4, 2, E, { filter: 'sludge' }),
  m('still', 5, 2, E, { recipe: 'refuel' }), ...row(range(6, 10), 2, E),
  b(4, 3, S), ...row(range(4, 9), 4, E), b(10, 4, N), b(10, 3, N),
];

// 区9（14×9）。浮遊石を毎分30：浸し槽2台を魔力炉の左右に置き、下の1列で納める口へ。
// 精製エーテルは上の列から、浮遊石の素は下の列から（右の浸し槽へは速いベルトで、6秒に間に合わせる）
const d9 = [
  m('refiner', 1, 1), b(3, 2, E), m('sorter', 4, 2, E, { filter: 'sludge' }),
  m('splitter', 5, 2, E), ...row(range(6, 9), 2, E), b(10, 2, S), b(10, 3, S), b(5, 3, S), // 精製エーテル
  b(4, 3, W), ...col(3, [3, 4, 5], S), b(3, 6, W), b(2, 6, S), // 澱 → 調合台
  m('mixer', 1, 7, E, { recipe: 'floatmix' }), b(3, 8, E), m('splitter', 4, 8, E), // 浮遊石の素
  ...col(4, [7, 6, 5], N), of(4, 4, E),
  ...row(range(5, 10), 8, E, fb), fb(11, 8, N), u(11, 7, N, 'in'), u(11, 5, N, 'out'), of(11, 4, W),
  m('steeper', 5, 4, S), m('steeper', 9, 4, S), m('manaFurnace', 7, 4),
  u(7, 1, S, 'in'), u(7, 3, S, 'out'), // 精製燃料（区8から）
  ...row(range(5, 12), 6, E), // 浮遊石 → 納める口
];

// 区10（18×6）。浮き板を毎分20：岸で木材を板にし、桟橋で島へ渡して組立台、水の下をくぐって右の岸へ
const d10 = [
  m('splitter', 1, 2, E), m('saw', 1, 0), m('saw', 1, 3),
  ...col(3, [0, 1, 2, 3], S), b(3, 4, E), ...row([4, 5, 6], 4, E), // 板 → 桟橋
  b(9, 1, W), ...col(8, [1, 2, 3], S), // 浮遊石
  m('assembler', 7, 4, E, { recipe: 'floatplank' }),
  b(9, 4, E), b(10, 4, E), u(11, 4, E, 'in'), u(16, 4, E, 'out'),
];

// 区11（12×6）。光る苔を毎分30：胞子のベルトを灯り台の光に5マス通す。灯り台は魔力炉の範囲に
const d11 = [
  ...row(range(1, 10), 2, E), m('lightPost', 5, 1), m('manaFurnace', 4, 3), ...row([1, 2, 3], 4, E),
];

// 区12（14×7）。光る苔を毎分90：育て床4台（上向き）の間の列から、苔は上から、エーテル水は下から分岐で左右へ入れる。
// 出た苔は上の列で集め（苔の落ちる列は下をくぐる）、優先分岐で上の列へ戻し、戻しきれない分を納める
const ps = (x, y, dir) => ({ id: 'prioritySplitter', x, y, dir });
const d12 = [
  m('planter', 1, 3, N), m('planter', 4, 3, N), m('planter', 7, 3, N), m('planter', 10, 3, N),
  b(1, 1, E), b(2, 1, E), m('splitter', 3, 1, E), ...row(range(4, 8), 1, E), b(9, 1, S), // 苔
  b(3, 2, S), b(9, 2, S), m('splitter', 3, 3, S), m('splitter', 9, 3, S),
  m('splitter', 1, 6, E), b(1, 5, W), b(0, 5, N), ...row(range(2, 5), 6, E), m('splitter', 6, 6, E), b(6, 5, N), // エーテル水
  ...row(range(7, 11), 6, E), b(12, 6, N), b(12, 5, N),
  m('splitter', 0, 4, N), m('splitter', 6, 4, N), m('splitter', 12, 4, N),
  b(1, 2, E), u(2, 2, E, 'in'), u(4, 2, E, 'out'), b(5, 2, E), b(6, 2, E), b(7, 2, E), u(8, 2, E, 'in'), u(10, 2, E, 'out'),
  b(11, 2, E), b(12, 2, N), ps(12, 1, N), // 出た苔
  b(12, 0, W), ...row(range(2, 11), 0, W), b(1, 0, S), // 戻す
];

// 区13（13×9）。帆布を毎分10と苔の鉢を毎分10：苔は優先分岐で、熱の列（乾き苔 → 紡ぎ機 → 織機）が先、
// あふれた分を下の育て床（苔の鉢。ガラスは口から直接）へ
const d13common = [
  ps(1, 1, E), ...row(range(2, 9), 1, E), m('spinner', 10, 0, S), m('furnace', 6, 2), m('manaFurnace', 6, 4),
  ...col(1, [2, 3, 4], S), m('planter', 1, 5, E, { recipe: 'mosspot' }),
  b(3, 6, S), ...row(range(3, 11), 7, E), ...col(12, [7, 6, 5], N), // 苔の鉢 → 納める口
  ...row(range(1, 5), 8, E), u(6, 8, N, 'in'), u(6, 6, N, 'out'), // 精製燃料
  b(10, 2, S),
];
const d13a = [...d13common, b(10, 3, S), b(10, 4, E), b(11, 4, E)]; // 段1：魔法の糸を毎分20
const d13b = [...d13common, m('loom', 10, 3, E, { recipe: 'weave' })]; // 段2：帆布

export const STAGES2 = { d8: [d8a, d8b], d9: [d9], d10: [d10], d11: [d11], d12: [d12], d13: [d13a, d13b] };
