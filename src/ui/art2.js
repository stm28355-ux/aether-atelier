// 第2部の絵（試し描き。フェーズ14）。palette3.html だけが読み込む。人が OK を出したら machines.js と sprites.js に移す。
// 第1部と同じ決まり：1マス＝20ドット、真上から見た形、モチーフを1つ真ん中に、顔はつけない。
// active：動いているか（止まると光や液が暗くなる）
import { OUT, shade, base } from './machines.js';

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
  canvas: { // 帆布：巻いた布。端の巻き目が見える
    rows: ['', '', '', '', '..oooooooooooo..', '.oCCCCCCCCCCCoRo', '.oCcCCCCcCCCCoRo', '.oCCCCcCCCCcCoRo', '.oCCcCCCCcCCCoro', '.oCCCCCCCCCCCoRo', '..oooooooooooo..', '', ''],
    pal: { C: '#efe6cf', c: '#d9cfb3', R: '#ddd2b4', r: '#b8ac8a' },
  },
};
