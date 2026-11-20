// 盤面を canvas に描く。素材は試し描きの絵（sprites.js）、機械は色の家族。
import { DX, DY, BELT_TICKS, WALL, RUBBLE, canPlace, fieldActive } from '../core/sim.js';
import { drawItem, MACHINE_STYLE, FIELD_TINT } from './sprites.js';

export const CELL = 40;
const C = CELL;
const LAMP = { working: '#3f8a4d', waiting: '#d9a514', blocked: '#c0392b', 'no-field': '#c0392b', 'no-recipe': '#999' };
const LABEL = { waiting: '材料待ち', blocked: '出口づまり', 'no-field': '範囲の外' };
const RANGE = { heat: ['rgba(255,110,30,0.18)', '#d2571a'], cold: ['rgba(60,150,255,0.18)', '#2f7fd0'], mana: ['rgba(140,90,230,0.12)', '#7a4fd8'] };

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

function frontEdge(ctx, e, color) {
  const x = e.x * C, y = e.y * C, w = e.w * C, h = e.h * C;
  ctx.fillStyle = color;
  if (e.dir === 0) ctx.fillRect(x + w - 6, y + 6, 4, h - 12);
  else if (e.dir === 1) ctx.fillRect(x + 6, y + h - 6, w - 12, 4);
  else if (e.dir === 2) ctx.fillRect(x + 2, y + 6, 4, h - 12);
  else ctx.fillRect(x + 6, y + 2, w - 12, 4);
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
  } else if (e.kind === 'splitter') {
    ctx.fillStyle = '#5f7391';
    ctx.fillRect(x + 1, y + 1, C - 2, C - 2);
    for (const d of [e.dir, (e.dir + 3) & 3, (e.dir + 1) & 3]) arrow(ctx, cx + DX[d] * 11, cy + DY[d] * 11, d, 6, '#dfe7f2');
  } else if (e.kind === 'source' || e.kind === 'sink') {
    ctx.fillStyle = e.imported ? '#3d4a63' : '#4a4036';
    ctx.fillRect(x + 1, y + 1, C - 2, C - 2);
    ctx.fillStyle = '#f4efe6';
    ctx.font = '600 11px system-ui, sans-serif';
    if (e.kind === 'source') {
      ctx.fillText(e.imported ? (opts.portLabel?.(e) ?? '受取') : '出す', cx, y + 9);
      drawItem(ctx, e.item, cx - 5, cy + 6, 16);
      arrow(ctx, cx + 12, cy + 6, e.dir, 7, '#f4efe6');
      if (e.imported) {
        for (let i = 0; i < e.credit; i++) { ctx.fillStyle = '#ffd166'; ctx.fillRect(x + 4, y + C - 8 - i * 5, 3, 3); }
      }
    } else ctx.fillText('納める', cx, cy);
  } else {
    const st = MACHINE_STYLE[e.id] || { body: '#999' };
    ctx.fillStyle = st.body;
    ctx.beginPath(); ctx.roundRect(x + 2, y + 2, w - 4, h - 4, 6); ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.fillRect(x + 2, y + h - 8, w - 4, 6);
    ctx.fillStyle = '#fff';
    ctx.font = `600 ${e.w === 1 ? 10 : 13}px system-ui, sans-serif`;
    ctx.fillText(data.buildings[e.id].name, cx, cy - (e.kind === 'machine' && e.w > 1 ? 8 : 0));
    if (e.kind === 'machine') {
      frontEdge(ctx, e, '#fff3d6');
      ctx.fillStyle = LAMP[e.status];
      ctx.beginPath(); ctx.arc(x + 11, y + 11, 5, 0, 7); ctx.fill();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke();
      if (LABEL[e.status] && e.w > 1) {
        ctx.fillStyle = '#fff';
        ctx.font = '11px system-ui, sans-serif';
        ctx.fillText(LABEL[e.status], cx, cy + 9);
      }
      const r = data.recipes[e.recipe];
      if (r && e.left > 0) {
        ctx.fillStyle = 'rgba(0,0,0,0.25)';
        ctx.fillRect(x + 10, y + h - 13, w - 20, 4);
        ctx.fillStyle = '#fff3d6';
        ctx.fillRect(x + 10, y + h - 13, (w - 20) * (1 - e.left / r.ticks), 4);
      }
    }
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

function drawRubble(ctx, x, y, hot) {
  ctx.fillStyle = hot ? '#d9c9a8' : '#cfc3ad';
  ctx.fillRect(x * C, y * C, C, C);
  ctx.fillStyle = '#9a8c74';
  for (const [dx, dy, r] of [[11, 13, 6], [26, 11, 5], [19, 26, 7], [31, 28, 4]]) {
    ctx.beginPath(); ctx.arc(x * C + dx, y * C + dy, r, 0, 7); ctx.fill();
  }
  ctx.fillStyle = '#b5a68b';
  ctx.beginPath(); ctx.arc(x * C + 18, y * C + 24, 3, 0, 7); ctx.fill();
}

// opts：tool, dir, hover, alpha, overLimit(id), cleanupTiles（片づけ中の瓦礫のマス）, portLabel(e)
export function draw(ctx, world, opts = {}) {
  const W = world.w * C, H = world.h * C;
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = '#f4efe6';
  ctx.fillRect(0, 0, W, H);
  const hot = new Set((opts.cleanupTiles || []).map(([x, y]) => y * world.w + x));
  for (let y = 0; y < world.h; y++) for (let x = 0; x < world.w; x++) {
    const i = y * world.w + x;
    if (world.blocked[i] === RUBBLE) { drawRubble(ctx, x, y, hot.has(i)); continue; }
    if (world.blocked[i] === WALL) {
      ctx.fillStyle = '#b9ae9c';
      ctx.beginPath(); ctx.roundRect(x * C + 4, y * C + 4, C - 8, C - 8, 10); ctx.fill();
      continue;
    }
    const h = world.fields.heat[i], c = world.fields.cold[i];
    if (h && c) { ctx.fillStyle = 'rgba(120,120,120,0.22)'; ctx.fillRect(x * C, y * C, C, C); }
    else if (h) { ctx.fillStyle = FIELD_TINT.heat; ctx.fillRect(x * C, y * C, C, C); }
    else if (c) { ctx.fillStyle = FIELD_TINT.cold; ctx.fillRect(x * C, y * C, C, C); }
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
  if (hot.size) {
    ctx.strokeStyle = '#b5541c'; ctx.lineWidth = 2; ctx.setLineDash([6, 4]);
    for (const [x, y] of opts.cleanupTiles) ctx.strokeRect(x * C + 2, y * C + 2, C - 4, C - 4);
    ctx.setLineDash([]);
  }

  for (const e of world.ents) drawEnt(ctx, world, e, opts);
  for (const e of world.ents) if ((e.kind === 'belt' || e.kind === 'splitter') && e.item) drawItemOnBelt(ctx, e, opts.alpha || 0);

  if (opts.tool && opts.hover) {
    const b = world.data.buildings[opts.tool];
    const { x, y } = opts.hover;
    const ok = canPlace(world, opts.tool, x, y).ok && !opts.overLimit?.(opts.tool);
    if (b.kind === 'emitter') {
      const r = b.radius;
      const [fill, line] = RANGE[b.field];
      ctx.fillStyle = fill;
      ctx.fillRect((x - r) * C, (y - r) * C, (b.w + 2 * r) * C, (b.h + 2 * r) * C);
      ctx.strokeStyle = line;
      ctx.setLineDash([6, 4]);
      ctx.strokeRect((x - r) * C + 1, (y - r) * C + 1, (b.w + 2 * r) * C - 2, (b.h + 2 * r) * C - 2);
      ctx.setLineDash([]);
    }
    ctx.fillStyle = ok ? 'rgba(63,138,77,0.35)' : 'rgba(192,57,43,0.35)';
    ctx.fillRect(x * C, y * C, b.w * C, b.h * C);
    ctx.strokeStyle = ok ? '#3f8a4d' : '#c0392b';
    ctx.lineWidth = 2;
    ctx.strokeRect(x * C + 1, y * C + 1, b.w * C - 2, b.h * C - 2);
    const ghost = { x, y, w: b.w, h: b.h, dir: opts.dir };
    if (b.kind === 'machine') frontEdge(ctx, ghost, '#2b2118');
    else if (b.kind === 'belt' || b.kind === 'splitter') arrow(ctx, x * C + C / 2, y * C + C / 2, opts.dir, 10, '#2b2118');
  }
}
