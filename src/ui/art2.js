// 第2部の機械と素材の絵（フェーズ14。試し描き3回目を人が OK）。machines.js と sprites.js が読み込んで足す。
// 第1部と同じ決まり：1マス＝20ドット、真上から見た形、モチーフを1つ真ん中に、顔はつけない。
// active：動いているか（止まると光や液が暗くなる）
import { OUT, shade, base } from './pixel.js';

// 横長の楕円（rx, ry）を塗る
function oval(d, cx, cy, rx, ry, c) {
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
    const t = 1 - ((y + 0.5 - cy) / ry) ** 2;
    if (t < 0) continue;
    const hw = rx * Math.sqrt(t), x0 = Math.round(cx - hw), x1 = Math.round(cx + hw);
    if (x1 > x0) d.r(x0, y, x1 - x0, 1, c);
  }
}

export const ART2 = {
  // 精製器：ガラスの槽の中で、上に澄んだ精製エーテル、底に澱が沈んでいる。下に2つの出口（澄んだ液と澱）
  refiner(d, gw, gh, active) {
    base(d, gw, gh, '#3f8fa8', { rivets: true });
    const cx = gw / 2, cy = gh / 2 - 1;
    d.disc(cx, cy, 13.2, OUT);
    d.disc(cx, cy, 12.2, '#d5f2f8'); // ガラスの縁
    d.disc(cx, cy, 10.6, OUT);
    d.disc(cx, cy, 10, '#6b5a3e'); // 澱（底）
    d.disc(cx, cy - 3.2, 9.2, active ? '#9fe6f2' : '#7fb3bd'); // 澄んだ精製エーテル
    d.disc(cx - 3, cy - 6, 2.6, active ? '#e9fbff' : '#b9d6dc');
    d.px(cx - 4, cy - 7, '#ffffff');
    for (const [x, y] of [[cx - 4, cy + 7], [cx + 1, cy + 8], [cx + 5, cy + 6]]) d.px(x, y, '#8a7650'); // 澱の泡
    if (active) for (const [x, y] of [[cx + 4, cy - 2], [cx + 6, cy - 5], [cx + 2, cy - 8]]) d.px(x, y, '#ffffff'); // 上る泡
    d.disc(cx, cy, 2.2, OUT); d.px(cx, cy, '#c9d1d9'); // 真ん中の軸
    for (const [x, col] of [[8, '#bff3ff'], [gw - 14, '#6b5a3e']]) { // 2つの出口
      d.r(x, gh - 7, 6, 4, OUT); d.r(x + 1, gh - 6, 4, 2, col);
    }
  },

  // 浸し槽：四角い槽に光る精製エーテルを満たし、浮遊石が浸かって浮きかけている
  steeper(d, gw, gh, active) {
    base(d, gw, gh, '#2f5560', { rivets: true });
    d.r(5, 5, gw - 10, gh - 10, OUT);
    const liquid = active ? '#5fcfe0' : '#3f7f8a';
    d.r(6, 6, gw - 12, gh - 12, liquid);
    d.r(6, 6, gw - 12, 2, active ? '#bff3ff' : '#6f9fa8');
    for (let y = 11; y < gh - 7; y += 5) for (let x = 8 + (y % 2) * 3; x < gw - 8; x += 7) d.r(x, y, 3, 1, shade(liquid, 0.25)); // 液面の揺れ
    for (const [x, y, rad] of [[14, 15, 4.2], [26, 23, 4.6], [14, 28, 3.2]]) { // 浮遊石
      if (active) { d.disc(x, y, rad + 2, shade(liquid, 0.35)); d.disc(x, y, rad + 1.2, liquid); } // 浮きかけの波紋
      d.disc(x, y, rad + 0.8, '#2f5a52');
      d.disc(x, y, rad, '#9fd6c9');
      d.disc(x - 1, y - 1, rad * 0.45, '#d8f2ea');
      d.px(Math.round(x + rad * 0.4), Math.round(y + rad * 0.3), '#6fa89a');
    }
  },

  // 灯り台（1×1）：上から見たランタン。動いていると周りに光が広がる
  lightPost(d, gw, gh, active) {
    base(d, gw, gh, '#5c5240');
    const cx = gw / 2, cy = gh / 2;
    if (active) { d.disc(cx, cy, 8, '#c9a84a'); d.disc(cx, cy, 6.6, '#ffe08a'); }
    d.disc(cx, cy, 5.2, OUT);
    d.disc(cx, cy, 4.2, active ? '#fff3c4' : '#8a7a5a');
    d.disc(cx - 1, cy - 1, 1.6, active ? '#ffffff' : '#a89a78');
    d.r(cx - 5, cy, 10, 1, OUT); d.r(cx, cy - 5, 1, 10, OUT); // 籠の枠
    if (active) for (const [x, y] of [[3, 3], [gw - 4, 3], [3, gh - 4], [gw - 4, gh - 4]]) d.px(x, y, '#fff3c4'); // 光の粒
  },

  // 育て床：木の枠に黒い土、光る苔の株がいくつも
  planter(d, gw, gh, active) {
    base(d, gw, gh, '#7a5a32', { wood: true });
    d.r(5, 5, gw - 10, gh - 10, OUT);
    d.r(6, 6, gw - 12, gh - 12, '#45301f');
    for (let k = 0; k < 40; k++) d.px(7 + ((k * 7) % (gw - 14)), 7 + ((k * 11) % (gh - 14)), '#5e4430'); // 土の粒
    for (const [x, y, rad] of [[12, 12, 3.6], [27, 11, 3.2], [20, 20, 4], [11, 28, 3.2], [28, 28, 3.8]]) { // 苔の株
      d.disc(x, y, rad + 0.8, '#1f4a38');
      d.disc(x, y, rad, active ? '#3fb487' : '#3a7a62');
      d.disc(x - 0.5, y - 0.5, rad * 0.6, active ? '#6fe0b0' : '#4f9a7c');
      d.px(Math.round(x - 1), Math.round(y - 1), active ? '#dcfff0' : '#8fbfa8');
    }
    if (active) for (const [x, y] of [[17, 9], [33, 18], [7, 20], [23, 33]]) d.px(x, y, '#b8ffe0'); // 光の粒
  },

  // 紡ぎ機：大きな糸車（スポーク）と、糸を巻いた紡錘。下に乾き苔の山
  spinner(d, gw, gh, active) {
    base(d, gw, gh, '#7a8a5a', { wood: true });
    const cx = 16, cy = 17;
    d.disc(cx, cy, 12.4, OUT);
    d.disc(cx, cy, 11.4, '#b07a3c'); // 車の輪
    d.disc(cx, cy, 9.6, OUT);
    d.disc(cx, cy, 8.8, '#6e5a36');
    for (let k = 0; k < 6; k++) { // スポーク
      const a = (k / 6) * Math.PI * 2 + (active ? 0.25 : 0);
      d.line(cx, cy, cx + Math.cos(a) * 8.6, cy + Math.sin(a) * 8.6, '#c9935a');
    }
    d.disc(cx, cy, 2.6, OUT); d.disc(cx, cy, 1.6, '#e0b97a');
    d.r(29, 8, 6, 20, OUT); d.r(30, 9, 4, 18, '#d8f0e6'); // 糸を巻いた紡錘
    for (let y = 10; y < 27; y += 2) d.r(30, y, 4, 1, active ? '#a8f0d0' : '#b8c8c0');
    d.r(31, 5, 2, 4, OUT); d.r(31, 27, 2, 4, OUT);
    d.line(cx + 9, cy - 8, 30, 10, '#e8fff4'); // 糸
    for (const [x, y] of [[6, 32], [9, 33], [12, 32], [8, 31], [11, 34], [14, 33]]) { d.r(x, y, 3, 2, OUT); d.r(x, y, 2, 1, '#a9b67a'); } // 乾き苔
  },

  // 織機：上下の梁の間に縦糸を張り、下半分は織り上がった帆布。真ん中に杼
  loom(d, gw, gh) {
    base(d, gw, gh, '#8a6a40', { wood: true });
    for (const y of [5, gh - 9]) { d.r(4, y, gw - 8, 4, OUT); d.r(5, y + 1, gw - 10, 2, '#c9935a'); d.r(5, y + 1, gw - 10, 1, '#e0b97a'); } // 梁
    for (let x = 7; x < gw - 6; x += 2) d.r(x, 9, 1, 10, '#d8f0e6'); // 縦糸
    d.r(6, 19, gw - 12, gh - 28, OUT);
    d.r(7, 20, gw - 14, gh - 30, '#efe6cf'); // 帆布
    for (let y = 20; y < gh - 10; y++) for (let x = 7 + (y % 2); x < gw - 7; x += 2) d.px(x, y, '#ddd2b4'); // 織り目
    d.r(11, 16, 18, 4, OUT); d.r(12, 17, 16, 2, '#b07a3c'); d.r(13, 17, 5, 1, '#e0b97a'); // 杼
    d.px(10, 17, OUT); d.px(29, 18, OUT);
    d.r(19, 17, 2, 2, '#d8f0e6'); // 杼の糸巻き
  },

  // 造船台（4×4）：真上から見た飛空艇。紫の浮き袋に縦の継ぎ目、うしろに尾翼、まわりに足場の柱
  shipyard(d, gw, gh, active) {
    base(d, gw, gh, '#4f4868', { rivets: true });
    for (let y = 8; y < gh - 6; y += 6) d.r(4, y, gw - 8, 1, '#433c58'); // 床板
    for (const [x, y] of [[10, 10], [gw - 10, 10], [10, gh - 10], [gw - 10, gh - 10]]) { // 足場の柱
      d.disc(x, y, 4, OUT); d.disc(x, y, 3, '#9aa1aa'); d.px(x - 1, y - 1, '#d5dae0');
    }
    d.line(10, 10, gw - 10, 10, '#9aa1aa'); d.line(10, gh - 10, gw - 10, gh - 10, '#9aa1aa'); // 足場の梁
    const cx = gw / 2 - 3, cy = gh / 2;
    for (const [fx, fy, w, h] of [[cx + 24, cy - 12, 8, 6], [cx + 24, cy + 6, 8, 6], [cx + 27, cy - 2, 7, 4]]) { // 尾翼
      d.r(fx, fy, w, h, OUT); d.r(fx + 1, fy + 1, w - 2, h - 2, '#8c5e30');
    }
    oval(d, cx, cy, 29, 15, OUT); // 浮き袋
    const body = active ? '#a87fd6' : '#7d6a99';
    oval(d, cx, cy, 28, 14, body);
    oval(d, cx - 3, cy - 4, 21, 7, active ? '#c7a6e8' : '#958aa8');
    oval(d, cx - 8, cy - 7, 10, 2.5, active ? '#eadcff' : '#b0a8bc');
    for (const k of [-18, -9, 0, 9, 18]) { // 縦の継ぎ目
      const hh = Math.round(14 * Math.sqrt(1 - (k / 28) ** 2));
      d.r(cx + k, cy - hh + 1, 1, hh * 2 - 1, shade(body, -0.25));
    }
    d.r(cx - 12, cy + 8, 24, 4, OUT); d.r(cx - 11, cy + 9, 22, 2, '#8a6a44'); // 吊った船体の縁
    if (active) for (const x of [cx - 7, cx, cx + 7]) d.r(x, cy + 9, 2, 1, '#ffd166'); // 窓の灯り
  },
};

// 素材（16×16）。o は縁、ほかは pal の色
export const ITEMS2 = {
  refined: { // 精製エーテル：エーテル水より澄んだしずくに、星のきらめき
    rows: ['', '.......oo.......', '......oAAo......', '.....oAAAAo.....', '....oAAAAAAo....', '...oAAwAAAAAo...', '...oAwwAAAsAo...', '..oAAwAAAsSsAo..', '..oAAAAAAAsAao..', '..oAAAAAAAAaao..', '...oAAAAAAaao...', '....oaaaaaao....', '.....oooooo.....'],
    pal: { A: '#bff3ff', a: '#7fd7e6', w: '#ffffff', s: '#ffffff', S: '#fff6c4' },
  },
  sludge: { // 澱：底にたまる、ねばる茶色のかたまり
    rows: ['', '', '', '', '', '......oooo......', '....ooSSSSoo....', '...oSSsSSSSSo...', '..oSSSSSSlSSSo..', '..oSsSSSSSSSSo..', '.oSSSSSlSSSsSSo.', '.oSSdSSSSSSSdSo.', '..ooddddddddoo..', '....oooooooo....'],
    pal: { S: '#6b5a3e', s: '#8a7650', l: '#a8946a', d: '#4f4230' },
  },
  floatmix: { // 浮遊石の素：澱と砂を練った、ひびの入った泥の玉
    rows: ['', '', '', '.....oooooo.....', '...ooMMMMMMoo...', '..oMMmMMMMlMMo..', '..oMMMMoMMMMMo..', '.oMMlMMMoMMmMMo.', '.oMMMMMMMoMMMMo.', '.oMmMMoMMMMMMMo.', '.oMMMMMoMMMlMMo.', '..oMMMMMMMMMMo..', '..oMMmMMMMMmMo..', '...ooMMMMMMoo...', '.....oooooo.....'],
    pal: { M: '#b9b08f', m: '#8f866a', l: '#ddd6ba' },
  },
  floatstone: { // 浮遊石：精製エーテルを吸った石が、影から離れて浮いている
    rows: ['', '', '.....oooooo.....', '...ooFFFFFFoo...', '..oFFwwFFFFFFo..', '..oFwFFFFFfFFo..', '.oFFFFFfFFFFFFo.', '.oFFfFFFFFFfFFo.', '..oFFFFFFFFFFo..', '...ooFFFFFFoo...', '.....oooooo.....', '................', '....gggggggg....', '.....gggggg.....'],
    pal: { F: '#9fd6c9', f: '#6fa89a', w: '#e8fff8', g: '#bfe9f2' },
  },
  moss: { // 光る苔：青白く光る小さな株
    rows: ['', '', '', '......o..o......', '.....oGooGo.....', '...o.oGGGGo.o...', '..oGooGgGGGooGo.', '..oGGGgGGGgGGGo.', '.oGGgGGGwGGGGGo.', '.oGGGGGwwGGgGGo.', '.oGgGGGGGGGGGGo.', '..oGGGGgGGGGGo..', '..oddddddddddo..', '...oooooooooo...'],
    pal: { G: '#6fe0b0', g: '#3fb487', w: '#dcfff0', d: '#45301f' },
  },
  refuel: { // 精製燃料：燃料の小瓶より明るい紫に、星の光
    rows: ['', '......oooo......', '......oKKo......', '.......oo.......', '......oVVo......', '.....oVVVVo.....', '....oVwVVVVo....', '...oVVwVVsVVo...', '...oVVVVsSsVo...', '...oVVVVVsVVo...', '...oVVVVVVVvo...', '....ovvvvvvo....', '.....oooooo.....'],
    pal: { V: '#c66cf0', v: '#8a3ab0', K: '#a07a4a', w: '#f0d8ff', s: '#ffffff', S: '#fff6c4' },
  },
  gravel: { // 石くず：浮遊石になりそこねた、小さな灰色の石
    rows: ['', '', '', '', '', '', '.....ooo........', '....oGGGo.ooo...', '....oGgGooGGGo..', '..ooooGooGGgGo..', '.oGGGooGGoooo...', '.oGgGGooGGgGo...', '..oGGGo.ooooo...', '...ooo..........'],
    pal: { G: '#7f786c', g: '#5f594f' },
  },
  floatplank: { // 浮き板：板に浮遊石を埋め込んだもの。少し浮いている
    rows: ['', '', '', '', '.oooooooooooooo.', '.oPPPPPPPPPPPPo.', '.oPppPoooPPppPo.', '.oPPPoFFFoPPPPo.', '.oPPPoFwFoPPPPo.', '.oPppPoooPPppPo.', '.oPPPPPPPPPPPPo.', '.oooooooooooooo.', '...gggggggggg...'],
    pal: { P: '#c8a86a', p: '#a5874e', F: '#9fd6c9', w: '#e8fff8', g: '#bfe9f2' },
  },
  spore: { // 胞子：ふわふわ漂う、淡い緑の小さな粒
    rows: ['', '', '.........oo.....', '........oSso....', '...oo....oo.....', '..oSso......oo..', '...oo..oo..oSso.', '......oSSo..oo..', '......oSso......', '..oo...oo...oo..', '.oSso......oSso.', '..oo...oo...oo..', '......oSso......', '.......oo.......'],
    pal: { S: '#c9e6a3', s: '#9fbf72' },
  },
  drymoss: { // 乾き苔：熱で乾いて、わらのようにほぐれた苔
    rows: ['', '', '', '', '....o..o..o.....', '...oYooYooYo.o..', '..oYyYYyYYyYoYo.', '.oYYyYYYyYYYyYo.', '.oYyYYyYYYyYYYo.', '.oYYYyYYyYYYyYo.', '..oYYYYYYYYYYo..', '..oddddddddddo..', '...oooooooooo...'],
    pal: { Y: '#c8c27a', y: '#a9a25c', d: '#7a6a42' },
  },
  thread: { // 魔法の糸：ほのかに光る糸を巻いた糸巻き
    rows: ['', '', '...oooooooooo...', '...oWWWWWWWWo...', '....oooooooo....', '....oTtTtTtTo...', '....otTtTtTto...', '....oTtTtTtTo...', '....otTtTtTto...', '....oTtTtTtTo...', '....oooooooo....', '...oWWWWWWWWo...', '...oooooooooo...', '..........oTTo..', '............oo..'],
    pal: { W: '#b07a3c', T: '#d8f0e6', t: '#9fe0c4' },
  },
  mosspot: { // 苔の鉢：ガラスの鉢に植えた光る苔
    rows: ['', '', '....o.o..o.o....', '...oGoGooGoGo...', '..oGGgGGGgGGGo..', '..oGGGGwGGGGGo..', '..oooooooooooo..', '..oBBwBBBBBBBo..', '..oBwBBBBBBBBo..', '...oBBBBBBBBo...', '...oBBBBBBBbo...', '....oBBBBBbo....', '....oooooooo....'],
    pal: { G: '#6fe0b0', g: '#3fb487', w: '#dcfff0', B: '#a8e6f0', b: '#6fb8c8' },
  },
  balloon: { // 浮き袋：帆布に浮遊石を縫い込んだ、紫の袋と網
    rows: ['', '....oooooooo....', '..ooBBBBBBBBoo..', '.oBBwwBBnBBBBBo.', '.oBwBBBBnBBBBbo.', 'oBBBBnnnnnnnBBbo', 'oBBBBBBBnBBBBbbo', '.oBBBBBBnBBBbbo.', '..oobBBBnBBboo..', '....oooooooo....', '.....o.oo.o.....', '......oooo......', '......oFFo......', '.......oo.......'],
    pal: { B: '#a87fd6', b: '#7a58a8', w: '#e6d6ff', n: '#d9c2f0', F: '#9fd6c9' },
  },
  compass: { // 航海計器：真鍮の円の中に、光る苔の針
    rows: ['', '.....oooooo.....', '...ooCCCCCCoo...', '..oCCoooooooCo..', '..oCoWWWWWWoCo..', '.oCoWWWWgWWWoCo.', '.oCoWWWWgWWWoCo.', '.oCoWWWgGgWWoCo.', '.oCoWWWWrWWWoCo.', '.oCoWWWWrWWWoCo.', '..oCoWWWWWWoCo..', '..oCCoooooooCo..', '...ooCCCCCCoo...', '.....oooooo.....'],
    pal: { C: '#d0a640', W: '#f4efe0', g: '#6fe0b0', G: '#2f7a5a', r: '#c0392b' },
  },
  hull: { // 船体：浮き板を鋼の帯で留めた舟の形（横から）
    rows: ['', '', '', '', '', 'oooooooooooooooo', 'oHHHHHHHHHHHHHHo', 'ohhhhhhhhhhhhhho', 'oSSSSSSSSSSSSSSo', '.oHHHHHHHHHHHHo.', '..ohhhhhhhhhho..', '...oHHHHHHHHo...', '....oooooooo....'],
    pal: { H: '#8a6a44', h: '#6e5236', S: '#45607e' },
  },
  airship: { // 飛空艇：浮き袋の下に船体を吊った、小さな飛空艇（横から）
    rows: ['', '...oooooooooo...', '.ooBBBwwBBBBBoo.', 'oBBBwwBBBBBBBBbo', 'oBBBBBBBBBBBBBbo', '.ooBBBBBBBBBboo.', '...oooooooooo..o', '....o..oo..o..oF', '....o..oo..o..o.', '..oooooooooooo..', '..oHyHHyHHyHHo..', '...ohhhhhhhho...', '....oooooooo....'],
    pal: { B: '#a87fd6', b: '#7a58a8', w: '#e6d6ff', H: '#8a6a44', h: '#6e5236', y: '#ffd166', F: '#8c5e30' },
  },
  canvas: { // 帆布：巻いた布。端の巻き目が見える
    rows: ['', '', '', '', '..oooooooooooo..', '.oCCCCCCCCCCCoRo', '.oCcCCCCcCCCCoRo', '.oCCCCcCCCCcCoRo', '.oCCcCCCCcCCCoro', '.oCCCCCCCCCCCoRo', '..oooooooooooo..', '', ''],
    pal: { C: '#efe6cf', c: '#d9cfb3', R: '#ddd2b4', r: '#b8ac8a' },
  },
};
