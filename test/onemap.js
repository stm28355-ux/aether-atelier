// 区16「1枚の工房」のお手本（フェーズ16の検証）。飛空艇を毎分1。原料の口を自由に置き、魔力炉ごとに エーテル水の口 → 蒸留器 で燃料を入れる。
// 組んだ順：上の帯（歯車箱・時計の機構・航海計器）→ 下の帯（ランタン・船体）と造船台 → 仮の口を1つずつ本物の作り場に替えた（dummy はその名残。real がすべて上書きする）
const E = 0, S = 1, W = 2, N = 3;
const b = (x, y, dir) => ({ id: 'belt', x, y, dir });
const m = (id, x, y, dir = E, p = {}) => ({ id, x, y, dir, ...p });
const u = (x, y, dir, role) => ({ id: 'under', x, y, dir, role });
const P = (item, x, y, dir) => ({ id: 'port', x, y, dir, item }); // 自由に置ける倉庫の口
const sp = (x, y, dir) => ({ id: 'splitter', x, y, dir });
const of = (x, y, dir) => ({ id: 'overflow', x, y, dir });
const sort = (x, y, dir, filter) => ({ id: 'sorter', x, y, dir, filter });
const row = (xs, y, dir) => xs.map((x) => b(x, y, dir));
const col = (x, ys, dir) => ys.map((y) => b(x, y, dir));
const R = (a, z) => Array.from({ length: Math.abs(z - a) + 1 }, (_, i) => (z >= a ? a + i : a - i));
// 魔力炉と燃料（エーテル水の口 → 蒸留器 → 魔力炉）
const mana = (x, y, sx, sy, sd, px, py, pd) => [m('manaFurnace', x, y), m('still', sx, sy, sd, { recipe: 'fuel' }), P('aether', px, py, pd)];

export const SIZE = { w: 26, h: 27 };

// ---- 上の帯（歯車箱・時計の機構・航海計器。上向き）：行1〜3。出口は行0、入口は行4 ----
const bandA = [
  ...mana(0, 2, 0, 1, S, 1, 1, W), m('workbench', 2, 1, N, { recipe: 'gearbox' }),
  ...mana(5, 2, 5, 1, S, 6, 1, W), m('workbench', 7, 1, N, { recipe: 'clockwork' }),
  ...mana(10, 2, 10, 1, S, 11, 1, W), m('workbench', 12, 1, N, { recipe: 'compass' }),
  ...mana(15, 2, 15, 1, S, 16, 1, W),
  b(4, 0, E), b(5, 0, E), u(6, 0, S, 'in'), u(6, 4, S, 'out'), b(6, 5, E), b(7, 5, N), b(7, 4, N), // 歯車箱 → 時計の機構
  b(9, 0, E), b(10, 0, E), u(11, 0, S, 'in'), u(11, 4, S, 'out'), b(11, 5, E), b(12, 5, N), b(12, 4, N), // 時計の機構 → 航海計器
  ...row(R(14, 16), 0, E), ...col(17, R(0, 13), S), // 航海計器 → 造船台の上（右の列）
];
// ---- 下の帯（ランタン・船体。上向き）：行14〜16。入口は行17（下から）、出口は行13 → 造船台の上 ----
const bandB = [
  ...mana(0, 15, 0, 14, S, 1, 14, W), m('workbench', 2, 14, N, { recipe: 'lantern' }),
  ...mana(6, 15, 6, 14, S, 7, 14, W), m('workbench', 8, 14, N, { recipe: 'hull' }),
  ...mana(11, 15, 11, 14, S, 12, 14, W),
  ...row(R(4, 13), 13, E), of(14, 13, S), // ランタンと船体 → 造船台（混ざった線の詰まりは、あふれ口で倉庫へ）
  m('shipyard', 14, 14, E), // 納める口は区画に固定（18,15）
  ...mana(15, 12, 14, 12, E, 13, 12, E), ...mana(15, 18, 17, 18, W, 18, 18, W),
];
// 仮の口（本物の作り場に替えていく）
export const dummy = {
  frameA: [P('frame', 2, 5, N), b(2, 4, N)],
  gear: [P('gear', 3, 5, N), b(3, 4, N)],
  screw: [P('screw', 4, 5, N), b(4, 4, N)],
  spring: [P('spring', 8, 5, N), b(8, 4, N)],
  lensA: [P('lens', 13, 5, N), b(13, 4, N)],
  moss: [P('moss', 14, 5, N), b(14, 4, N)],
  frameB: [P('frame', 2, 18, N), b(2, 17, N)],
  lensB: [P('lens', 3, 18, N), b(3, 17, N)],
  crystal: [P('crystal', 4, 18, N), b(4, 17, N)],
  floatplank: [P('floatplank', 8, 18, N), b(8, 17, N)],
  steelB: [P('steel', 9, 18, N), b(9, 17, N)],
  frameH: [P('frame', 10, 18, N), b(10, 17, N)],
  balloon: [P('balloon', 14, 19, N), b(14, 18, N)],
};
// 本物の作り場（dummy と同じ名前で置くと、その仮の口を外す）。
// 範囲で素材を変える線の終わりには、あふれ口（魔力が届く前に流れた物を倉庫へ戻す）
export const real = {
  // 左の列：木材の口 → 製材機 → 組立台（枠）→ 上へ歯車箱、下へランタン
  frameA: [
    P('wood', 0, 5, S), m('saw', 0, 6, S), m('assembler', 0, 8, E, { recipe: 'frame' }),
    ...col(2, R(8, 4), N),
  ],
  // 鉱石の口 → 熱の中を4マス → 鋳型台 → プレス機（歯車）と、分岐で旋盤（ねじ。歯車箱へじかに）。竜炉は真ん中の魔力炉で
  gear: [
    m('press', 3, 6, N, { recipe: 'gear' }), b(3, 5, N), b(3, 4, N),
    m('caster', 4, 8, N), sp(5, 7, N), b(5, 6, N), b(5, 5, N), b(5, 4, W), m('lathe', 4, 4, N, { recipe: 'screw' }),
    P('ore', 10, 9, W), ...row(R(9, 7), 9, W), of(6, 9, W), m('furnace', 6, 10), ...mana(8, 10, 10, 10, W, 11, 10, W),
  ],
  screw: [],
  // 分岐の右 → 熱（赤熱した板）→ 冷気2マス（焼き入れ鋼）→ 巻き機 → 時計の機構へぜんまい
  spring: [
    b(6, 7, S), ...row(R(6, 9), 8, E), b(10, 8, N), of(10, 7, W), m('frostPillar', 11, 8),
    m('winder', 8, 6, N), b(9, 5, N), b(9, 4, N),
  ],
  // エーテル水の口 → 冷気4マス（結晶）→ 研磨機（結晶からレンズ）→ 航海計器へ。研磨機と灯り台は右の魔力炉で
  lensA: [
    P('aether', 12, 11, N), ...col(12, R(10, 9), N), b(12, 8, E), of(13, 8, N),
    m('polisher', 13, 6, N, { recipe: 'lensAlt' }), b(13, 5, N), b(13, 4, N),
    ...mana(15, 6, 15, 8, N, 16, 8, W),
  ],
  // 胞子の口 → 光4マス（光る苔）→ 研磨機の下をくぐって航海計器へ
  moss: [
    P('spore', 16, 10, W), b(15, 10, W), b(14, 10, N), b(14, 9, N), u(14, 8, N, 'in'), u(14, 5, N, 'out'), of(14, 4, N),
    m('lightPost', 15, 9),
  ],
  // ランタンへ：枠（製材機 → 組立台）、レンズ（研磨機をじかに下から）、結晶（冷気4マス → 分岐で研磨機と、横の列5から）
  frameB: [P('wood', 0, 21, N), m('saw', 0, 19, N), m('assembler', 0, 17, E, { recipe: 'frame' }), b(2, 17, N)],
  lensB: [m('polisher', 3, 17, N, { recipe: 'lensAlt' })],
  crystal: [
    m('frostPillar', 6, 18), P('aether', 6, 19, S), b(6, 20, W), b(5, 20, W), b(4, 20, N), sp(4, 19, N),
    ...col(5, R(19, 17), N), of(5, 16, W),
  ],
  // 船体へ浮き板：製材機 → 組立台（浮き板、じかに上へ）。浮遊石は 精製器 → 調合台（＋砂）→ 浸し槽 → 列7を上へ
  floatplank: [
    m('assembler', 8, 17, N, { recipe: 'floatplank' }), m('saw', 8, 19, N), P('wood', 8, 21, N),
    m('steeper', 6, 22, N, { recipe: 'steep' }), m('mixer', 6, 24, N, { recipe: 'floatmix' }), m('refiner', 8, 23, W),
    P('aether', 9, 25, N), P('sand', 5, 25, E), ...col(7, R(21, 19), N), b(7, 18, E),
    ...mana(4, 22, 4, 24, N, 5, 24, W),
  ],
  // 浮き袋：紡ぎ機 → 織機（帆布）→ 織機（浮き袋）を右から左へじかに。浮き袋は行20を左へ、造船台の下から
  // 浮遊石は2組目の 精製器 → 調合台 → 浸し槽（上から）。乾き苔は 胞子 → 光4マス → 熱2マス（下の竜炉）→ 紡ぎ機の下から
  balloon: [
    m('loom', 20, 19, W, { recipe: 'balloon' }), m('loom', 22, 19, W, { recipe: 'weave' }), m('spinner', 24, 19, W),
    ...row(R(19, 15), 20, W), b(14, 20, N), b(14, 19, N), b(14, 18, N),
    m('refiner', 20, 13, S), m('steeper', 19, 15, S, { recipe: 'steep' }), m('mixer', 21, 15, W, { recipe: 'floatmix' }),
    P('aether', 22, 13, W), P('sand', 23, 16, W), b(20, 17, S), b(20, 18, S),
    ...mana(21, 17, 23, 17, W, 24, 17, W),
    P('spore', 23, 25, W), ...row(R(22, 19), 25, W), b(18, 25, N), b(18, 24, N), ...row(R(18, 22), 23, E),
    b(23, 23, N), b(23, 22, E), b(24, 22, N), of(24, 21, N), m('lightPost', 20, 24),
  ],
  // 船体へ：列10を上へ、枠と焼き入れ鋼を混ぜて入れる（入口はあふれ口）
  // 枠：木材の口 → 製材機 → 組立台（左向き、列10へじかに）
  // 鋼：鉱石の口 → 熱4マス → 鋳型台 → 熱4マス（赤熱した板）→ 熱の外へ → 冷気（焼き入れ鋼）→ 列10
  frameH: [
    of(10, 17, N), ...col(10, R(18, 23), N),
    m('assembler', 11, 18, W, { recipe: 'frame' }), m('saw', 11, 20, N), P('wood', 11, 22, N),
  ],
  steelB: [
    P('ore', 20, 26, W), ...row(R(19, 16), 26, W), of(15, 26, N), m('caster', 14, 24, N),
    b(15, 23, N), b(15, 22, N), b(15, 21, W), b(14, 21, W), b(13, 21, S), b(13, 22, S), ...row(R(13, 11), 23, W),
    m('furnace', 16, 23), m('frostPillar', 11, 24),
    ...mana(12, 25, 11, 25, E, 11, 26, N), ...mana(18, 21, 20, 21, W, 21, 21, W),
  ],
};
const keys = [...new Set([...Object.keys(dummy), ...Object.keys(real)])];
export const layout = [...bandA, ...bandB, ...keys.flatMap((k) => real[k] || dummy[k])];
