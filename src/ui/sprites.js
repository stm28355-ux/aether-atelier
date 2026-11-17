// 素材と機械の絵（色の試し描き1回目）。ゲームの描画からも使えるように、canvas に描く関数だけを置く。
// 素材は 16×16 のドットの格子に描き、size に合わせて拡大する（くっきり見せるため整数倍で描く）。

// 素材の色。範囲で変わる物は、変わる前と後が同じ系統の色に見えるように選ぶ。
export const ITEM_COLORS = {
  wood: '#8a5a2b', ore: '#6b7a91', sand: '#d9c48c', aether: '#5fd0e0',
  plank: '#e0b97a', molten: '#ff7a1a', plate: '#c9d1d9', dust: '#8c8273',
  frame: '#b07a3c', gear: '#c8973a', screw: '#a7b4c2',
  glassmix: '#e8efe0', glass: '#a8e6f0', lens: '#4aa8e8', fuel: '#9b6cf0',
  gearbox: '#b8862f', redplate: '#e8452c', steel: '#45607e', crystal: '#7e5cf0',
  spring: '#7d93ad', clockwork: '#e0b440', lantern: '#f2c94c',
};

const OUT = '#2b2118';

// 16×16 の格子に描くための小さな道具
function pen(ctx, x0, y0, s) {
  const px = (x, y, w = 1, h = 1, c) => { ctx.fillStyle = c; ctx.fillRect(x0 + x * s, y0 + y * s, w * s, h * s); };
  return px;
}

// 文字の並びで描く：. は透明、ほかは pal の色
function grid(px, rows, pal) {
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const c = pal[row[x]];
      if (c) px(x, y, 1, 1, c);
    }
  });
}

// 素材を描く。cx, cy は中心、size は見た目の大きさ（px）
export function drawItem(ctx, id, cx, cy, size = 18) {
  const s = Math.max(1, Math.round(size / 16));
  const x0 = Math.round(cx - 8 * s), y0 = Math.round(cy - 8 * s);
  const px = pen(ctx, x0, y0, s);
  const c = ITEM_COLORS[id];
  switch (id) {
    case 'wood': // 丸太
      grid(px, ['', '', '', '', '....oooooooooo..', '...oBBBBBBBBBroo', '..oBbBBBBbBBrRRo', '..oBBBBbBBBBrRRo', '..oBBBBBBBBBrRRo', '...oooooooooooo.'], { o: OUT, B: c, b: '#6e4620', r: '#c9935a', R: '#e8b880' });
      break;
    case 'ore': // 岩
      grid(px, ['', '', '', '.....ooooo......', '....oGGGGGoo....', '...oGgGGGGGGo...', '..oGGGGGsGGGGo..', '..oGGsGGGGGgGo..', '.oGGGGGGGGGGGGo.', '.oGgGGGGsGGGGGo.', '.oGGGGGGGGGgGo..', '..oGGGGGGGGGo...', '...ooooooooo....'], { o: OUT, G: c, g: '#4f5c70', s: '#c6d3e6' });
      break;
    case 'sand': // 砂の山
      grid(px, ['', '', '', '', '', '', '.......oo.......', '.....ooSSoo.....', '....oSSsSSSo....', '...oSsSSSSsSo...', '..oSSSSSsSSSSo..', '.oSSsSSSSSSsSSo.', '.oooooooooooooo.'], { o: OUT, S: c, s: '#b39a5c' });
      break;
    case 'aether': // しずく
      grid(px, ['', '', '.......oo.......', '......oAAo......', '.....oAAAAo.....', '....oAAAAAAo....', '...oAAwAAAAAo...', '...oAwwAAAAAo...', '..oAAwAAAAAAAo..', '..oAAAAAAAAAao..', '..oAAAAAAAAaao..', '...oAAAAAAaao...', '....oaaaaaao....', '.....oooooo.....'], { o: OUT, A: c, a: '#3a9fc0', w: '#ffffff' });
      break;
    case 'plank': // 板
      grid(px, ['', '', '', '', '.oooooooooooooo.', '.oPPPPPPPPPPPPo.', '.oPpppPPPPpppPo.', '.oPPPPPPPPPPPPo.', '.oPPPPpppPPPPPo.', '.oPPPPPPPPPPPPo.', '.oooooooooooooo.'], { o: OUT, P: c, p: '#b88d52' });
      break;
    case 'molten': // 溶けた鉱石（光るかたまり）
      grid(px, ['', '', '', '', '......oooo......', '....ooMMMMoo....', '...oMMyyMMMMo...', '..oMMyYyMMMMMo..', '..oMMMyMMMMmMo..', '.oMMMMMMMMmmMMo.', '.oMMMMMMmmmMMMo.', '..ooMMMMMMMMoo..', '....oooooooo....'], { o: '#7a2a05', M: c, m: '#d24e0a', y: '#ffd166', Y: '#fff3c4' });
      break;
    case 'plate': case 'redplate': case 'steel': { // 板金（同じ形で色が変わる）
      const pal = {
        plate: { P: c, l: '#ffffff', d: '#8d98a5' },
        redplate: { P: c, l: '#ffb36b', d: '#a8220f' },
        steel: { P: c, l: '#8fb0d6', d: '#25364a' },
      }[id];
      grid(px, ['', '', '', '..oooooooooooo..', '..olllllllllPo..', '..olPPPPPPPPdo..', '..olPPPPPPPPdo..', '..olPPPPPPPPdo..', '..olPPPPPPPPdo..', '..olPPPPPPPPdo..', '..olPPPPPPPPdo..', '..oPddddddddddo.', '..oooooooooooo..'], { o: OUT, ...pal });
      if (id === 'redplate') grid(px, ['', '', '', '', '', '......y.........', '.....yYy...y....', '......y...yYy...', '...........y....'], { y: '#ffd166', Y: '#fff3c4' });
      if (id === 'steel') grid(px, ['', '', '', '', '', '', '....w...........', '...w............', '..........w.....', '.........w......'], { w: '#c8dcf2' });
      break;
    }
    case 'dust': // 粉
      grid(px, ['', '', '', '', '', '', '', '.......d........', '....d.oo..d.....', '.....oDDDo...d..', '...ooDdDDDoo....', '..oDDDDDdDDDo...', '.oDDdDDDDDDDDo..', '.ooooooooooooo..'], { o: OUT, D: c, d: '#5e5649' });
      break;
    case 'frame': // 枠
      grid(px, ['', '', '.oooooooooooooo.', '.oFFFFFFFFFFFFo.', '.oFffffffffffFo.', '.oFfoooooooofFo.', '.oFfo......ofFo.', '.oFfo......ofFo.', '.oFfo......ofFo.', '.oFfo......ofFo.', '.oFfoooooooofFo.', '.oFffffffffffFo.', '.oFFFFFFFFFFFFo.', '.oooooooooooooo.'], { o: OUT, F: c, f: '#8a5a26' });
      break;
    case 'gear': // 歯車
      grid(px, ['', '......oooo......', '...oo.oGGo.oo...', '..oGGooGGooGGo..', '..oGGGGGGGGGGo..', '...oGGGggGGGo...', '.ooGGGgoogGGGoo.', '.oGGGgo..ogGGGo.', '.oGGGgo..ogGGGo.', '.ooGGGgoogGGGoo.', '...oGGGggGGGo...', '..oGGGGGGGGGGo..', '..oGGooGGooGGo..', '...oo.oGGo.oo...', '......oooo......'], { o: OUT, G: c, g: '#8f6820' });
      break;
    case 'screw': // ねじ
      grid(px, ['', '', '.....oooooo.....', '....oSSSSSSo....', '....oSoSSoSo....', '.....oooooo.....', '......oSso......', '......osSo......', '......oSso......', '......osSo......', '......oSso......', '......osSo......', '.......oo.......'], { o: OUT, S: c, s: '#6c7a8a' });
      break;
    case 'glassmix': // ガラスの素（白い粉に緑の粒）
      grid(px, ['', '', '', '', '', '', '', '.......oo.......', '.....ooWWoo.....', '....oWgWWWWo....', '...oWWWWgWWWo...', '..oWgWWWWWWgWo..', '.oWWWWWgWWWWWWo.', '.oooooooooooooo.'], { o: OUT, W: c, g: '#8fbf7a' });
      break;
    case 'glass': // ガラス板（透き通る）
      grid(px, ['', '', '..oooooooooooo..', '..oGGGGGGGGGGo..', '..oGwGGGGGGGGo..', '..oGGwGGGGGGGo..', '..oGGGwGGGGGGo..', '..oGGGGGGGGGGo..', '..oGGGGGGGwGGo..', '..oGGGGGGGGwGo..', '..oGGGGGGGGGGo..', '..oooooooooooo..'], { o: '#3d7f8c', G: c, w: '#ffffff' });
      break;
    case 'lens': // レンズ
      grid(px, ['', '', '.....oooooo.....', '...ooLLLLLLoo...', '..oLLwwLLLLLLo..', '..oLwwLLLLLLLo..', '.oLLwLLLLLLLLLo.', '.oLLLLLLLLLLLlo.', '.oLLLLLLLLLLLlo.', '.oLLLLLLLLLLllo.', '..oLLLLLLLLllo..', '..oLLLLLLLlllo..', '...ooLLLllloo...', '.....oooooo.....'], { o: OUT, L: c, l: '#2f78b0', w: '#ffffff' });
      break;
    case 'fuel': // 燃料（小瓶）
      grid(px, ['', '......oooo......', '......oKKo......', '.......oo.......', '......oVVo......', '.....oVVVVo.....', '....oVvVVVVo....', '...oVVvVVVVVo...', '...oVVVVVVVVo...', '...oVVVVVVVvo...', '...oVVVVVVvvo...', '....ovvvvvvo....', '.....oooooo.....'], { o: OUT, V: c, v: '#6a40c0', K: '#a07a4a' });
      break;
    case 'gearbox': // 歯車箱（箱に歯車の窓）
      grid(px, ['', '', '.oooooooooooooo.', '.oBBBBBBBBBBBBo.', '.oBbbbbbbbbbbBo.', '.oBbooo..ooobBo.', '.oBbo.GGGG.obBo.', '.oBbo.GooG.obBo.', '.oBbo.GooG.obBo.', '.oBbo.GGGG.obBo.', '.oBbooo..ooobBo.', '.oBbbbbbbbbbbBo.', '.oBBBBBBBBBBBBo.', '.oooooooooooooo.'], { o: OUT, B: c, b: '#7d5a1c', G: '#e8c06a' });
      break;
    case 'crystal': // エーテル結晶
      grid(px, ['', '.......oo.......', '......oCwo......', '.....oCCwCo.....', '....oCCwCCCo....', '....oCwCCCco....', '...oCCwCCCcco...', '...oCCCCCCcco...', '...oCCCCCccco...', '....oCCCCccco...', '....oCCCCcco....', '.....oCCCcco....', '......oCCco.....', '.......ooo......'], { o: '#2e1f6b', C: c, c: '#5a3cc0', w: '#d6ccff' });
      break;
    case 'spring': // ぜんまい
      grid(px, ['', '', '....oooooooo....', '...oSSSSSSSSo...', '..oSSoooooooSo..', '..oSo.......So..', '..oSo.oooo..So..', '..oSo.oSSo..So..', '..oSo.oSo..oSo..', '..oSo.oSoooSSo..', '..oSo..SSSSSo...', '..oSSoo.oooo....', '...oSSSSSSSSSSo.', '....ooooooooooo.'], { o: OUT, S: c });
      break;
    case 'clockwork': // 時計の機構（文字盤）
      grid(px, ['', '.....oooooo.....', '...ooCCCCCCoo...', '..oCCwCCCCwCCo..', '..oCCCCCCCCCCo..', '.oCwCCCCoCCCCwo.', '.oCCCCCCoCCCCCo.', '.oCCCCCCoCCCCCo.', '.oCCCCCCoooooCo.', '.oCwCCCCCCCCCwo.', '..oCCCCCCCCCCo..', '..oCCwCCCCwCCo..', '...ooCCCCCCoo...', '.....oooooo.....'], { o: OUT, C: c, w: '#7a5a10' });
      break;
    case 'lantern': // 魔導ランタン
      grid(px, ['.......oo.......', '......o..o......', '.....oooooo.....', '....oLLLLLLo....', '....oooooooo....', '....oGyyyyGo....', '....oGyYYyGo....', '....oGyYYyGo....', '....oGyyyyGo....', '....oGGGGGGo....', '....oooooooo....', '....oLLLLLLo....', '.....oooooo.....'], { o: OUT, L: c, G: '#a8e6f0', y: '#ffe08a', Y: '#ffffff' });
      break;
    default:
      ctx.fillStyle = c || '#999';
      ctx.beginPath(); ctx.arc(cx, cy, size / 2, 0, 7); ctx.fill();
  }
}

// 機械の色。種類ごとに色の家族を分ける（木＝茶、金属＝灰、火＝赤、霜＝青、魔力＝紫）
export const MACHINE_STYLE = {
  saw: { body: '#a5753f', kind: '木' },
  assembler: { body: '#8c5e30', kind: '木' },
  crusher: { body: '#7f848a', kind: '金属' },
  caster: { body: '#6d7f94', kind: '金属' },
  press: { body: '#5f6670', kind: '金属' },
  lathe: { body: '#8b97a6', kind: '金属' },
  winder: { body: '#566a80', kind: '金属' },
  mixer: { body: '#b39a5c', kind: '砂' },
  furnace: { body: '#c2452d', kind: '火' },
  frostPillar: { body: '#5aa7d6', kind: '霜' },
  manaFurnace: { body: '#6a46c4', kind: '魔力' },
  still: { body: '#3f9fb0', kind: '魔力' },
  polisher: { body: '#4a7fc0', kind: '魔力' },
  workbench: { body: '#8a6a2a', kind: '魔力' },
};

// 範囲の色（盤面に薄く重ねる）
export const FIELD_TINT = {
  heat: 'rgba(255,110,30,0.24)',
  cold: 'rgba(60,150,255,0.24)',
  mana: 'rgba(140,90,230,0.16)',
};
