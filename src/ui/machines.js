import { ART2 } from './art2.js';

// 機械の絵（試し描き2回目）。1マス＝20ドット、1ドット＝2px で描く（ベルトの上の素材と同じ粗さ）。
// 真上から見た形で、何をする機械かが分かるモチーフを1つ真ん中に置く。顔はつけない。
// 向きは絵では回さない（正面の辺は盤面の描画で線と矢印を重ねる）。
// active：動いているか（竜炉の火、魔力炉の結晶、霜の柱の冷気は、止まっていると暗くなる）

export { OUT, shade, base } from './pixel.js';
import { OUT, shade, base, pen } from './pixel.js';
export const DOTS = 20; // 1マスのドット数

// 歯車：歯を外に並べ、左上に光、真ん中に軸穴
export function gear(d, cx, cy, rad, teeth, color) {
  const pts = [];
  for (let k = 0; k < teeth; k++) {
    const a = (k / teeth) * Math.PI * 2 + 0.2;
    pts.push([Math.round(cx + Math.cos(a) * (rad + 1.3)), Math.round(cy + Math.sin(a) * (rad + 1.3))]);
  }
  for (const [x, y] of pts) d.r(x - 2, y - 2, 4, 4, OUT); // 歯は同じ大きさの四角
  d.disc(cx, cy, rad + 0.8, OUT);
  for (const [x, y] of pts) d.r(x - 1, y - 1, 2, 2, color);
  d.disc(cx, cy, rad, color);
  for (let a = 3.5; a <= 5.1; a += 0.1) { // 左上の光
    d.px(Math.round(cx + Math.cos(a) * (rad - 1.6) - 0.5), Math.round(cy + Math.sin(a) * (rad - 1.6) - 0.5), shade(color, 0.45));
  }
  d.disc(cx, cy, rad * 0.62, shade(color, -0.1)); // 内側の段
  d.disc(cx, cy, rad * 0.4, shade(color, -0.38));
  d.disc(cx, cy, rad * 0.2 + 0.6, OUT);
}

// 魔力炉の結晶（ひし形）。燃えているときだけ描く
function drawCrystal(d, cx, cy) {
  d.disc(cx, cy, 9, '#4a3a8c');
  const rows = [1, 3, 5, 7, 9, 9, 7, 5, 3, 1];
  rows.forEach((wdt, i) => {
    const y = cy - 7 + i, x = Math.round(cx - wdt / 2 - 0.5);
    d.r(x - 1, y, wdt + 2, 1, OUT);
  });
  rows.forEach((wdt, i) => {
    if (wdt < 3) return;
    const y = cy - 7 + i, x = Math.round(cx - wdt / 2 + 0.5);
    d.r(x, y, wdt - 2, 1, '#b9a0ff');
    if (i < 5) d.r(x, y, Math.max(1, Math.floor((wdt - 2) / 2)), 1, '#efe8ff');
  });
}

// ---- 機械ごとの絵 ----
const ART = {
  // 製材機：板張りの台に、丸のこの刃
  saw(d, gw, gh) {
    base(d, gw, gh, '#a5753f', { wood: true });
    const cx = gw / 2, cy = gh / 2;
    d.r(4, cy - 1, gw - 8, 2, '#3b2a1a'); // 刃の通る溝
    for (let k = 0; k < 18; k++) { // 刃のギザギザ
      const a = (k / 18) * Math.PI * 2;
      d.disc(cx + Math.cos(a) * 12, cy + Math.sin(a) * 12, 1.6, OUT);
    }
    d.disc(cx, cy, 11.6, OUT);
    d.disc(cx, cy, 10.8, '#c9d1d9');
    d.disc(cx - 1, cy - 1, 9, '#eef2f5');
    d.disc(cx, cy, 9, '#b4bec9');
    for (let k = 0; k < 6; k++) { // 刃の模様（放射）
      const a = (k / 6) * Math.PI * 2 + 0.4;
      d.line(cx + Math.cos(a) * 4, cy + Math.sin(a) * 4, cx + Math.cos(a) * 8, cy + Math.sin(a) * 8, '#97a3b0');
    }
    d.disc(cx, cy, 3.2, '#5d6875');
    d.disc(cx, cy, 1.4, OUT);
    for (const [x, y] of [[7, 30], [9, 32], [31, 8], [33, 10], [29, 33]]) d.px(x, y, '#e8cf9c'); // おがくず
  },

  // 竜炉：竜の鱗の炉。真ん中の火口に炎。四隅に爪（顔はつけない）
  furnace(d, gw, gh, active) {
    const cx = gw / 2, cy = gh / 2 + 1;
    d.r(1, 1, gw - 2, gh - 2, OUT);
    d.r(2, 2, gw - 4, gh - 4, '#7d2618');
    for (let y = 3; y < gh - 3; y += 4) { // 鱗
      for (let x = 3 + ((y / 4) % 2) * 2; x < gw - 4; x += 4) {
        d.px(x, y, '#a83a24'); d.px(x + 1, y + 1, '#c2452d'); d.px(x + 2, y + 1, '#c2452d'); d.px(x + 3, y, '#a83a24');
        d.px(x + 1, y + 2, '#5e1a10'); d.px(x + 2, y + 2, '#5e1a10');
      }
    }
    d.r(2, 2, gw - 4, 1, '#d2643f');
    d.r(2, gh - 3, gw - 4, 1, '#4a140b');
    for (const [x, y, sx, sy] of [[3, 3, 1, 1], [gw - 4, 3, -1, 1], [3, gh - 4, 1, -1], [gw - 4, gh - 4, -1, -1]]) { // 爪
      d.px(x, y, '#efe3c6'); d.px(x + sx, y, '#efe3c6'); d.px(x, y + sy, '#efe3c6'); d.px(x + sx * 2, y + sy, '#b8a988'); d.px(x + sx, y + sy * 2, '#b8a988');
    }
    d.disc(cx, cy, 12.6, OUT);
    d.disc(cx, cy, 11.6, '#3a3330'); // 石の縁
    d.disc(cx, cy, 10.2, OUT);
    d.disc(cx, cy, 9.4, active ? '#3a1208' : '#1e1210');
    if (active) {
      d.disc(cx, cy + 2, 7.5, '#d2400f');
      for (const [fx, h] of [[cx - 5, 9], [cx - 1, 12], [cx + 3, 10], [cx + 6, 7]]) { // 炎の舌
        for (let i = 0; i < h; i++) d.r(Math.round(fx - (h - i) / 5), Math.round(cy + 6 - i), Math.max(1, Math.round(((h - i) / h) * 4)), 1, '#ff7a1a');
      }
      d.disc(cx, cy + 3, 5.2, '#ffb347');
      d.disc(cx, cy + 4, 3, '#ffe08a');
      d.disc(cx, cy + 4.5, 1.4, '#fff6d8');
    } else {
      for (const [x, y] of [[cx - 4, cy + 4], [cx + 1, cy + 5], [cx + 4, cy + 3], [cx - 1, cy + 2]]) d.r(x, y, 2, 1, '#8a2a0e'); // 消えかけの燠
    }
    for (let x = Math.round(cx - 8); x <= cx + 7; x += 3) d.r(x, cy + 7, 1, 2, '#2b2118'); // 火格子
  },

  // 魔力炉：紋様の円と、真ん中の魔力の結晶。燃えていると光る
  manaFurnace(d, gw, gh, active) {
    base(d, gw, gh, '#4b3a8a', { rivets: true });
    const cx = gw / 2, cy = gh / 2;
    d.r(7, 4, gw - 14, gh - 8, '#2e2357'); // 八角の台
    d.r(4, 7, gw - 8, gh - 14, '#2e2357');
    d.r(7, 4, gw - 14, 1, '#5a479e');
    d.disc(cx, cy, 13.5, active ? '#9b7cf0' : '#5e4f8f'); // 紋様の円
    d.disc(cx, cy, 12.5, '#2e2357');
    for (let k = 0; k < 8; k++) { // 紋様の印
      const a = (k / 8) * Math.PI * 2;
      const x = cx + Math.cos(a) * 13, y = cy + Math.sin(a) * 13;
      d.r(Math.round(x) - 1, Math.round(y) - 1, 2, 2, active ? '#cbb8ff' : '#6e60a0');
    }
    if (!active) { // 止まっているときは結晶がなく、空の台座だけ
      d.disc(cx, cy, 5.5, OUT);
      d.disc(cx, cy, 4.5, '#1e1838');
      d.px(cx - 2, cy - 2, '#3a2f66');
    } else drawCrystal(d, cx, cy);
    d.r(8, gh - 9, 4, 3, OUT); d.r(gw - 12, gh - 9, 4, 3, OUT); // 燃料の差し口
    d.r(9, gh - 8, 2, 1, '#8a6cf0'); d.r(gw - 11, gh - 8, 2, 1, '#8a6cf0');
  },

  // 旋盤：台の上の回る軸（左の爪つきの掴み、右へ伸びる棒にねじ山）と、刃物台
  lathe(d, gw, gh) {
    base(d, gw, gh, '#8b97a6');
    d.r(3, 12, gw - 6, 3, '#4f565e'); // 台のレール
    d.r(3, 12, gw - 6, 1, '#6d757e');
    d.r(8, 8, 9, 3, OUT); // 棒
    d.r(8, 9, 9, 1, '#e3e8ee');
    for (let x = 9; x < 17; x += 2) d.px(x, 9, '#97a3b0'); // ねじ山
    d.disc(6, 9.5, 4.2, OUT); // 掴み
    d.disc(6, 9.5, 3.2, '#4a5058');
    d.px(6, 7, '#c9d1d9'); d.px(4, 10, '#c9d1d9'); d.px(8, 11, '#c9d1d9');
    d.r(12, 13, 3, 3, OUT); // 刃物台（真鍮）
    d.r(13, 13, 1, 2, '#e0b440');
  },

  // 霜の柱：凍った柱を真上から。氷の六角と雪の結晶
  frostPillar(d, gw, gh, active) {
    const ice = active ? '#7ec3ec' : '#8a9aa6', pale = active ? '#c8ecff' : '#b5c0c8', star = active ? '#ffffff' : '#d8dde1';
    base(d, gw, gh, active ? '#2f6f9e' : '#4d5d6a');
    const cx = gw / 2, cy = gh / 2;
    d.disc(cx, cy, 7.4, OUT);
    d.disc(cx, cy, 6.5, ice);
    d.disc(cx - 1, cy - 1, 4, pale);
    d.disc(cx, cy, 4, ice);
    d.line(cx - 5, cy, cx + 4, cy, star); // 雪の結晶（3本の線）
    d.line(cx - 3, cy - 4, cx + 2, cy + 3, star);
    d.line(cx + 2, cy - 4, cx - 3, cy + 3, star);
    if (active) for (const [x, y] of [[3, 4], [16, 5], [4, 15], [15, 16]]) d.px(x, y, '#e6f6ff'); // 霜のきらめき
  },

  // からくり台：真鍮の歯車を組んでいる作業台。ねじ回しと部品
  workbench(d, gw, gh) {
    base(d, gw, gh, '#8a6a2a', { wood: true });
    gear(d, 19, 27, 11, 11, '#e0b440'); // 歯が少し噛み合う間隔で並べる
    gear(d, 40, 40, 7, 9, '#c8973a');
    gear(d, 41, 17, 5, 7, '#d8b060');
    d.line(8, 52, 17, 43, OUT); // ねじ回し
    d.line(9, 52, 18, 43, OUT);
    d.line(13, 47, 17, 43, '#c9d1d9');
    d.r(7, 50, 4, 4, OUT); d.r(8, 51, 2, 2, '#c0392b');
    for (const [x, y] of [[50, 50], [53, 47], [48, 54], [30, 50]]) { d.r(x, y, 2, 2, OUT); d.px(x, y, '#c9d1d9'); } // ねじ
  },

  // 粉砕機：鉄の枠に、歯のついた2本のローラー。間に砕けた粉
  crusher(d, gw, gh) {
    base(d, gw, gh, '#7f848a', { rivets: true });
    d.r(6, 6, gw - 12, gh - 12, OUT); // 投入口
    d.r(7, 7, gw - 14, gh - 14, '#3a3d42');
    for (const x0 of [8, 21]) { // ローラー2本
      d.r(x0, 8, 11, gh - 16, '#5d636b');
      d.r(x0, 8, 2, gh - 16, '#9aa1aa');
      d.r(x0 + 9, 8, 2, gh - 16, '#454a51');
      for (let y = 9; y < gh - 8; y += 3) d.r(x0 + 1, y, 9, 1, '#2f3237'); // 歯
    }
    d.r(19, 8, 2, gh - 16, '#1f2124'); // 噛み合わせ
    for (const [x, y] of [[19, 12], [20, 18], [19, 25], [20, 29]]) d.px(x, y, '#b9ae9c'); // 粉
  },

  // 鋳型台：板の形のくぼみが2つ。片方に溶けた鉱石、片方に固まった金属板
  caster(d, gw, gh) {
    base(d, gw, gh, '#6d7f94', { rivets: true });
    d.r(15, 3, 10, 4, OUT); d.r(16, 4, 8, 2, '#ff7a1a'); // 注ぎ口
    for (const [y, molten] of [[9, true], [23, false]]) {
      d.r(6, y, gw - 12, 10, OUT);
      d.r(7, y + 1, gw - 14, 8, '#33404f');
      if (molten) {
        d.r(8, y + 2, gw - 16, 6, '#d2400f');
        d.r(8, y + 2, gw - 16, 2, '#ff7a1a');
        d.r(10, y + 3, 6, 1, '#ffe08a');
      } else {
        d.r(8, y + 2, gw - 16, 6, '#c9d1d9');
        d.r(8, y + 2, gw - 16, 1, '#eef2f5');
        d.r(8, y + 7, gw - 16, 1, '#8d98a5');
      }
    }
  },

  // 組立台：板張りの作業台に、組みかけの枠と金槌
  assembler(d, gw, gh) {
    base(d, gw, gh, '#8c5e30', { wood: true });
    d.r(8, 8, 18, 18, OUT); // 枠
    d.r(9, 9, 16, 16, '#b07a3c');
    d.r(13, 13, 8, 8, OUT);
    d.r(14, 14, 6, 6, '#8c5e30');
    d.r(9, 9, 16, 1, '#e0b97a'); d.r(9, 9, 1, 16, '#e0b97a');
    for (const [x, y] of [[10, 10], [23, 10], [10, 23], [23, 23]]) d.px(x, y, '#5d6875'); // 釘
    d.line(26, 32, 33, 25, OUT); d.line(27, 32, 34, 25, OUT); // 金槌の柄
    d.line(27, 31, 33, 25, '#c9935a');
    d.r(31, 21, 6, 4, OUT); d.r(32, 22, 4, 2, '#8d98a5');
  },

  // プレス機：四隅の柱と、黄色と黒の縞の重いおもり
  press(d, gw, gh) {
    base(d, gw, gh, '#5f6670');
    for (const [x, y] of [[7, 7], [gw - 7, 7], [7, gh - 7], [gw - 7, gh - 7]]) { // 柱
      d.disc(x, y, 4, OUT); d.disc(x, y, 3, '#9aa1aa'); d.disc(x - 0.5, y - 0.5, 1.5, '#d5dae0');
    }
    d.r(10, 10, gw - 20, gh - 20, OUT); // おもり
    for (let i = 0; i < gw - 22; i++) for (let j = 0; j < gh - 22; j++) {
      const edge = i < 2 || j < 2 || i >= gw - 24 || j >= gh - 24;
      d.px(11 + i, 11 + j, edge ? ((i + j) % 6 < 3 ? '#e0b440' : '#2b2118') : '#7a828c');
    }
    d.r(15, 15, gw - 30, 2, '#9aa1aa');
    d.disc(gw / 2, gh / 2, 2.5, '#454a51');
  },

  // 調合台：丸い鉢に白い粉の渦と、かき混ぜる棒
  mixer(d, gw, gh) {
    base(d, gw, gh, '#b39a5c', { wood: true });
    const cx = gw / 2, cy = gh / 2 + 1;
    d.disc(cx, cy, 13, OUT);
    d.disc(cx, cy, 12, '#8a7a5a');
    d.disc(cx, cy, 10, '#5e5240');
    d.disc(cx, cy, 9, '#e8efe0');
    for (let a = 0; a < Math.PI * 3.2; a += 0.18) { // 渦
      const rr = 1.5 + a * 0.75;
      d.px(Math.round(cx + Math.cos(a) * rr), Math.round(cy + Math.sin(a) * rr), '#b9b2a0');
    }
    d.line(cx + 2, cy - 2, cx + 13, cy - 13, OUT); d.line(cx + 3, cy - 2, cx + 14, cy - 13, OUT); // 棒
    d.line(cx + 3, cy - 3, cx + 13, cy - 13, '#c9935a');
    for (const [x, y] of [[6, 33], [9, 35], [33, 32]]) d.px(x, y, '#d9c48c'); // 砂粒
  },

  // 研磨機：回る砥石と、磨いているレンズ
  polisher(d, gw, gh) {
    base(d, gw, gh, '#4a7fc0', { rivets: true });
    d.disc(15, 20, 11, OUT); // 砥石
    d.disc(15, 20, 10, '#9a9488');
    d.disc(15, 20, 7, '#b8b2a5');
    d.disc(15, 20, 6, '#9a9488');
    for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2; d.px(Math.round(15 + Math.cos(a) * 8.5), Math.round(20 + Math.sin(a) * 8.5), '#7a7468'); }
    d.disc(15, 20, 2.2, OUT);
    d.disc(29, 22, 6, OUT); // レンズ
    d.disc(29, 22, 5, '#4aa8e8');
    d.disc(28, 21, 2.5, '#a8e6f0');
    d.px(27, 20, '#ffffff');
    for (const [x, y] of [[24, 13], [26, 11], [23, 30], [34, 14]]) d.px(x, y, '#ffe08a'); // 火花
  },

  // 蒸留器（1×1）：丸いフラスコに燃料の紫の液、曲がった管
  still(d, gw, gh) {
    base(d, gw, gh, '#3f9fb0');
    d.disc(8, 11, 5.4, OUT);
    d.disc(8, 11, 4.4, '#d8f4f8');
    d.disc(8, 12.5, 3.3, '#9b6cf0'); // 底にたまった燃料
    d.px(6, 9, '#ffffff');
    d.r(7, 3, 3, 4, OUT); d.r(8, 4, 1, 3, '#d8f4f8'); // 首
    d.line(10, 4, 15, 9, OUT); d.line(10, 5, 15, 10, '#d8f4f8'); // 管
    d.r(14, 11, 3, 4, OUT); d.r(15, 12, 1, 2, '#9b6cf0'); // 受け
  },

  // 巻き機：鋼の帯を巻いたぜんまいと、回すハンドル
  winder(d, gw, gh) {
    base(d, gw, gh, '#566a80', { rivets: true });
    const cx = gw / 2 - 2, cy = gh / 2;
    d.disc(cx, cy, 13, OUT);
    d.disc(cx, cy, 12, '#3b4a5a');
    for (let a = 0; a < Math.PI * 7; a += 0.06) { // 渦巻きの帯
      const rr = 2 + a * 0.45;
      if (rr > 11) break;
      d.px(Math.round(cx + Math.cos(a) * rr), Math.round(cy + Math.sin(a) * rr), '#a7b4c2');
    }
    d.disc(cx, cy, 2, '#d5dae0');
    d.r(cx + 12, cy - 1, 8, 3, OUT); d.r(cx + 12, cy, 7, 1, '#9aa1aa'); // ハンドル
    d.r(cx + 18, cy - 4, 3, 9, OUT); d.r(cx + 19, cy - 3, 1, 7, '#c0392b');
  },
};

Object.assign(ART, ART2); // 第2部の機械（art2.js）

export const hasArt = (id) => !!ART[id];

// 試し描きのページから、まだ本番に入れていない絵を足す（ゲームでは使わない）
export function addArt(more) { Object.assign(ART, more); }

// 機械の絵を描く。x, y, w, h は px（1マス＝40px、1ドット＝2px。大きく見せるときは ctx を拡大する）
export function drawMachineArt(ctx, id, x, y, w, h, active = true) {
  const s = 40 / DOTS;
  ART[id](pen(ctx, x, y, s), Math.round(w / s), Math.round(h / s), active);
}
