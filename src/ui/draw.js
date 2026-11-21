// 盤面を canvas に描く。素材は試し描きの絵（sprites.js）、機械は色の家族。
import { DX, DY, BELT_TICKS, WALL, RUBBLE, SHAKE_RADIUS, canPlace, isHolder } from '../core/sim.js';
import { drawItem, MACHINE_STYLE, FIELD_TINT } from './sprites.js';
import { drawMachineArt, hasArt } from './machines.js';

export const CELL = 40;
const C = CELL;
const LAMP = { working: '#3f8a4d', waiting: '#d9a514', blocked: '#c0392b', 'no-field': '#c0392b', 'no-recipe': '#999', 'no-mana': '#c0392b', 'no-fuel': '#c0392b', shaken: '#c0392b' };
const LABEL = { waiting: '材料待ち', blocked: '出口づまり', 'no-field': '範囲の外', 'no-mana': '魔力の範囲外', 'no-fuel': '魔力炉が空', shaken: '揺れで止まる' };

function lamp(ctx, x, y, color, small = false) {
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.arc(x + (small ? 8 : 11), y + (small ? 8 : 11), small ? 4 : 5, 0, 7); ctx.fill();
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke();
}

// 下をくぐるベルト：入口は正面側、出口は後ろ側が暗い（穴）
function drawUnder(ctx, e, role, ghost) {
  const x = e.x * C, y = e.y * C, cx = x + C / 2, cy = y + C / 2;
  if (!ghost) { ctx.fillStyle = '#857e74'; ctx.fillRect(x + 1, y + 1, C - 2, C - 2); }
  const d = role === 'in' ? e.dir : (e.dir + 2) & 3;
  ctx.fillStyle = ghost ? 'rgba(43,33,24,0.55)' : '#3b352e';
  const t = 15;
  if (d === 0) ctx.fillRect(x + C - t, y + 4, t - 3, C - 8);
  else if (d === 1) ctx.fillRect(x + 4, y + C - t, C - 8, t - 3);
  else if (d === 2) ctx.fillRect(x + 3, y + 4, t - 3, C - 8);
  else ctx.fillRect(x + 4, y + 3, C - 8, t - 3);
  arrow(ctx, cx - DX[d] * 4, cy - DY[d] * 4, e.dir, 8, ghost ? '#2b2118' : '#efe9de');
  if (!ghost && !e.partner) { ctx.strokeStyle = '#c0392b'; ctx.lineWidth = 2; ctx.strokeRect(x + 2, y + 2, C - 4, C - 4); }
}
const RANGE = { heat: ['rgba(255,110,30,0.18)', '#d2571a'], cold: ['rgba(60,150,255,0.18)', '#2f7fd0'], mana: ['rgba(140,90,230,0.12)', '#7a4fd8'], shake: ['rgba(90,80,70,0.10)', '#6b5f52'] };

// 揺れの範囲：斜めの細い線
function hatch(ctx, x, y) {
  ctx.save();
  ctx.beginPath(); ctx.rect(x * C, y * C, C, C); ctx.clip();
  ctx.strokeStyle = 'rgba(95,80,60,0.30)'; ctx.lineWidth = 1.5;
  ctx.beginPath();
  for (let k = -C; k < C; k += 9) { ctx.moveTo(x * C + k, y * C + C); ctx.lineTo(x * C + k + C, y * C); }
  ctx.stroke();
  ctx.restore();
}

function arrow(ctx, cx, cy, dir, size, color) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate((dir * Math.PI) / 2);
  ctx.beginPath();
  ctx.moveTo(-size * 0.5, -size * 0.6);
  ctx.lineTo(size * 0.5, 0);
  ctx.lineTo(-size * 0.5, size * 0.6);
  ctx.strokeStyle = color;
  ctx.lineWidth = 2.5;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.stroke();
  ctx.restore();
}

// noArrow：1×1 の機械は狭いので、前の辺の線だけ
function frontEdge(ctx, e, color, noArrow = false) {
  const x = e.x * C, y = e.y * C, w = e.w * C, h = e.h * C;
  ctx.fillStyle = color;
  if (e.dir === 0) ctx.fillRect(x + w - 6, y + 6, 4, h - 12);
  else if (e.dir === 1) ctx.fillRect(x + 6, y + h - 6, w - 12, 4);
  else if (e.dir === 2) ctx.fillRect(x + 2, y + 6, 4, h - 12);
  else ctx.fillRect(x + 6, y + 2, w - 12, 4);
  if (noArrow) return;
  const cx = x + w / 2 + DX[e.dir] * (w / 2 - 14), cy = y + h / 2 + DY[e.dir] * (h / 2 - 14);
  arrow(ctx, cx, cy, e.dir, 9, color);
}

function drawEnt(ctx, world, e, opts) {
  const { data } = world;
  const x = e.x * C, y = e.y * C, w = e.w * C, h = e.h * C;
  const cx = x + w / 2, cy = y + h / 2;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  if (e.kind === 'belt') {
    ctx.fillStyle = '#9b958c';
    ctx.fillRect(x + 1, y + 1, C - 2, C - 2);
    arrow(ctx, cx, cy, e.dir, 10, '#c9c3b8');
  } else if (e.kind === 'under') {
    drawUnder(ctx, e, e.role, false);
  } else if (e.kind === 'splitter') {
    ctx.fillStyle = '#5f7391';
    ctx.fillRect(x + 1, y + 1, C - 2, C - 2);
    for (const d of [e.dir, (e.dir + 3) & 3, (e.dir + 1) & 3]) arrow(ctx, cx + DX[d] * 11, cy + DY[d] * 11, d, 6, '#dfe7f2');
  } else if (e.kind === 'sorter') {
    // 選り分け：真ん中に選んだ素材、左右に黄色の矢印（選んだ物）、正面に白の矢印（残り）
    ctx.fillStyle = '#6a5a86';
    ctx.fillRect(x + 1, y + 1, C - 2, C - 2);
    arrow(ctx, cx + DX[e.dir] * 13, cy + DY[e.dir] * 13, e.dir, 6, '#efe9f7');
    for (const d of [(e.dir + 3) & 3, (e.dir + 1) & 3]) arrow(ctx, cx + DX[d] * 13, cy + DY[d] * 13, d, 6, '#ffd166');
    if (e.filter) drawItem(ctx, e.filter, cx, cy, 16);
    else { ctx.fillStyle = '#efe9f7'; ctx.font = '600 13px system-ui, sans-serif'; ctx.fillText('？', cx, cy); }
  } else if (e.kind === 'overflow') {
    // あふれ口：ベルトの先に、倉庫へ戻す口（暗い穴）
    ctx.fillStyle = '#9b958c';
    ctx.fillRect(x + 1, y + 1, C - 2, C - 2);
    ctx.fillStyle = '#b5541c';
    ctx.beginPath(); ctx.arc(cx - DX[e.dir] * 9, cy - DY[e.dir] * 9, 6, 0, 7); ctx.fill();
    ctx.fillStyle = '#3b352e';
    ctx.beginPath(); ctx.arc(cx - DX[e.dir] * 9, cy - DY[e.dir] * 9, 3, 0, 7); ctx.fill();
    arrow(ctx, cx + DX[e.dir] * 6, cy + DY[e.dir] * 6, e.dir, 9, '#c9c3b8');
  } else if (e.kind === 'source' || e.kind === 'sink') {
    ctx.fillStyle = e.imported ? '#3d4a63' : '#4a4036';
    ctx.fillRect(x + 1, y + 1, C - 2, C - 2);
    ctx.fillStyle = '#f4efe6';
    ctx.font = '600 11px system-ui, sans-serif';
    if (e.kind === 'source') {
      ctx.fillText(e.imported ? (opts.portLabel?.(e) ?? '受取') : '出す', cx, y + 9);
      if (e.extra) { drawItem(ctx, e.item, cx - 9, cy + 6, 16); drawItem(ctx, e.extra, cx + 4, cy + 6, 16); }
      else drawItem(ctx, e.item, cx - 5, cy + 6, 16);
      if (!e.extra) arrow(ctx, cx + 12, cy + 6, e.dir, 7, '#f4efe6');
      if (e.imported) {
        for (let i = 0; i < e.credit; i++) { ctx.fillStyle = '#ffd166'; ctx.fillRect(x + 4, y + C - 8 - i * 5, 3, 3); }
      }
    } else ctx.fillText('納める', cx, cy);
  } else if (opts.art && hasArt(e.id)) {
    drawArtEnt(ctx, world, e, opts);
  } else {
    const st = MACHINE_STYLE[e.id] || { body: '#999' };
    ctx.fillStyle = st.body;
    ctx.beginPath(); ctx.roundRect(x + 2, y + 2, w - 4, h - 4, 6); ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.fillRect(x + 2, y + h - 8, w - 4, 6);
    ctx.fillStyle = '#fff';
    ctx.font = `600 ${e.w === 1 ? 10 : 13}px system-ui, sans-serif`;
    // 下に札（状態）を書く物は、名前を少し上へ
    const sub = e.w > 1 && (e.kind === 'machine' || (e.kind === 'emitter' && !world.leyline && (e.fuelIn || e.needsMana)));
    // 1×1 の機械：上に状態の丸とできる物の絵、その下に名前、いちばん下に相乗
    const tiny = e.kind === 'machine' && e.w === 1;
    if (tiny) ctx.font = '600 9px system-ui, sans-serif';
    ctx.fillText(data.buildings[e.id].name, cx, tiny ? y + 22 : cy - (sub ? 8 : 0));
    if (e.kind === 'emitter' && (e.fuelIn || e.needsMana) && !world.leyline) {
      // 魔力炉は燃えているか、竜炉などは魔力が届いているか
      const on = e.fuelIn ? e.burning : e.on;
      const idle = e.fuelIn && !on && e.fuel > 0; // 燃料はあるが、範囲に魔力の要る機械がない
      lamp(ctx, x, y, on ? LAMP.working : idle ? LAMP['no-recipe'] : LAMP['no-mana']);
      ctx.fillStyle = '#fff';
      ctx.font = '11px system-ui, sans-serif';
      if (e.fuelIn) {
        ctx.fillText(on ? '燃えている' : idle ? '待っている' : '燃料なし', cx, cy + 9);
        for (let i = 0; i < e.fuel; i++) { ctx.fillStyle = '#ffd166'; ctx.fillRect(x + w - 10, y + 6 + i * 6, 4, 4); }
      } else if (!on) ctx.fillText(e.covered ? LABEL['no-fuel'] : LABEL['no-mana'], cx, cy + 9);
    }
    if (e.kind === 'machine') {
      frontEdge(ctx, e, '#fff3d6', e.w === 1);
      const slow = e.slow && e.status === 'working';
      lamp(ctx, x, y, slow ? LAMP.waiting : LAMP[e.status], e.w === 1);
      const label = slow ? '魔力不足' : LABEL[e.status];
      if (label && e.w > 1) {
        ctx.fillStyle = '#fff';
        ctx.font = '11px system-ui, sans-serif';
        ctx.fillText(label, cx, cy + 9);
      }
      const r = data.recipes[e.recipe];
      const small = e.w === 1;
      // 右上に、できる物の絵（何を作る機械か、ひと目で分かるように）
      if (r) {
        const out = Object.keys(r.out)[0];
        const ox = x + w - (small ? 10 : 14), oy = y + (small ? 10 : 14);
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        ctx.beginPath(); ctx.arc(ox, oy, small ? 8 : 11, 0, 7); ctx.fill();
        drawItem(ctx, out, ox, oy, 16);
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      }
      if (e.syn) { // 相乗：隣の同じ機械の数だけ速い
        ctx.fillStyle = '#ffd166';
        ctx.font = '600 8px system-ui, sans-serif';
        ctx.fillText(`+${e.syn * 25}%`, cx, small ? y + 31 : y + h - 20);
      }
      if (r && e.left > 0 && !small) { // 進み具合（1×1 は狭いので出さない。状態の丸で分かる）
        ctx.fillStyle = 'rgba(0,0,0,0.25)';
        ctx.fillRect(x + 10, y + h - 13, w - 20, 4);
        ctx.fillStyle = '#fff3d6';
        ctx.fillRect(x + 10, y + h - 13, (w - 20) * (1 - e.left / r.ticks), 4);
      }
    }
  }
}

// 絵で描く機械（試し描き2回目）。opts.art：'name'（下に名前の帯）か 'plain'（絵だけ。名前はマウスを載せると出る）
// 止まっている理由は、小さな札で絵の下の方に出す（1×1 は状態の丸だけ）
function drawArtEnt(ctx, world, e, opts) {
  const { data } = world;
  const x = e.x * C, y = e.y * C, w = e.w * C, h = e.h * C, cx = x + w / 2;
  const small = e.w === 1;
  let active = true, tag = null, tagColor = '#c0392b', lampColor = null;
  if (e.kind === 'emitter') {
    if (e.fuelIn && !world.leyline) {
      const idle = !e.burning && e.fuel > 0;
      active = !!e.burning;
      lampColor = e.burning ? LAMP.working : idle ? LAMP['no-recipe'] : LAMP['no-mana'];
      if (!e.burning) { tag = idle ? '待っている' : '燃料なし'; if (idle) tagColor = '#7a6d5e'; }
    } else if (e.needsMana && !world.leyline) {
      active = !!e.on;
      lampColor = e.on ? LAMP.working : LAMP['no-mana'];
      if (!e.on) tag = e.covered ? LABEL['no-fuel'] : LABEL['no-mana'];
    }
  } else {
    const slow = e.slow && e.status === 'working';
    active = e.status === 'working';
    lampColor = slow ? LAMP.waiting : LAMP[e.status];
    tag = slow ? '魔力不足' : LABEL[e.status] ?? null;
    if (slow || e.status === 'waiting') tagColor = '#a87b0c';
  }
  drawMachineArt(ctx, e.id, x, y, w, h, active);
  const band = opts.art === 'name' && !small;
  if (band) {
    ctx.fillStyle = 'rgba(30,22,16,0.78)';
    ctx.fillRect(x + 4, y + h - 16, w - 8, 13);
    ctx.fillStyle = '#fff';
    ctx.font = '600 10px system-ui, sans-serif';
    ctx.fillText(data.buildings[e.id].name, cx, y + h - 9);
  }
  if (e.kind === 'machine') frontEdge(ctx, e, '#fff3d6', small);
  if (lampColor) lamp(ctx, x, y, lampColor, small);
  if (e.fuelIn) for (let i = 0; i < e.fuel; i++) { ctx.fillStyle = '#ffd166'; ctx.fillRect(x + w - 10, y + 6 + i * 6, 4, 4); }
  if (e.kind === 'machine') {
    const r = data.recipes[e.recipe];
    if (r) { // 右上に、できる物の絵
      const ox = x + w - (small ? 10 : 14), oy = y + (small ? 10 : 14);
      ctx.fillStyle = 'rgba(255,255,255,0.88)';
      ctx.beginPath(); ctx.arc(ox, oy, small ? 8 : 11, 0, 7); ctx.fill();
      drawItem(ctx, Object.keys(r.out)[0], ox, oy, 16);
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    }
    if (e.syn) { // 相乗：暗い下地に黄色の字
      const sy = small ? y + h - 13 : y + h - (band ? 24 : 12);
      ctx.fillStyle = 'rgba(30,22,16,0.8)';
      ctx.beginPath(); ctx.roundRect(cx - 12, sy - 5, 24, 10, 3); ctx.fill();
      ctx.fillStyle = '#ffd166';
      ctx.font = '600 8px system-ui, sans-serif';
      ctx.fillText(`+${e.syn * 25}%`, cx, sy);
    }
    if (r && e.left > 0 && !small) {
      const by = band ? y + h - 19 : y + h - 8;
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fillRect(x + 10, by, w - 20, 3);
      ctx.fillStyle = '#fff3d6';
      ctx.fillRect(x + 10, by, (w - 20) * (1 - e.left / r.ticks), 3);
    }
  }
  if (tag && !small) { // 止まっている理由の札
    ctx.font = '600 10px system-ui, sans-serif';
    const tw = ctx.measureText(tag).width + 10, ty = y + h - (band ? 30 : 16);
    ctx.fillStyle = tagColor;
    ctx.beginPath(); ctx.roundRect(cx - tw / 2, ty - 7, tw, 14, 4); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.fillText(tag, cx, ty);
  }
}

function drawItemOnBelt(ctx, h, alpha) {
  const it = h.item;
  const tx = (h.x + 0.5) * C, ty = (h.y + 0.5) * C;
  let fx = tx, fy = ty;
  const from = h.lastFrom;
  if (from) {
    fx = Math.max(from.x, Math.min(from.x + from.w - 1, h.x)) * C + C / 2;
    fy = Math.max(from.y, Math.min(from.y + from.h - 1, h.y)) * C + C / 2;
  }
  const f = Math.min(1, (it.p + (it.p < BELT_TICKS ? alpha : 0)) / BELT_TICKS);
  drawItem(ctx, it.t, fx + (tx - fx) * f, fy + (ty - fy) * f, 32);
}

function drawRubble(ctx, x, y) {
  ctx.fillStyle = '#cfc3ad';
  ctx.fillRect(x * C, y * C, C, C);
  ctx.fillStyle = '#9a8c74';
  for (const [dx, dy, r] of [[11, 13, 6], [26, 11, 5], [19, 26, 7], [31, 28, 4]]) {
    ctx.beginPath(); ctx.arc(x * C + dx, y * C + dy, r, 0, 7); ctx.fill();
  }
  ctx.fillStyle = '#b5a68b';
  ctx.beginPath(); ctx.arc(x * C + 18, y * C + 24, 3, 0, 7); ctx.fill();
}

// opts：tool, dir, hover, alpha, overLimit(id), portLabel(e), showShake（揺れの範囲を見せる）
//       sel（選んでいる範囲 {ax,ay,bx,by}）, paste（持っている図面 {bp, ox, oy, bad, ok}）
export function draw(ctx, world, opts = {}) {
  const W = world.w * C, H = world.h * C;
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = '#f4efe6';
  ctx.fillRect(0, 0, W, H);
  for (let y = 0; y < world.h; y++) for (let x = 0; x < world.w; x++) {
    const i = y * world.w + x;
    if (world.blocked[i] === RUBBLE) { drawRubble(ctx, x, y); continue; }
    if (world.blocked[i] === WALL) {
      ctx.fillStyle = '#b9ae9c';
      ctx.beginPath(); ctx.roundRect(x * C + 4, y * C + 4, C - 8, C - 8, 10); ctx.fill();
      continue;
    }
    const h = world.fields.heat[i], c = world.fields.cold[i];
    if (h && c) { ctx.fillStyle = 'rgba(120,120,120,0.22)'; ctx.fillRect(x * C, y * C, C, C); }
    else if (h) { ctx.fillStyle = FIELD_TINT.heat; ctx.fillRect(x * C, y * C, C, C); }
    else if (c) { ctx.fillStyle = FIELD_TINT.cold; ctx.fillRect(x * C, y * C, C, C); }
    if (opts.showShake && world.fields.shake[i]) hatch(ctx, x, y);
    if (world.fields.mana[i]) {
      ctx.fillStyle = '#8a5ae6';
      for (const [dx, dy] of [[4, 4], [C - 7, 4], [4, C - 7], [C - 7, C - 7]]) ctx.fillRect(x * C + dx, y * C + dy, 3, 3);
    }
  }
  ctx.strokeStyle = 'rgba(90,70,40,0.12)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = 1; x < world.w; x++) { ctx.moveTo(x * C + 0.5, 0); ctx.lineTo(x * C + 0.5, H); }
  for (let y = 1; y < world.h; y++) { ctx.moveTo(0, y * C + 0.5); ctx.lineTo(W, y * C + 0.5); }
  ctx.stroke();

  // 下をくぐるベルトの組（地面の下の線）
  ctx.strokeStyle = 'rgba(59,53,46,0.45)'; ctx.lineWidth = 3; ctx.setLineDash([4, 5]);
  for (const e of world.ents) {
    if (e.kind !== 'under' || e.role !== 'in' || !e.partner) continue;
    ctx.beginPath(); ctx.moveTo((e.x + 0.5) * C, (e.y + 0.5) * C); ctx.lineTo((e.partner.x + 0.5) * C, (e.partner.y + 0.5) * C); ctx.stroke();
  }
  ctx.setLineDash([]);

  for (const e of world.ents) drawEnt(ctx, world, e, opts);
  for (const e of world.ents) if (isHolder(e) && e.item) drawItemOnBelt(ctx, e, opts.alpha || 0);

  // 選んでいる範囲
  if (opts.sel) {
    const { ax, ay, bx, by } = opts.sel;
    ctx.fillStyle = 'rgba(60,120,220,0.14)';
    ctx.fillRect(ax * C, ay * C, (bx - ax + 1) * C, (by - ay + 1) * C);
    ctx.strokeStyle = '#2f6fd0'; ctx.lineWidth = 2; ctx.setLineDash([6, 4]);
    ctx.strokeRect(ax * C + 1, ay * C + 1, (bx - ax + 1) * C - 2, (by - ay + 1) * C - 2);
    ctx.setLineDash([]);
  }
  // 持っている図面：薄く描き、重なる物は赤
  if (opts.paste) {
    const { bp, ox, oy, bad, ok } = opts.paste;
    ctx.save();
    ctx.globalAlpha = 0.6;
    for (const g of bp.ents) {
      const b = world.data.buildings[g.id];
      drawEnt(ctx, world, { ...g, kind: b.kind, x: ox + g.x, y: oy + g.y, w: b.w, h: b.h, item: null, partner: true, status: 'no-recipe' }, opts);
    }
    ctx.restore();
    bp.ents.forEach((g, i) => {
      if (!bad.has(i)) return;
      const b = world.data.buildings[g.id];
      ctx.fillStyle = 'rgba(192,57,43,0.42)';
      ctx.fillRect((ox + g.x) * C, (oy + g.y) * C, b.w * C, b.h * C);
    });
    ctx.strokeStyle = ok ? '#3f8a4d' : '#c0392b'; ctx.lineWidth = 2; ctx.setLineDash([6, 4]);
    ctx.strokeRect(ox * C + 1, oy * C + 1, bp.w * C - 2, bp.h * C - 2);
    ctx.setLineDash([]);
  }

  if (opts.tool && opts.hover) {
    const b = world.data.buildings[opts.tool];
    const { x, y } = opts.hover;
    const ok = canPlace(world, opts.tool, x, y).ok && !opts.overLimit?.(opts.tool);
    if (b.kind === 'emitter' || b.shake) {
      const r = b.shake ? SHAKE_RADIUS : b.radius;
      const [fill, line] = RANGE[b.shake ? 'shake' : b.field];
      ctx.fillStyle = fill;
      ctx.fillRect((x - r) * C, (y - r) * C, (b.w + 2 * r) * C, (b.h + 2 * r) * C);
      ctx.strokeStyle = line;
      ctx.setLineDash([6, 4]);
      ctx.strokeRect((x - r) * C + 1, (y - r) * C + 1, (b.w + 2 * r) * C - 2, (b.h + 2 * r) * C - 2);
      ctx.setLineDash([]);
    }
    if (opts.art && hasArt(opts.tool)) { // 置く前の影も、薄い絵で
      ctx.save(); ctx.globalAlpha = 0.55;
      drawMachineArt(ctx, opts.tool, x * C, y * C, b.w * C, b.h * C, true);
      ctx.restore();
    }
    ctx.fillStyle = ok ? 'rgba(63,138,77,0.3)' : 'rgba(192,57,43,0.35)';
    ctx.fillRect(x * C, y * C, b.w * C, b.h * C);
    ctx.strokeStyle = ok ? '#3f8a4d' : '#c0392b';
    ctx.lineWidth = 2;
    ctx.strokeRect(x * C + 1, y * C + 1, b.w * C - 2, b.h * C - 2);
    const ghost = { x, y, w: b.w, h: b.h, dir: opts.dir };
    if (b.kind === 'under') {
      drawUnder(ctx, ghost, opts.underRole || 'in', true);
      ctx.fillStyle = '#2b2118'; ctx.font = '600 11px system-ui, sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(opts.underRole === 'out' ? '出口' : '入口', x * C + C / 2, y * C - 7);
    } else if (b.kind === 'machine') frontEdge(ctx, ghost, '#2b2118');
    else if (b.kind === 'belt' || b.kind === 'splitter' || b.kind === 'sorter' || b.kind === 'overflow') arrow(ctx, x * C + C / 2, y * C + C / 2, opts.dir, 10, '#2b2118');
  }
}
