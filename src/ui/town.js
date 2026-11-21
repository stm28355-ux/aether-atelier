// 町の地図の絵。1ドット＝4px、190×170ドット（760×680px）。
// 第1部：区画は開く順に、上の通りに区0〜3、下の通りに区4〜7（左から）。
// 第2部：港の通り（区8〜10）と市場の通り（区11〜13）、海の向こうの島に区14・15。
// 屋根の色で系統を分ける（機工＝茶と歯車の看板、炉と霜＝赤と煙突、エーテル＝青としずく、育てる＝緑と葉、総まとめ＝紫と浮き袋）。
// 開いた区画は窓に灯り、まだの区画は霧。大目標で絵が変わる：時計塔の針、街灯と灯台、島への浮き橋、温室、空の飛空艇。
export const TOWN_W = 760, TOWN_H = 680;
const S = 4, GW = 190, GH = 170;
const OUT = '#2b2118';

// 区画の建物の位置（左上のドット）。幅30・高さ24（名前まで）
export const SPOTS = {
  d0: [8, 22], d1: [50, 22], d2: [110, 22], d3: [152, 22],
  d4: [8, 58], d5: [50, 58], d6: [110, 58], d7: [148, 58],
  d8: [8, 106], d9: [50, 106], d10: [104, 106],
  d11: [8, 140], d12: [50, 140], d13: [104, 140],
  d14: [152, 106], d15: [152, 140],
};
const ROOF = { 機工: '#8c5e30', 炉と霜: '#9a3e2c', エーテル: '#3f7f95', 育てる: '#4f8a4a', 総まとめ: '#6b4f9a' };
// 海岸の線（このドットより右が海）。第1部の港の斜めの岸から、第2部の通りの右でまっすぐになる
const coast = (y) => (y < 100 ? 132 - Math.round((y - 76) * 0.6) : Math.min(138, 118 + (y - 100) * 3));
const BW = 30, BH = 26;

// px（地図の上の位置）から区画を探す
export function townHit(px, py) {
  const x = px / S, y = py / S;
  for (const [id, [bx, by]] of Object.entries(SPOTS)) {
    if (x >= bx - 1 && x < bx + BW + 1 && y >= by - 4 && y < by + BH) return id;
  }
  return null;
}

// st：districts（[{id, name, sys}]）, open（開いた区画）, done（依頼を全部達成）, clock（時計塔が動いている）,
//     clockStopped（達成したが今は止まっている）, lights（灯りがついている）, bridge（浮き橋）, greenhouse（温室と市場）,
//     airship（飛空艇）, hover（マウスの下の区画）, t（針を動かす刻み）
export function drawTown(ctx, st) {
  const r = (x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(x * S, y * S, w * S, h * S); };
  const disc = (cx, cy, rad, c) => { for (let y = -rad; y <= rad; y++) { const hw = Math.round(Math.sqrt(rad * rad - y * y)); r(cx - hw, cy + y, hw * 2 + 1, 1, c); } };
  r(0, 0, GW, GH, '#e3dccd');
  // 海と港（右下）と、海の向こうの島（区14・15）
  for (let y = 76; y < GH; y++) { r(coast(y), y, GW, 1, '#8fb3c2'); r(coast(y) - 1, y, 1, 1, '#cdbf9f'); }
  for (const [x, y] of [[146, 84], [164, 90], [152, 96], [178, 82], [136, 98], [141, 120], [141, 156]]) r(x, y, 4, 1, '#c3dbe4');
  r(147, 101, 42, 67, '#cdbf9f'); r(148, 102, 40, 65, '#d9d0bb');
  // 通り（第1部の2本と、港・市場の通り。真ん中の縦の通りを下までのばす）
  r(4, 48, 182, 7, '#cbbfa8'); r(92, 6, 7, 130, '#cbbfa8'); r(4, 132, 132, 7, '#cbbfa8'); r(150, 132, 36, 7, '#c6baa2');
  for (let x = 6; x < 186; x += 4) { r(x, 48, 2, 1, '#b9ac93'); r(x + 2, 54, 2, 1, '#b9ac93'); }
  for (let x = 6; x < 134; x += 4) { r(x, 132, 2, 1, '#b9ac93'); r(x + 2, 138, 2, 1, '#b9ac93'); }
  if (st.bridge) { // 大目標「浮き橋がかかる」：岸から島へ、浮き板の橋
    for (let x = 136; x < 150; x += 2) { r(x, 133, 2, 5, OUT); r(x, 134, 1, 3, '#b98a52'); }
    r(136, 132, 14, 1, '#7d6a5a'); r(136, 138, 14, 1, '#7d6a5a');
  }
  if (st.greenhouse) { // 大目標「温室と市場」：ガラスの温室と、帆布の天幕
    disc(86, 160, 5, OUT); disc(86, 160, 4, '#cfe9e4'); r(81, 160, 11, 6, OUT); r(82, 160, 9, 5, '#cfe9e4');
    for (const [x, y] of [[84, 158], [88, 161], [85, 163], [87, 157]]) r(x, y, 1, 1, '#4fbf9a');
    for (const [x, c] of [[40, '#d9a514'], [44, '#c0392b'], [82, '#3f7f95']]) { r(x, 129, 4, 2, c); r(x, 131, 1, 1, OUT); r(x + 3, 131, 1, 1, OUT); }
  }
  // 時計塔（真ん中の上）
  const lit = st.clock;
  r(86, 8, 19, 32, OUT); r(87, 9, 17, 30, lit ? '#c9b48e' : '#a99c86');
  r(84, 4, 23, 5, OUT); r(85, 5, 21, 3, '#5f6670');
  disc(95, 19, 6, OUT); disc(95, 19, 5, lit ? '#fff6dc' : '#cfc7b8');
  if (lit) { // 針が動く
    const a = ((st.t || 0) / 40) % (Math.PI * 2), b = a / 12;
    ctx.strokeStyle = OUT; ctx.lineWidth = 3; ctx.lineCap = 'round';
    const c = [95.5 * S, 19.5 * S];
    ctx.beginPath(); ctx.moveTo(...c); ctx.lineTo(c[0] + Math.sin(a) * 16, c[1] - Math.cos(a) * 16); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(...c); ctx.lineTo(c[0] + Math.sin(b) * 10, c[1] - Math.cos(b) * 10); ctx.stroke();
    r(94, 12, 3, 1, '#e0b440');
  } else { r(95, 19, 1, 5, '#5b5148'); r(93, 20, 2, 1, '#5b5148'); }
  r(93, 32, 5, 7, '#4a4036');
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = '600 11px system-ui, sans-serif';
  ctx.fillStyle = st.clock ? '#3a3128' : '#7a6d5e';
  ctx.fillText(st.clock ? '時計塔（動いている）' : st.clockStopped ? '時計塔（止まっている）' : '時計塔', 95.5 * S, 43 * S);
  // 区画の建物
  for (const d of st.districts) {
    const spot = SPOTS[d.id];
    if (!spot) continue;
    const [x, y] = spot;
    const open = st.open.includes(d.id), done = st.done.includes(d.id), sys = d.sys;
    const roof = open ? ROOF[sys] || '#9a3e2c' : '#9e978c', wall = open ? '#efe4cf' : '#c9c3b8';
    if (st.hover === d.id && open) { ctx.fillStyle = 'rgba(181,84,28,0.18)'; ctx.fillRect((x - 2) * S, (y - 4) * S, (BW + 4) * S, (BH + 3) * S); }
    r(x, y + 2, BW, 18, OUT);
    r(x + 1, y + 9, BW - 2, 10, wall);
    for (let i = 0; i < 7; i++) r(x + 1 + i, y + 8 - i, BW - 2 - i * 2, 1, roof); // 屋根
    r(x + 1, y + 8, BW - 2, 1, OUT);
    if (sys === '炉と霜') { // 煙突と煙
      r(x + 21, y - 2, 4, 6, OUT); r(x + 22, y - 1, 2, 5, open ? '#7d6a5a' : '#9e978c');
      if (open) { disc(x + 24, y - 5, 2, '#d8d2c6'); disc(x + 27, y - 8, 1, '#e4dfd6'); }
    } else if (sys === 'エーテル') { // しずくの看板
      r(x + 15, y + 1, 1, 1, OUT); r(x + 14, y + 2, 3, 1, OUT); disc(x + 15, y + 4, 2, OUT); disc(x + 15, y + 4, 1, open ? '#8fd3e8' : '#b8b0a2');
    } else if (sys === '育てる') { // 葉の看板
      r(x + 13, y + 4, 5, 2, OUT); r(x + 14, y + 3, 3, 4, OUT); r(x + 14, y + 4, 3, 2, open ? '#7ccf6a' : '#b8b0a2');
    } else if (sys === '総まとめ') { // 浮き袋の看板
      disc(x + 15, y + 3, 3, OUT); disc(x + 15, y + 3, 2, open ? '#c7a6e8' : '#b8b0a2'); r(x + 14, y + 6, 3, 1, OUT);
    } else { disc(x + 15, y + 4, 2, open ? '#e0b440' : '#b8b0a2'); r(x + 15, y + 4, 1, 1, OUT); } // 歯車の看板
    for (const wx of [x + 4, x + 11, x + 22]) { r(wx, y + 11, 4, 4, OUT); r(wx + 1, y + 12, 2, 2, open ? '#ffd166' : '#6b6257'); }
    r(x + 16, y + 13, 4, 6, '#4a4036');
    if (done) { r(x + 27, y - 4, 1, 7, OUT); r(x + 28, y - 4, 4, 3, '#3f8a4d'); } // 達成の旗
    if (!open) { ctx.fillStyle = 'rgba(240,238,232,0.62)'; ctx.fillRect((x - 2) * S, (y - 4) * S, (BW + 4) * S, (BH + 2) * S); }
    ctx.fillStyle = open ? '#3a3128' : '#9a8f80';
    ctx.font = `600 ${open ? 12 : 11}px system-ui, sans-serif`;
    ctx.fillText(open ? d.name : `${d.name.split(' ')[0]}（まだ）`, (x + BW / 2) * S, (y + 23) * S);
  }
  // 灯台（右下の岬）
  r(180, 62, 8, 22, OUT);
  for (let i = 0; i < 20; i++) r(181, 63 + i, 6, 1, Math.floor(i / 4) % 2 ? '#c0392b' : '#f4efe6');
  r(179, 58, 10, 5, OUT); r(180, 59, 8, 3, st.lights ? '#ffe08a' : '#6b6257');
  if (st.lights) { ctx.fillStyle = 'rgba(255,224,138,0.35)'; ctx.beginPath(); ctx.moveTo(180 * S, 60 * S); ctx.lineTo(134 * S, 90 * S); ctx.lineTo(156 * S, 100 * S); ctx.fill(); }
  // 街灯（建物の間に、通りの両側）
  for (const x of [2, 44, 145, 186]) {
    for (const [py, hy] of [[43, 41], [57, 55]]) {
      if (x === 186 && hy === 55) continue; // 灯台の前
      r(x, py, 1, 5, '#4a4036'); r(x - 1, hy, 3, 2, st.lights ? '#ffd166' : '#7a6d5e');
      if (st.lights) { ctx.fillStyle = 'rgba(255,209,102,0.25)'; ctx.beginPath(); ctx.arc((x + 0.5) * S, (hy + 1) * S, 14, 0, 7); ctx.fill(); }
    }
  }
  if (st.airship) { // 大目標「飛空艇が飛ぶ」：空をゆっくり渡る飛空艇
    const ax = 112 + Math.round(Math.sin((st.t || 0) / 300) * 8), ay = 3;
    for (let i = 0; i < 6; i++) { const hw = [6, 9, 10, 10, 9, 6][i]; r(ax + 12 - hw, ay + i, hw * 2, 1, OUT); }
    for (let i = 1; i < 5; i++) { const hw = [0, 8, 9, 8, 0][i]; r(ax + 12 - hw, ay + i, hw * 2, 1, i === 1 ? '#d9c2f0' : '#a87fd6'); }
    r(ax + 11, ay + 6, 1, 2, OUT); r(ax + 6, ay + 6, 1, 2, OUT); r(ax + 17, ay + 6, 1, 2, OUT);
    r(ax + 5, ay + 8, 14, 3, OUT); r(ax + 6, ay + 8, 12, 2, '#8c5e30'); r(ax + 9, ay + 8, 1, 1, '#ffd166'); r(ax + 14, ay + 8, 1, 1, '#ffd166');
  }
  if (!st.lights) { ctx.fillStyle = 'rgba(232,229,222,0.28)'; ctx.fillRect(0, 0, GW * S, GH * S); } // 灯りのない町の霧
}
