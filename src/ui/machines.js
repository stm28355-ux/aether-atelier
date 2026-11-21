// 機械の絵（試し描き2回目）。1マス＝20ドット、1ドット＝2px で描く（ベルトの上の素材と同じ粗さ）。
// 真上から見た形で、何をする機械かが分かるモチーフを1つ真ん中に置く。顔はつけない。
// 向きは絵では回さない（正面の辺は盤面の描画で線と矢印を重ねる）。
// active：動いているか（竜炉の火、魔力炉の結晶、霜の柱の冷気は、止まっていると暗くなる）

const OUT = '#2b2118';
export const DOTS = 20; // 1マスのドット数

// 色を明るく（k>0）・暗く（k<0）する
function shade(hex, k) {
  const n = parseInt(hex.slice(1), 16);
  const t = k > 0 ? 255 : 0, a = Math.abs(k);
  const f = (v) => Math.round(v + (t - v) * a);
  return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
}

// ドットで描く道具
function pen(ctx, ox, oy, s) {
  const r = (x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(ox + x * s, oy + y * s, w * s, h * s); };
  // 塗った円（中心は .5 でもよい）
  const disc = (cx, cy, rad, c) => {
    for (let y = Math.floor(cy - rad); y <= Math.ceil(cy + rad); y++) {
      const dy = y + 0.5 - cy, q = rad * rad - dy * dy;
      if (q < 0) continue;
      const dx = Math.sqrt(q), x0 = Math.round(cx - dx), x1 = Math.round(cx + dx);
      if (x1 > x0) r(x0, y, x1 - x0, 1, c);
    }
  };
  const line = (x0, y0, x1, y1, c) => {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
    for (let i = 0; i <= n; i++) r(Math.round(x0 + ((x1 - x0) * i) / (n || 1)), Math.round(y0 + ((y1 - y0) * i) / (n || 1)), 1, 1, c);
  };
  return { r, disc, line, px: (x, y, c) => r(x, y, 1, 1, c) };
}

// 台：縁取り、上と左は明るく、下と右は暗く。wood は板の継ぎ目、rivets は四隅の鋲
function base(d, gw, gh, body, { wood = false, rivets = false } = {}) {
  d.r(1, 1, gw - 2, gh - 2, OUT);
  d.r(2, 2, gw - 4, gh - 4, body);
  if (wood) {
    for (let y = 7; y < gh - 3; y += 6) d.r(3, y, gw - 6, 1, shade(body, -0.22));
    for (let y = 4; y < gh - 3; y += 6) for (let x = 6 + (y % 12 ? 0 : 7); x < gw - 4; x += 14) d.px(x, y, shade(body, 0.18));
  }
  d.r(2, 2, gw - 4, 1, shade(body, 0.35));
  d.r(2, 3, 1, gh - 5, shade(body, 0.18));
  d.r(2, gh - 3, gw - 4, 1, shade(body, -0.35));
  d.r(gw - 3, 3, 1, gh - 5, shade(body, -0.2));
  if (rivets) {
    for (const [x, y] of [[4, 4], [gw - 6, 4], [4, gh - 6], [gw - 6, gh - 6]]) {
      d.r(x, y, 2, 2, shade(body, -0.45));
      d.px(x, y, shade(body, 0.45));
    }
  }
}

// 歯車：歯を外に並べ、左上に光、真ん中に軸穴
function gear(d, cx, cy, rad, teeth, color) {
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
    if (active) d.disc(cx, cy, 9, '#4a3a8c');
    // 結晶（ひし形）
    const rows = [1, 3, 5, 7, 9, 9, 7, 5, 3, 1];
    rows.forEach((wdt, i) => {
      const y = cy - 7 + i, x = Math.round(cx - wdt / 2 - 0.5);
      d.r(x - 1, y, wdt + 2, 1, OUT);
    });
    rows.forEach((wdt, i) => {
      if (wdt < 3) return;
      const y = cy - 7 + i, x = Math.round(cx - wdt / 2 + 0.5);
      d.r(x, y, wdt - 2, 1, active ? '#b9a0ff' : '#7a6aa8');
      if (i < 5) d.r(x, y, Math.max(1, Math.floor((wdt - 2) / 2)), 1, active ? '#efe8ff' : '#9a8cc0');
    });
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
};

export const hasArt = (id) => !!ART[id];

// 機械の絵を描く。x, y, w, h は px（1マス＝40px、1ドット＝2px。大きく見せるときは ctx を拡大する）
export function drawMachineArt(ctx, id, x, y, w, h, active = true) {
  const s = 40 / DOTS;
  ART[id](pen(ctx, x, y, s), Math.round(w / s), Math.round(h / s), active);
}
